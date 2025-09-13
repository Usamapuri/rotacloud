export const createApiAuthMiddleware = jest.fn(() => async () => ({
  user: { id: 'mgr-123', role: 'manager', email: 'mgr@example.com' },
  isAuthenticated: true,
}))

export const isTeamLead = jest.fn((user?: any) => user?.role === 'team_lead')
export const isAdmin = jest.fn((user?: any) => user?.role === 'admin')
export const isEmployee = jest.fn((user?: any) => user?.role === 'employee')
export const isProjectManager = jest.fn((user?: any) => user?.role === 'project_manager')


