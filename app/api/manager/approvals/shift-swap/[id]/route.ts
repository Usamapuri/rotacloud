import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { z } from 'zod'

const approveShiftSwapSchema = z.object({
  action: z.enum(['approve', 'reject']),
  manager_notes: z.string().optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: swapRequestId } = params
    
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
    const validatedData = approveShiftSwapSchema.parse(body)

    // Get the shift swap request with location info
    const swapRequestQuery = `
      SELECT ssr.*, e.location_id, l.name as location_name
      FROM shift_swap_requests ssr
      JOIN employees e ON ssr.employee_id = e.id
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE ssr.id = $1 AND ssr.tenant_id = $2
    `
    const swapRequestResult = await query(swapRequestQuery, [swapRequestId, tenantContext.tenant_id])
    
    if (swapRequestResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Shift swap request not found' },
        { status: 404 }
      )
    }

    const swapRequest = swapRequestResult.rows[0]

    // Check if manager has access to this location
    const managerLocationQuery = `
      SELECT 1 FROM manager_locations 
      WHERE tenant_id = $1 AND manager_id = $2 AND location_id = $3
    `
    const managerLocationResult = await query(managerLocationQuery, [
      tenantContext.tenant_id,
      user.id,
      swapRequest.location_id
    ])

    if (managerLocationResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Access denied. You can only approve shift swaps for your assigned locations.' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()
    const newStatus = validatedData.action === 'approve' ? 'approved' : 'rejected'

    // Update the shift swap request
    const updateQuery = `
      UPDATE shift_swap_requests SET
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
      swapRequestId
    ])

    // If approved, update the shift assignments
    if (validatedData.action === 'approve') {
      // This would involve updating the shift assignments
      // For now, we'll just log that it was approved
      console.log(`Shift swap approved: ${swapRequestId}`)
    }

    // Create notification for employee
    const notificationType = validatedData.action === 'approve' ? 'success' : 'warning'
    const notificationMessage = validatedData.action === 'approve'
      ? `Your shift swap request has been approved. Original shift: ${swapRequest.original_shift_date}, New shift: ${swapRequest.requested_shift_date}`
      : `Your shift swap request has been rejected. Reason: ${validatedData.manager_notes || 'No reason provided'}`

    await query(`
      INSERT INTO notifications (tenant_id, employee_id, title, message, type, is_read, action_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      tenantContext.tenant_id,
      swapRequest.employee_id,
      `Shift Swap ${validatedData.action.charAt(0).toUpperCase() + validatedData.action.slice(1)}`,
      notificationMessage,
      notificationType,
      false,
      '/employee/scheduling'
    ])

    return NextResponse.json({
      success: true,
      data: {
        shiftSwap: updateResult.rows[0],
        message: `Shift swap request ${validatedData.action}d successfully`
      }
    })

  } catch (error) {
    console.error('Error in shift swap approval:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
