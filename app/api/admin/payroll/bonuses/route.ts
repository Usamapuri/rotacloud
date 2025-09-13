import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { employee_email, payroll_period_id, amount, reason, bonus_type } = await request.json()

    if (!employee_email || !payroll_period_id || !amount || !reason) {
      return NextResponse.json(
        { error: 'Employee email, period ID, amount, and reason are required' },
        { status: 400 }
      )
    }

    // Get employee_id from email for backward compatibility
    const employeeResult = await query(`
      SELECT employee_code FROM employees WHERE email = $1
    `, [employee_email])

    if (employeeResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    const employee_id = employeeResult.rows[0].employee_id

    // Insert the bonus
    const result = await query(`
      INSERT INTO payroll_bonuses (
        employee_id,
        employee_email,
        amount,
        reason,
        bonus_type,
        applied_by,
        applied_date
      ) VALUES ($1, $2, $3, $4, $5, 'admin', NOW())
      RETURNING *
    `, [employee_id, employee_email, amount, reason, bonus_type || 'performance'])

    // Update the payroll record to reflect the new bonus
    await query(`
      UPDATE payroll_records
      SET 
        bonus_amount = (
          SELECT COALESCE(SUM(amount), 0)
          FROM payroll_bonuses
          WHERE employee_email = $1
        ),
        gross_pay = base_salary + hourly_pay + overtime_pay + (
          SELECT COALESCE(SUM(amount), 0)
          FROM payroll_bonuses
          WHERE employee_email = $1
        ),
        net_pay = (base_salary + hourly_pay + overtime_pay + (
          SELECT COALESCE(SUM(amount), 0)
          FROM payroll_bonuses
          WHERE employee_email = $1
        )) - deductions_amount,
        updated_at = NOW()
      WHERE employee_email = $1 AND payroll_period_id = $2
    `, [employee_email, payroll_period_id])

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error adding bonus:', error)
    return NextResponse.json(
      { error: 'Failed to add bonus' },
      { status: 500 }
    )
  }
}
