"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, 
  Clock, 
  Calendar, 
  TrendingUp, 
  Plus,
  LogOut,
  UserPlus,
  Settings,
  BarChart3,
  AlertCircle,
  CheckCircle,
  XCircle,
  Bell,
  Loader2,
  Eye,
  RefreshCw,
  FileText,
  UserCheck,
  UserX
} from 'lucide-react'
import { AuthService } from '@/lib/auth'
import { apiService } from '@/lib/api-service'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useDashboardPolling } from '@/lib/hooks/use-dashboard-polling'
import { ImpersonationModal } from '@/components/admin/ImpersonationModal'

interface Employee {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string
  department?: string
  position?: string
  is_active: boolean
}

interface Shift {
  id: string
  name: string
  start_time: string
  end_time: string
  department?: string
  required_staff: number
  hourly_rate?: number
  color: string
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

interface TimeEntry {
  id: string
  employee_id: string
  shift_assignment_id?: string
  clock_in?: string
  clock_out?: string
  break_start?: string
  break_end?: string
  total_hours?: number
  status: 'in-progress' | 'completed' | 'break' | 'overtime'
  notes?: string
  location_lat?: number
  location_lng?: number
  created_at: string
  updated_at: string
  employee_first_name?: string
  employee_last_name?: string
}

interface ShiftLog {
  id: string
  employee_id: string
  shift_assignment_id?: string
  clock_in: string
  clock_out?: string
  total_hours?: number
  break_hours: number
  max_break_allowed: number
  is_late: boolean
  is_no_show: boolean
  late_minutes: number
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  employee?: Employee
  shift_assignment?: any
}

interface SwapRequest {
  id: string
  requester_id: string
  target_id: string
  original_shift_id: string
  requested_shift_id: string
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  reason?: string
  admin_notes?: string
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
  requester_first_name?: string
  requester_last_name?: string
  target_first_name?: string
  target_last_name?: string
}

interface LeaveRequest {
  id: string
  employee_id: string
  type: 'vacation' | 'sick' | 'personal' | 'bereavement' | 'jury-duty' | 'other'
  start_date: string
  end_date: string
  days_requested: number
  reason?: string
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  approved_by?: string
  approved_at?: string
  admin_notes?: string
  created_at: string
  updated_at: string
  employee_first_name?: string
  employee_last_name?: string
}

interface DashboardStats {
  totalEmployees: number
  activeEmployees: number
  totalShifts: number
  completedShifts: number
  weeklyHours: number
  avgHoursPerEmployee: number
  pendingSwapRequests: number
  pendingLeaveRequests: number
  currentAttendance: number
  attendanceRate: number
}

interface EmployeeStatus {
  employeeId: string
  status: 'online' | 'offline' | 'break'
  lastActivity?: string
}

export default function AdminDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [shiftAssignments, setShiftAssignments] = useState<any[]>([])
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [shiftLogs, setShiftLogs] = useState<ShiftLog[]>([])
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    totalShifts: 0,
    completedShifts: 0,
    weeklyHours: 0,
    avgHoursPerEmployee: 0,
    pendingSwapRequests: 0,
    pendingLeaveRequests: 0,
    currentAttendance: 0,
    attendanceRate: 0
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [broadcastToAll, setBroadcastToAll] = useState(true)
  const [showImpersonationModal, setShowImpersonationModal] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [originalUser, setOriginalUser] = useState<any>(null)
  const [approvalsStats, setApprovalsStats] = useState<{ pending: number; approved: number; rejected: number; pendingHours: number; approvedHours: number } | null>(null)
  const [weeklyPlannedHours, setWeeklyPlannedHours] = useState<number>(0)
  const [weeklyPlannedCost, setWeeklyPlannedCost] = useState<number>(0)
  const [budgetWeekly, setBudgetWeekly] = useState<number | null>(null)
  const [overtimeCount, setOvertimeCount] = useState<number>(0)
  
  const router = useRouter()
  
