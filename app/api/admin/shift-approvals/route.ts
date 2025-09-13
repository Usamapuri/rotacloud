import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { query as db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authMiddleware = createApiAuthMiddleware()
    const authResult = await authMiddleware(request)
    if (!('isAuthenticated' in authResult) || !authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow admins and managers; managers will be location-scoped if permitted by settings
    if (!(authResult.user.role === 'admin' || authResult.user.role === 'manager')) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
    }

    const tenantContext = await getTenantContext(authResult.user.id)
    if (!tenantContext) {
      return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    }

    // Check tenant setting: allow_manager_approvals
    let managerAllowed = false
    if (authResult.user.role === 'manager') {
      const s = await db(`SELECT allow_manager_approvals FROM tenant_settings WHERE tenant_id = $1`, [tenantContext.tenant_id])
      managerAllowed = s.rows[0]?.allow_manager_approvals === true
      if (!managerAllowed) {
        return NextResponse.json({ error: 'Manager approvals disabled by settings' }, { status: 403 })
      }
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build the query based on status filter and role scoping
    const whereParts: string[] = ['te.tenant_id = $1', "te.status = 'completed'"]
    const params: any[] = [tenantContext.tenant_id]

    if (status === 'pending') {
      whereParts.push("te.approval_status = 'pending'")
    } else if (status === 'approved') {
      whereParts.push("te.approval_status = 'approved'")
    } else if (status === 'rejected') {
      whereParts.push("te.approval_status = 'rejected'")
    } else if (status === 'all') {
      whereParts.push("te.approval_status IN ('pending','approved','rejected')")
    }

    // If manager, restrict to their assigned locations
    if (authResult.user.role === 'manager') {
      const idx = params.length + 1
      whereParts.push(`e.location_id IN (SELECT location_id FROM manager_locations WHERE tenant_id = $1 AND manager_id = $${idx})`)
      params.push(authResult.user.id)
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM time_entries te
      JOIN employees e ON te.employee_id = e.id AND e.tenant_id = te.tenant_id
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = parseInt(countResult.rows[0].total)

    // Get shift approvals with pagination
    const approvalsQuery = `
      SELECT 
        te.id,
        te.employee_id,
        te.assignment_id,
        te.clock_in,
        te.clock_out,
        te.total_hours,
        te.break_hours,
        te.total_calls_taken,
        te.leads_generated,
        te.shift_remarks,
        te.performance_rating,
        te.approval_status,
        te.admin_notes,
        te.rejection_reason,
        te.created_at,
        te.updated_at,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department,
        e.job_position,
        e.hourly_rate,
        sa.date as shift_date,
        s.name as shift_name,
        s.start_time as scheduled_start_time,
        s.end_time as scheduled_end_time,
        approver.first_name as approver_first_name,
        approver.last_name as approver_last_name,
        -- discrepancy flags
        (CASE WHEN te.clock_in IS NULL OR te.clock_out IS NULL THEN true ELSE false END) AS missing_events,
        (CASE WHEN te.clock_in IS NOT NULL AND s.start_time IS NOT NULL AND te.clock_in::time > (s.start_time + interval '5 minute') THEN true ELSE false END) AS is_late,
        (CASE WHEN te.clock_out IS NOT NULL AND s.end_time IS NOT NULL AND te.clock_out::time < (s.end_time - interval '5 minute') THEN true ELSE false END) AS early_leave,
        (CASE WHEN te.total_hours IS NOT NULL AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL AND (te.total_hours > (extract(epoch from (s.end_time - s.start_time))/3600.0 + 0.25)) THEN true ELSE false END) AS overtime
      FROM time_entries te
      JOIN employees e ON te.employee_id = e.id AND e.tenant_id = te.tenant_id
      LEFT JOIN shift_assignments sa ON te.assignment_id = sa.id AND sa.tenant_id = te.tenant_id
      LEFT JOIN shift_templates s ON sa.template_id = s.id AND s.tenant_id = te.tenant_id
      LEFT JOIN employees approver ON te.approved_by = approver.id AND approver.tenant_id = te.tenant_id
      ${whereClause}
      ORDER BY te.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    
    const approvalsResult = await query(approvalsQuery, [...params, limit, offset])
    const approvals = approvalsResult.rows

    // Calculate summary statistics
    // Summary statistics (scoped for manager if applicable)
    let statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE te.approval_status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE te.approval_status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE te.approval_status = 'rejected') as rejected_count,
        SUM(te.total_hours) FILTER (WHERE te.approval_status = 'pending') as pending_hours,
        SUM(te.total_hours) FILTER (WHERE te.approval_status = 'approved') as approved_hours
      FROM time_entries te
      JOIN employees e ON e.id = te.employee_id AND e.tenant_id = te.tenant_id
      WHERE te.approval_status IN ('pending', 'approved', 'rejected') AND te.status = 'completed' AND te.tenant_id = $1
    `
    const statsParams: any[] = [tenantContext.tenant_id]
    if (authResult.user.role === 'manager') {
      const idx = statsParams.length + 1
      statsQuery += ` AND e.location_id IN (
        SELECT location_id FROM manager_locations WHERE tenant_id = $1 AND manager_id = $${idx}
      )`
      statsParams.push(authResult.user.id)
    }
    const statsResult = await query(statsQuery, statsParams)
    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        approvals,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          pending: parseInt(stats.pending_count) || 0,
          approved: parseInt(stats.approved_count) || 0,
          rejected: parseInt(stats.rejected_count) || 0,
          pendingHours: parseFloat(stats.pending_hours) || 0,
          approvedHours: parseFloat(stats.approved_hours) || 0
        }
      }
    })

  } catch (error) {
    console.error('Error fetching shift approvals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shift approvals' },
      { status: 500 }
    )
  }
}
