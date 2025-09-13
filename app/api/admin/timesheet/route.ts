import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'

interface Discrepancy {
  type: 'late_clock_in' | 'early_clock_out' | 'missing_clock_out' | 'overtime' | 'no_show' | 'extra_break'
  severity: 'warning' | 'error'
  message: string
  minutes?: number
}

function detectDiscrepancies(timeEntry: any, shiftAssignment: any): Discrepancy[] {
  const discrepancies: Discrepancy[] = []
  
  if (!timeEntry.clock_out) {
    discrepancies.push({
      type: 'missing_clock_out',
      severity: 'error',
      message: 'Missing clock-out time'
    })
    return discrepancies // Don't check other discrepancies if clock-out is missing
  }

  // Check for late clock-in
  if (shiftAssignment?.start_time && timeEntry.clock_in) {
    const scheduledStart = new Date(`${timeEntry.date}T${shiftAssignment.start_time}`)
    const actualStart = new Date(timeEntry.clock_in)
    const lateMinutes = Math.floor((actualStart.getTime() - scheduledStart.getTime()) / (1000 * 60))
    
    if (lateMinutes > 5) { // 5 minute grace period
      discrepancies.push({
        type: 'late_clock_in',
        severity: lateMinutes > 15 ? 'error' : 'warning',
        message: `Clock-in was ${lateMinutes} minutes late`,
        minutes: lateMinutes
      })
    }
  }

  // Check for early clock-out
  if (shiftAssignment?.end_time && timeEntry.clock_out) {
    const scheduledEnd = new Date(`${timeEntry.date}T${shiftAssignment.end_time}`)
    const actualEnd = new Date(timeEntry.clock_out)
    const earlyMinutes = Math.floor((scheduledEnd.getTime() - actualEnd.getTime()) / (1000 * 60))
    
    if (earlyMinutes > 5) { // 5 minute grace period
      discrepancies.push({
        type: 'early_clock_out',
        severity: earlyMinutes > 30 ? 'error' : 'warning',
        message: `Clock-out was ${earlyMinutes} minutes early`,
        minutes: earlyMinutes
      })
    }
  }

  // Check for overtime
  if (shiftAssignment?.start_time && shiftAssignment?.end_time && timeEntry.clock_in && timeEntry.clock_out) {
    const scheduledStart = new Date(`${timeEntry.date}T${shiftAssignment.start_time}`)
    const scheduledEnd = new Date(`${timeEntry.date}T${shiftAssignment.end_time}`)
    const actualStart = new Date(timeEntry.clock_in)
    const actualEnd = new Date(timeEntry.clock_out)
    
    const scheduledHours = (scheduledEnd.getTime() - scheduledStart.getTime()) / (1000 * 60 * 60)
    const actualHours = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60)
    
    const overtimeMinutes = Math.floor((actualHours - scheduledHours) * 60)
    
    if (overtimeMinutes > 15) { // 15 minute grace period
      discrepancies.push({
        type: 'overtime',
        severity: overtimeMinutes > 60 ? 'error' : 'warning',
        message: `Worked ${overtimeMinutes} minutes overtime`,
        minutes: overtimeMinutes
      })
    }
  }

  // Check for no-show (scheduled but no time entry)
  if (shiftAssignment && !timeEntry.clock_in) {
    discrepancies.push({
      type: 'no_show',
      severity: 'error',
      message: 'Employee did not clock in for scheduled shift'
    })
  }

  return discrepancies
}

export async function GET(request: NextRequest) {
  try {
    const authMiddleware = createApiAuthMiddleware()
    const { user, isAuthenticated } = await authMiddleware(request)
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or manager
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return NextResponse.json({ error: 'Access denied. Admin or manager role required.' }, { status: 403 })
    }

    const tenantContext = await getTenantContext(user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
    }

    // Get timesheet entries with employee and shift assignment data
    const timesheetQuery = `
      SELECT 
        te.id,
        te.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_code,
        e.department,
        l.name as location_name,
        te.date,
        te.clock_in,
        te.clock_out,
        te.break_hours,
        te.total_hours as actual_hours,
        te.total_hours - te.break_hours as total_approved_hours,
        te.status,
        te.is_approved,
        te.approved_by,
        te.approved_at,
        te.notes,
        sa.start_time as scheduled_start,
        sa.end_time as scheduled_end,
        CASE 
          WHEN sa.start_time AND sa.end_time 
          THEN EXTRACT(EPOCH FROM (sa.end_time::time - sa.start_time::time)) / 3600
          ELSE NULL 
        END as scheduled_hours,
        COALESCE(bl.breaks, '[]'::json) as breaks
      FROM time_entries te
      JOIN employees e ON te.employee_id = e.id AND e.tenant_id = $1
      LEFT JOIN locations l ON e.location_id = l.id AND l.tenant_id = $1
      LEFT JOIN shift_assignments sa ON te.employee_id = sa.employee_id 
        AND te.date = sa.date 
        AND sa.tenant_id = $1
        AND sa.status IN ('scheduled', 'assigned')
      LEFT JOIN (
        SELECT 
          time_entry_id,
          json_agg(
            json_build_object(
              'id', id,
              'break_start', break_start,
              'break_end', break_end,
              'break_duration', break_duration,
              'break_type', break_type,
              'status', status
            )
          ) as breaks
        FROM break_logs 
        WHERE tenant_id = $1
        GROUP BY time_entry_id
      ) bl ON te.id = bl.time_entry_id
      WHERE te.tenant_id = $1
        AND te.date BETWEEN $2 AND $3
      ORDER BY te.date DESC, e.first_name, e.last_name
    `

    const result = await query(timesheetQuery, [tenantContext.tenant_id, startDate, endDate])
    
    // Process entries and detect discrepancies
    const processedEntries = result.rows.map(row => {
      const shiftAssignment = row.scheduled_start ? {
        start_time: row.scheduled_start,
        end_time: row.scheduled_end
      } : null

      const discrepancies = detectDiscrepancies(row, shiftAssignment)
      
      return {
        id: row.id,
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        employee_code: row.employee_code,
        department: row.department,
        location_name: row.location_name,
        date: row.date,
        scheduled_start: row.scheduled_start,
        scheduled_end: row.scheduled_end,
        actual_clock_in: row.clock_in,
        actual_clock_out: row.clock_out,
        scheduled_hours: row.scheduled_hours,
        actual_hours: row.actual_hours,
        break_hours: row.break_hours,
        total_approved_hours: row.total_approved_hours,
        discrepancies,
        is_approved: row.is_approved,
        approved_by: row.approved_by,
        approved_at: row.approved_at,
        notes: row.notes,
        breaks: row.breaks || []
      }
    })

    return NextResponse.json({
      success: true,
      data: processedEntries
    })

  } catch (error) {
    console.error('Error in GET /api/admin/timesheet:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
