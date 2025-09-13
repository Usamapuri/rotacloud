import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { z } from 'zod'

// Validation schema for profile updates
const updateProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').optional(),
  last_name: z.string().min(1, 'Last name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  hourly_rate: z.number().positive('Hourly rate must be positive').optional(),
  max_hours_per_week: z.number().positive('Max hours must be positive').optional(),
  // Add more fields as needed for profile management
})

/**
 * GET /api/employees/[id]/profile
 * Get employee profile data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    // Use demo authentication
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is accessing their own profile or is admin
    if (user?.role !== 'admin' && user?.id !== id) {
      return NextResponse.json({ error: 'Forbidden: Can only access own profile' }, { status: 403 })
    }

    // Get employee profile
    const employeeResult = await query(`
      SELECT 
        id,
        employee_id,
        first_name,
        last_name,
        email,
        department,
        position,
        hire_date,
        hourly_rate,
        max_hours_per_week,
        is_active,
        created_at,
        updated_at
      FROM employees
      WHERE id = $1
    `, [id])

    if (employeeResult.rows.length === 0) {
      console.error('Error fetching employee profile: Employee not found')
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json({ employee: employeeResult.rows[0] })

  } catch (error) {
    console.error('Error in GET /api/employees/[id]/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/employees/[id]/profile
 * Update employee profile data
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    // Use demo authentication
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is updating their own profile or is admin
    if (user?.role !== 'admin' && user?.id !== id) {
      return NextResponse.json({ error: 'Forbidden: Can only update own profile' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validate input
    const validationResult = updateProfileSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationResult.error.errors 
      }, { status: 400 })
    }

    const updateData = validationResult.data

    // Check if employee exists
    const existingEmployeeResult = await query(`
      SELECT id FROM employees WHERE id = $1
    `, [id])

    if (existingEmployeeResult.rows.length === 0) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Build dynamic update query
    const updateFields = Object.keys(updateData).filter(key => updateData[key as keyof typeof updateData] !== undefined)
    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ')
    const values = [id, ...updateFields.map(field => updateData[field as keyof typeof updateData])]

    // Update employee profile
    const employeeResult = await query(`
      UPDATE employees 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING 
        id,
        employee_id,
        first_name,
        last_name,
        email,
        department,
        position,
        hire_date,
        hourly_rate,
        max_hours_per_week,
        is_active,
        created_at,
        updated_at
    `, values)

    return NextResponse.json({ 
      employee: employeeResult.rows[0],
      message: 'Profile updated successfully' 
    })

  } catch (error) {
    console.error('Error in PUT /api/employees/[id]/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 