import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    const res = await query(`SELECT * FROM shift_swaps WHERE tenant_id=$1 AND (target_id=$2 OR requester_id=$2) AND status='pending' ORDER BY created_at DESC`, [tenant.tenant_id, user.id])
    return NextResponse.json({ success: true, data: res.rows })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    const { id, action } = await request.json()
    if (!id || !['accept','decline'].includes(action)) return NextResponse.json({ error: 'id and action required' }, { status: 400 })
    const res = await query(`UPDATE shift_swaps SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 AND target_id=$4 AND status='pending' RETURNING *`, [action === 'accept' ? 'accepted' : 'denied', id, tenant.tenant_id, user.id])
    if (res.rows.length === 0) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: res.rows[0] })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}


