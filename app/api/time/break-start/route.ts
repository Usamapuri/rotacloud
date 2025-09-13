import { NextRequest, NextResponse } from 'next/server'
import { createBreakLog, getShiftLogs, getCurrentBreak, query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function POST(request: NextRequest) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const authResult = await authMiddleware(request)
    if (!('isAuthenticated' in authResult) || !authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantContext = await getTenantContext(authResult.user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const { employee_id } = await request.json()
    const requester_id = authResult.user.id
    const target_employee_id = employee_id || requester_id

    if (!target_employee_id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    const currentBreak = await getCurrentBreak(target_employee_id)
    if (currentBreak) {
      return NextResponse.json({ error: 'Employee is already on break' }, { status: 400 })
    }

    const shiftLogs = await getShiftLogs({ employee_id: target_employee_id, status: 'in-progress' })
    if (shiftLogs.length === 0) {
      return NextResponse.json({ error: 'No active shift found' }, { status: 404 })
    }

    const currentShift = shiftLogs[0]

    if (currentShift.break_time_used >= currentShift.max_break_allowed) {
      return NextResponse.json({ error: 'Break time limit reached for this shift' }, { status: 400 })
    }

    const shiftStartTime = new Date(currentShift.clock_in)
    const breakStartTime = new Date()
    const elapsedShiftTime = (breakStartTime.getTime() - shiftStartTime.getTime()) / (1000 * 60 * 60)

    const breakLog = await createBreakLog({
      shift_log_id: currentShift.id,
      employee_id: target_employee_id,
      break_start_time: breakStartTime.toISOString(),
      break_type: 'lunch',
      status: 'break',
    })

    await query(
      `UPDATE employees SET is_online = true, last_online = NOW() WHERE id = $1 AND tenant_id = $2`,
      [target_employee_id, tenantContext.tenant_id]
    )

    // Normalize response to BreakLog shape expected by UI
    const normalized = {
      id: breakLog.id,
      shift_log_id: breakLog.id,
      employee_id: breakLog.employee_id,
      break_start_time: breakLog.break_start,
      // Legacy alias for UI fallbacks
      break_start: breakLog.break_start,
      break_end_time: breakLog.break_end || null,
      break_duration: breakLog.break_hours || 0,
      break_type: 'lunch',
      status: 'active',
      // Legacy status alias
      legacy_status: 'break',
      created_at: breakLog.created_at,
      updated_at: breakLog.updated_at,
    }

    return NextResponse.json({ success: true, data: normalized, message: 'Break started successfully', elapsedShiftTime: elapsedShiftTime.toFixed(2) })
  } catch (error) {
    console.error('Error starting break:', error)
    return NextResponse.json({ error: 'Failed to start break' }, { status: 500 })
  }
} 