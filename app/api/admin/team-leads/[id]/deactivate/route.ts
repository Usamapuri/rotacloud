import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = createApiAuthMiddleware()
    const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const teamLeadId = params.id

    // Ensure user exists and is team lead
    const emp = await query('SELECT id FROM employees WHERE id = $1 AND role = $2', [teamLeadId, 'team_lead'])
    if (emp.rows.length === 0) return NextResponse.json({ error: 'Team lead not found' }, { status: 404 })

    // Clear teams led by this lead
    await query('UPDATE teams SET team_lead_id = NULL, updated_at = NOW() WHERE team_lead_id = $1', [teamLeadId])

    // Demote to employee
    const updated = await query("UPDATE employees SET role = 'employee', updated_at = NOW() WHERE id = $1 RETURNING *", [teamLeadId])

    return NextResponse.json({ success: true, data: updated.rows[0], message: 'Team lead deactivated' })
  } catch (err) {
    console.error('POST /api/admin/team-leads/[id]/deactivate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
