import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    let sql = `SELECT * FROM pay_periods WHERE tenant_id = $1`
    const params: any[] = [tenant.tenant_id]
    if (status) { sql += ` AND status = $2`; params.push(status) }
    sql += ' ORDER BY start_date DESC'
    const res = await query(sql, params)
    return NextResponse.json({ success: true, data: res.rows })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    const { start_date, end_date } = await request.json()
    if (!start_date || !end_date) return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 })
    const res = await query(`INSERT INTO pay_periods (tenant_id, start_date, end_date, status) VALUES ($1,$2,$3,'open') ON CONFLICT (tenant_id,start_date,end_date) DO UPDATE SET start_date=EXCLUDED.start_date RETURNING *`, [tenant.tenant_id, start_date, end_date])
    return NextResponse.json({ success: true, data: res.rows[0] })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    const { id, status } = await request.json()
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })
    if (!['open','locked'].includes(status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    // Prevent edits to time_entries once locked (enforced app-side; can add trigger later)
    const res = await query(`UPDATE pay_periods SET status=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *`, [status, id, tenant.tenant_id])
    return NextResponse.json({ success: true, data: res.rows[0] })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}


