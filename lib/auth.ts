// Simple authentication utility for demo purposes
export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'team_lead' | 'project_manager' | 'employee'
  employeeId?: string // legacy: human-readable employee code
  organization_id?: string
  organization_name?: string
  tenant_id?: string
  isImpersonating?: boolean
  originalUser?: { id: string, email: string, role: string }
}

export class AuthService {
  private static readonly ADMIN_KEY = 'adminUser'
  private static readonly EMPLOYEE_KEY = 'employeeId'
  private static readonly SESSION_KEY = 'authSession'
  private static readonly IMPERSONATION_KEY = 'impersonationSession'

  static async adminLogin(username: string, password: string): Promise<AuthUser | null> {
    try {
      // For demo purposes, allow admin login with any valid credentials
      // In production, this should validate against the database
      if (username && password) {
        const user: AuthUser = {
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', // Alex Brown (LogiCode Admin)
          email: 'alex.brown@logicode.com',
          role: 'admin'
        }
        
        if (typeof window !== 'undefined') {
          localStorage.setItem(this.ADMIN_KEY, username)
          localStorage.setItem(this.SESSION_KEY, JSON.stringify(user))
        }
        
        return user
      }
      return null
    } catch (error) {
      console.error('Admin login error:', error)
      return null
    }
  }

  static async employeeLogin(employeeId: string, password: string): Promise<AuthUser | null> {
    try {
      const response = await fetch('/api/auth/employee-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employeeId, password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Login failed')
      }

      const data = await response.json()
      
      if (data.success && data.employee) {
        const normalizedRole = (data.employee.role === 'team_lead' ? 'team_lead' : (data.employee.role === 'project_manager' ? 'project_manager' : 'employee')) as AuthUser['role']
        const user: AuthUser = {
          id: data.employee.id,
          email: data.employee.email,
          role: normalizedRole,
          employeeId: data.employee.employee_id,
          organization_id: data.employee.organization_id,
          organization_name: data.employee.organization_name,
          tenant_id: data.employee.tenant_id
        }
        
        if (typeof window !== 'undefined') {
          // Store human-readable employee code for legacy use, but use UUID for auth
          localStorage.setItem(this.EMPLOYEE_KEY, employeeId)
          localStorage.setItem(this.SESSION_KEY, JSON.stringify(user))
        }
        
        return user
      }
      return null
    } catch (error) {
      console.error('Employee login error:', error)
      return null
    }
  }

  static async unifiedLogin(email: string, password: string): Promise<AuthUser | null> {
    try {
      const response = await fetch('/api/auth/unified-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Login failed')
      }

      const data = await response.json()
      
      if (data.success && data.employee) {
        const normalizedRole = (data.employee.role === 'admin' ? 'admin' : (data.employee.role === 'manager' ? 'manager' : (data.employee.role === 'team_lead' ? 'team_lead' : (data.employee.role === 'project_manager' ? 'project_manager' : 'employee')))) as AuthUser['role']
        const user: AuthUser = {
          id: data.employee.id,
          email: data.employee.email,
          role: normalizedRole,
          employeeId: data.employee.employee_id,
          organization_id: data.employee.organization_id,
          organization_name: data.employee.organization_name,
          tenant_id: data.employee.tenant_id
        }
        
        if (typeof window !== 'undefined') {
          localStorage.setItem(this.EMPLOYEE_KEY, data.employee.employee_id)
          localStorage.setItem(this.SESSION_KEY, JSON.stringify(user))
        }
        
        return user
      }
      return null
    } catch (error) {
      console.error('Unified login error:', error)
      return null
    }
  }

  static async startImpersonation(targetUserId: string, targetUserData: any): Promise<AuthUser> {
    const currentUser = this.getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only admins can impersonate users')
    }

    const impersonatedUser: AuthUser = {
      id: targetUserData.id,
      email: targetUserData.email,
      role: targetUserData.role,
      employeeId: targetUserData.employee_id,
      isImpersonating: true,
      originalUser: {
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.role
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.IMPERSONATION_KEY, JSON.stringify(impersonatedUser))
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(impersonatedUser))
    }

    return impersonatedUser
  }

  static async stopImpersonation(): Promise<AuthUser | null> {
    if (typeof window === 'undefined') return null

    const impersonationSession = localStorage.getItem(this.IMPERSONATION_KEY)
    if (!impersonationSession) {
      throw new Error('No active impersonation session')
    }

    try {
      const impersonatedUser = JSON.parse(impersonationSession)
      const originalUser = impersonatedUser.originalUser

      if (!originalUser) {
        throw new Error('No original user data found')
      }

      // Restore original user session
      const restoredUser: AuthUser = {
        id: originalUser.id,
        email: originalUser.email,
        role: originalUser.role
      }

      localStorage.removeItem(this.IMPERSONATION_KEY)
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(restoredUser))

      return restoredUser
    } catch (error) {
      console.error('Error stopping impersonation:', error)
      return null
    }
  }

  static isImpersonating(): boolean {
    if (typeof window === 'undefined') return false
    
    const impersonationSession = localStorage.getItem(this.IMPERSONATION_KEY)
    return !!impersonationSession
  }

  static getOriginalUser(): AuthUser | null {
    if (typeof window === 'undefined') return null
    
    const impersonationSession = localStorage.getItem(this.IMPERSONATION_KEY)
    if (!impersonationSession) return null

    try {
      const impersonatedUser = JSON.parse(impersonationSession)
      return impersonatedUser.originalUser ? {
        id: impersonatedUser.originalUser.id,
        email: impersonatedUser.originalUser.email,
        role: impersonatedUser.originalUser.role
      } : null
    } catch {
      return null
    }
  }

  static getCurrentUser(): AuthUser | null {
    if (typeof window === 'undefined') return null
    
    // Check for impersonation session first
    const impersonationSession = localStorage.getItem(this.IMPERSONATION_KEY)
    if (impersonationSession) {
      try {
        return JSON.parse(impersonationSession)
      } catch {
        // If impersonation session is corrupted, clean it up
        localStorage.removeItem(this.IMPERSONATION_KEY)
      }
    }
    
    const session = localStorage.getItem(this.SESSION_KEY)
    if (session) {
      try {
        return JSON.parse(session)
      } catch {
        return null
      }
    }
    return null
  }

  static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null
  }

  static isAdmin(): boolean {
    const user = this.getCurrentUser()
    return user?.role === 'admin'
  }

  static isEmployee(): boolean {
    const user = this.getCurrentUser()
    return user?.role === 'employee'
  }

  static isTeamLead(): boolean {
    const user = this.getCurrentUser()
    return user?.role === 'team_lead'
  }

  static isProjectManager(): boolean {
    const user = this.getCurrentUser()
    return user?.role === 'project_manager'
  }

  static logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.ADMIN_KEY)
      localStorage.removeItem(this.EMPLOYEE_KEY)
      localStorage.removeItem(this.SESSION_KEY)
      localStorage.removeItem(this.IMPERSONATION_KEY)
      
      // Redirect to main login page
      window.location.href = '/login'
    }
  }
} 