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

    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin role required.' },
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

    // Get all managers with their assigned locations
    const managersQuery = `
      SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.role,
        e.is_active,
        COALESCE(
          json_agg(
            json_build_object(
              'id', l.id,
              'name', l.name
            ) 
            ORDER BY l.name
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'::json
        ) as assigned_locations
      FROM employees e
      LEFT JOIN manager_locations ml ON e.id = ml.manager_id
      LEFT JOIN locations l ON ml.location_id = l.id AND l.is_active = true
      WHERE e.tenant_id = $1 AND e.role = 'manager' AND e.is_active = true
      GROUP BY e.id, e.employee_code, e.first_name, e.last_name, e.email, e.role, e.is_active
      ORDER BY e.first_name, e.last_name
    `
    const managersResult = await query(managersQuery, [tenantContext.tenant_id])

    return NextResponse.json({
      success: true,
      data: managersResult.rows
    })

  } catch (error) {
    console.error('Error in managers API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
