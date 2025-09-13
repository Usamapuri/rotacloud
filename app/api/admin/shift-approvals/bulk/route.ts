import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function POST(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

    const { start_date, end_date } = await request.json()
    if (!start_date || !end_date) return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 })

    // Scope by role: admin=tenant; manager=their locations
    let where = `te.tenant_id = $1 AND te.status = 'completed' AND te.approval_status = 'pending' AND te.clock_in IS NOT NULL AND te.clock_out IS NOT NULL AND te.created_at::date BETWEEN $2 AND $3`
    const params: any[] = [tenant.tenant_id, start_date, end_date]
    if (user.role === 'manager') {
      where += ` AND e.location_id IN (SELECT location_id FROM manager_locations WHERE tenant_id = $1 AND manager_id = $4)`
      params.push(user.id)
    }

    const res = await query(`
      WITH to_approve AS (
        SELECT te.id FROM time_entries te
        JOIN employees e ON e.id = te.employee_id AND e.tenant_id = te.tenant_id
        WHERE ${where}
      )
      UPDATE time_entries te
      SET approval_status = 'approved', approved_by = $4, approved_at = NOW(), updated_at = NOW()
      WHERE te.id IN (SELECT id FROM to_approve)
      RETURNING te.id
    `, user.role === 'manager' ? [tenant.tenant_id, start_date, end_date, user.id] : [tenant.tenant_id, start_date, end_date, user.id])

    return NextResponse.json({ success: true, approved: res.rows.length })
  } catch (e) {
    console.error('Bulk approve failed', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}


