import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = createApiAuthMiddleware()
    const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const tenant = await getTenantContext(user.id)
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const { id } = params

    const result = await query(
      `SELECT 
         e.id,
         e.employee_code as employee_id,
         e.first_name,
         e.last_name,
         e.email,
         e.department,
         e.job_position as position,
         e.role,
         e.hire_date,
         e.manager_id,
         e.team_id,
         e.hourly_rate,
         e.max_hours_per_week,
         e.is_active,
         e.is_online,
         e.last_online,
         e.phone,
         e.address,
         e.emergency_contact,
         e.emergency_phone,
         e.notes,
         e.location_id,
         e.created_at,
         e.updated_at,
         r.display_name as role_display_name,
         r.description as role_description,
         l.name as location_name,
         COUNT(DISTINCT sa.id) as total_assignments,
         COUNT(DISTINCT te.id) as total_time_entries,
         COALESCE(SUM(te.total_hours), 0) as total_hours_worked
       FROM employees e
       LEFT JOIN roles r ON e.role = r.name
       LEFT JOIN locations l ON e.location_id = l.id AND l.tenant_id = e.tenant_id
       LEFT JOIN shift_assignments sa ON e.id = sa.employee_id AND sa.tenant_id = e.tenant_id
       LEFT JOIN time_entries te ON e.id = te.employee_id AND te.tenant_id = e.tenant_id
       WHERE e.id = $1 AND e.tenant_id = $2
       GROUP BY e.id, e.employee_code, e.first_name, e.last_name, e.email, e.department, e.job_position, e.role, e.hire_date, e.manager_id, e.team_id, e.hourly_rate, e.max_hours_per_week, e.is_active, e.is_online, e.last_online, e.phone, e.address, e.emergency_contact, e.emergency_phone, e.notes, e.location_id, e.created_at, e.updated_at, r.display_name, r.description, l.name
      `,
      [id, tenant.tenant_id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Error in GET /api/employees/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { z } from 'zod'

// Validation schema for employee updates
const updateEmployeeSchema = z.object({
  first_name: z.string().min(1).nullable().optional().transform(val => val === null ? undefined : val),
  last_name: z.string().min(1).nullable().optional().transform(val => val === null ? undefined : val),
  email: z.string().email().nullable().optional().transform(val => val === null ? undefined : val),
  department: z.string().min(1).nullable().optional().transform(val => val === null ? undefined : val),
  position: z.string().min(1).nullable().optional().transform(val => val === null ? undefined : val),
  hourly_rate: z.union([z.string(), z.number()]).transform((val) => {
    if (val === null || val === undefined || val === '') return undefined
    const num = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(num) ? undefined : num
  }).pipe(z.number().positive()).optional(),
  is_active: z.boolean().optional(),
  max_hours_per_week: z.union([z.string(), z.number()]).transform((val) => {
    if (val === null || val === undefined || val === '') return undefined
    const num = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(num) ? undefined : num
  }).pipe(z.number().positive()).optional(),
  phone: z.string().nullable().optional().transform(val => val === null ? undefined : val),
  role: z.enum(['admin','manager','agent']).optional(),
  team_id: z.string().uuid().nullable().optional().transform(val => val === null ? undefined : val),
  manager_id: z.string().uuid().nullable().optional().transform(val => val === null ? undefined : val),
  address: z.string().nullable().optional().transform(val => val === null ? undefined : val),
  emergency_contact: z.string().nullable().optional().transform(val => val === null ? undefined : val),
  emergency_phone: z.string().nullable().optional().transform(val => val === null ? undefined : val),
  notes: z.string().nullable().optional().transform(val => val === null ? undefined : val),
  location_id: z.string().uuid().nullable().optional().transform(val => val === null ? undefined : val),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const employeeId = params.id
    const body = await request.json()
    
    // Validate the request body
    const validatedData = updateEmployeeSchema.parse(body)
    
    // Check if employee exists within tenant
    const checkQuery = 'SELECT * FROM employees WHERE id = $1 AND tenant_id = $2'
    const checkResult = await query(checkQuery, [employeeId, tenantContext.tenant_id])
      
      if (checkResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        )
      }
      
      const currentEmployee = checkResult.rows[0]
      
      // Build dynamic update query
      const updateFields: string[] = []
      const updateValues: any[] = []
      let paramCount = 1
      
      // Add fields to update
      if (validatedData.first_name !== undefined) {
        updateFields.push(`first_name = $${paramCount}`)
        updateValues.push(validatedData.first_name)
        paramCount++
      }
      
      if (validatedData.last_name !== undefined) {
        updateFields.push(`last_name = $${paramCount}`)
        updateValues.push(validatedData.last_name)
        paramCount++
      }
      
      if (validatedData.email !== undefined) {
        updateFields.push(`email = $${paramCount}`)
        updateValues.push(validatedData.email)
        paramCount++
      }
      
      if (validatedData.department !== undefined) {
        updateFields.push(`department = $${paramCount}`)
        updateValues.push(validatedData.department)
        paramCount++
      }
      
      if (validatedData.position !== undefined) {
        updateFields.push(`position = $${paramCount}`)
        updateValues.push(validatedData.position)
        paramCount++
      }
      
      if (validatedData.hourly_rate !== undefined) {
        updateFields.push(`hourly_rate = $${paramCount}`)
        updateValues.push(validatedData.hourly_rate)
        paramCount++
      }
      
      if (validatedData.is_active !== undefined) {
        updateFields.push(`is_active = $${paramCount}`)
        updateValues.push(validatedData.is_active)
        paramCount++
      }
      
      if (validatedData.max_hours_per_week !== undefined) {
        updateFields.push(`max_hours_per_week = $${paramCount}`)
        updateValues.push(validatedData.max_hours_per_week)
        paramCount++
      }
      
      if (validatedData.phone !== undefined) {
        updateFields.push(`phone = $${paramCount}`)
        updateValues.push(validatedData.phone)
        paramCount++
      }
      
      if (validatedData.address !== undefined) {
        updateFields.push(`address = $${paramCount}`)
        updateValues.push(validatedData.address)
        paramCount++
      }
      
      if (validatedData.emergency_contact !== undefined) {
        updateFields.push(`emergency_contact = $${paramCount}`)
        updateValues.push(validatedData.emergency_contact)
        paramCount++
      }
      
      if (validatedData.emergency_phone !== undefined) {
        updateFields.push(`emergency_phone = $${paramCount}`)
        updateValues.push(validatedData.emergency_phone)
        paramCount++
      }
      
      if (validatedData.notes !== undefined) {
        updateFields.push(`notes = $${paramCount}`)
        updateValues.push(validatedData.notes)
        paramCount++
      }
      
      if (validatedData.role !== undefined) {
        updateFields.push(`role = $${paramCount}`)
        updateValues.push(validatedData.role)
        paramCount++
      }
      
      if (validatedData.team_id !== undefined) {
        updateFields.push(`team_id = $${paramCount}`)
        updateValues.push(validatedData.team_id)
        paramCount++
      }
      
      if (validatedData.manager_id !== undefined) {
        updateFields.push(`manager_id = $${paramCount}`)
        updateValues.push(validatedData.manager_id)
        paramCount++
      }

      if (validatedData.location_id !== undefined) {
        updateFields.push(`location_id = $${paramCount}`)
        updateValues.push(validatedData.location_id)
        paramCount++
      }
      
      // Add updated_at timestamp
      updateFields.push(`updated_at = NOW()`)
      
      // Add employee ID to values array
      updateValues.push(employeeId)
      
      // Execute update query
      const updateQuery = `
        UPDATE employees 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `
      
      const updateResult = await query(updateQuery, updateValues)
      const updatedEmployee = updateResult.rows[0]
      
      // Log department transfer if it occurred
      if (validatedData.department && validatedData.department !== currentEmployee.department) {
        console.log(`Employee ${updatedEmployee.first_name} ${updatedEmployee.last_name} transferred from ${currentEmployee.department} to ${validatedData.department}`)
      }
      
      // Log hourly rate change if it occurred
      if (validatedData.hourly_rate && validatedData.hourly_rate !== currentEmployee.hourly_rate) {
        console.log(`Employee ${updatedEmployee.first_name} ${updatedEmployee.last_name} hourly rate changed from $${currentEmployee.hourly_rate} to $${validatedData.hourly_rate}`)
      }
      
      return NextResponse.json({
        message: 'Employee updated successfully',
        data: updatedEmployee
      })
    
  } catch (error) {
    console.error('Error updating employee:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
