import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

/**
 * POST /api/shifts/[id]/end
 * End a shift
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    // Check if shift exists and get current status within tenant
    const shiftResult = await query(
      `SELECT id, status, employee_id, start_time, end_time
       FROM shifts
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantContext.tenant_id]
    )

    if (shiftResult.rows.length === 0) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    const shift = shiftResult.rows[0]

    // Check if user is the employee assigned to this shift
    const employeeResult = await query(
      `SELECT id FROM employees WHERE id = $1 AND tenant_id = $2`,
      [user.id, tenantContext.tenant_id]
    )

    if (employeeResult.rows.length === 0 || employeeResult.rows[0].id !== shift.employee_id) {
      return NextResponse.json({ error: 'You can only end your own shifts' }, { status: 403 })
    }

    // Validate shift status
    if (shift.status !== 'in-progress') {
      return NextResponse.json({ error: `Cannot end shift with status: ${shift.status}` }, { status: 400 })
    }

    // End the shift
    const updatedShiftResult = await query(
      `UPDATE shifts
       SET status = 'completed', end_time = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [new Date().toISOString(), id, tenantContext.tenant_id]
    )

    return NextResponse.json({ shift: updatedShiftResult.rows[0], message: 'Shift ended successfully' })
  } catch (error) {
    console.error('Error in POST /api/shifts/[id]/end:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 