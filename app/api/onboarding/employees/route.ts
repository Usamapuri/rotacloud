import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"

export async function GET() {
  try {
    const employeesResult = await query(`
      SELECT * FROM employees
      WHERE is_active = true
      ORDER BY created_at DESC
    `)

    return NextResponse.json({ employees: employeesResult.rows })
  } catch (error) {
    console.error("Error fetching employees:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { employee_id, first_name, last_name, email, department, position, hire_date, manager_id } = body

    const employeeResult = await query(`
      INSERT INTO employees (employee_id, first_name, last_name, email, department, position, hire_date, manager_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [employee_id, first_name, last_name, email, department, position, hire_date, manager_id, true])

    return NextResponse.json({ employee: employeeResult.rows[0] })
  } catch (error) {
    console.error("Error creating employee:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
