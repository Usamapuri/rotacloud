import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { z } from 'zod'
import { query as db } from '@/lib/database'

// Validation schema for shift approval actions
const approvalSchema = z.object({
  action: z.enum(['approve', 'reject', 'edit']),
  approved_hours: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(num) ? 0 : num
  }).pipe(z.number().min(0)).optional(),
  approved_rate: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(num) ? 0 : num
  }).pipe(z.number().min(0)).optional(),
  admin_notes: z.string().optional(),
  rejection_reason: z.string().optional(),
  // Additional fields for edit action
  clock_in: z.string().optional(),
  clock_out: z.string().optional(),
  break_hours: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(num) ? 0 : num
  }).pipe(z.number().min(0)).optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the request
    const authMiddleware = createApiAuthMiddleware()
    const authResult = await authMiddleware(request)
    if (!('isAuthenticated' in authResult) || !authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow admins and managers; managers location-scoped when config permits
    if (!(authResult.user.role === 'admin' || authResult.user.role === 'manager')) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
    }

    const tenant = await getTenantContext(authResult.user.id)
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    }

    // Settings gate for manager approvals
    if (authResult.user.role === 'manager') {
      const s = await db(`SELECT allow_manager_approvals FROM tenant_settings WHERE tenant_id = $1`, [tenant.tenant_id])
      if (s.rows[0]?.allow_manager_approvals !== true) {
        return NextResponse.json({ error: 'Manager approvals disabled by settings' }, { status: 403 })
      }
    }

    const shiftId = params.id
    const body = await request.json()
    
    // Log the incoming data for debugging
    console.log('Incoming approval data:', body)
    
    const validatedData = approvalSchema.parse(body)
    
    // Log the validated data
    console.log('Validated approval data:', validatedData)

    // Get the current time entry
    const shiftResult = await query(
      `SELECT te.*
       FROM time_entries te
       JOIN employees e ON e.id = te.employee_id AND e.tenant_id = te.tenant_id
       WHERE te.id = $1 AND te.tenant_id = $2
       ${authResult.user.role === 'manager' ? `AND e.location_id IN (
          SELECT location_id FROM manager_locations
          WHERE tenant_id = $2 AND manager_id = $3
        )` : ''}
      `,
      authResult.user.role === 'manager' ? [shiftId, tenant.tenant_id, authResult.user.id] : [shiftId, tenant.tenant_id]
    )

    if (shiftResult.rows.length === 0) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    const shift = shiftResult.rows[0]
    const now = new Date().toISOString()

    // Get employee's default hourly rate
    const employeeResult = await query(
      'SELECT hourly_rate FROM employees WHERE id = $1',
      [shift.employee_id]
    )
    const defaultRate = employeeResult.rows[0]?.hourly_rate || 0

    let approvalStatus = ''
    let approvedHours = 0
    let approvedRate = 0
    let totalPay = 0

    // Calculate new values based on action
    let newClockIn = shift.clock_in
    let newClockOut = shift.clock_out
    let newBreakHours = shift.break_hours || 0
    let newTotalHours = shift.total_hours

    if (validatedData.action === 'approve') {
      approvalStatus = 'approved'
      approvedHours = validatedData.approved_hours || shift.total_hours
      approvedRate = validatedData.approved_rate || defaultRate
      totalPay = approvedHours * approvedRate
    } else if (validatedData.action === 'reject') {
      approvalStatus = 'rejected'
      if (!validatedData.rejection_reason) {
        return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
      }
    } else if (validatedData.action === 'edit') {
      approvalStatus = 'edited'
      
      // Handle time edits
      if (validatedData.clock_in) {
        newClockIn = validatedData.clock_in
      }
      if (validatedData.clock_out) {
        newClockOut = validatedData.clock_out
      }
      if (validatedData.break_hours !== undefined) {
        newBreakHours = validatedData.break_hours
      }
      
      // Recalculate total hours if times were edited
      if (validatedData.clock_in && validatedData.clock_out) {
        const clockInTime = new Date(validatedData.clock_in)
        const clockOutTime = new Date(validatedData.clock_out)
        newTotalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) - newBreakHours
      }
      
      approvedHours = validatedData.approved_hours || newTotalHours
      approvedRate = validatedData.approved_rate || defaultRate
      totalPay = approvedHours * approvedRate
    }

    // Update the time entry
    const updateResult = await query(
      `UPDATE time_entries SET 
        approval_status = $1,
        approved_by = $2,
        approved_at = $3,
        approved_hours = $4,
        approved_rate = $5,
        total_pay = $6,
        admin_notes = $7,
        rejection_reason = $8,
        clock_in = $9,
        clock_out = $10,
        break_hours = $11,
        total_hours = $12,
        updated_at = NOW()
      WHERE id = $13 RETURNING *`,
      [
        approvalStatus,
        authResult.user.id,
        now,
        approvedHours,
        approvedRate,
        totalPay,
        validatedData.admin_notes || null,
        validatedData.rejection_reason || null,
        newClockIn,
        newClockOut,
        newBreakHours,
        newTotalHours,
        shiftId
      ]
    )

    const updatedShift = updateResult.rows[0]

    // Create approval history record
    await query(
      `INSERT INTO time_entry_approvals (
        time_entry_id, tenant_id, employee_id, approver_id, status,
        decision_notes, approved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        shiftId,
        tenant.tenant_id,
        shift.employee_id,
        authResult.user.id,
        approvalStatus,
        validatedData.admin_notes || validatedData.rejection_reason || null,
        now
      ]
    )

    // Create notification for employee
    let notificationMessage = ''
    let notificationType = ''

    if (validatedData.action === 'approve') {
      notificationMessage = `Your shift on ${new Date(shift.clock_in).toLocaleDateString()} has been approved. Hours: ${approvedHours}, Rate: £${approvedRate}/hr, Total: £${totalPay.toFixed(2)}`
      notificationType = 'success'
    } else if (validatedData.action === 'reject') {
      notificationMessage = `Your shift on ${new Date(shift.clock_in).toLocaleDateString()} has been rejected. Reason: ${validatedData.rejection_reason}`
      notificationType = 'error'
    } else if (validatedData.action === 'edit') {
      notificationMessage = `Your shift on ${new Date(shift.clock_in).toLocaleDateString()} has been edited. Hours: ${approvedHours}, Rate: £${approvedRate}/hr, Total: £${totalPay.toFixed(2)}`
      notificationType = 'info'
    }

    if (notificationMessage) {
      await query(
        `INSERT INTO notifications (tenant_id, user_id, title, message, type, read, action_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenant.tenant_id,
          shift.employee_id,
          `Shift ${validatedData.action.charAt(0).toUpperCase() + validatedData.action.slice(1)}`,
          notificationMessage,
          notificationType,
          false,
          '/employee/dashboard'
        ]
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedShift,
      message: `Shift ${validatedData.action} successfully`
    })

  } catch (error) {
    console.error('Error processing shift approval:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to process shift approval' },
      { status: 500 }
    )
  }
}
