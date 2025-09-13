import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    const res = await query(`
      SELECT ml.id, ml.manager_id, ml.location_id,
             e.first_name||' '||e.last_name AS manager_name,
             l.name AS location_name
      FROM manager_locations ml
      JOIN employees e ON ml.manager_id = e.id AND e.tenant_id = ml.tenant_id
      JOIN locations l ON ml.location_id = l.id AND l.tenant_id = ml.tenant_id
      WHERE ml.tenant_id = $1
      ORDER BY manager_name, location_name
    `, [tenant.tenant_id])
    return NextResponse.json({ success: true, data: res.rows })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    const { manager_id, location_id } = await request.json()
    if (!manager_id || !location_id) return NextResponse.json({ error: 'manager_id and location_id required' }, { status: 400 })
    await query(`
      INSERT INTO manager_locations (tenant_id, manager_id, location_id)
      VALUES ($1,$2,$3) ON CONFLICT DO NOTHING
    `, [tenant.tenant_id, manager_id, location_id])
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await query('DELETE FROM manager_locations WHERE id = $1 AND tenant_id = $2', [id, tenant.tenant_id])
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}


