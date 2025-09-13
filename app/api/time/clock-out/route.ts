import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'
import { z } from 'zod'
import { getTenantContext } from '@/lib/tenant'

// Validation schema for clock out with shift remarks
const clockOutSchema = z.object({
	employee_id: z.string().uuid(),
	total_calls_taken: z.number().min(0).optional(),
	leads_generated: z.number().min(0).optional(),
	shift_remarks: z.string().optional(),
	performance_rating: z.number().min(1).max(5).optional(),
})

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

		const body = await request.json()
		const validatedData = clockOutSchema.parse(body)

		const { employee_id, total_calls_taken, leads_generated, shift_remarks, performance_rating } = validatedData
		const requester_id = authResult.user.id

		// Use authenticated user's ID if employee_id not provided
		const target_employee_id = employee_id || requester_id

		// Get active time entry (in-progress)
		const result = await query(
			"SELECT * FROM time_entries WHERE employee_id = $1 AND status = $2 AND tenant_id = $3 ORDER BY created_at DESC LIMIT 1",
			[target_employee_id, 'in-progress', tenantContext.tenant_id]
		)
		
		if (result.rows.length === 0) {
			return NextResponse.json(
				{ error: 'No active shift found' },
				{ status: 404 }
			)
		}

		const currentShift = result.rows[0]
		const clockOutTime = new Date()
		const clockInTime = new Date(currentShift.clock_in)
		
		// Calculate total shift duration
		const totalShiftDuration = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) // hours
		const breakTimeUsed = Number(currentShift.break_hours)
		const totalHours = totalShiftDuration - breakTimeUsed

		// Update time entry with clock out and totals
		const updateResult = await query(
			`UPDATE time_entries SET 
				clock_out = $1, 
				total_hours = $2, 
				break_hours = $3, 
				status = $4,
				approval_status = $5,
				total_calls_taken = $6,
				leads_generated = $7,
				shift_remarks = $8,
				performance_rating = $9,
				updated_at = NOW()
			WHERE id = $10 AND tenant_id = $11 RETURNING *`,
			[
				clockOutTime.toISOString(), 
				totalHours, 
				breakTimeUsed, 
				'completed',
				'pending', // Set approval status to pending
				total_calls_taken || 0,
				leads_generated || 0,
				shift_remarks || null,
				performance_rating || null,
				currentShift.id,
				tenantContext.tenant_id,
			]
		)
		
		const updatedShift = updateResult.rows[0]

		// Update employee online status to offline
		await query(
			`
				UPDATE employees 
				SET is_online = false, last_online = NOW()
				WHERE id = $1 AND tenant_id = $2
			`,
			[target_employee_id, tenantContext.tenant_id]
		)

		// Get employee name for notification
		const employeeResult = await query(
			'SELECT first_name, last_name FROM employees WHERE id = $1 AND tenant_id = $2',
			[target_employee_id, tenantContext.tenant_id]
		)
		const employeeName = employeeResult.rows.length > 0 
			? `${employeeResult.rows[0].first_name} ${employeeResult.rows[0].last_name}`
			: 'Employee'

		// Create notification for admin about pending approval
		await query(
			`
				INSERT INTO notifications (user_id, title, message, type, read, action_url, tenant_id)
				SELECT 
					 e.id,
					 'Shift Approval Required',
					 $1,
					 'info',
					 false,
					 '/admin/shift-approvals',
					 $2
				FROM employees e 
				WHERE e.role = 'admin' AND e.tenant_id = $3
			`,
			[`${employeeName} has completed a shift and requires approval`, tenantContext.tenant_id, tenantContext.tenant_id]
		)

		return NextResponse.json({
			success: true,
			data: updatedShift,
			message: 'Successfully clocked out. Shift submitted for approval.',
			totalShiftDuration: totalShiftDuration.toFixed(2),
			totalWorkHours: totalHours.toFixed(2),
			breakTimeUsed: breakTimeUsed.toFixed(2),
			totalCallsTaken: total_calls_taken || 0,
			leadsGenerated: leads_generated || 0,
			approvalStatus: 'pending',
		})
	} catch (error) {
		console.error('Error in clock out:', error)
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.errors },
				{ status: 400 }
			)
		}
		return NextResponse.json(
			{ error: 'Failed to clock out' },
			{ status: 500 }
		)
	}
} 