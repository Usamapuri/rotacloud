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

    // Get locations with employee and manager counts
    const locationsQuery = `
      SELECT 
        l.id,
        l.name,
        l.description,
        l.is_active,
        l.created_at,
        COUNT(DISTINCT e.id) as employee_count,
        COUNT(DISTINCT ml.manager_id) as manager_count
      FROM locations l
      LEFT JOIN employees e ON l.id = e.location_id AND e.is_active = true
      LEFT JOIN manager_locations ml ON l.id = ml.location_id
      WHERE l.tenant_id = $1
      GROUP BY l.id, l.name, l.description, l.is_active, l.created_at
      ORDER BY l.name
    `
    const locationsResult = await query(locationsQuery, [tenantContext.tenant_id])

    return NextResponse.json({
      success: true,
      data: locationsResult.rows
    })

  } catch (error) {
    console.error('Error in detailed locations API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