  // Dashboard polling for real-time updates
  const {
    stats: pollingStats,
    data: pollingData,
    isLoading: isPollingLoading,
    error: pollingError,
    lastUpdate: pollingLastUpdate,
    isPolling,
    refresh: refreshData
  } = useDashboardPolling(currentUser?.id || '', 10000) // Poll every 10 seconds

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'admin') {
      router.push('/login')
    } else {
      setCurrentUser(user)
    }
  }, [router])

  // Load initial data only if polling is not available
  useEffect(() => {
    if (currentUser && !pollingStats) {
      loadDashboardData()
    }
  }, [currentUser, pollingStats])

  // Update dashboard data when polling data changes
  useEffect(() => {
    if (pollingStats) {
      setStats(pollingStats)
      setIsLoadingData(false)
    }
  }, [pollingStats])

  useEffect(() => {
    if (pollingData) {
      if (pollingData.employees) {
        setEmployees(pollingData.employees)
      }
      if (pollingData.shifts) {
        setShiftAssignments(pollingData.shifts)
      }
      if (pollingData.swapRequests) {
        setSwapRequests(pollingData.swapRequests)
      }
      if (pollingData.leaveRequests) {
        setLeaveRequests(pollingData.leaveRequests)
      }
    }
  }, [pollingData])

  const loadDashboardData = useCallback(async () => {
    setIsLoadingData(true)
    try {
      console.log('🔄 Loading admin dashboard data...')
      const user = AuthService.getCurrentUser()
      const authHeaders = user?.id ? { authorization: `Bearer ${user.id}` } : {}
      
      // Load employees
      const employeesResponse = await fetch('/api/employees', { headers: authHeaders })
      let employeesData: Employee[] = []
      if (employeesResponse.ok) {
        const data = await employeesResponse.json()
        if (data.data) {
          employeesData = data.data
          setEmployees(employeesData)
          console.log(`📊 Loaded ${employeesData.length} agents`)
        }
      }

      // Load shifts
      const shiftsResponse = await fetch('/api/shifts', { headers: authHeaders })
      let shiftsData: Shift[] = []
      if (shiftsResponse.ok) {
        const data = await shiftsResponse.json()
        if (data.data) {
          shiftsData = data.data
          setShifts(shiftsData)
          console.log(`📊 Loaded ${shiftsData.length} shifts`)
        }
      }

      // Load shift swap requests
      const swapResponse = await fetch('/api/shifts/swap-requests', { headers: authHeaders })
      let swapRequestsData: SwapRequest[] = []
      if (swapResponse.ok) {
        const data = await swapResponse.json()
        if (data.data) {
          swapRequestsData = data.data
          setSwapRequests(swapRequestsData)
          console.log(`📊 Loaded ${swapRequestsData.length} swap requests`)
        }
      }

      // Load leave requests
      const leaveResponse = await fetch('/api/leave-requests', { headers: authHeaders })
      let leaveRequestsData: LeaveRequest[] = []
      if (leaveResponse.ok) {
        const data = await leaveResponse.json()
        if (data.data) {
          leaveRequestsData = data.data
          setLeaveRequests(leaveRequestsData)
          console.log(`📊 Loaded ${leaveRequestsData.length} leave requests`)
        }
      }

      // Load approvals stats (timesheet summary)
      const approvalsResponse = await fetch('/api/admin/shift-approvals?status=all&limit=1', { headers: authHeaders })
      if (approvalsResponse.ok) {
        const data = await approvalsResponse.json()
        if (data?.data?.stats) {
          setApprovalsStats({
            pending: Number(data.data.stats.pending || 0),
            approved: Number(data.data.stats.approved || 0),
            rejected: Number(data.data.stats.rejected || 0),
            pendingHours: Number(data.data.stats.pendingHours || 0),
            approvedHours: Number(data.data.stats.approvedHours || 0),
          })
        }
      }

      // Load time entries for attendance tracking (legacy)
      const today = new Date().toISOString().split('T')[0]
      const timeResponse = await fetch(`/api/time/entries?start_date=${today}&end_date=${today}`, { headers: authHeaders })
      if (timeResponse.ok) {
        const data = await timeResponse.json()
        if (data.data) {
          setTimeEntries(data.data)
          setOvertimeCount((data.data || []).filter((t: any) => t.status === 'overtime').length)
          console.log(`📊 Loaded ${data.data.length} time entries for today`)
        }
      }

      // Load shift logs for current attendance (new system)
      console.log('🔄 Loading active shift logs...')
      const shiftLogsResponse = await fetch(`/api/shift-logs?status=active`, { headers: authHeaders })
      let shiftLogsWithEmployees: any[] = []
      
      if (shiftLogsResponse.ok) {
        const shiftLogsData = await shiftLogsResponse.json()
        console.log('📊 Shift logs API response:', shiftLogsData)
        
        if (shiftLogsData.success && shiftLogsData.data) {
          // Map employee data properly
          shiftLogsWithEmployees = shiftLogsData.data.map((log: any) => ({
            ...log,
            employee: {
              id: log.employee_id,
              first_name: log.first_name,
              last_name: log.last_name,
              employee_id: log.emp_id
            }
          }))
          setShiftLogs(shiftLogsWithEmployees)
          console.log(`📊 Loaded ${shiftLogsWithEmployees.length} active shift logs`)
          shiftLogsWithEmployees.forEach((log, index) => {
            console.log(`  Shift Log ${index + 1}: ${log.employee?.first_name} ${log.employee?.last_name} - ${log.status}`)
          })
        }
      } else {
        console.error('❌ Failed to load shift logs:', shiftLogsResponse.status)
      }

      // Load shift assignments for current week
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6) // Sunday
      
      const assignmentsResponse = await fetch(`/api/shifts/assignments?start_date=${weekStart.toISOString().split('T')[0]}&end_date=${weekEnd.toISOString().split('T')[0]}` , { headers: authHeaders })
      let shiftAssignmentsData: any[] = []
      let totalShifts = 0
      let completedShifts = 0
      
      if (assignmentsResponse.ok) {
        const assignmentsData = await assignmentsResponse.json()
        if (assignmentsData.data) {
          shiftAssignmentsData = assignmentsData.data
          setShiftAssignments(shiftAssignmentsData)
          totalShifts = shiftAssignmentsData.length
          completedShifts = shiftAssignmentsData.filter((assignment: any) => assignment.status === 'completed').length
          console.log(`📊 Loaded ${shiftAssignmentsData.length} shift assignments for current week`)

          // Compute planned hours and cost
          let hoursSum = 0
          let costSum = 0
          for (const a of shiftAssignmentsData) {
            try {
              const start = a.start_time
              const end = a.end_time
              if (start && end) {
                const [sh, sm] = String(start).split(':').map((x: string) => parseInt(x, 10))
                const [eh, em] = String(end).split(':').map((x: string) => parseInt(x, 10))
                const duration = (eh + em / 60) - (sh + sm / 60)
                if (!isNaN(duration) && duration > 0) {
                  hoursSum += duration
                  if (typeof a.hourly_rate === 'number') costSum += duration * a.hourly_rate
                }
              }
            } catch {}
          }
          setWeeklyPlannedHours(parseFloat(hoursSum.toFixed(2)))
          setWeeklyPlannedCost(parseFloat(costSum.toFixed(2)))
        }
      }

      // Calculate stats using loaded data
      const activeEmployees = employeesData.filter(emp => emp.is_active).length
      const pendingSwapRequests = swapRequestsData.filter(req => req.status === 'pending').length
      const pendingLeaveRequests = leaveRequestsData.filter(req => req.status === 'pending').length
      
      // Calculate current attendance from both systems
      const activeShiftLogs = shiftLogsWithEmployees.filter(log => log.status === 'active')
      const activeTimeEntries = timeEntries.filter(entry => entry.status === 'in-progress' || entry.status === 'break')
      const currentAttendance = activeShiftLogs.length + activeTimeEntries.length
      const totalTimeEntries = timeEntries.length
      const attendanceRate = totalTimeEntries > 0 ? Math.round((currentAttendance / totalTimeEntries) * 100) : 0

      console.log(`📊 Current attendance: ${currentAttendance} (${activeShiftLogs.length} shift logs + ${activeTimeEntries.length} time entries)`)

      // Calculate employee statuses
      const employeeStatusesData: EmployeeStatus[] = []
      for (const employee of employeesData) {
        const status = await determineEmployeeStatus(employee.id, timeEntries, shiftLogsWithEmployees)
        employeeStatusesData.push({
          employeeId: employee.id,
          status
        })
      }
      setEmployeeStatuses(employeeStatusesData)
      
      const onlineEmployees = employeeStatusesData.filter(s => s.status === 'online').length
      const onBreakEmployees = employeeStatusesData.filter(s => s.status === 'break').length
      console.log(`📊 Calculated statuses for ${employeeStatusesData.length} agents: ${onlineEmployees} online, ${onBreakEmployees} on break`)

      setStats({
        totalEmployees: employeesData.length,
        activeEmployees,
        totalShifts,
        completedShifts,
        weeklyHours: 168, // Mock total weekly hours
        avgHoursPerEmployee: employeesData.length > 0 ? Math.round(168 / employeesData.length) : 0,
        pendingSwapRequests,
        pendingLeaveRequests,
        currentAttendance,
        attendanceRate
      })
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  const handleApproveSwapRequest = async (requestId: string) => {
    setIsLoading(true)
    try {
      const response = await apiService.updateShiftSwap(requestId, { status: 'approved' })

      if (response.success && response.data) {
        setSwapRequests(prev => 
          prev.map(req => 
            req.id === requestId ? { ...req, status: 'approved' as const } : req
          )
        )
        
        // Send notification to both requester and target
        const request = swapRequests.find(req => req.id === requestId)
        if (request) {
          try {
            // Notify requester
            await fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: request.requester_id,
                title: 'Swap Request Approved',
                message: `Your shift swap request has been approved.`,
                type: 'swap',
                priority: 'normal'
              })
            })
            
            // Notify target
            await fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: request.target_id,
                title: 'Shift Swap Approved',
                message: `A shift swap involving your schedule has been approved.`,
                type: 'swap',
                priority: 'normal'
              })
            })
          } catch (error) {
            console.error('Error sending notifications:', error)
          }
        }
        
        toast.success('Swap request approved!')
        await loadDashboardData() // Refresh stats
      } else {
        toast.error(response.message || 'Failed to approve request')
      }
    } catch (error) {
      console.error('Error approving swap request:', error)
      toast.error('Failed to approve request')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRejectSwapRequest = async (requestId: string) => {
    setIsLoading(true)
    try {
      const response = await apiService.updateShiftSwap(requestId, { status: 'denied' })

      if (response.success && response.data) {
        setSwapRequests(prev => 
          prev.map(req => 
            req.id === requestId ? { ...req, status: 'denied' as const } : req
          )
        )
        
        // Send notification to requester
        const request = swapRequests.find(req => req.id === requestId)
        if (request) {
          try {
            await fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: request.requester_id,
                title: 'Swap Request Denied',
                message: `Your shift swap request has been denied.`,
                type: 'swap',
                priority: 'high'
              })
            })
          } catch (error) {
            console.error('Error sending notification:', error)
          }
        }
        
        toast.success('Swap request rejected')
        await loadDashboardData() // Refresh stats
      } else {
        toast.error(response.message || 'Failed to reject request')
      }
    } catch (error) {
      console.error('Error rejecting swap request:', error)
      toast.error('Failed to reject request')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveLeaveRequest = async (requestId: string) => {
    setIsLoading(true)
    try {
      const response = await apiService.approveLeaveRequest(requestId)

      if (response.success && response.data) {
        setLeaveRequests(prev => 
          prev.map(req => 
            req.id === requestId ? { ...req, status: 'approved' as const } : req
          )
        )
        
        // Send notification to employee
        const request = leaveRequests.find(req => req.id === requestId)
        if (request) {
          try {
            await fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: request.employee_id,
                title: 'Leave Request Approved',
                message: `Your leave request for ${request.start_date} to ${request.end_date} has been approved.`,
                type: 'leave',
                priority: 'normal'
              })
            })
          } catch (error) {
            console.error('Error sending notification:', error)
          }
        }
        
        toast.success('Leave request approved!')
        await loadDashboardData() // Refresh stats
      } else {
        toast.error(response.message || 'Failed to approve request')
      }
    } catch (error) {
      console.error('Error approving leave request:', error)
      toast.error('Failed to approve request')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRejectLeaveRequest = async (requestId: string) => {
    setIsLoading(true)
    try {
      const response = await apiService.rejectLeaveRequest(requestId)

      if (response.success && response.data) {
        setLeaveRequests(prev => 
          prev.map(req => 
            req.id === requestId ? { ...req, status: 'denied' as const } : req
          )
        )
        
        // Send notification to employee
        const request = leaveRequests.find(req => req.id === requestId)
        if (request) {
          try {
            await fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: request.employee_id,
                title: 'Leave Request Denied',
                message: `Your leave request for ${request.start_date} to ${request.end_date} has been denied.`,
                type: 'leave',
                priority: 'high'
              })
            })
          } catch (error) {
            console.error('Error sending notification:', error)
          }
        }
        
        toast.success('Leave request rejected')
        await loadDashboardData() // Refresh stats
      } else {
        toast.error(response.message || 'Failed to reject request')
      }
    } catch (error) {
      console.error('Error rejecting leave request:', error)
      toast.error('Failed to reject request')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    AuthService.logout()
    router.push('/login')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="secondary">Scheduled</Badge>
      case 'in-progress':
        return <Badge variant="default">In Progress</Badge>
      case 'completed':
        return <Badge variant="outline">Completed</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'approved':
        return <Badge variant="default">Approved</Badge>
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getEmployeeStatusBadge = (employeeId: string) => {
    const status = employeeStatuses.find(s => s.employeeId === employeeId)
    if (!status) {
      return <Badge variant="outline">Offline</Badge>
    }
    
    switch (status.status) {
      case 'online':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Online</Badge>
      case 'break':
        return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white">Break</Badge>
      case 'offline':
      default:
        return <Badge variant="outline">Offline</Badge>
    }
  }

  const determineEmployeeStatus = async (employeeId: string, timeEntries: TimeEntry[], shiftLogs: ShiftLog[]): Promise<'online' | 'offline' | 'break'> => {
    // Check for active shift logs first (newer system)
    const activeShiftLog = shiftLogs.find(log => 
      log.employee_id === employeeId && 
      log.status === 'active' && 
      !log.clock_out
    )
    
    if (activeShiftLog) {
      // Check if on break using break_logs table
      // We need to check if there's an active break for this employee
      try {
        const breakResponse = await fetch(`/api/time/break-status?employee_id=${employeeId}`)
        if (breakResponse.ok) {
          const breakData = await breakResponse.json()
          if (breakData.data && breakData.data.status === 'active') {
            return 'break'
          }
        }
      } catch (error) {
        console.error('Error checking break status:', error)
      }
      
      return 'online'
    }
    
    // Check for active time entries (legacy system)
    const activeTimeEntry = timeEntries.find(entry => 
      entry.employee_id === employeeId && 
      entry.status === 'in-progress' && 
      entry.clock_in && 
      !entry.clock_out
    )
    
    if (activeTimeEntry) {
      // Check if on break
      if (activeTimeEntry.status === 'break' && activeTimeEntry.break_start && !activeTimeEntry.break_end) {
        return 'break'
      }
      
      return 'online'
    }
    
    return 'offline'
  }

  const handleBroadcastMessage = async () => {
    if (!broadcastMessage.trim()) {
      toast.error('Please enter a message')
      return
    }
    
    setIsLoading(true)
    try {
      console.log('📢 Sending broadcast message...')
      const response = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: broadcastMessage,
          employeeIds: broadcastToAll ? null : selectedEmployeeIds,
          sendToAll: broadcastToAll
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Message sent successfully to ${data.recipients} employee(s)!`)
        setShowBroadcastModal(false)
        setBroadcastMessage('')
        setSelectedEmployeeIds([])
        setBroadcastToAll(true)
      } else {
        console.error('Broadcast error response:', data)
        toast.error(data.error || data.message || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending broadcast message:', error)
      toast.error('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartImpersonation = async (employee: Employee) => {
    try {
      console.log('🔄 Starting impersonation for:', employee.email)
      const user = AuthService.getCurrentUser()
      const response = await fetch('/api/admin/impersonation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { authorization: `Bearer ${user.id}` } : {}),
        },
        body: JSON.stringify({ targetUserId: employee.id }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        await AuthService.startImpersonation(employee.id, data.targetUser)
        setIsImpersonating(true)
        setOriginalUser(currentUser)
        setCurrentUser({
          ...data.targetUser,
          isImpersonating: true,
          originalUser: currentUser
        })
        toast.success(`Now impersonating ${employee.first_name} ${employee.last_name}`)
        const role = data.targetUser.role
        if (role === 'employee' || role === 'agent') {
          router.push('/employee/dashboard')
        } else if (role === 'manager') {
          router.push('/admin/dashboard')
        } else {
          router.push('/admin/dashboard')
        }
      } else {
        console.error('Impersonation error response:', data)
        toast.error(data.error || 'Failed to start impersonation')
      }
    } catch (error) {
      console.error('Error starting impersonation:', error)
      toast.error('Failed to start impersonation')
    }
  }

  const handleStopImpersonation = async () => {
    try {
      console.log('🔄 Stopping impersonation...')
      
      const response = await fetch('/api/admin/impersonation', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        // Stop impersonation in AuthService
        const restoredUser = await AuthService.stopImpersonation()
        
        setIsImpersonating(false)
        setOriginalUser(null)
        setCurrentUser(restoredUser)
        
        toast.success('Impersonation stopped')
        
        // Redirect back to admin dashboard
        router.push('/admin/dashboard')
      } else {
        const data = await response.json()
        console.error('Stop impersonation error response:', data)
        toast.error(data.error || 'Failed to stop impersonation')
      }
    } catch (error) {
      console.error('Error stopping impersonation:', error)
      toast.error('Failed to stop impersonation')
    }
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
          <div className="min-h-screen bg-gradient-to-br from-[#FDFBF8] to-white">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="relative w-10 h-10">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center relative shadow-lg">
                  <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center">
                    <div className="w-1 h-4 bg-blue-600 rounded-full transform rotate-45 origin-bottom"></div>
                  </div>
                  <div className="absolute w-0.5 h-2.5 bg-blue-600 transform rotate-12 origin-bottom"></div>
                  <div className="absolute w-0.5 h-2 bg-blue-600 transform -rotate-45 origin-bottom"></div>
                </div>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-transparent bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text">
                  {currentUser?.organization_name || 'Admin'} Dashboard
                </h1>
                <p className="text-sm text-gray-500">
                  Welcome back, {currentUser?.email || 'Administrator'}!
                </p>
                <p className="text-xs text-blue-600">
                  Organization ID: {currentUser?.organization_id}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Impersonation Status */}
              {isImpersonating && (
                <div className="flex items-center space-x-2 bg-orange-100 border border-orange-200 rounded-lg px-3 py-2">
                  <UserCheck className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">
                    Impersonating {currentUser?.first_name} {currentUser?.last_name}
                  </span>
                  <Button 
                    onClick={handleStopImpersonation} 
                    variant="outline" 
                    size="sm"
                    className="border-orange-300 text-orange-700 hover:bg-orange-200"
                  >
                    <UserX className="h-4 w-4 mr-1" />
                    Stop
                  </Button>
                </div>
              )}
              
              {/* Impersonation Button (only show when not impersonating) */}
              {!isImpersonating && currentUser?.role === 'admin' && (
                <Button 
                  onClick={() => setShowImpersonationModal(true)} 
                  variant="outline" 
                  size="sm"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Impersonate
                </Button>
              )}
              
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                {isPolling ? (
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    Live
                  </span>
                ) : (
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                    Offline
                  </span>
                )}
                {pollingLastUpdate && (
                  <span>Updated {new Date(pollingLastUpdate).toLocaleTimeString()}</span>
                )}
                {currentUser?.organization_name && (
                  <span className="font-semibold text-gray-800">Org: {currentUser.organization_name}</span>
                )}
              </div>
              <Button onClick={refreshData} variant="outline" size="sm" disabled={isPollingLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isPollingLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {/* Reduced header actions to keep UI clean */}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions - simplified */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <Button variant="outline" onClick={() => router.push('/admin/scheduling')}>
            <Calendar className="h-4 w-4 mr-2" /> Open Rota
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/shift-approvals')}>
            <CheckCircle className="h-4 w-4 mr-2" /> Review Approvals
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/timesheet')}>
            <FileText className="h-4 w-4 mr-2" /> Timesheets
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Total Agents</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalEmployees}</p>
                  <p className="text-xs text-blue-700">{stats.activeEmployees} active</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Current Attendance</p>
                  <p className="text-2xl font-bold text-green-900">{stats.currentAttendance}</p>
                  <p className="text-xs text-green-700">{stats.attendanceRate}% rate</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center shadow-lg">
                  <Eye className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">Total Shifts</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.totalShifts}</p>
                  <p className="text-xs text-purple-700">{stats.completedShifts} completed</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-full flex items-center justify-center shadow-lg">
                  <Clock className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800">Pending Requests</p>
                  <p className="text-2xl font-bold text-orange-900">{stats.pendingSwapRequests + stats.pendingLeaveRequests}</p>
                  <p className="text-xs text-orange-700">Swap: {stats.pendingSwapRequests} | Leave: {stats.pendingLeaveRequests}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-full flex items-center justify-center shadow-lg">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="swap-requests">Swap Requests</TabsTrigger>
            <TabsTrigger value="leave-requests">Leave Requests</TabsTrigger>
                            <TabsTrigger value="employees">Agents</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Employees */}
              <Card>
                <CardHeader>
                                  <CardTitle>Active Agents</CardTitle>
                <CardDescription>Currently active agents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {employees
                      .filter(emp => emp.is_active)
                      .sort((a, b) => {
                        const statusA = employeeStatuses.find(s => s.employeeId === a.id)?.status || 'offline'
                        const statusB = employeeStatuses.find(s => s.employeeId === b.id)?.status || 'offline'
                        
                        // Priority: online > break > offline
                        const priority = { online: 3, break: 2, offline: 1 }
                        return priority[statusB as keyof typeof priority] - priority[statusA as keyof typeof priority]
                      })
                      .slice(0, 5)
                      .map((employee) => (
                        <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                            <p className="text-sm text-gray-500">{employee.position || employee.department || 'Employee'}</p>
                          </div>
                          {getEmployeeStatusBadge(employee.id)}
                        </div>
                      ))}
                    {employees.filter(emp => emp.is_active).length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        No active agents found
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Rota at a Glance & Upcoming Shifts */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Rota at a Glance</CardTitle>
                      <CardDescription>Current week's key figures</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 border rounded-md">
                      <p className="text-xs text-gray-500">Planned Hours</p>
                      <p className="text-lg font-semibold">{weeklyPlannedHours.toFixed(2)}h</p>
                    </div>
                    <div className="p-3 border rounded-md">
                      <p className="text-xs text-gray-500">Planned Cost</p>
                      <p className="text-lg font-semibold">£{weeklyPlannedCost.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {shiftAssignments.slice(0, 5).map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{assignment.employee_first_name} {assignment.employee_last_name}</p>
                          <p className="text-sm text-gray-500">
                            {assignment.shift_name} • {new Date(assignment.date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </p>
                          <p className="text-xs text-gray-400">
                            {assignment.start_time} - {assignment.end_time}
                          </p>
                        </div>
                        <Badge variant={assignment.status === 'confirmed' ? "default" : "secondary"}>
                          {assignment.status}
                        </Badge>
                      </div>
                    ))}
                    {shiftAssignments.length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        No shifts scheduled for this week
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Additional Overview Panels */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Timesheet Summary</CardTitle>
                  <CardDescription>Pay period overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span>Pending</span><span>{approvalsStats?.pending ?? 0}</span></div>
                    <div className="flex justify-between text-sm"><span>Approved</span><span>{approvalsStats?.approved ?? 0}</span></div>
                    <div className="flex justify-between text-sm"><span>Rejected</span><span>{approvalsStats?.rejected ?? 0}</span></div>
                    <div className="flex justify-between text-sm pt-2"><span>Pending Hours</span><span>{approvalsStats?.pendingHours?.toFixed ? approvalsStats?.pendingHours.toFixed(2) : (approvalsStats?.pendingHours || 0)}</span></div>
                    <div className="flex justify-between text-sm"><span>Approved Hours</span><span>{approvalsStats?.approvedHours?.toFixed ? approvalsStats?.approvedHours.toFixed(2) : (approvalsStats?.approvedHours || 0)}</span></div>
                  </div>
                  <div className="pt-4">
                    <Button variant="outline" size="sm" onClick={() => router.push('/admin/shift-approvals')}>Manage Approvals</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Action Items</CardTitle>
                  <CardDescription>What needs attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Swap Requests</span><span className="font-semibold">{stats.pendingSwapRequests}</span></div>
                    <div className="flex justify-between"><span>Leave Requests</span><span className="font-semibold">{stats.pendingLeaveRequests}</span></div>
                    <div className="flex justify-between"><span>Overtime Entries</span><span className="font-semibold">{overtimeCount}</span></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest changes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-500">Activity log coming soon</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Attendance</CardTitle>
                <CardDescription>Agents currently clocked in</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Show employees from shift logs (new system) */}
                  {shiftLogs.filter(log => log.status === 'active').map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {log.employee?.first_name} {log.employee?.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Clocked in at {log.clock_in ? new Date(log.clock_in).toLocaleTimeString() : 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-400">
                          Break time used: {(typeof log.break_hours === 'string' ? parseFloat(log.break_hours) : log.break_hours || 0).toFixed(2)}h / {(typeof log.max_break_allowed === 'string' ? parseFloat(log.max_break_allowed) : log.max_break_allowed || 1)}h
                        </p>
                      </div>
                      <Badge variant="default">Active</Badge>
                    </div>
                  ))}
                  
                  {/* Show employees from time entries (legacy system) */}
                  {timeEntries.filter(entry => entry.status === 'in-progress').map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{entry.employee_first_name} {entry.employee_last_name}</p>
                        <p className="text-sm text-gray-500">Clocked in at {entry.clock_in ? new Date(entry.clock_in).toLocaleTimeString() : 'Unknown'}</p>
                      </div>
                      <Badge variant="default">Active (Legacy)</Badge>
                    </div>
                  ))}
                  
                  {shiftLogs.filter(log => log.status === 'active').length === 0 && 
                   timeEntries.filter(entry => entry.status === 'in-progress').length === 0 && (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No agents currently clocked in</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Swap Requests Tab */}
          <TabsContent value="swap-requests" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Swap Requests</CardTitle>
                <CardDescription>Review and approve shift swap requests</CardDescription>
              </CardHeader>
              <CardContent>
                {swapRequests.filter(req => req.status === 'pending').length > 0 ? (
                  <div className="space-y-4">
                    {swapRequests.filter(req => req.status === 'pending').map((request) => (
                      <div key={request.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{request.requester_first_name} {request.requester_last_name}</span>
                            <span className="text-gray-500">→</span>
                            <span className="font-medium">{request.target_first_name} {request.target_last_name}</span>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-sm text-gray-600">
                            <strong>Reason:</strong> {request.reason}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            Created: {new Date(request.created_at).toLocaleDateString()}
                          </p>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveSwapRequest(request.id)}
                              disabled={isLoading}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectSwapRequest(request.id)}
                              disabled={isLoading}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No pending swap requests</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Requests Tab */}
          <TabsContent value="leave-requests" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Leave Requests</CardTitle>
                <CardDescription>Review and approve leave requests</CardDescription>
              </CardHeader>
              <CardContent>
                {leaveRequests.filter(req => req.status === 'pending').length > 0 ? (
                  <div className="space-y-4">
                    {leaveRequests.filter(req => req.status === 'pending').map((request) => (
                      <div key={request.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{request.employee_first_name} {request.employee_last_name}</span>
                            <Badge variant="outline">{request.type}</Badge>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Start Date</p>
                            <p className="text-sm text-gray-600">{new Date(request.start_date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">End Date</p>
                            <p className="text-sm text-gray-600">{new Date(request.end_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-sm text-gray-600">
                            <strong>Reason:</strong> {request.reason}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            Created: {new Date(request.created_at).toLocaleDateString()}
                          </p>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveLeaveRequest(request.id)}
                              disabled={isLoading}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectLeaveRequest(request.id)}
                              disabled={isLoading}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No pending leave requests</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Agents</CardTitle>
                <CardDescription>Manage employee information and status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {employees
                    .sort((a, b) => {
                      const statusA = employeeStatuses.find(s => s.employeeId === a.id)?.status || 'offline'
                      const statusB = employeeStatuses.find(s => s.employeeId === b.id)?.status || 'offline'
                      
                      // Priority: online > break > offline
                      const priority = { online: 3, break: 2, offline: 1 }
                      return priority[statusB as keyof typeof priority] - priority[statusA as keyof typeof priority]
                    })
                    .map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                          <p className="text-sm text-gray-500">{employee.email}</p>
                          <p className="text-sm text-gray-500">{employee.position} • {employee.department}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getEmployeeStatusBadge(employee.id)}
                          <Badge variant={employee.is_active ? "default" : "secondary"}>
                            {employee.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">Broadcast Message</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full border rounded px-3 py-2 h-32"
                  placeholder="Enter your message..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Recipients</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={broadcastToAll}
                      onChange={() => setBroadcastToAll(true)}
                      className="mr-2"
                    />
                    Send to all agents
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!broadcastToAll}
                      onChange={() => setBroadcastToAll(false)}
                      className="mr-2"
                    />
                    Select specific agents
                  </label>
                </div>
              </div>
              
              {!broadcastToAll && (
                <div>
                  <label className="block text-sm font-medium mb-2">Select Agents</label>
                  <select
                    multiple
                    value={selectedEmployeeIds}
                    onChange={(e) => setSelectedEmployeeIds(Array.from(e.target.selectedOptions, option => option.value))}
                    className="w-full border rounded px-3 py-2 h-32"
                    required
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.department})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowBroadcastModal(false)
                    setBroadcastMessage('')
                    setSelectedEmployeeIds([])
                    setBroadcastToAll(true)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBroadcastMessage}
                  disabled={isLoading || !broadcastMessage.trim()}
                >
                  {isLoading ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Impersonation Modal */}
      <ImpersonationModal
        isOpen={showImpersonationModal}
        onClose={() => setShowImpersonationModal(false)}
        onImpersonate={handleStartImpersonation}
      />
    </div>
  )
}
