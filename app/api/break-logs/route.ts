import { NextRequest, NextResponse } from 'next/server'
import { getBreakLogs } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  try {
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
    const employee_id = searchParams.get('employee_id') || undefined
    const shift_log_id = searchParams.get('shift_log_id') || undefined
    const start_date = searchParams.get('start_date') || undefined
    const end_date = searchParams.get('end_date') || undefined
    const status = searchParams.get('status') || undefined

    const logs = await getBreakLogs({ employee_id, shift_log_id, start_date, end_date, status })

    // Normalize rows to BreakLog shape for admin UI
    const data = logs.map((row: any) => ({
      id: row.id,
      shift_log_id: row.id,
      employee_id: row.employee_id,
      break_start_time: row.break_start,
      break_end_time: row.break_end,
      break_duration: row.break_hours,
      break_type: 'lunch',
      status: row.status === 'break' ? 'active' : row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      first_name: row.first_name,
      last_name: row.last_name,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in GET /api/break-logs:', error)
    return NextResponse.json({ error: 'Failed to get break logs' }, { status: 500 })
  }
}

// Duplicate block removed to fix build error
