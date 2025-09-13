import { NextRequest } from 'next/server'
import { query } from '@/lib/database'

type ApiUser = {
  id: string
  email?: string
  role: 'admin' | 'manager' | 'employee' | 'team_lead' | 'project_manager'
  employeeId?: string
  isImpersonating?: boolean
  originalUser?: { id: string, email: string, role: string }
}

export function createApiAuthMiddleware() {
  return async (request: NextRequest) => {
    const authHeader = request.headers.get('authorization')
    const employeeHeader = request.headers.get('x-employee-id')

    // Try to resolve user from headers
    let employeeIdOrUuid: string | null = null
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      employeeIdOrUuid = authHeader.split(' ')[1]?.trim() || null
    } else if (employeeHeader) {
      employeeIdOrUuid = employeeHeader.trim()
    }

    let user: ApiUser | null = null
    if (employeeIdOrUuid) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeIdOrUuid)
      const sql = isUuid
        ? 'SELECT id, employee_code, email, role FROM employees WHERE id = $1 AND is_active = true'
        : 'SELECT id, employee_code, email, role FROM employees WHERE employee_code = $1 AND is_active = true'
      const res = await query(sql, [employeeIdOrUuid])
      if (res.rows.length > 0) {
        const e = res.rows[0]
        const role = (e.role as string) || 'employee'
        user = { id: e.id, email: e.email, role: role as any, employeeId: e.employee_code }
        
        // Check if this user is being impersonated
        // For now, we'll rely on the client-side impersonation state
        // In a production environment, you might want to store impersonation state server-side
      }
    }

    // Demo fallback ONLY if explicitly enabled
    const allowDemo = (process.env.DEMO_AUTH ?? '').toLowerCase() === 'true'
    if (!user && allowDemo) {
      user = { id: 'c67f737f-662a-4530-8d07-ba13d56bc54b', email: 'admin@rotaclock.com', role: 'admin', employeeId: 'EMP001' }
    }

    const isAuthenticated = !!user
    return { user, isAuthenticated }
  }
}

export function isAdmin(user: ApiUser | null): boolean {
  return !!user && user.role === 'admin'
}

export function isTeamLead(user: ApiUser | null): boolean {
  return !!user && user.role === 'team_lead'
}

export function isEmployee(user: ApiUser | null): boolean {
  return !!user && user.role === 'employee'
}

export function isProjectManager(user: ApiUser | null): boolean {
  return !!user && user.role === 'project_manager'
}