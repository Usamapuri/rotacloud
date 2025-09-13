import { NextRequest, NextResponse } from 'next/server'
import { query, getShiftSwaps, createShiftSwap } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { z } from 'zod'
import { getTenantContext } from '@/lib/tenant'

// Validation schemas
const createShiftSwapSchema = z.object({
  requester_id: z.string().uuid('Invalid requester ID'),
  target_id: z.string().uuid('Invalid target ID'),
  original_shift_id: z.string().uuid('Invalid original shift ID'),
  requested_shift_id: z.string().uuid('Invalid requested shift ID'),
  reason: z.string().optional(),
})

/**
 * GET /api/shifts/swap-requests
 * Get shift swap requests with filters
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
    const requester_id = searchParams.get('requester_id')
    const target_id = searchParams.get('target_id')
    const status = searchParams.get('status')

    // Build filters
    const filters: any = { tenant_id: tenantContext.tenant_id }
    if (requester_id) filters.requester_id = requester_id
    if (target_id) filters.target_id = target_id
    if (status) filters.status = status

    // Get shift swaps
    const swaps = await getShiftSwaps(filters)

    return NextResponse.json({
      data: swaps,
    })
  } catch (error) {
    console.error('Error in GET /api/shifts/swap-requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/shifts/swap-requests
 * Create a new shift swap request
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
    const validatedData = createShiftSwapSchema.parse(body)

    // Check if requester exists and is active in tenant (and get location)
    const requesterResult = await query(
      'SELECT id, location_id FROM employees WHERE id = $1 AND is_active = true AND tenant_id = $2',
      [validatedData.requester_id, tenantContext.tenant_id]
    )

    if (requesterResult.rows.length === 0) {
      return NextResponse.json({ error: 'Requester not found or inactive' }, { status: 404 })
    }

    // Check if target exists and is active in tenant (and get location)
    const targetResult = await query(
      'SELECT id, location_id FROM employees WHERE id = $1 AND is_active = true AND tenant_id = $2',
      [validatedData.target_id, tenantContext.tenant_id]
    )

    if (targetResult.rows.length === 0) {
      return NextResponse.json({ error: 'Target employee not found or inactive' }, { status: 404 })
    }

    // Check if original shift assignment exists in tenant
    const originalShiftResult = await query(
      'SELECT id FROM shift_assignments WHERE id = $1 AND employee_id = $2 AND tenant_id = $3',
      [validatedData.original_shift_id, validatedData.requester_id, tenantContext.tenant_id]
    )

    if (originalShiftResult.rows.length === 0) {
      return NextResponse.json({ error: 'Original shift assignment not found' }, { status: 404 })
    }

    // Check if requested shift assignment exists in tenant
    const requestedShiftResult = await query(
      'SELECT id FROM shift_assignments WHERE id = $1 AND employee_id = $2 AND tenant_id = $3',
      [validatedData.requested_shift_id, validatedData.target_id, tenantContext.tenant_id]
    )

    if (requestedShiftResult.rows.length === 0) {
      return NextResponse.json({ error: 'Requested shift assignment not found' }, { status: 404 })
    }

    // Eligibility: restrict by location only
    const requesterLocation = requesterResult.rows[0].location_id
    const targetLocation = targetResult.rows[0].location_id
    if (requesterLocation && targetLocation && requesterLocation !== targetLocation) {
      return NextResponse.json({ error: 'Employees are not in the same location and cannot swap' }, { status: 400 })
    }

    // Check for existing swap request in tenant
    const existingSwapResult = await query(
      `SELECT id FROM shift_swaps 
       WHERE requester_id = $1 
       AND target_id = $2 
       AND original_shift_id = $3 
       AND requested_shift_id = $4 
       AND status = 'pending'
       AND tenant_id = $5`,
      [validatedData.requester_id, validatedData.target_id, validatedData.original_shift_id, validatedData.requested_shift_id, tenantContext.tenant_id]
    )

    if (existingSwapResult.rows.length > 0) {
      return NextResponse.json({ error: 'Swap request already exists for these shifts' }, { status: 409 })
    }

    // Create shift swap scoped to tenant
    const swap = await createShiftSwap(validatedData as any, tenantContext.tenant_id)

    return NextResponse.json({ data: swap, message: 'Shift swap request created successfully' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }

    console.error('Error in POST /api/shifts/swap-requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 