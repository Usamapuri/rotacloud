import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { createApiAuthMiddleware, isAdmin } from '@/lib/api-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const auth = createApiAuthMiddleware()
    const { user, isAuthenticated } = await auth(request)
    if (!isAuthenticated || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: teamId, memberId } = params

    // Verify the team exists
    const teamCheck = await query(
      'SELECT id FROM teams WHERE id = $1 AND is_active = true',
      [teamId]
    )

    if (teamCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Verify the employee is in this team
    const employeeCheck = await query(
      'SELECT id, team_id FROM employees WHERE id = $1 AND team_id = $2 AND is_active = true',
      [memberId, teamId]
    )

    if (employeeCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Employee not found in this team' },
        { status: 404 }
      )
    }

    // Remove employee from team (set team_id to NULL)
    const result = await query(
      `UPDATE employees 
       SET team_id = NULL, updated_at = NOW()
       WHERE id = $1 AND team_id = $2
       RETURNING *`,
      [memberId, teamId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to remove employee from team' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Team member removed successfully'
    })

  } catch (error) {
    console.error('Error removing team member:', error)
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    )
  }
}
