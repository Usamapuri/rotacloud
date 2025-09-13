import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    let row: any = null
    try {
      const res = await query(`SELECT allow_manager_approvals, pay_period_type, custom_period_days, week_start_day FROM tenant_settings WHERE tenant_id = $1`, [tenant.tenant_id])
      row = res.rows[0] || null
    } catch (e: any) {
      // Auto-bootstrap table if missing (dev env convenience)
      if (String(e?.message || '').includes('tenant_settings')) {
        await query(`CREATE TABLE IF NOT EXISTS tenant_settings (
          tenant_id VARCHAR(80) PRIMARY KEY,
          allow_manager_approvals BOOLEAN DEFAULT false,
          pay_period_type VARCHAR(20) DEFAULT 'weekly',
          custom_period_days INTEGER,
          week_start_day INTEGER DEFAULT 1,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`)
      }
    }
    row = row || { allow_manager_approvals:false, pay_period_type:'weekly', custom_period_days:null, week_start_day:1 }
    return NextResponse.json({ success: true, data: row })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = createApiAuthMiddleware(); const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const tenant = await getTenantContext(user.id); if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    const { allow_manager_approvals, pay_period_type, custom_period_days, week_start_day } = await request.json()
    await query(`INSERT INTO tenant_settings (tenant_id, allow_manager_approvals, pay_period_type, custom_period_days, week_start_day)
                 VALUES ($1,$2,COALESCE($3,'weekly'),$4,COALESCE($5,1))
                 ON CONFLICT (tenant_id) DO UPDATE SET
                   allow_manager_approvals = EXCLUDED.allow_manager_approvals,
                   pay_period_type = EXCLUDED.pay_period_type,
                   custom_period_days = EXCLUDED.custom_period_days,
                   week_start_day = EXCLUDED.week_start_day,
                   updated_at = NOW()`,
      [tenant.tenant_id, !!allow_manager_approvals, pay_period_type, custom_period_days ?? null, week_start_day ?? 1])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}


