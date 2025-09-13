import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teamId = params.id
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const employeeId = searchParams.get('employee_id')

    let sql = `
      SELECT 
        ta.*,
        e.first_name,
        e.last_name,
        e.employee_id
      FROM training_assignments ta
      JOIN employees e ON ta.employee_id = e.id
      WHERE e.team_id = $1`
    const paramsArr: any[] = [teamId]
    let idx = 2

    if (status) { sql += ` AND ta.status = $${idx}`; paramsArr.push(status); idx++ }
    if (employeeId) { sql += ` AND ta.employee_id = $${idx}`; paramsArr.push(employeeId); idx++ }

    sql += ' ORDER BY ta.due_date ASC, e.first_name'

    const result = await query(sql, paramsArr)
    return NextResponse.json({ success: true, data: result.rows })
  } catch (err) {
    console.error('GET /api/teams/[id]/training-assignments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teamId = params.id
    const body = await request.json()
    const { employee_id, training_type, training_title, description, due_date } = body

    if (!employee_id || !training_type || !training_title) {
      return NextResponse.json({ error: 'employee_id, training_type, training_title are required' }, { status: 400 })
    }

    // ensure employee is in team
          const emp = await query('SELECT id FROM employees WHERE id = $1 AND team_id = $2', [employee_id, teamId])
    if (emp.rows.length === 0) return NextResponse.json({ error: 'Employee not in team' }, { status: 400 })

    const result = await query(
      `INSERT INTO training_assignments (
        employee_id, assigned_by, training_type, training_title, description, due_date, status
      ) VALUES ($1,$2,$3,$4,$5,$6,'assigned') RETURNING *`,
      [employee_id, null, training_type, training_title, description || null, due_date || null]
    )

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (err) {
    console.error('POST /api/teams/[id]/training-assignments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
