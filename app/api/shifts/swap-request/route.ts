import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

const authMiddleware = createApiAuthMiddleware()

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authMiddleware(request)
    if (!('isAuthenticated' in authResult) || !authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantContext = await getTenantContext(authResult.user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const { target_employee_id, reason, swap_date } = await request.json()
    const requester_id = authResult.user.id

    if (!target_employee_id || !reason || !swap_date) {
      return NextResponse.json(
        { error: 'Target employee ID, reason, and swap date are required' },
        { status: 400 }
      )
    }

    // Get the requester's shift for the swap date within tenant
    const requesterShiftResult = await query(`
      SELECT sa.id as assignment_id, sa.template_id, st.name as shift_name
      FROM shift_assignments sa
      JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id
      WHERE sa.employee_id = $1 AND sa.date = $2 AND sa.tenant_id = $3
    `, [requester_id, swap_date, tenantContext.tenant_id])

    if (requesterShiftResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'You do not have a shift assigned on the requested date' },
        { status: 400 }
      )
    }

    const requesterShift = requesterShiftResult.rows[0]

    // Get the target employee's shift for the swap date within tenant
    const targetShiftResult = await query(`
      SELECT sa.id as assignment_id, sa.template_id, st.name as shift_name
      FROM shift_assignments sa
      JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id
      WHERE sa.employee_id = $1 AND sa.date = $2 AND sa.tenant_id = $3
    `, [target_employee_id, swap_date, tenantContext.tenant_id])

    if (targetShiftResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Target employee does not have a shift assigned on the requested date' },
        { status: 400 }
      )
    }

    const targetShift = targetShiftResult.rows[0]

    // Check if a swap request already exists within tenant
    const existingSwapResult = await query(`
      SELECT id FROM shift_swaps 
      WHERE requester_id = $1 AND target_id = $2 AND original_shift_id = $3 AND requested_shift_id = $4
      AND status = 'pending' AND tenant_id = $5
    `, [requester_id, target_employee_id, requesterShift.assignment_id, targetShift.assignment_id, tenantContext.tenant_id])

    if (existingSwapResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'A swap request already exists for these shifts' },
        { status: 400 }
      )
    }

    // Create the swap request with tenant scope
    const swapResult = await query(`
      INSERT INTO shift_swaps (
        requester_id,
        target_id,
        original_shift_id,
        requested_shift_id,
        status,
        reason,
        tenant_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW(), NOW())
      RETURNING *
    `, [requester_id, target_employee_id, requesterShift.assignment_id, targetShift.assignment_id, reason, tenantContext.tenant_id])

    const swapRequest = swapResult.rows[0]

    // Get employee names for notifications
    const requesterResult = await query(`
      SELECT first_name, last_name FROM employees WHERE id = $1 AND tenant_id = $2
    `, [requester_id, tenantContext.tenant_id])

    const targetResult = await query(`
      SELECT first_name, last_name FROM employees WHERE id = $1 AND tenant_id = $2
    `, [target_employee_id, tenantContext.tenant_id])

    const requester = requesterResult.rows[0]
    const target = targetResult.rows[0]

    // Create notifications for all relevant parties within tenant
    const notificationRecipients = [
      { user_id: requester_id, title: 'Shift Swap Request Sent', message: `Your swap request with ${target.first_name} ${target.last_name} for ${swap_date} is pending approval`, type: 'info' },
      { user_id: target_employee_id, title: 'Shift Swap Request Received', message: `${requester.first_name} ${requester.last_name} wants to swap shifts with you on ${swap_date}`, type: 'info' }
    ]

    for (const notification of notificationRecipients) {
      await query(`
        INSERT INTO notifications (
          user_id, title, message, type, created_at, tenant_id
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
      `, [notification.user_id, notification.title, notification.message, notification.type, tenantContext.tenant_id])
    }

    return NextResponse.json({
      success: true,
      data: swapRequest,
      message: 'Shift swap request created successfully'
    })

  } catch (error) {
    console.error('Error creating shift swap request:', error)
    return NextResponse.json(
      { error: 'Failed to create shift swap request' },
      { status: 500 }
    )
  }
}
