import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { z } from 'zod'

const approveLeaveRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
  manager_notes: z.string().optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: leaveRequestId } = params
    
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    
    if (!isAuthenticated || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.role !== 'manager') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Manager role required.' },
        { status: 403 }
      )
    }

    // Get tenant context
    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json(
        { success: false, error: 'No tenant context found' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = approveLeaveRequestSchema.parse(body)

    // Get the leave request with location info
    const leaveRequestQuery = `
      SELECT lr.*, e.location_id, l.name as location_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE lr.id = $1 AND lr.tenant_id = $2
    `
    const leaveRequestResult = await query(leaveRequestQuery, [leaveRequestId, tenantContext.tenant_id])
    
    if (leaveRequestResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Leave request not found' },
        { status: 404 }
      )
    }

    const leaveRequest = leaveRequestResult.rows[0]

    // Check if manager has access to this location
    const managerLocationQuery = `
      SELECT 1 FROM manager_locations 
      WHERE tenant_id = $1 AND manager_id = $2 AND location_id = $3
    `
    const managerLocationResult = await query(managerLocationQuery, [
      tenantContext.tenant_id,
      user.id,
      leaveRequest.location_id
    ])

    if (managerLocationResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Access denied. You can only approve leave requests for your assigned locations.' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()
    const newStatus = validatedData.action === 'approve' ? 'approved' : 'rejected'

    // Update the leave request
    const updateQuery = `
      UPDATE leave_requests SET
        status = $1,
        manager_notes = $2,
        processed_at = $3,
        processed_by = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `
    const updateResult = await query(updateQuery, [
      newStatus,
      validatedData.manager_notes || null,
      now,
      user.id,
      leaveRequestId
    ])

    // Create notification for employee
    const notificationType = validatedData.action === 'approve' ? 'success' : 'warning'
    const daysRequested = Math.ceil((new Date(leaveRequest.end_date).getTime() - new Date(leaveRequest.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    const notificationMessage = validatedData.action === 'approve'
      ? `Your leave request has been approved. ${leaveRequest.leave_type} from ${leaveRequest.start_date} to ${leaveRequest.end_date} (${daysRequested} days)`
      : `Your leave request has been rejected. Reason: ${validatedData.manager_notes || 'No reason provided'}`

    await query(`
      INSERT INTO notifications (tenant_id, employee_id, title, message, type, is_read, action_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      tenantContext.tenant_id,
      leaveRequest.employee_id,
      `Leave Request ${validatedData.action.charAt(0).toUpperCase() + validatedData.action.slice(1)}`,
      notificationMessage,
      notificationType,
      false,
      '/employee/leave'
    ])

    return NextResponse.json({
      success: true,
      data: {
        leaveRequest: updateResult.rows[0],
        message: `Leave request ${validatedData.action}d successfully`
      }
    })

  } catch (error) {
    console.error('Error in leave request approval:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
