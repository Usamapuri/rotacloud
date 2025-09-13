import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { z } from 'zod'

const editTimesheetSchema = z.object({
  clock_in: z.string().optional(),
  clock_out: z.string().optional(),
  break_hours: z.number().min(0).optional(),
  notes: z.string().optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or manager
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return NextResponse.json({ error: 'Access denied. Admin or manager role required.' }, { status: 403 })
    }

    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const validatedData = editTimesheetSchema.parse(body)

    // Get the current timesheet entry
    const currentResult = await query(`
      SELECT * FROM time_entries 
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantContext.tenant_id])

    if (currentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Timesheet entry not found' }, { status: 404 })
    }

    const currentEntry = currentResult.rows[0]

    // Calculate new total hours if clock times are updated
    let newTotalHours = currentEntry.total_hours
    if (validatedData.clock_in || validatedData.clock_out) {
      const clockIn = validatedData.clock_in ? new Date(validatedData.clock_in) : new Date(currentEntry.clock_in)
      const clockOut = validatedData.clock_out ? new Date(validatedData.clock_out) : new Date(currentEntry.clock_out)
      
      if (clockIn && clockOut) {
        const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
        newTotalHours = Math.max(0, hoursWorked - (validatedData.break_hours || currentEntry.break_hours || 0))
      }
    }

    // Build update query dynamically
    const updateFields = []
    const updateValues = []
    let paramIndex = 1

    if (validatedData.clock_in !== undefined) {
      updateFields.push(`clock_in = $${paramIndex}`)
      updateValues.push(validatedData.clock_in)
      paramIndex++
    }

    if (validatedData.clock_out !== undefined) {
      updateFields.push(`clock_out = $${paramIndex}`)
      updateValues.push(validatedData.clock_out)
      paramIndex++
    }

    if (validatedData.break_hours !== undefined) {
      updateFields.push(`break_hours = $${paramIndex}`)
      updateValues.push(validatedData.break_hours)
      paramIndex++
    }

    if (validatedData.notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`)
      updateValues.push(validatedData.notes)
      paramIndex++
    }

    // Always update total_hours and updated_at
    updateFields.push(`total_hours = $${paramIndex}`)
    updateValues.push(newTotalHours)
    paramIndex++

    updateFields.push(`updated_at = NOW()`)

    // If any time fields were updated, reset approval status
    if (validatedData.clock_in !== undefined || validatedData.clock_out !== undefined || validatedData.break_hours !== undefined) {
      updateFields.push(`is_approved = false`)
      updateFields.push(`approved_by = NULL`)
      updateFields.push(`approved_at = NULL`)
    }

    const updateQuery = `
      UPDATE time_entries 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `

    updateValues.push(id, tenantContext.tenant_id)

    const updateResult = await query(updateQuery, updateValues)

    if (updateResult.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to update timesheet entry' }, { status: 500 })
    }

    const updatedEntry = updateResult.rows[0]

    // Create audit log entry
    await query(`
      INSERT INTO audit_logs (
        tenant_id, user_id, action, table_name, record_id, old_values, new_values, created_at
      ) VALUES ($1, $2, 'UPDATE', 'time_entries', $3, $4, $5, NOW())
    `, [
      tenantContext.tenant_id,
      user.id,
      id,
      JSON.stringify(currentEntry),
      JSON.stringify(updatedEntry)
    ])

    return NextResponse.json({
      success: true,
      data: updatedEntry,
      message: 'Timesheet entry updated successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error in PATCH /api/admin/timesheet/[id]:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
