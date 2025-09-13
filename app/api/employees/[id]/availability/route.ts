import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { z } from 'zod'

// Validation schema for availability updates
const availabilitySchema = z.object({
  day_of_week: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  is_available: z.boolean()
})

const updateAvailabilitySchema = z.object({
  availability: z.array(availabilitySchema)
})

/**
 * GET /api/employees/[id]/availability
 * Get employee availability schedule
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

    // Check if user is accessing their own availability or is admin
    if (user?.role !== 'admin' && user?.id !== id) {
      return NextResponse.json({ error: 'Forbidden: Can only access own availability' }, { status: 403 })
    }

    // Get employee availability
    const availabilityResult = await query(`
      SELECT 
        id,
        employee_id,
        day_of_week,
        start_time,
        end_time,
        is_available,
        created_at,
        updated_at
      FROM employee_availability
      WHERE employee_id = $1
      ORDER BY day_of_week
    `, [id])

    return NextResponse.json({ availability: availabilityResult.rows })

  } catch (error) {
    console.error('Error in GET /api/employees/[id]/availability:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/employees/[id]/availability
 * Update employee availability schedule
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

    // Check if user is updating their own availability or is admin
    if (user?.role !== 'admin' && user?.id !== id) {
      return NextResponse.json({ error: 'Forbidden: Can only update own availability' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validate input
    const validationResult = updateAvailabilitySchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationResult.error.errors 
      }, { status: 400 })
    }

    const { availability } = validationResult.data

    // Check if employee exists
    const existingEmployeeResult = await query(`
      SELECT id FROM employees WHERE id = $1
    `, [id])

    if (existingEmployeeResult.rows.length === 0) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Delete existing availability records for this employee
    await query(`
      DELETE FROM employee_availability WHERE employee_id = $1
    `, [id])

    // Insert new availability records
    if (availability.length > 0) {
      const values = availability.map((avail, index) => {
        const baseIndex = index * 4
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`
      }).join(', ')

      const params = availability.flatMap(avail => [
        id,
        avail.day_of_week,
        avail.start_time,
        avail.is_available
      ])

      const insertResult = await query(`
        INSERT INTO employee_availability (employee_id, day_of_week, start_time, is_available)
        VALUES ${values}
        RETURNING 
          id,
          employee_id,
          day_of_week,
          start_time,
          end_time,
          is_available,
          created_at,
          updated_at
      `, params)

      return NextResponse.json({ 
        availability: insertResult.rows,
        message: 'Availability updated successfully' 
      })
    }

    return NextResponse.json({ 
      availability: [],
      message: 'Availability cleared successfully' 
    })

  } catch (error) {
    console.error('Error in PUT /api/employees/[id]/availability:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 