import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

/**
 * DELETE /api/scheduling/assignments/[id]
 * Delete a specific shift assignment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    if (!id) {
      return NextResponse.json({ success: false, error: 'Assignment ID is required' }, { status: 400 })
    }

    // Check if assignment exists and belongs to tenant
    const existingAssignment = await query(
      'SELECT id, rota_id FROM shift_assignments WHERE id = $1 AND tenant_id = $2',
      [id, tenantContext.tenant_id]
    )

    if (existingAssignment.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 })
    }

    const assignment = existingAssignment.rows[0]

    // Check if the assignment is in a published rota
    if (assignment.rota_id) {
      const rotaResult = await query(
        'SELECT status FROM rotas WHERE id = $1 AND tenant_id = $2',
        [assignment.rota_id, tenantContext.tenant_id]
      )
      
      if (rotaResult.rows.length > 0 && rotaResult.rows[0].status === 'published') {
        return NextResponse.json({ 
          success: false, 
          error: 'Cannot delete assignments from published rotas' 
        }, { status: 400 })
      }
    }

    // Delete the assignment
    await query(
      'DELETE FROM shift_assignments WHERE id = $1 AND tenant_id = $2',
      [id, tenantContext.tenant_id]
    )

    return NextResponse.json({ 
      success: true, 
      message: 'Shift assignment deleted successfully' 
    })

  } catch (error) {
    console.error('Error deleting shift assignment:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete shift assignment' 
    }, { status: 500 })
  }
}

/**
 * GET /api/scheduling/assignments/[id]
 * Get a specific shift assignment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 })
    }

    // Get the assignment with related data
    const result = await query(
      `SELECT 
        sa.id, sa.employee_id, sa.template_id, sa.date, sa.start_time, sa.end_time,
        sa.status, sa.notes, sa.rota_id, sa.is_published, sa.created_at, sa.updated_at,
        e.first_name, e.last_name, e.employee_code, e.department,
        st.name as shift_name, st.start_time as template_start_time, st.end_time as template_end_time, st.color,
        r.name as rota_name, r.status as rota_status
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id AND e.tenant_id = sa.tenant_id
      LEFT JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id
      LEFT JOIN rotas r ON sa.rota_id = r.id
      WHERE sa.id = $1 AND sa.tenant_id = $2`,
      [id, tenantContext.tenant_id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error getting shift assignment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/scheduling/assignments/[id]
 * Update a specific shift assignment
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 })
    }

    // Check if assignment exists and belongs to tenant
    const existingAssignment = await query(
      'SELECT id, rota_id FROM shift_assignments WHERE id = $1 AND tenant_id = $2',
      [id, tenantContext.tenant_id]
    )

    if (existingAssignment.rows.length === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const assignment = existingAssignment.rows[0]

    // Check if the assignment is in a published rota
    if (assignment.rota_id) {
      const rotaResult = await query(
        'SELECT status FROM rotas WHERE id = $1 AND tenant_id = $2',
        [assignment.rota_id, tenantContext.tenant_id]
      )
      
      if (rotaResult.rows.length > 0 && rotaResult.rows[0].status === 'published') {
        return NextResponse.json({ 
          error: 'Cannot modify assignments in published rotas' 
        }, { status: 400 })
      }
    }

    // Build update query dynamically based on provided fields
    const updateFields: string[] = []
    const updateValues: any[] = []
    let paramIndex = 1

    const allowedFields = [
      'template_id', 'start_time', 'end_time', 'status', 'notes', 
      'override_name', 'override_start_time', 'override_end_time', 'override_color'
    ]

    for (const field of allowedFields) {
      if (field in body) {
        updateFields.push(`${field} = $${paramIndex}`)
        updateValues.push(body[field])
        paramIndex++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updateFields.push(`updated_at = NOW()`)
    updateValues.push(id, tenantContext.tenant_id)

    const updateQuery = `
      UPDATE shift_assignments 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `

    const result = await query(updateQuery, updateValues)

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Assignment updated successfully'
    })

  } catch (error) {
    console.error('Error updating shift assignment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
