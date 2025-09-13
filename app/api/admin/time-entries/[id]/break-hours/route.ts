import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = createApiAuthMiddleware()
    const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(user.role === 'admin' || user.role === 'manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const tenant = await getTenantContext(user.id)
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const { id } = params
    const { break_hours } = await request.json()
    const newBreakHours = Number(break_hours)
    if (isNaN(newBreakHours) || newBreakHours < 0) {
      return NextResponse.json({ error: 'Invalid break_hours' }, { status: 400 })
    }

    // Enforce manager location scoping by ensuring the employee belongs to a location they manage
    const res = await query(
      `UPDATE time_entries te
       SET break_hours = $1, updated_at = NOW()
       FROM employees e
       WHERE te.id = $2 AND te.tenant_id = $3 AND e.id = te.employee_id AND e.tenant_id = te.tenant_id
       ${user.role === 'manager' ? `AND e.location_id IN (
          SELECT location_id FROM manager_locations
          WHERE tenant_id = $3 AND manager_id = $4
        )` : ''}
       RETURNING te.*`,
      user.role === 'manager' ? [newBreakHours, id, tenant.tenant_id, user.id] : [newBreakHours, id, tenant.tenant_id]
    )

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: res.rows[0] })
  } catch (error) {
    console.error('Error updating break hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


