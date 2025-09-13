import { NextRequest, NextResponse } from 'next/server'
import { query, getShiftAssignments, createShiftAssignment } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { z } from 'zod'
import { getTenantContext } from '@/lib/tenant'

// Validation schemas
const createShiftAssignmentSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  shift_id: z.string().uuid('Invalid shift ID'),
  date: z.string().min(1, 'Date is required'),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  status: z.enum(['assigned', 'confirmed', 'completed', 'cancelled', 'swap-requested']).default('assigned'),
  assigned_by: z.string().uuid().optional(),
  notes: z.string().optional(),
})

/**
 * GET /api/shifts/assignments
 * Get shift assignments with filters
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const employee_id = searchParams.get('employee_id')
    const status = searchParams.get('status')

    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    // Build filters
    const filters: any = {
      start_date,
      end_date,
      tenant_id: tenantContext.tenant_id,
    }
    if (employee_id) filters.employee_id = employee_id
    if (status) filters.status = status

    // Get shift assignments
    const assignments = await getShiftAssignments(filters)

    return NextResponse.json({
      data: assignments,
    })
  } catch (error) {
    console.error('Error in GET /api/shifts/assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/shifts/assignments
 * Create a new shift assignment
 */
export async function POST(request: NextRequest) {
  try {
    // Use demo authentication
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createShiftAssignmentSchema.parse(body)

    // Check if employee exists in tenant
    const employeeResult = await query(
      'SELECT id FROM employees WHERE id = $1 AND is_active = true AND tenant_id = $2',
      [validatedData.employee_id, tenantContext.tenant_id]
    )

    if (employeeResult.rows.length === 0) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 })
    }

    // Check if shift exists in tenant
    const shiftResult = await query(
      'SELECT id FROM shift_templates WHERE id = $1 AND is_active = true AND tenant_id = $2',
      [validatedData.shift_id, tenantContext.tenant_id]
    )

    if (shiftResult.rows.length === 0) {
      return NextResponse.json({ error: 'Shift not found or inactive' }, { status: 404 })
    }

    // Check for conflicting assignments within tenant
    const conflictResult = await query(
      `SELECT id, status FROM shift_assignments 
       WHERE employee_id = $1 
       AND date = $2 
       AND status NOT IN ('cancelled')
       AND tenant_id = $3`,
      [validatedData.employee_id, validatedData.date, tenantContext.tenant_id]
    )

    if (conflictResult.rows.length > 0) {
      return NextResponse.json({ error: 'Employee already has an assignment on this date' }, { status: 409 })
    }

    // Create shift assignment in tenant as draft
    const assignment = await query(
      `INSERT INTO shift_assignments (
        employee_id, template_id, date, start_time, end_time, status, assigned_by, notes, tenant_id, organization_id, is_published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        validatedData.employee_id,
        validatedData.shift_id,
        validatedData.date,
        validatedData.start_time || null,
        validatedData.end_time || null,
        validatedData.status,
        validatedData.assigned_by || user.id,
        validatedData.notes || null,
        tenantContext.tenant_id,
        tenantContext.organization_id,
        false, // Always create as draft
      ]
    )

    return NextResponse.json({ data: assignment.rows[0], message: 'Shift assignment created successfully' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }

    console.error('Error in POST /api/shifts/assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 