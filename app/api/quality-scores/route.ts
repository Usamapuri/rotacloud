import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const teamId = searchParams.get('team_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let sql = `
      SELECT 
        qs.*,
        e.first_name,
        e.last_name,
        e.employee_id,
        evaluator.first_name as evaluator_first_name,
        evaluator.last_name as evaluator_last_name
      FROM quality_scores qs
      JOIN employees e ON qs.employee_id = e.id
      JOIN employees evaluator ON qs.evaluator_id = evaluator.id
      WHERE 1=1`
    const params: any[] = []
    let idx = 1

    if (employeeId) { sql += ` AND qs.employee_id = $${idx}`; params.push(employeeId); idx++ }
    if (teamId) { sql += ` AND e.team_id = $${idx}`; params.push(teamId); idx++ }
    if (startDate) { sql += ` AND qs.evaluation_date >= $${idx}`; params.push(startDate); idx++ }
    if (endDate) { sql += ` AND qs.evaluation_date <= $${idx}`; params.push(endDate); idx++ }

    sql += ' ORDER BY qs.evaluation_date DESC'

    const result = await query(sql, params)
    return NextResponse.json({ success: true, data: result.rows })
  } catch (err) {
    console.error('GET /api/quality-scores error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      employee_id,
      evaluator_id,
      call_id,
      score,
      communication_score,
      problem_solving_score,
      customer_service_score,
      compliance_score,
      feedback,
      recommendations
    } = body

    if (!employee_id || score == null) {
      return NextResponse.json({ error: 'employee_id and score are required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO quality_scores (
        employee_id, evaluator_id, call_id, evaluation_date, score,
        communication_score, problem_solving_score, customer_service_score,
        compliance_score, feedback, recommendations
      ) VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        employee_id,
        evaluator_id || null,
        call_id || null,
        score,
        communication_score || null,
        problem_solving_score || null,
        customer_service_score || null,
        compliance_score || null,
        feedback || null,
        recommendations || null,
      ]
    )

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (err) {
    console.error('POST /api/quality-scores error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
