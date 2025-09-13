import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const adminId = searchParams.get('adminId')

  if (!adminId) {
    return NextResponse.json({ error: 'Admin ID required' }, { status: 400 })
  }

  // Set up SSE headers
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (data: any, eventType: string = 'update') => {
        const event = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(event))
      }

      const sendHeartbeat = () => {
        sendEvent({ timestamp: new Date().toISOString() }, 'heartbeat')
      }

      // Send initial data
      const sendInitialData = async () => {
        try {
          // Get dashboard stats
          const stats = await getDashboardStats()
          sendEvent({ type: 'initial', data: stats }, 'dashboard')
        } catch (error) {
          console.error('Error sending initial data:', error)
          sendEvent({ type: 'error', message: 'Failed to load initial data' }, 'error')
        }
      }

      // Send real-time updates
      const sendUpdates = async () => {
        try {
          const updates = await getDashboardUpdates()
          sendEvent({ type: 'update', data: updates }, 'dashboard')
        } catch (error) {
          console.error('Error sending updates:', error)
        }
      }

      // Initial data
      sendInitialData()

      // Set up intervals
      const heartbeatInterval = setInterval(sendHeartbeat, 30000) // 30 seconds
      const updateInterval = setInterval(sendUpdates, 10000) // 10 seconds

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        clearInterval(updateInterval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}

async function getDashboardStats() {
  try {
    // Get employees
    const employeesResult = await query(`
      SELECT 
        COUNT(*) as total_employees,
        COUNT(*) FILTER (WHERE is_active = true) as active_employees
      FROM employees
    `)

    // Get current week shift assignments
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6) // Sunday

    const shiftsResult = await query(`
      SELECT 
        COUNT(*) as total_shifts,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_shifts
      FROM shift_assignments 
      WHERE date >= $1 AND date <= $2
    `, [weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]])

    // Get pending requests
    const swapRequestsResult = await query(`
      SELECT COUNT(*) as pending_swap_requests
      FROM shift_swaps 
      WHERE status = 'pending'
    `)

    const leaveRequestsResult = await query(`
      SELECT COUNT(*) as pending_leave_requests
      FROM leave_requests 
      WHERE status = 'pending'
    `)

    // Get current attendance
    const attendanceResult = await query(`
      SELECT COUNT(*) as current_attendance
      FROM shift_logs 
      WHERE status = 'active'
    `)

    const timeEntriesResult = await query(`
      SELECT COUNT(*) as active_time_entries
      FROM time_entries 
      WHERE status IN ('in-progress', 'break')
    `)

    const stats = {
      totalEmployees: parseInt(employeesResult.rows[0]?.total_employees || '0'),
      activeEmployees: parseInt(employeesResult.rows[0]?.active_employees || '0'),
      totalShifts: parseInt(shiftsResult.rows[0]?.total_shifts || '0'),
      completedShifts: parseInt(shiftsResult.rows[0]?.completed_shifts || '0'),
      pendingSwapRequests: parseInt(swapRequestsResult.rows[0]?.pending_swap_requests || '0'),
      pendingLeaveRequests: parseInt(leaveRequestsResult.rows[0]?.pending_leave_requests || '0'),
      currentAttendance: parseInt(attendanceResult.rows[0]?.current_attendance || '0') + 
                        parseInt(timeEntriesResult.rows[0]?.active_time_entries || '0'),
      weeklyHours: 168, // Mock total weekly hours
      avgHoursPerEmployee: 0, // Will be calculated
      attendanceRate: 0 // Will be calculated
    }

    // Calculate derived stats
    if (stats.totalEmployees > 0) {
      stats.avgHoursPerEmployee = Math.round(168 / stats.totalEmployees)
    }

    const totalTimeEntries = parseInt(timeEntriesResult.rows[0]?.active_time_entries || '0')
    if (totalTimeEntries > 0) {
      stats.attendanceRate = Math.round((stats.currentAttendance / totalTimeEntries) * 100)
    }

    return stats
  } catch (error) {
    console.error('Error getting dashboard stats:', error)
    throw error
  }
}

async function getDashboardUpdates() {
  try {
    // Get recent employees with status
    const employeesResult = await query(`
      SELECT 
        e.id,
        e.employee_code as employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.department,
        e.job_position as position,
        e.is_active,
        CASE 
          WHEN sl.status = 'active' THEN 'online'
          WHEN te.status = 'break' THEN 'break'
          ELSE 'offline'
        END as status
      FROM employees e
      LEFT JOIN shift_logs sl ON e.id = sl.employee_id AND sl.status = 'active'
      LEFT JOIN time_entries te ON e.id = te.employee_id AND te.status IN ('in-progress', 'break')
      WHERE e.is_active = true
      ORDER BY e.first_name, e.last_name
      LIMIT 10
    `)

    // Get recent shift assignments
    const shiftsResult = await query(`
      SELECT 
        sa.id,
        sa.date,
        sa.status,
        e.first_name,
        e.last_name,
        s.name as shift_name,
        s.start_time,
        s.end_time
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.date >= CURRENT_DATE
      ORDER BY sa.date, s.start_time
      LIMIT 10
    `)

    // Get recent swap requests
    const swapRequestsResult = await query(`
      SELECT 
        ss.id,
        ss.status,
        ss.created_at,
        r.first_name as requester_first_name,
        r.last_name as requester_last_name,
        t.first_name as target_first_name,
        t.last_name as target_last_name,
        ss.reason
      FROM shift_swaps ss
      JOIN employees r ON ss.requester_id = r.id
      JOIN employees t ON ss.target_id = t.id
      ORDER BY ss.created_at DESC
      LIMIT 5
    `)

    // Get recent leave requests
    const leaveRequestsResult = await query(`
      SELECT 
        lr.id,
        lr.type,
        lr.start_date,
        lr.end_date,
        lr.status,
        lr.created_at,
        e.first_name,
        e.last_name,
        lr.reason
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      ORDER BY lr.created_at DESC
      LIMIT 5
    `)

    return {
      employees: employeesResult.rows,
      shifts: shiftsResult.rows,
      swapRequests: swapRequestsResult.rows,
      leaveRequests: leaveRequestsResult.rows,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error getting dashboard updates:', error)
    throw error
  }
}
