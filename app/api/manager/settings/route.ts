import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { z } from 'zod'

const updateSettingsSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  notification_preferences: z.object({
    email_notifications: z.boolean(),
    shift_reminders: z.boolean(),
    approval_notifications: z.boolean(),
    weekly_reports: z.boolean()
  })
})

export async function GET(request: NextRequest) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    
    if (!isAuthenticated || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.role !== 'manager') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Manager role required.' },
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

    // Get manager's profile information
    const profileQuery = `
      SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e.role,
        e.is_active,
        e.location_id,
        l.name as location_name,
        e.hire_date,
        e.notification_preferences
      FROM employees e
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE e.id = $1 AND e.tenant_id = $2
    `
    const profileResult = await query(profileQuery, [user.id, tenantContext.tenant_id])

    if (profileResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Manager profile not found' },
        { status: 404 }
      )
    }

    const profile = profileResult.rows[0]

    // Get manager's assigned locations
    const assignedLocationsQuery = `
      SELECT l.id, l.name, l.description
      FROM locations l
      JOIN manager_locations ml ON l.id = ml.location_id
      WHERE ml.tenant_id = $1 AND ml.manager_id = $2 AND l.is_active = true
      ORDER BY l.name
    `
    const assignedLocationsResult = await query(assignedLocationsQuery, [
      tenantContext.tenant_id,
      user.id
    ])

    const result = {
      ...profile,
      assigned_locations: assignedLocationsResult.rows,
      notification_preferences: profile.notification_preferences || {
        email_notifications: true,
        shift_reminders: true,
        approval_notifications: true,
        weekly_reports: true
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error in manager settings API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    
    if (!isAuthenticated || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.role !== 'manager') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Manager role required.' },
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
    const validatedData = updateSettingsSchema.parse(body)

    // Check if email is already taken by another user
    const emailCheckQuery = `
      SELECT id FROM employees 
      WHERE email = $1 AND id != $2 AND tenant_id = $3
    `
    const emailCheckResult = await query(emailCheckQuery, [
      validatedData.email,
      user.id,
      tenantContext.tenant_id
    ])

    if (emailCheckResult.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Email address is already in use' },
        { status: 400 }
      )
    }

    // Update the manager's profile
    const updateQuery = `
      UPDATE employees SET
        first_name = $1,
        last_name = $2,
        email = $3,
        phone = $4,
        notification_preferences = $5,
        updated_at = NOW()
      WHERE id = $6 AND tenant_id = $7
      RETURNING *
    `
    const updateResult = await query(updateQuery, [
      validatedData.first_name,
      validatedData.last_name,
      validatedData.email,
      validatedData.phone || null,
      JSON.stringify(validatedData.notification_preferences),
      user.id,
      tenantContext.tenant_id
    ])

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Settings updated successfully'
    })

  } catch (error) {
    console.error('Error updating manager settings:', error)
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
