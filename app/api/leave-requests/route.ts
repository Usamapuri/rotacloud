import { NextRequest, NextResponse } from 'next/server'
import { query, getLeaveRequests, createLeaveRequest } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { z } from 'zod'

// Validation schemas
const createLeaveRequestSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  type: z.enum(['vacation', 'sick', 'personal', 'bereavement', 'jury-duty', 'other']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  days_requested: z.number().positive('Days requested must be positive'),
  reason: z.string().optional()
})

/**
 * GET /api/leave-requests
 * Get leave requests with filters
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
    const employee_id = searchParams.get('employee_id')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    // Build filters with tenant context
    const filters: any = { tenant_id: tenantContext.tenant_id }
    if (employee_id) filters.employee_id = employee_id
    if (status) filters.status = status
    if (type) filters.type = type
    if (start_date) filters.start_date = start_date
    if (end_date) filters.end_date = end_date

    // Get leave requests
    const requests = await getLeaveRequests(filters)

    return NextResponse.json({
      data: requests
    })

  } catch (error) {
    console.error('Error in GET /api/leave-requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/leave-requests
 * Create a new leave request
 */
export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createLeaveRequestSchema.parse(body)

    // Check if employee exists and is active within tenant
    const employeeResult = await query(
      'SELECT id FROM employees WHERE id = $1 AND is_active = true AND tenant_id = $2',
      [validatedData.employee_id, tenantContext.tenant_id]
    )

    if (employeeResult.rows.length === 0) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 })
    }

    // Validate date range
    const startDate = new Date(validatedData.start_date)
    const endDate = new Date(validatedData.end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (startDate < today) {
      return NextResponse.json({ 
        error: 'Start date cannot be in the past' 
      }, { status: 400 })
    }

    if (endDate < startDate) {
      return NextResponse.json({ 
        error: 'End date must be after start date' 
      }, { status: 400 })
    }

    // Check for overlapping leave requests within tenant
    const overlapResult = await query(
      `SELECT id FROM leave_requests 
       WHERE employee_id = $1 
       AND tenant_id = $2
       AND status IN ('pending', 'approved')
       AND (
         (start_date <= $3 AND end_date >= $3) OR
         (start_date <= $4 AND end_date >= $4) OR
         (start_date >= $3 AND end_date <= $4)
       )`,
      [validatedData.employee_id, tenantContext.tenant_id, validatedData.start_date, validatedData.end_date]
    )

    if (overlapResult.rows.length > 0) {
      return NextResponse.json({ 
        error: 'Leave request overlaps with existing approved or pending request' 
      }, { status: 409 })
    }

    // Create leave request with tenant context
    const leaveRequest = await createLeaveRequest(validatedData, tenantContext.tenant_id)

    return NextResponse.json({ 
      data: leaveRequest,
      message: 'Leave request created successfully' 
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation error', 
        details: error.errors 
      }, { status: 400 })
    }

    console.error('Error in POST /api/leave-requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
