import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { getTenantContext } from '@/lib/tenant'
import { z } from 'zod'

const bulkApproveSchema = z.object({
  entry_ids: z.array(z.string().uuid()),
  notes: z.string().optional()
})

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const validatedData = bulkApproveSchema.parse(body)

    if (validatedData.entry_ids.length === 0) {
      return NextResponse.json({ error: 'No entries selected for approval' }, { status: 400 })
    }

    // Verify all entries exist and belong to the tenant
    const entriesResult = await query(`
      SELECT id, employee_id, date, clock_in, clock_out, total_hours, break_hours, notes
      FROM time_entries 
      WHERE id = ANY($1) AND tenant_id = $2
    `, [validatedData.entry_ids, tenantContext.tenant_id])

    if (entriesResult.rows.length !== validatedData.entry_ids.length) {
      return NextResponse.json({ error: 'Some entries not found or access denied' }, { status: 404 })
    }

    // Start transaction
    await query('BEGIN')

    try {
      const now = new Date().toISOString()
      let approvedCount = 0

      // Approve each entry
      for (const entry of entriesResult.rows) {
        const updateResult = await query(`
          UPDATE time_entries 
          SET 
            is_approved = true,
            approved_by = $1,
            approved_at = $2,
            notes = CASE 
              WHEN notes IS NULL OR notes = '' THEN $3
              ELSE notes || '\n\nBulk approval: ' || $3
            END,
            updated_at = NOW()
          WHERE id = $4 AND tenant_id = $5
          RETURNING *
        `, [
          user.id,
          now,
          validatedData.notes || 'Bulk approved',
          entry.id,
          tenantContext.tenant_id
        ])

        if (updateResult.rows.length > 0) {
          approvedCount++

          // Create audit log
          await query(`
            INSERT INTO audit_logs (
              tenant_id, user_id, action, table_name, record_id, old_values, new_values, created_at
            ) VALUES ($1, $2, 'APPROVE', 'time_entries', $3, $4, $5, NOW())
          `, [
            tenantContext.tenant_id,
            user.id,
            entry.id,
            JSON.stringify(entry),
            JSON.stringify(updateResult.rows[0])
          ])

          // Create notification for employee
          await query(`
            INSERT INTO notifications (
              user_id, title, message, type, created_at, tenant_id
            ) VALUES ($1, $2, $3, $4, NOW(), $5)
          `, [
            entry.employee_id,
            'Timesheet Entry Approved',
            `Your timesheet entry for ${new Date(entry.date).toLocaleDateString()} has been approved and is ready for payroll.`,
            'success',
            tenantContext.tenant_id
          ])
        }
      }

      await query('COMMIT')

      return NextResponse.json({
        success: true,
        data: {
          approved_count: approvedCount,
          total_requested: validatedData.entry_ids.length
        },
        message: `${approvedCount} timesheet entries approved successfully`
      })

    } catch (error) {
      await query('ROLLBACK')
      throw error
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error in POST /api/admin/timesheet/bulk-approve:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
