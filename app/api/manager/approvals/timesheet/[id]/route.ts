import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { z } from 'zod'

const approveTimesheetSchema = z.object({
  action: z.enum(['approve', 'reject']),
  approved_hours: z.number().optional(),
  approved_rate: z.number().optional(),
  admin_notes: z.string().optional(),
  rejection_reason: z.string().optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: timesheetId } = params
    
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
    const validatedData = approveTimesheetSchema.parse(body)

    // Check if manager has access to this timesheet
    const timesheetQuery = `
      SELECT te.*, e.location_id, l.name as location_name
      FROM time_entries te
      JOIN employees e ON te.employee_id = e.id
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE te.id = $1 AND te.tenant_id = $2
    `
    const timesheetResult = await query(timesheetQuery, [timesheetId, tenantContext.tenant_id])
    
    if (timesheetResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Timesheet not found' },
        { status: 404 }
      )
    }

    const timesheet = timesheetResult.rows[0]

    // Check if manager has access to this location
    const managerLocationQuery = `
      SELECT 1 FROM manager_locations 
      WHERE tenant_id = $1 AND manager_id = $2 AND location_id = $3
    `
    const managerLocationResult = await query(managerLocationQuery, [
      tenantContext.tenant_id,
      user.id,
      timesheet.location_id
    ])

    if (managerLocationResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Access denied. You can only approve timesheets for your assigned locations.' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()
    const approvalStatus = validatedData.action === 'approve' ? 'approved' : 'rejected'
    
    let approvedHours = validatedData.approved_hours || timesheet.total_hours
    let approvedRate = validatedData.approved_rate || timesheet.hourly_rate
    let totalPay = approvedHours * approvedRate

    // Update the time entry
    const updateQuery = `
      UPDATE time_entries SET
        approval_status = $1,
        approved_by = $2,
        approved_at = $3,
        approved_hours = $4,
        approved_rate = $5,
        total_pay = $6,
        admin_notes = $7,
        rejection_reason = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `
    const updateResult = await query(updateQuery, [
      approvalStatus,
      user.id,
      now,
      approvedHours,
      approvedRate,
      totalPay,
      validatedData.admin_notes || null,
      validatedData.rejection_reason || null,
      timesheetId
    ])

    // Create approval history record
    await query(`
      INSERT INTO time_entry_approvals (
        time_entry_id, employee_id, approver_id, status,
        decision_notes, approved_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      timesheetId,
      timesheet.employee_id,
      user.id,
      approvalStatus,
      validatedData.admin_notes || validatedData.rejection_reason || null,
      now
    ])

    // Create notification for employee
    const notificationType = approvalStatus === 'approved' ? 'success' : 'warning'
    const notificationMessage = approvalStatus === 'approved'
      ? `Your timesheet for ${new Date(timesheet.clock_in).toLocaleDateString()} has been approved. Hours: ${approvedHours}, Rate: £${approvedRate}/hr, Total: £${totalPay.toFixed(2)}`
      : `Your timesheet for ${new Date(timesheet.clock_in).toLocaleDateString()} has been rejected. Reason: ${validatedData.rejection_reason}`

    await query(`
      INSERT INTO notifications (tenant_id, employee_id, title, message, type, is_read, action_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      tenantContext.tenant_id,
      timesheet.employee_id,
      `Timesheet ${validatedData.action.charAt(0).toUpperCase() + validatedData.action.slice(1)}`,
      notificationMessage,
      notificationType,
      false,
      '/employee/timesheet'
    ])

    return NextResponse.json({
      success: true,
      data: {
        timesheet: updateResult.rows[0],
        message: `Timesheet ${validatedData.action}d successfully`
      }
    })

  } catch (error) {
    console.error('Error in timesheet approval:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
