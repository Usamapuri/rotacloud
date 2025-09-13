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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const status = searchParams.get('status')

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

    // Build date filter
    let dateFilter = ''
    if (startDate && endDate) {
      dateFilter = `AND te.clock_in::date BETWEEN '${startDate}' AND '${endDate}'`
    } else if (startDate) {
      dateFilter = `AND te.clock_in::date >= '${startDate}'`
    } else if (endDate) {
      dateFilter = `AND te.clock_in::date <= '${endDate}'`
    }

    // Build status filter
    let statusFilter = ''
    if (status && status !== 'all') {
      statusFilter = `AND te.approval_status = '${status}'`
    }

    // Get timesheet entries
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
        te.total_pay,
        te.break_hours,
        te.approval_status,
        te.approved_by,
        te.approved_at,
        te.admin_notes,
        te.rejection_reason,
        te.created_at
      FROM time_entries te
      JOIN employees e ON te.employee_id = e.id
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE te.tenant_id = $1
      ${locationFilter}
      ${dateFilter}
      ${statusFilter}
      ORDER BY te.clock_in DESC
    `
    const timesheetsResult = await query(timesheetsQuery, [tenantContext.tenant_id])

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_entries,
        COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_approvals,
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_entries,
        COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected_entries,
        COALESCE(SUM(total_hours), 0) as total_hours,
        COALESCE(SUM(total_pay), 0) as total_pay,
        COUNT(DISTINCT employee_id) as unique_employees
      FROM time_entries te
      JOIN employees e ON te.employee_id = e.id
      WHERE te.tenant_id = $1
      ${locationFilter}
      ${dateFilter}
    `
    const summaryResult = await query(summaryQuery, [tenantContext.tenant_id])
    const summary = summaryResult.rows[0]

    const averageHoursPerEmployee = summary.unique_employees > 0 
      ? summary.total_hours / summary.unique_employees 
      : 0

    const result = {
      timesheets: timesheetsResult.rows,
      summary: {
        total_entries: parseInt(summary.total_entries) || 0,
        pending_approvals: parseInt(summary.pending_approvals) || 0,
        approved_entries: parseInt(summary.approved_entries) || 0,
        rejected_entries: parseInt(summary.rejected_entries) || 0,
        total_hours: parseFloat(summary.total_hours) || 0,
        total_pay: parseFloat(summary.total_pay) || 0,
        average_hours_per_employee: parseFloat(averageHoursPerEmployee.toFixed(2))
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error in manager timesheets API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
