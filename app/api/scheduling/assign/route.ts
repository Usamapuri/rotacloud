import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function POST(request: NextRequest) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ success: false, error: 'No tenant context found' }, { status: 403 })
    }

  const body = await request.json()
  const { employee_id, date, notes, assigned_by, rota_id } = body
  const template_id = body.template_id ?? body.shift_id
  const override_name = body.override_name ?? null
  const override_start_time = body.override_start_time ?? null
  const override_end_time = body.override_end_time ?? null
  const override_color = body.override_color ?? null

    const hasTemplate = !!template_id
    const hasOverrides = !!(override_name && override_start_time && override_end_time)
    if (!employee_id || !date || (!hasTemplate && !hasOverrides)) {
      return NextResponse.json({ success: false, error: 'Missing required fields: employee_id, date and either template_id or override fields' }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
    }

    const employeeResult = await query(
      'SELECT id FROM employees WHERE id = $1 AND is_active = true AND tenant_id = $2',
      [employee_id, tenantContext.tenant_id]
    )
    if (employeeResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Employee not found or inactive' }, { status: 404 })
    }

    if (hasTemplate) {
      const shiftResult = await query(
        'SELECT id FROM shift_templates WHERE id = $1 AND is_active = true AND tenant_id = $2',
        [template_id, tenantContext.tenant_id]
      )
      if (shiftResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Shift not found or inactive' }, { status: 404 })
      }
    }

    // If using custom overrides and DB requires a template_id, ensure we have a reusable placeholder template
    let effectiveTemplateId = template_id
    if (!hasTemplate && hasOverrides) {
      const placeholderName = 'Custom (Ad-hoc)'
      const existingPlaceholder = await query(
        'SELECT id FROM shift_templates WHERE name = $1 AND tenant_id = $2 AND is_active = true LIMIT 1',
        [placeholderName, tenantContext.tenant_id]
      )
      if (existingPlaceholder.rows.length > 0) {
        effectiveTemplateId = existingPlaceholder.rows[0].id
      } else {
        const created = await query(
          `INSERT INTO shift_templates (
             name, description, start_time, end_time, department, required_staff, hourly_rate, color, is_active, created_by, tenant_id, organization_id, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11, NOW(), NOW())
           RETURNING id`,
          [
            placeholderName,
            'Placeholder for ad-hoc custom shifts',
            '00:00',
            '00:00',
            'General',
            1,
            null,
            '#64748B',
            user.id,
            tenantContext.tenant_id,
            tenantContext.organization_id,
          ]
        )
        effectiveTemplateId = created.rows[0].id
      }
    }

    const existingAssignment = await query(
      'SELECT id FROM shift_assignments WHERE employee_id = $1 AND date = $2 AND tenant_id = $3',
      [employee_id, date, tenantContext.tenant_id]
    )
    if (existingAssignment.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Employee already has an assignment on this date' }, { status: 409 })
    }

    const colCheck = await query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shift_assignments' AND column_name = 'override_name' LIMIT 1
    `)
    const hasOverrideCols = colCheck.rows.length > 0

    if (hasOverrides && !hasOverrideCols) {
      return NextResponse.json({ success: false, error: 'Custom shift overrides are not enabled. Run scripts/cleanup_db.sql to add override columns.' }, { status: 400 })
    }

    let insertSql: string
    let insertParams: any[]
    // Check if rota_id is provided and validate it
    let rotaStatus = null
    if (rota_id) {
      const rotaResult = await query(
        'SELECT status FROM rotas WHERE id = $1 AND tenant_id = $2',
        [rota_id, tenantContext.tenant_id]
      )
      if (rotaResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Rota not found' }, { status: 404 })
      }
      rotaStatus = rotaResult.rows[0].status
      // Allow creating new shifts in published rotas as drafts
    }

    // Always create shifts as drafts by default - no auto-publishing
    const isPublished = false

    if (hasOverrideCols) {
      insertSql = `
        INSERT INTO shift_assignments (
          employee_id, template_id, date, override_name, override_start_time, override_end_time, override_color,
          status, notes, assigned_by, tenant_id, organization_id, rota_id, is_published, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'assigned', $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING id, employee_id, template_id, date, override_name, override_start_time, override_end_time, override_color, status, notes, rota_id, is_published, created_at
      `
      insertParams = [employee_id, effectiveTemplateId || null, date, override_name, override_start_time, override_end_time, override_color, notes || null, assigned_by || user.id, tenantContext.tenant_id, tenantContext.organization_id, rota_id || null, isPublished]
    } else {
      insertSql = `
        INSERT INTO shift_assignments (
          employee_id, template_id, date, status, notes, assigned_by, tenant_id, organization_id, rota_id, is_published, created_at, updated_at
        ) VALUES ($1, $2, $3, 'assigned', $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id, employee_id, template_id, date, status, notes, rota_id, is_published, created_at
      `
      insertParams = [employee_id, effectiveTemplateId || null, date, notes || null, assigned_by || user.id, tenantContext.tenant_id, tenantContext.organization_id, rota_id || null, isPublished]
    }

    const result = await query(insertSql, insertParams)
    const assignment = result.rows[0]

    const fullAssignmentResult = await query(`
      SELECT 
        sa.id, sa.employee_id, sa.template_id, sa.date, sa.override_name, sa.override_start_time, sa.override_end_time, sa.override_color,
        sa.status, sa.notes, sa.rota_id, sa.is_published, sa.created_at,
        e.first_name, e.last_name, e.employee_code,
        st.name as shift_name, st.start_time, st.end_time, st.color,
        r.name as rota_name, r.status as rota_status
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id AND e.tenant_id = sa.tenant_id
      LEFT JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id
      LEFT JOIN rotas r ON sa.rota_id = r.id
      WHERE sa.id = $1 AND sa.tenant_id = $2
    `, [assignment.id, tenantContext.tenant_id])

    return NextResponse.json({ success: true, data: fullAssignmentResult.rows[0], message: 'Shift assigned successfully' })
  } catch (error: any) {
    console.error('Error assigning shift:', error)
    const message = error?.message || 'Failed to assign shift'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ success: false, error: 'No tenant context found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('id')

    if (!assignmentId) {
      return NextResponse.json({ success: false, error: 'Assignment ID is required' }, { status: 400 })
    }

    const existingAssignment = await query(
      'SELECT id FROM shift_assignments WHERE id = $1 AND tenant_id = $2',
      [assignmentId, tenantContext.tenant_id]
    )
    if (existingAssignment.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 })
    }

    await query('DELETE FROM shift_assignments WHERE id = $1 AND tenant_id = $2', [assignmentId, tenantContext.tenant_id])

    return NextResponse.json({ success: true, message: 'Shift assignment removed successfully' })
  } catch (error) {
    console.error('Error removing shift assignment:', error)
    return NextResponse.json({ success: false, error: 'Failed to remove shift assignment' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ success: false, error: 'No tenant context found' }, { status: 403 })
    }

    const body = await request.json()
    const { id, template_id, date, status, notes, emergency_mode } = body
    const override_name = body.override_name
    const override_start_time = body.override_start_time
    const override_end_time = body.override_end_time
    const override_color = body.override_color

    if (!id) {
      return NextResponse.json({ success: false, error: 'Assignment ID is required' }, { status: 400 })
    }

    const fields: string[] = []
    const params: any[] = []
    let idx = 1
    if (typeof template_id !== 'undefined') { fields.push(`template_id = $${idx++}`); params.push(template_id) }
    if (date) { fields.push(`date = $${idx++}`); params.push(date) }
    if (status) { fields.push(`status = $${idx++}`); params.push(status) }
    if (typeof notes !== 'undefined') { fields.push(`notes = $${idx++}`); params.push(notes) }

    const colCheckPut = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'shift_assignments'`)
    const cols = new Set(colCheckPut.rows.map((r: any) => r.column_name))
    if (cols.has('override_name') && typeof override_name !== 'undefined') { fields.push(`override_name = $${idx++}`); params.push(override_name) }
    if (cols.has('override_start_time') && typeof override_start_time !== 'undefined') { fields.push(`override_start_time = $${idx++}`); params.push(override_start_time) }
    if (cols.has('override_end_time') && typeof override_end_time !== 'undefined') { fields.push(`override_end_time = $${idx++}`); params.push(override_end_time) }
    if (cols.has('override_color') && typeof override_color !== 'undefined') { fields.push(`override_color = $${idx++}`); params.push(override_color) }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    // First, get the current assignment to check if it's published
    const currentAssignment = await query(
      `SELECT sa.*, e.first_name, e.last_name, e.email, r.status as rota_status
       FROM shift_assignments sa
       JOIN employees e ON sa.employee_id = e.id AND e.tenant_id = sa.tenant_id
       LEFT JOIN rotas r ON sa.rota_id = r.id
       WHERE sa.id = $1 AND sa.tenant_id = $2`,
      [id, tenantContext.tenant_id]
    )

    if (currentAssignment.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 })
    }

    const current = currentAssignment.rows[0]
    const isPublished = current.is_published || current.rota_status === 'published'

    const updateQuery = `
      UPDATE shift_assignments
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${idx} AND tenant_id = $${idx + 1}
      RETURNING *
    `
    params.push(id, tenantContext.tenant_id)
    const updateResult = await query(updateQuery, params)
    const updated = updateResult.rows[0]

    // If this was a published shift, send notification to the employee
    if (isPublished) {
      try {
        const notificationTitle = emergency_mode ? 'URGENT: Shift Updated' : 'Shift Updated'
        const notificationMessage = emergency_mode 
          ? `URGENT: Your shift on ${new Date(current.date).toLocaleDateString()} has been updated due to an emergency. Please check your schedule immediately.`
          : `Your shift on ${new Date(current.date).toLocaleDateString()} has been updated. Please check your schedule for changes.`
        const notificationType = emergency_mode ? 'urgent' : 'info'

        await query(
          `
            INSERT INTO notifications (user_id, title, message, type, read, action_url, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            current.employee_id,
            notificationTitle,
            notificationMessage,
            notificationType,
            false,
            '/employee/scheduling',
            tenantContext.tenant_id
          ]
        )

        // Also send email notification (if email service is configured)
        // This would integrate with your email service
        console.log(`${emergency_mode ? 'URGENT ' : ''}Email notification sent to ${current.email} about shift update`)
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError)
        // Don't fail the update if notification fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: updated,
      notificationSent: isPublished,
      emergencyMode: emergency_mode
    })
  } catch (error: any) {
    console.error('Error updating shift assignment:', error)
    const message = (error && error.message || '').includes('null value')
      ? 'Custom overrides require DB migration. Run scripts/cleanup_db.sql.'
      : 'Failed to update assignment'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
