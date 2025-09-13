import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  try {
    // Scope to current tenant
    const auth = createApiAuthMiddleware()
    const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const tenant = await getTenantContext(user.id)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'No tenant context found' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const department = searchParams.get('department') || ''
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let queryText = `
      SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.department,
        e.job_position,
        e.is_active,
        e.hourly_rate,
        e.max_hours_per_week
      FROM employees e
      WHERE e.is_active = true AND e.role = 'agent' AND e.tenant_id = $1
    `
    const params: any[] = [tenant.tenant_id]
    let paramIndex = 2

    // Add search filter
    if (search) {
      queryText += ` AND (
        LOWER(first_name) LIKE LOWER($${paramIndex}) OR
        LOWER(last_name) LIKE LOWER($${paramIndex}) OR
        LOWER(employee_code) LIKE LOWER($${paramIndex}) OR
        LOWER(email) LIKE LOWER($${paramIndex})
      )`
      params.push(`%${search}%`)
      paramIndex++
    }

    // Add department filter
    if (department) {
      queryText += ` AND department = $${paramIndex}`
      params.push(department)
      paramIndex++
    }

    // Add ordering and pagination
    queryText += ` ORDER BY first_name, last_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await query(queryText, params)

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM employees e
      WHERE e.is_active = true AND e.role = 'agent' AND e.tenant_id = $1
    `
    const countParams: any[] = [tenant.tenant_id]
    let countParamIndex = 2

    if (search) {
      countQuery += ` AND (
        LOWER(first_name) LIKE LOWER($${countParamIndex}) OR
        LOWER(last_name) LIKE LOWER($${countParamIndex}) OR
        LOWER(employee_code) LIKE LOWER($${countParamIndex}) OR
        LOWER(email) LIKE LOWER($${countParamIndex})
      )`
      countParams.push(`%${search}%`)
      countParamIndex++
    }

    if (department) {
      countQuery += ` AND department = $${countParamIndex}`
      countParams.push(department)
    }

    const countResult = await query(countQuery, countParams)
    const total = parseInt(countResult.rows[0].total)

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}
