import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0]

    const result = await query(
      `SELECT pm.*, e.first_name, e.last_name, e.employee_id
       FROM performance_metrics pm
       JOIN employees e ON pm.employee_id = e.id
       WHERE e.team_id = $1 AND pm.date BETWEEN $2 AND $3
       ORDER BY pm.date DESC, e.first_name`,
      [teamId, startDate, endDate]
    )

    const teamStats = await query(
      `SELECT 
         AVG(pm.calls_handled) as avg_calls_handled,
         AVG(pm.avg_handle_time) as avg_handle_time,
         AVG(pm.customer_satisfaction) as avg_customer_satisfaction,
         AVG(pm.first_call_resolution_rate) as avg_fcr_rate,
         AVG(pm.productivity_score) as avg_productivity_score,
         AVG(pm.quality_score) as avg_quality_score,
         SUM(pm.calls_handled) as total_calls_handled,
         COUNT(DISTINCT pm.employee_id) as active_employees
       FROM performance_metrics pm
       JOIN employees e ON pm.employee_id = e.id
       WHERE e.team_id = $1 AND pm.date BETWEEN $2 AND $3`,
      [teamId, startDate, endDate]
    )

    return NextResponse.json({ success: true, data: { members: result.rows, teamStats: teamStats.rows[0] } })
  } catch (err) {
    console.error('GET /api/performance-metrics/team/[teamId] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
