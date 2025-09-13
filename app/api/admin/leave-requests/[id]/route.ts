import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { z } from 'zod'

const approveLeaveRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
  rejection_reason: z.string().optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or manager
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return NextResponse.json({ error: 'Access denied. Admin or manager role required.' }, { status: 403 })
    }

    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const validatedData = approveLeaveRequestSchema.parse(body)

    // Get the leave request
    const leaveRequestResult = await query(`
      SELECT lr.*, e.first_name, e.last_name, e.email
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.id = $1 AND lr.tenant_id = $2
    `, [id, tenantContext.tenant_id])

    if (leaveRequestResult.rows.length === 0) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    const leaveRequest = leaveRequestResult.rows[0]

    // Check if request is already processed
    if (leaveRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Leave request has already been processed' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const newStatus = validatedData.action === 'approve' ? 'approved' : 'rejected'

    // Update the leave request
    const updateResult = await query(`
      UPDATE leave_requests SET
        status = $1,
        approved_by = $2,
        approved_at = $3,
        admin_notes = $4,
        rejection_reason = $5,
        updated_at = NOW()
      WHERE id = $6 AND tenant_id = $7
      RETURNING *
    `, [
      newStatus,
      user.id,
      now,
      validatedData.notes || null,
      validatedData.rejection_reason || null,
      id,
      tenantContext.tenant_id
    ])

    if (updateResult.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 })
    }

    const updatedRequest = updateResult.rows[0]

    // Create notification for the employee
    const notificationMessage = validatedData.action === 'approve' 
      ? `Your leave request for ${leaveRequest.start_date} to ${leaveRequest.end_date} has been approved.`
      : `Your leave request for ${leaveRequest.start_date} to ${leaveRequest.end_date} has been rejected. Reason: ${validatedData.rejection_reason || 'No reason provided'}`

    await query(`
      INSERT INTO notifications (
        user_id, title, message, type, created_at, tenant_id
      ) VALUES ($1, $2, $3, $4, NOW(), $5)
    `, [
      leaveRequest.employee_id,
      `Leave Request ${validatedData.action === 'approve' ? 'Approved' : 'Rejected'}`,
      notificationMessage,
      validatedData.action === 'approve' ? 'success' : 'warning',
      tenantContext.tenant_id
    ])

    // If approved, check for scheduling conflicts and remove shifts
    if (validatedData.action === 'approve') {
      // Remove any scheduled shifts during the leave period
      await query(`
        UPDATE shift_assignments SET
          status = 'cancelled',
          cancellation_reason = 'Employee on approved leave',
          updated_at = NOW()
        WHERE employee_id = $1 
        AND tenant_id = $2
        AND date BETWEEN $3 AND $4
        AND status = 'scheduled'
      `, [
        leaveRequest.employee_id,
        tenantContext.tenant_id,
        leaveRequest.start_date,
        leaveRequest.end_date
      ])

      // Log the approval action
      console.log(`Leave request approved: Employee ${leaveRequest.first_name} ${leaveRequest.last_name} from ${leaveRequest.start_date} to ${leaveRequest.end_date} by ${user.role} ${user.id}`)
    } else {
      // Log the rejection action
      console.log(`Leave request rejected: Employee ${leaveRequest.first_name} ${leaveRequest.last_name} from ${leaveRequest.start_date} to ${leaveRequest.end_date} by ${user.role} ${user.id}. Reason: ${validatedData.rejection_reason}`)
    }

    return NextResponse.json({
      success: true,
      data: updatedRequest,
      message: `Leave request ${validatedData.action}d successfully`
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error in PATCH /api/admin/leave-requests/[id]:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
