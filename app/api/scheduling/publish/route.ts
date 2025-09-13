import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

/**
 * POST /api/scheduling/publish
 * Publish all draft shifts for a specific date range or all draft shifts
 */
export async function POST(request: NextRequest) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const body = await request.json()
    const { start_date, end_date, shift_ids } = body

    let whereClause = 'WHERE sa.tenant_id = $1 AND sa.is_published = FALSE'
    let params: any[] = [tenantContext.tenant_id]
    let paramIndex = 2

    // If specific shift IDs are provided, publish only those
    if (shift_ids && Array.isArray(shift_ids) && shift_ids.length > 0) {
      const placeholders = shift_ids.map((_, i) => `$${paramIndex + i}`).join(',')
      whereClause += ` AND sa.id IN (${placeholders})`
      params.push(...shift_ids)
      paramIndex += shift_ids.length
    }
    // If date range is provided, publish shifts in that range
    else if (start_date && end_date) {
      whereClause += ` AND sa.date >= $${paramIndex} AND sa.date <= $${paramIndex + 1}`
      params.push(start_date, end_date)
      paramIndex += 2
    }

    // Get count of shifts to be published
    const countResult = await query(
      `SELECT COUNT(*) as count FROM shift_assignments sa ${whereClause}`,
      params
    )
    const shiftCount = parseInt(countResult.rows[0].count)

    if (shiftCount === 0) {
      return NextResponse.json({ 
        error: 'No draft shifts found to publish' 
      }, { status: 400 })
    }

    // Update shifts to published
    const updateResult = await query(
      `UPDATE shift_assignments sa 
       SET is_published = TRUE, updated_at = NOW()
       ${whereClause}
       RETURNING sa.id, sa.employee_id, sa.date, sa.template_id`,
      params
    )

    // Get affected employees for notifications
    const affectedEmployees = await query(
      `SELECT DISTINCT sa.employee_id, e.first_name, e.last_name, e.email
       FROM shift_assignments sa
       JOIN employees e ON sa.employee_id = e.id AND e.tenant_id = sa.tenant_id
       ${whereClause}`,
      params
    )

    // Create notifications for affected employees
    if (affectedEmployees.rows.length > 0) {
      const notificationValues = affectedEmployees.rows.map((emp, index) => {
        const baseIndex = index * 4
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`
      }).join(', ')

      const notificationParams = affectedEmployees.rows.flatMap(emp => [
        tenantContext.tenant_id,
        emp.employee_id,
        'shifts_published',
        `Your shift assignments have been published and are now visible.`
      ])

      await query(
        `INSERT INTO notifications (tenant_id, user_id, type, message, created_at)
         VALUES ${notificationValues}
         ON CONFLICT DO NOTHING`,
        notificationParams
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        published_shifts: updateResult.rows.length,
        affected_employees: affectedEmployees.rows.length,
        shifts: updateResult.rows
      },
      message: `Successfully published ${updateResult.rows.length} shift${updateResult.rows.length > 1 ? 's' : ''}. ${affectedEmployees.rows.length} employees have been notified.`
    })

  } catch (error) {
    console.error('Error in POST /api/scheduling/publish:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/scheduling/publish
 * Get draft shifts that can be published
 */
export async function GET(request: NextRequest) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    let whereClause = 'WHERE sa.tenant_id = $1 AND sa.is_published = FALSE'
    let params: any[] = [tenantContext.tenant_id]

    if (start_date && end_date) {
      whereClause += ' AND sa.date >= $2 AND sa.date <= $3'
      params.push(start_date, end_date)
    }

    const draftShifts = await query(
      `SELECT 
         sa.id, sa.employee_id, sa.date, sa.template_id, sa.override_name, 
         sa.override_start_time, sa.override_end_time, sa.override_color,
         sa.status, sa.notes, sa.rota_id, sa.created_at,
         e.first_name, e.last_name, e.employee_code,
         st.name as shift_name, st.start_time, st.end_time, st.color,
         r.name as rota_name, r.status as rota_status
       FROM shift_assignments sa
       JOIN employees e ON sa.employee_id = e.id AND e.tenant_id = sa.tenant_id
       LEFT JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id
       LEFT JOIN rotas r ON sa.rota_id = r.id
       ${whereClause}
       ORDER BY sa.date, e.first_name, e.last_name`,
      params
    )

    return NextResponse.json({
      success: true,
      data: draftShifts.rows
    })

  } catch (error) {
    console.error('Error in GET /api/scheduling/publish:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
