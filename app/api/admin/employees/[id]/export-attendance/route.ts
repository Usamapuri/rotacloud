import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get employee details
    const employeeResult = await query(`
      SELECT employee_id, first_name, last_name, email
      FROM employees 
      WHERE id = $1
    `, [id])

    if (employeeResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    const employee = employeeResult.rows[0]

    // Get all shift logs for this employee
    const shiftLogsResult = await query(`
      SELECT 
        clock_in_time,
        clock_out_time,
        total_shift_hours,
        break_time_used,
        max_break_allowed,
        is_late,
        is_no_show,
        late_minutes,
        status,
        total_calls_taken,
        leads_generated,
        performance_rating,
        shift_remarks,
        created_at
      FROM shift_logs 
      WHERE employee_id = $1
      ORDER BY clock_in_time DESC
    `, [id])

    const shiftLogs = shiftLogsResult.rows

    // Generate CSV content
    const csvHeaders = [
      'Date',
      'Clock In Time',
      'Clock Out Time',
      'Total Hours',
      'Break Time Used',
      'Max Break Allowed',
      'Is Late',
      'Is No Show',
      'Late Minutes',
      'Status',
      'Total Calls',
      'Leads Generated',
      'Performance Rating',
      'Shift Remarks'
    ].join(',')

    const csvRows = shiftLogs.map(log => [
      new Date(log.clock_in_time).toLocaleDateString(),
      new Date(log.clock_in_time).toLocaleTimeString(),
      log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString() : '',
      log.total_shift_hours || '',
      log.break_time_used || '',
      log.max_break_allowed || '',
      log.is_late ? 'Yes' : 'No',
      log.is_no_show ? 'Yes' : 'No',
      log.late_minutes || '',
      log.status || '',
      log.total_calls_taken || '',
      log.leads_generated || '',
      log.performance_rating || '',
      log.shift_remarks ? `"${log.shift_remarks.replace(/"/g, '""')}"` : ''
    ].join(','))

    const csvContent = [csvHeaders, ...csvRows].join('\n')

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${employee.employee_id}_attendance.csv"`,
      },
    })

  } catch (error) {
    console.error('Error exporting attendance:', error)
    return NextResponse.json(
      { error: 'Failed to export attendance data' },
      { status: 500 }
    )
  }
}
