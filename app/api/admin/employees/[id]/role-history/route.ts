import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    // Get employee email if UUID is provided
    let email = id
    if (isUuid) {
      const employeeResult = await query(`
        SELECT email FROM employees WHERE id = $1
      `, [id])
      
      if (employeeResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        )
      }
      email = employeeResult.rows[0].email
    }

    const result = await query(`
      SELECT 
        id,
        employee_id,
        employee_email,
        old_role,
        new_role,
        assigned_by,
        reason,
        effective_date,
        created_at
      FROM role_assignments
      WHERE employee_email = $1
      ORDER BY created_at DESC
    `, [email])

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching role history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch role history' },
      { status: 500 }
    )
  }
}
