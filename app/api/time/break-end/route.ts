import { NextRequest, NextResponse } from 'next/server'
import { updateBreakLog, getCurrentBreak, updateShiftLog, query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
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

    // Use authenticated user's ID if employee_id not provided
    const target_employee_id = employee_id || requester_id

    if (!target_employee_id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      )
    }

    // Get current active break
    const currentBreak = await getCurrentBreak(target_employee_id, tenantContext.tenant_id)
    if (!currentBreak) {
      return NextResponse.json(
        { error: 'No active break found' },
        { status: 404 }
      )
    }

    const breakEndTime = new Date()
    const breakStartTime = new Date(currentBreak.break_start)
    const breakDuration = (breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60 * 60) // hours

    // Calculate total break time used (existing + current break duration)
    const existingBreakHours = parseFloat(currentBreak.break_hours) || 0
    const totalBreakTimeUsed = existingBreakHours + breakDuration

    // Update time entry: set break end and return to in-progress
    const updatedBreak = await updateBreakLog(currentBreak.id, {
      break_end_time: breakEndTime.toISOString(),
      break_duration: totalBreakTimeUsed,
      status: 'in-progress'
    })

    // Update employee online status to show they're back from break
    await query(`
      UPDATE employees 
      SET is_online = true, last_online = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, [target_employee_id, tenantContext.tenant_id])

    // Normalize response to BreakLog shape expected by UI
    const normalized = {
      id: updatedBreak.id,
      shift_log_id: updatedBreak.id,
      employee_id: updatedBreak.employee_id,
      break_start_time: updatedBreak.break_start,
      break_start: updatedBreak.break_start,
      break_end_time: updatedBreak.break_end,
      break_duration: updatedBreak.break_hours,
      break_type: 'lunch',
      status: 'completed',
      legacy_status: 'in-progress',
      created_at: updatedBreak.created_at,
      updated_at: updatedBreak.updated_at,
    }

    return NextResponse.json({
      success: true,
      data: normalized,
      message: 'Break ended successfully',
      breakDuration: parseFloat(breakDuration.toFixed(2)),
      totalBreakTimeUsed: parseFloat(totalBreakTimeUsed.toFixed(2))
    })

  } catch (error) {
    console.error('Error ending break:', error)
    return NextResponse.json(
      { error: 'Failed to end break' },
      { status: 500 }
    )
  }
} 