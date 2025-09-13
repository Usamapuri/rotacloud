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
    const type = searchParams.get('type') // 'overview', 'employees', 'attendance'
    const locationId = searchParams.get('location_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

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
    }

    if (type === 'overview') {
      // Get overview statistics
      const overviewQuery = `
        SELECT 
          COUNT(DISTINCT e.id) as total_employees,
          COUNT(DISTINCT CASE WHEN e.is_active = true THEN e.id END) as active_employees,
          COALESCE(SUM(te.total_hours), 0) as total_hours,
          COALESCE(SUM(te.total_pay), 0) as total_payroll,
          COALESCE(AVG(te.total_hours), 0) as avg_hours_per_employee,
          COUNT(DISTINCT CASE WHEN te.clock_in::date = CURRENT_DATE THEN te.employee_id END) as today_present,
          COUNT(DISTINCT CASE WHEN te.total_hours > 8 THEN te.employee_id END) as overtime_employees,
          COALESCE(SUM(CASE WHEN te.total_hours > 8 THEN te.total_hours - 8 ELSE 0 END), 0) as overtime_hours
        FROM employees e
        LEFT JOIN time_entries te ON e.id = te.employee_id
        WHERE e.tenant_id = $1
        ${locationFilter}
        ${dateFilter}
      `
      const overviewResult = await query(overviewQuery, [tenantContext.tenant_id])
      const overview = overviewResult.rows[0]

      // Calculate attendance rate
      const attendanceRate = overview.total_employees > 0 
        ? (overview.today_present / overview.total_employees) * 100 
        : 0

      // Calculate efficiency (simplified metric)
      const efficiency = overview.avg_hours_per_employee > 0 
        ? Math.min((overview.avg_hours_per_employee / 8) * 100, 100)
        : 0

      // Determine performance level
      let performance = 'poor'
      if (attendanceRate >= 90 && efficiency >= 80) performance = 'excellent'
      else if (attendanceRate >= 80 && efficiency >= 70) performance = 'good'
      else if (attendanceRate >= 70 && efficiency >= 60) performance = 'fair'

      const result = {
        totalEmployees: parseInt(overview.total_employees) || 0,
        activeEmployees: parseInt(overview.active_employees) || 0,
        totalHours: parseFloat(overview.total_hours) || 0,
        totalPayroll: parseFloat(overview.total_payroll) || 0,
        attendanceRate: parseFloat(attendanceRate.toFixed(1)),
        overtimeHours: parseFloat(overview.overtime_hours) || 0,
        efficiency: parseFloat(efficiency.toFixed(1)),
        performance
      }

      return NextResponse.json({
        success: true,
        data: result
      })
    }

    if (type === 'employees') {
      // Get employee performance data
      const employeesQuery = `
        SELECT 
          e.id as employee_id,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.employee_code,
          l.name as location_name,
          COALESCE(SUM(te.total_hours), 0) as total_hours,
          COALESCE(SUM(te.total_pay), 0) as total_pay,
          COUNT(DISTINCT te.clock_in::date) as days_worked,
          COALESCE(SUM(CASE WHEN te.total_hours > 8 THEN te.total_hours - 8 ELSE 0 END), 0) as overtime_hours,
          COUNT(DISTINCT te.clock_in::date) as attendance_days
        FROM employees e
        LEFT JOIN locations l ON e.location_id = l.id
        LEFT JOIN time_entries te ON e.id = te.employee_id
        WHERE e.tenant_id = $1 AND e.is_active = true
        ${locationFilter}
        ${dateFilter}
        GROUP BY e.id, e.first_name, e.last_name, e.employee_code, l.name
        ORDER BY total_hours DESC
      `
      const employeesResult = await query(employeesQuery, [tenantContext.tenant_id])

      const employeePerformance = employeesResult.rows.map(emp => {
        // Calculate attendance rate (simplified)
        const totalDays = dateFilter ? 
          Math.ceil((new Date(endDate!).getTime() - new Date(startDate!).getTime()) / (1000 * 60 * 60 * 24)) + 1 :
          30 // Default to 30 days if no date range
        const attendanceRate = totalDays > 0 ? (emp.attendance_days / totalDays) * 100 : 0

        // Calculate efficiency (hours worked vs expected)
        const expectedHours = totalDays * 8 // 8 hours per day
        const efficiency = expectedHours > 0 ? (emp.total_hours / expectedHours) * 100 : 0

        // Determine performance level
        let performance = 'poor'
        if (attendanceRate >= 90 && efficiency >= 80) performance = 'excellent'
        else if (attendanceRate >= 80 && efficiency >= 70) performance = 'good'
        else if (attendanceRate >= 70 && efficiency >= 60) performance = 'fair'

        return {
          employee_id: emp.employee_id,
          employee_name: emp.employee_name,
          employee_code: emp.employee_code,
          location_name: emp.location_name,
          total_hours: parseFloat(emp.total_hours),
          total_pay: parseFloat(emp.total_pay),
          attendance_rate: parseFloat(attendanceRate.toFixed(1)),
          overtimeHours: parseFloat(emp.overtime_hours),
          efficiency: parseFloat(efficiency.toFixed(1)),
          performance
        }
      })

      return NextResponse.json({
        success: true,
        data: { employeePerformance }
      })
    }

    if (type === 'attendance') {
      // Get daily attendance breakdown
      const attendanceQuery = `
        SELECT 
          te.clock_in::date as date,
          COUNT(DISTINCT te.employee_id) as present_employees,
          COUNT(DISTINCT CASE WHEN te.clock_in::time > '09:00:00' THEN te.employee_id END) as late_clock_ins,
          COUNT(CASE WHEN te.clock_out IS NOT NULL THEN 1 END) as completed_entries
        FROM time_entries te
        JOIN employees e ON te.employee_id = e.id
        WHERE te.tenant_id = $1
        ${locationFilter}
        ${dateFilter}
        GROUP BY te.clock_in::date
        ORDER BY te.clock_in::date
      `
      const attendanceResult = await query(attendanceQuery, [tenantContext.tenant_id])

      const dailyBreakdown = attendanceResult.rows.map(row => ({
        date: row.date,
        present_employees: parseInt(row.present_employees) || 0,
        late_clock_ins: parseInt(row.late_clock_ins) || 0,
        completed_entries: parseInt(row.completed_entries) || 0
      }))

      return NextResponse.json({
        success: true,
        data: { dailyBreakdown }
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid report type'
    }, { status: 400 })

  } catch (error) {
    console.error('Error in manager reports API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
