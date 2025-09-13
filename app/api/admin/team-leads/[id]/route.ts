import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware } from '@/lib/api-auth'

export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const auth = createApiAuthMiddleware()
		const { user, isAuthenticated } = await auth(request)
		if (!isAuthenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

		const teamLeadId = params.id
		const result = await query(
			`SELECT 
				e.*,
				t.name as team_name,
				t.id as team_id,
				(SELECT COUNT(*) FROM employees m WHERE m.team_id = t.id AND m.is_active = true) as member_count,
				AVG(pm.quality_score) as quality_score,
				AVG(pm.productivity_score) as performance_score
			 FROM employees e
			 LEFT JOIN teams t ON e.team_id = t.id
			 LEFT JOIN performance_metrics pm ON e.id = pm.employee_id
			 WHERE e.id = $1 AND e.role = 'team_lead'
			 GROUP BY e.id, t.id, t.name`,
			[teamLeadId]
		)
		if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
		return NextResponse.json({ success: true, data: result.rows[0] })
	} catch (err) {
		console.error('GET /api/admin/team-leads/[id] error:', err)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
