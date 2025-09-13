import { NextRequest, NextResponse } from 'next/server'
import { query, getLeaveRequests } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { z } from 'zod'

// Validation schema for leave requests
const createLeaveRequestSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  leave_type: z.enum(['vacation', 'sick', 'personal', 'bereavement', 'other']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).default('pending')
})

const updateLeaveRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
  admin_notes: z.string().optional()
})

/**
 * GET /api/employees/leave-requests
 * Get leave requests (filtered by user role and permissions)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const employeeId = searchParams.get('employee_id')
    const leaveType = searchParams.get('leave_type')

    // Build filters
    const filters: any = {}
    if (status) filters.status = status
    if (employeeId) filters.employee_id = employeeId
    if (leaveType) filters.type = leaveType

    // Get leave requests
    const leaveRequests = await getLeaveRequests(filters)

    return NextResponse.json({ data: leaveRequests })

  } catch (error) {
    console.error('Error in GET /api/employees/leave-requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/employees/leave-requests
 * Create a new leave request
 */
export async function POST(request: NextRequest) {
  try {
    // Use demo authentication
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate input
    const validationResult = createLeaveRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationResult.error.errors 
      }, { status: 400 })
    }

    const { employee_id, leave_type, start_date, end_date, reason, status } = validationResult.data

    // Check permissions - employees can only create requests for themselves
    if (user?.role !== 'admin' && user?.id !== employee_id) {
      return NextResponse.json({ error: 'You can only create leave requests for yourself' }, { status: 403 })
    }

    // Verify that the employee exists
    const employeeResult = await query(`
      SELECT id FROM employees WHERE id = $1
    `, [employee_id])

    if (employeeResult.rows.length === 0) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Validate date range
    const startDate = new Date(start_date)
    const endDate = new Date(end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (startDate < today) {
      return NextResponse.json({ error: 'Start date cannot be in the past' }, { status: 400 })
    }

    if (endDate < startDate) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 })
    }

    // Check for overlapping leave requests
    const overlappingRequestsResult = await query(`
      SELECT id FROM leave_requests
      WHERE employee_id = $1 
      AND status IN ('pending', 'approved')
      AND (
        (start_date <= $2 AND end_date >= $3) OR
        (start_date <= $3 AND end_date >= $2) OR
        (start_date >= $2 AND end_date <= $3)
      )
      LIMIT 1
    `, [employee_id, end_date, start_date])

    if (overlappingRequestsResult.rows.length > 0) {
      return NextResponse.json({ error: 'You have overlapping leave requests for this period' }, { status: 409 })
    }

    // Calculate days requested
    const daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Create the leave request
    const leaveRequestResult = await query(`
      INSERT INTO leave_requests (employee_id, type, start_date, end_date, days_requested, reason, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id,
        employee_id,
        type as leave_type,
        start_date,
        end_date,
        days_requested,
        reason,
        status,
        admin_notes,
        created_at,
        updated_at
    `, [employee_id, leave_type, start_date, end_date, daysRequested, reason, status])

    return NextResponse.json({ 
      leaveRequest: leaveRequestResult.rows[0],
      message: 'Leave request created successfully' 
    }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/employees/leave-requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 