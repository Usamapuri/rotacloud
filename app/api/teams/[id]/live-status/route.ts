import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const teamId = id
    const result = await query(
      `SELECT 
         e.id,
         e.first_name,
         e.last_name,
         e.employee_id,
         CASE 
           WHEN te.status = 'in-progress' THEN 'online'
           WHEN te.status = 'break' THEN 'break'
           WHEN bl.status = 'active' THEN 'break'
           WHEN sl.status = 'active' THEN 'online'
           ELSE 'offline'
         END as status,
         COALESCE(te.clock_in, sl.clock_in_time) as clock_in,
         COALESCE(te.clock_out, sl.clock_out_time) as clock_out
       FROM employees e
        LEFT JOIN time_entries te ON e.id = te.employee_id AND te.status IN ('in-progress', 'break')
        LEFT JOIN shift_logs sl ON e.id = sl.employee_id AND sl.status = 'active'
        LEFT JOIN break_logs bl ON e.id = bl.employee_id AND bl.status = 'active'
       WHERE e.team_id = $1 AND e.is_active = true
       ORDER BY e.first_name, e.last_name`,
      [teamId]
    )

    const stats = {
      total_members: result.rows.length,
      online: result.rows.filter((r: any) => r.status === 'online').length,
      on_break: result.rows.filter((r: any) => r.status === 'break').length,
      offline: result.rows.filter((r: any) => r.status === 'offline').length,
    }

    return NextResponse.json({ success: true, data: { members: result.rows, stats } })
  } catch (err) {
    console.error('GET /api/teams/[id]/live-status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
