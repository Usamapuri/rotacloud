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
    const locationId = searchParams.get('location_id')

    // Get manager's assigned locations
    const assignedLocationsQuery = `
      SELECT l.id, l.name, l.description
      FROM locations l
      JOIN manager_locations ml ON l.id = ml.location_id
      WHERE ml.tenant_id = $1 AND ml.manager_id = $2 AND l.is_active = true
      ORDER BY l.name
    `
    const assignedLocationsResult = await query(assignedLocationsQuery, [
      tenantContext.tenant_id,
      user.id
    ])

    const assignedLocations = assignedLocationsResult.rows

    // If no locations assigned, return error
    if (assignedLocations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No locations assigned to this manager'
      }, { status: 403 })
    }

    // Validate location_id if provided
    let validLocationId = null
    if (locationId) {
      const validLocation = assignedLocations.find(loc => loc.id === locationId)
      if (!validLocation) {
        return NextResponse.json({
          success: false,
          error: 'Invalid location or location not assigned to manager'
        }, { status: 400 })
      }
      validLocationId = locationId
    }

    // Build location filter for queries
    const locationFilter = validLocationId 
      ? `AND e.location_id = '${validLocationId}'`
      : `AND e.location_id IN (${assignedLocations.map(loc => `'${loc.id}'`).join(', ')})`

    // Get current week stats
    const currentWeekStart = new Date()
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay())
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6)

    const statsQuery = `
      SELECT 
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(DISTINCT sa.id) as scheduled_shifts,
        COUNT(DISTINCT CASE WHEN te.approval_status = 'pending' THEN te.id END) as pending_approvals,
        COUNT(DISTINCT CASE WHEN te.clock_out IS NULL AND te.clock_in IS NOT NULL THEN te.employee_id END) as clocked_in_now
      FROM employees e
      LEFT JOIN shift_assignments sa ON e.id = sa.employee_id 
        AND sa.start_date >= $1 AND sa.end_date <= $2
      LEFT JOIN time_entries te ON e.id = te.employee_id 
        AND te.clock_in >= $1 AND te.clock_in <= $3
      WHERE e.tenant_id = $4 AND e.is_active = true
      ${locationFilter}
    `
    const statsResult = await query(statsQuery, [
      currentWeekStart.toISOString().split('T')[0],
      currentWeekEnd.toISOString().split('T')[0],
      new Date().toISOString().split('T')[0],
      tenantContext.tenant_id
    ])

    const currentWeekStats = statsResult.rows[0] || {
      total_employees: 0,
      scheduled_shifts: 0,
      pending_approvals: 0,
      clocked_in_now: 0
    }

    // Get pending actions (timesheet approvals, shift swaps, leave requests)
    const pendingActionsQuery = `
      SELECT 
        'timesheet_approval' as type,
        te.id,
        CONCAT('Timesheet Approval - ', e.first_name, ' ', e.last_name) as title,
        CONCAT('Timesheet for ', te.clock_in::date, ' needs approval') as description,
        'medium' as priority,
        te.created_at,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM time_entries te
      JOIN employees e ON te.employee_id = e.id
      WHERE te.tenant_id = $1 AND te.approval_status = 'pending'
      ${locationFilter}
      
      UNION ALL
      
      SELECT 
        'shift_swap' as type,
        ssr.id,
        CONCAT('Shift Swap Request - ', e.first_name, ' ', e.last_name) as title,
        CONCAT('Wants to swap shift on ', ssr.original_shift_date) as description,
        'high' as priority,
        ssr.created_at,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM shift_swap_requests ssr
      JOIN employees e ON ssr.employee_id = e.id
      WHERE ssr.tenant_id = $1 AND ssr.status = 'pending'
      ${locationFilter}
      
      UNION ALL
      
      SELECT 
        'leave_request' as type,
        lr.id,
        CONCAT('Leave Request - ', e.first_name, ' ', e.last_name) as title,
        CONCAT('Leave from ', lr.start_date, ' to ', lr.end_date) as description,
        'medium' as priority,
        lr.created_at,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.tenant_id = $1 AND lr.status = 'pending'
      ${locationFilter}
      
      ORDER BY created_at DESC
      LIMIT 10
    `
    const pendingActionsResult = await query(pendingActionsQuery, [tenantContext.tenant_id])

    // Get live status of team members
    const liveStatusQuery = `
      SELECT 
        e.id as employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        l.name as location_name,
        CASE 
          WHEN te.clock_out IS NULL AND te.clock_in IS NOT NULL THEN 'clocked_in'
          WHEN bl.id IS NOT NULL AND bl.break_end IS NULL THEN 'on_break'
          WHEN lr.id IS NOT NULL AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date THEN 'on_leave'
          ELSE 'clocked_out'
        END as status,
        COALESCE(
          te.clock_in::text,
          bl.break_start::text,
          lr.start_date::text,
          'No recent activity'
        ) as last_activity
      FROM employees e
      JOIN locations l ON e.location_id = l.id
      LEFT JOIN time_entries te ON e.id = te.employee_id 
        AND te.clock_in >= CURRENT_DATE 
        AND (te.clock_out IS NULL OR te.clock_out >= CURRENT_DATE)
      LEFT JOIN break_logs bl ON e.id = bl.employee_id 
        AND bl.break_start >= CURRENT_DATE 
        AND bl.break_end IS NULL
      LEFT JOIN leave_requests lr ON e.id = lr.employee_id 
        AND lr.status = 'approved'
        AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
      WHERE e.tenant_id = $1 AND e.is_active = true
      ${locationFilter}
      ORDER BY e.first_name, e.last_name
    `
    const liveStatusResult = await query(liveStatusQuery, [tenantContext.tenant_id])

    const dashboardData = {
      assignedLocations,
      currentWeekStats: {
        totalEmployees: parseInt(currentWeekStats.total_employees) || 0,
        scheduledShifts: parseInt(currentWeekStats.scheduled_shifts) || 0,
        pendingApprovals: parseInt(currentWeekStats.pending_approvals) || 0,
        clockedInNow: parseInt(currentWeekStats.clocked_in_now) || 0
      },
      pendingActions: pendingActionsResult.rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        priority: row.priority,
        createdAt: row.created_at,
        employeeName: row.employee_name
      })),
      liveStatus: liveStatusResult.rows.map(row => ({
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        status: row.status,
        locationName: row.location_name,
        lastActivity: row.last_activity
      }))
    }

    return NextResponse.json({
      success: true,
      data: dashboardData
    })

  } catch (error) {
    console.error('Error in manager dashboard API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
