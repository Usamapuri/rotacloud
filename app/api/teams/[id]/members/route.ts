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
      `SELECT e.id, e.first_name, e.last_name, e.email, e.employee_id, e.is_active
       FROM employees e
       WHERE e.team_id = $1 AND e.is_active = true
       ORDER BY e.first_name, e.last_name`,
      [teamId]
    )
    return NextResponse.json({ success: true, data: result.rows })
  } catch (err) {
    console.error('GET /api/teams/[id]/members error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
