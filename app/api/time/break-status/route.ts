import { NextRequest, NextResponse } from 'next/server'
import { getCurrentBreak } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  try {
    // Authenticate and resolve tenant
    const auth = createApiAuthMiddleware()
    const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const tenant = await getTenantContext(user.id)
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id') || user.id

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      )
    }

    const currentBreak = await getCurrentBreak(employeeId, tenant.tenant_id)

    // Normalize to BreakLog shape expected by UI
    const normalized = currentBreak ? {
      id: currentBreak.id,
      shift_log_id: currentBreak.id,
      employee_id: currentBreak.employee_id,
      break_start_time: currentBreak.break_start,
      break_start: currentBreak.break_start,
      break_end_time: currentBreak.break_end,
      break_duration: currentBreak.break_hours,
      break_type: 'lunch',
      status: 'active',
      legacy_status: 'break',
      created_at: currentBreak.created_at,
      updated_at: currentBreak.updated_at,
    } : null

    return NextResponse.json({
      success: true,
      data: normalized,
      message: currentBreak ? 'Active break found' : 'No active break'
    })

  } catch (error) {
    console.error('Error getting break status:', error)
    return NextResponse.json(
      { error: 'Failed to get break status' },
      { status: 500 }
    )
  }
}
