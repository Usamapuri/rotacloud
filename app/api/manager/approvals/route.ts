import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'timesheets', 'shift_swaps', 'leave_requests', or 'all'
    const locationId = searchParams.get('location_id')

    // Get manager's assigned locations
    const assignedLocationsQuery = `
      SELECT l.id, l.name
      FROM locations l
      JOIN manager_locations ml ON l.id = ml.location_id
      WHERE ml.tenant_id = $1 AND ml.manager_id = $2 AND l.is_active = true
    `
    const assignedLocationsResult = await query(assignedLocationsQuery, [
      tenantContext.tenant_id,
      user.id
    ])

    const assignedLocations = assignedLocationsResult.rows
    if (assignedLocations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No locations assigned to this manager'
      }, { status: 403 })
    }

    // Build location filter
    const locationFilter = locationId 
      ? `AND e.location_id = '${locationId}'`
      : `AND e.location_id IN (${assignedLocations.map(loc => `'${loc.id}'`).join(', ')})`

    const result: any = {
      timesheets: [],
      shift_swaps: [],
      leave_requests: []
    }

    // Get pending timesheet approvals
    if (!type || type === 'all' || type === 'timesheets') {
      const timesheetsQuery = `
        SELECT 
          te.id,
          te.employee_id,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.employee_code,
          l.name as location_name,
          te.clock_in,
          te.clock_out,
          te.total_hours,
          te.hourly_rate,
          te.break_hours,
          te.approval_status,
          te.created_at,
          te.admin_notes
        FROM time_entries te
        JOIN employees e ON te.employee_id = e.id
        LEFT JOIN locations l ON e.location_id = l.id
        WHERE te.tenant_id = $1 AND te.approval_status = 'pending'
        ${locationFilter}
        ORDER BY te.created_at DESC
      `
      const timesheetsResult = await query(timesheetsQuery, [tenantContext.tenant_id])
      result.timesheets = timesheetsResult.rows
    }

    // Get pending shift swap requests
    if (!type || type === 'all' || type === 'shift_swaps') {
      const shiftSwapsQuery = `
        SELECT 
          ssr.id,
          ssr.employee_id,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.employee_code,
          l.name as location_name,
          ssr.original_shift_date,
          ssr.requested_shift_date,
          ssr.reason,
          ssr.status,
          ssr.created_at,
          ssr.manager_notes
        FROM shift_swap_requests ssr
        JOIN employees e ON ssr.employee_id = e.id
        LEFT JOIN locations l ON e.location_id = l.id
        WHERE ssr.tenant_id = $1 AND ssr.status = 'pending'
        ${locationFilter}
        ORDER BY ssr.created_at DESC
      `
      const shiftSwapsResult = await query(shiftSwapsQuery, [tenantContext.tenant_id])
      result.shift_swaps = shiftSwapsResult.rows
    }

    // Get pending leave requests
    if (!type || type === 'all' || type === 'leave_requests') {
      const leaveRequestsQuery = `
        SELECT 
          lr.id,
          lr.employee_id,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.employee_code,
          l.name as location_name,
          lr.start_date,
          lr.end_date,
          lr.leave_type,
          lr.reason,
          lr.status,
          lr.created_at,
          lr.manager_notes,
          EXTRACT(DAYS FROM (lr.end_date - lr.start_date)) + 1 as days_requested
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN locations l ON e.location_id = l.id
        WHERE lr.tenant_id = $1 AND lr.status = 'pending'
        ${locationFilter}
        ORDER BY lr.created_at DESC
      `
      const leaveRequestsResult = await query(leaveRequestsQuery, [tenantContext.tenant_id])
      result.leave_requests = leaveRequestsResult.rows
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error in manager approvals API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
