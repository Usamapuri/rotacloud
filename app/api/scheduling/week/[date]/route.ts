import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ success: false, error: 'No tenant context found' }, { status: 403 })
    }

    const { date } = await params
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id') || ''
    const rotaId = searchParams.get('rota_id') || ''
    const showPublishedOnly = searchParams.get('published_only') === 'true'
    const showDraftsOnly = searchParams.get('show_drafts_only') === 'true'

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
    }

    const weekStart = new Date(date)
    const dayOfWeek = weekStart.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    weekStart.setDate(weekStart.getDate() - daysToMonday)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    // Employees for tenant - show schedulable roles
    let employeesQuery = `
      SELECT id, employee_code, first_name, last_name, email, department, job_position
      FROM employees
      WHERE is_active = true AND tenant_id = $1 AND role IN ('agent','employee')
    `
    const employeesParams: any[] = [tenantContext.tenant_id]

    // If user is a manager, restrict employees by their assigned locations
    if (user.role === 'manager') {
      const idx = employeesParams.length + 1
      employeesQuery += ` AND location_id IN (
        SELECT location_id FROM manager_locations
        WHERE tenant_id = $1 AND manager_id = $${idx}
      )`
      employeesParams.push(user.id)
    }

    if (employeeId) {
      employeesQuery += ` AND id = $2`
      employeesParams.push(employeeId)
    }

    employeesQuery += ` ORDER BY first_name, last_name`
    const employeesPromise = query(employeesQuery, employeesParams)

    // Determine if override columns exist
    const colCheck = await query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shift_assignments' AND column_name = 'override_name' LIMIT 1
    `)
    const hasOverrides = colCheck.rows.length > 0

    // Assignments for tenant - filter based on rota and published status
    let assignmentsQuery = ''
    if (hasOverrides) {
      assignmentsQuery = `
        SELECT 
          sa.id,
          sa.employee_id,
          sa.template_id,
          to_char(sa.date, 'YYYY-MM-DD') as date,
          sa.override_name,
          sa.override_start_time,
          sa.override_end_time,
          sa.override_color,
          sa.status,
          sa.notes,
          sa.rota_id,
          sa.is_published,
          sa.created_at,
          COALESCE(sa.override_name, st.name) as template_name,
          COALESCE(sa.override_start_time, st.start_time) as start_time,
          COALESCE(sa.override_end_time, st.end_time) as end_time,
          COALESCE(sa.override_color, st.color) as color,
          st.department as template_department,
          r.name as rota_name,
          r.status as rota_status
        FROM shift_assignments sa
        LEFT JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id
        LEFT JOIN rotas r ON sa.rota_id = r.id
        WHERE sa.date >= $1 AND sa.date <= $2 AND sa.tenant_id = $3
      `
    } else {
      assignmentsQuery = `
        SELECT 
          sa.id,
          sa.employee_id,
          sa.template_id,
          to_char(sa.date, 'YYYY-MM-DD') as date,
          sa.status,
          sa.notes,
          sa.rota_id,
          sa.is_published,
          sa.created_at,
          st.name as template_name,
          st.start_time as start_time,
          st.end_time as end_time,
          st.color as color,
          st.department as template_department,
          r.name as rota_name,
          r.status as rota_status
        FROM shift_assignments sa
        LEFT JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id
        LEFT JOIN rotas r ON sa.rota_id = r.id
        WHERE sa.date >= $1 AND sa.date <= $2 AND sa.tenant_id = $3
      `
    }
    const assignmentsParams: any[] = [weekStartStr, weekEndStr, tenantContext.tenant_id]
    let paramIndex = 4

    // If manager, scope assignments through employees' locations
    if (user.role === 'manager') {
      assignmentsQuery += ` AND EXISTS (
        SELECT 1 FROM employees e
        JOIN manager_locations ml ON ml.location_id = e.location_id AND ml.tenant_id = e.tenant_id
        WHERE e.id = sa.employee_id AND ml.manager_id = $${paramIndex}
      )`
      assignmentsParams.push(user.id)
      paramIndex++
    }

    // Filter by specific rota if provided
    if (rotaId) {
      assignmentsQuery += ` AND sa.rota_id = $${paramIndex}`
      assignmentsParams.push(rotaId)
      paramIndex++
    }

    // Filter by published status if requested (for employee view)
    if (showPublishedOnly) {
      assignmentsQuery += ` AND sa.is_published = true`
    } else if (showDraftsOnly) {
      assignmentsQuery += ` AND sa.is_published = false`
    }

    if (employeeId) {
      assignmentsQuery += ` AND sa.employee_id = $${paramIndex}`
      assignmentsParams.push(employeeId)
      paramIndex++
    }

    assignmentsQuery += ` ORDER BY sa.date, sa.employee_id`
    const assignmentsPromise = query(assignmentsQuery, assignmentsParams)

    // Tenant templates
    const templatesPromise = query(`
      SELECT id, name, start_time, end_time, department, color, required_staff
      FROM shift_templates
      WHERE is_active = true AND tenant_id = $1
      ORDER BY name
    `, [tenantContext.tenant_id])
    const [employeesResult, assignmentsResult, templatesResult] = await Promise.all([
      employeesPromise,
      assignmentsPromise,
      templatesPromise,
    ])
    const employees = employeesResult.rows
    const assignments = assignmentsResult.rows
    const templates = templatesResult.rows

    // Get rotas for this week and/or details for the selected rota
    let rotas: any[] = []
    let currentRotaDetails: any | null = null
    if (!rotaId) {
      const rotasResult = await query(`
        SELECT r.*, COUNT(sa.id) as total_shifts
        FROM rotas r
        LEFT JOIN shift_assignments sa ON r.id = sa.rota_id
        WHERE r.tenant_id = $1 AND r.week_start_date = $2
        ${user.role === 'manager' ? `AND EXISTS (
          SELECT 1 FROM employees e2
          JOIN manager_locations ml2 ON ml2.location_id = e2.location_id AND ml2.tenant_id = r.tenant_id
          JOIN shift_assignments sa2 ON sa2.employee_id = e2.id AND sa2.rota_id = r.id
          WHERE ml2.manager_id = $3
        )` : ''}
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `, user.role === 'manager' ? [tenantContext.tenant_id, weekStartStr, user.id] : [tenantContext.tenant_id, weekStartStr])
      rotas = rotasResult.rows
    } else {
      const currentRotaRes = await query(`
        SELECT r.*, COUNT(sa.id) as total_shifts
        FROM rotas r
        LEFT JOIN shift_assignments sa ON r.id = sa.rota_id
        WHERE r.tenant_id = $1 AND r.id = $2
        ${user.role === 'manager' ? `AND EXISTS (
          SELECT 1 FROM employees e2
          JOIN manager_locations ml2 ON ml2.location_id = e2.location_id AND ml2.tenant_id = r.tenant_id
          JOIN shift_assignments sa2 ON sa2.employee_id = e2.id AND sa2.rota_id = r.id
          WHERE ml2.manager_id = $3
        )` : ''}
        GROUP BY r.id
      `, user.role === 'manager' ? [tenantContext.tenant_id, rotaId, user.id] : [tenantContext.tenant_id, rotaId])
      currentRotaDetails = currentRotaRes.rows[0] || null
    }

    const scheduleData = {
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      employees: employees.map(emp => ({ ...emp, assignments: {} })),
      templates,
      assignments: assignments,
      rotas: rotas,
      currentRota: rotaId ? currentRotaDetails : null
    }

    employees.forEach(employee => {
      const employeeAssignments = assignments.filter(a => a.employee_id === employee.id)
      employeeAssignments.forEach(assignment => {
        const dateValue: any = (assignment as any).date
        const dateKey = typeof dateValue === 'string' ? dateValue : new Date(dateValue).toISOString().split('T')[0]
        const emp = scheduleData.employees.find(e => e.id === employee.id)!
        if (!emp.assignments[dateKey]) emp.assignments[dateKey] = []
        emp.assignments[dateKey].push(assignment)
      })
    })

    return NextResponse.json({ success: true, data: scheduleData })
  } catch (error) {
    console.error('Error fetching week schedule:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch week schedule' }, { status: 500 })
  }
}

