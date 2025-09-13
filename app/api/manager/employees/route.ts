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

    // Get current week start (Monday)
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)

    // Get employees with their location and activity info
    const employeesQuery = `
      SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e.role,
        e.department,
        e.is_active,
        e.location_id,
        l.name as location_name,
        e.hire_date,
        (
          SELECT MAX(clock_in)
          FROM time_entries te
          WHERE te.employee_id = e.id AND te.tenant_id = e.tenant_id
        ) as last_clock_in,
        (
          SELECT COALESCE(SUM(total_hours), 0)
          FROM time_entries te
          WHERE te.employee_id = e.id 
            AND te.tenant_id = e.tenant_id
            AND te.clock_in >= $2
        ) as total_hours_this_week
      FROM employees e
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE e.tenant_id = $1
      ${locationFilter}
      ORDER BY e.first_name, e.last_name
    `
    const employeesResult = await query(employeesQuery, [
      tenantContext.tenant_id,
      weekStart.toISOString()
    ])

    return NextResponse.json({
      success: true,
      data: {
        employees: employeesResult.rows
      }
    })

  } catch (error) {
    console.error('Error in manager employees API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
