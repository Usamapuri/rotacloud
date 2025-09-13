import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { z } from 'zod'

const updateLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  description: z.string().optional(),
  is_active: z.boolean().optional()
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: locationId } = params
    
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    
    if (!isAuthenticated || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin role required.' },
        { status: 403 }
      )
    }

    // Get tenant context
    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json(
        { success: false, error: 'No tenant context found' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateLocationSchema.parse(body)

    // Check if location exists and belongs to tenant
    const locationCheckQuery = `
      SELECT id FROM locations 
      WHERE id = $1 AND tenant_id = $2
    `
    const locationCheckResult = await query(locationCheckQuery, [locationId, tenantContext.tenant_id])

    if (locationCheckResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Location not found' },
        { status: 404 }
      )
    }

    // Update the location
    const updateQuery = `
      UPDATE locations SET
        name = $1,
        description = $2,
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
      WHERE id = $4 AND tenant_id = $5
      RETURNING *
    `
    const updateResult = await query(updateQuery, [
      validatedData.name,
      validatedData.description || null,
      validatedData.is_active,
      locationId,
      tenantContext.tenant_id
    ])

    return NextResponse.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Location updated successfully'
    })

  } catch (error) {
    console.error('Error updating location:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: locationId } = params
    
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    
    if (!isAuthenticated || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin role required.' },
        { status: 403 }
      )
    }

    // Get tenant context
    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json(
        { success: false, error: 'No tenant context found' },
        { status: 403 }
      )
    }

    // Check if location exists and belongs to tenant
    const locationCheckQuery = `
      SELECT id FROM locations 
      WHERE id = $1 AND tenant_id = $2
    `
    const locationCheckResult = await query(locationCheckQuery, [locationId, tenantContext.tenant_id])

    if (locationCheckResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Location not found' },
        { status: 404 }
      )
    }

    // Check if location has employees or managers assigned
    const assignmentCheckQuery = `
      SELECT 
        (SELECT COUNT(*) FROM employees WHERE location_id = $1) as employee_count,
        (SELECT COUNT(*) FROM manager_locations WHERE location_id = $1) as manager_count
    `
    const assignmentCheckResult = await query(assignmentCheckQuery, [locationId])
    const { employee_count, manager_count } = assignmentCheckResult.rows[0]

    if (employee_count > 0 || manager_count > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot delete location. It has ${employee_count} employees and ${manager_count} managers assigned. Please reassign them first.` 
        },
        { status: 400 }
      )
    }

    // Delete the location
    const deleteQuery = `
      DELETE FROM locations 
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `
    const deleteResult = await query(deleteQuery, [locationId, tenantContext.tenant_id])

    return NextResponse.json({
      success: true,
      data: deleteResult.rows[0],
      message: 'Location deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting location:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
