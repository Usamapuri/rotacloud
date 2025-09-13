"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CameraVerification } from '@/components/ui/camera-verification'
import { ShiftRemarksDialog, ShiftRemarksData } from '@/components/ui/shift-remarks-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { NotificationBell } from '@/components/ui/notification-bell'

import { 
  Clock, 
  Calendar, 
  User, 
  TrendingUp, 
  Camera,
  Play,
  Pause,
  Square,
  Coffee,
  LogOut,
  Timer as TimerIcon,
  AlertCircle,
  FileText,
  Plus
} from 'lucide-react'
import { AuthService } from '@/lib/auth'
import { apiService } from '@/lib/api-service'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner'

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
}

interface Shift {
  id: string
  name: string
  start_time: string
  end_time: string
  date: string
  status: 'scheduled' | 'in-progress' | 'completed'
  employee_id: string
}

// New interfaces for shift logs
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
}

interface BreakLog {
  id: string
  shift_log_id: string
  employee_id: string
  break_start_time: string
  break_end_time?: string
  break_duration?: number
  break_type: 'lunch' | 'rest' | 'other'
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
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
}

interface SwapRequest {
  id: string
  requester_id: string
  target_id: string
  requester_shift_id: string
  target_shift_id: string
  status: 'pending' | 'accepted' | 'declined' | 'approved' | 'rejected'
  requester_name: string
  target_name: string
  requester_shift_date: string
  requester_shift_start: string
  requester_shift_end: string
  target_shift_date: string
  target_shift_start: string
  target_shift_end: string
  created_at: string
  updated_at: string
}

// Timer component for displaying elapsed time
const TimerDisplay = ({ startTime, label, className = "", variant = "default" }: { 
  startTime: string, 
  label: string, 
  className?: string,
  variant?: "default" | "break"
}) => {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) {
      setElapsed(0)
      return
    }

    const updateTimer = () => {
      const start = new Date(startTime).getTime()
      const now = new Date().getTime()
      const elapsedMs = now - start
      setElapsed(elapsedMs)
    }

    // Update immediately
    updateTimer()

    // Update every second
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  const formatTime = (ms: number) => {
    if (ms <= 0) return "00:00"
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const getColors = () => {
    switch (variant) {
      case "break":
        return "text-orange-600"
      default:
        return "text-blue-600"
    }
  }

  if (!startTime) {
    return (
      <div className={`text-center ${className}`}>
        <p className="text-gray-500">{label}: --:--</p>
      </div>
    )
  }

  return (
    <div className={`text-center ${className}`}>
      <p className={`font-mono font-bold timer-display ${getColors()}`}>
        {label}: <span className="tabular-nums">{formatTime(elapsed)}</span>
      </p>
    </div>
  )
}

// Shift History component
const ShiftHistory = ({ employeeId }: { employeeId: string }) => {
  const [shiftLogs, setShiftLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employeeId) return

    const loadShiftHistory = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/shift-logs/employee?employee_id=${employeeId}&limit=5`)
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setShiftLogs(data.data)
          }
        }
      } catch (error) {
        console.error('Error loading shift history:', error)
      } finally {
        setLoading(false)
      }
    }

    loadShiftHistory()
  }, [employeeId])

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Loading shift history...</p>
      </div>
    )
  }

  if (shiftLogs.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500">No recent shifts found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {shiftLogs.map((shiftLog) => {
        const start = shiftLog.clock_in ? new Date(shiftLog.clock_in) : null
        const end = shiftLog.clock_out ? new Date(shiftLog.clock_out) : null
        const startLabel = start ? start.toLocaleTimeString() : '--:--'
        const endLabel = end ? end.toLocaleTimeString() : 'Ongoing'
        const elapsedMs = start ? ((end ? end.getTime() : Date.now()) - start.getTime()) : 0
        const hours = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60)))
        const minutes = Math.max(0, Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60)))
        const elapsedLabel = `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}`

        return (
          <div key={shiftLog.id} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {start ? start.toLocaleDateString() : ''}
                </span>
                {shiftLog.status === 'active' && (
                  <Badge variant="default" className="text-xs">Active</Badge>
                )}
                {shiftLog.status === 'completed' && (
                  <Badge variant="outline" className="text-xs">Completed</Badge>
                )}
                {shiftLog.status === 'cancelled' && (
                  <Badge variant="destructive" className="text-xs">Cancelled</Badge>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {startLabel} - {endLabel}
              </span>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Duration:</span>
                <span className="font-mono font-medium text-blue-600">{elapsedLabel}</span>
              </div>
              {Number(shiftLog.total_shift_hours || 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Work Hours:</span>
                  <span className="font-medium">{Number(shiftLog.total_shift_hours).toFixed(2)}h</span>
                </div>
              )}
              {Number(shiftLog.break_hours || 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Break Time:</span>
                  <span className="font-medium text-orange-600">{Number(shiftLog.break_hours).toFixed(2)}h</span>
                </div>
              )}
              {shiftLog.is_late && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>Late by {shiftLog.late_minutes} minutes</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function EmployeeDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentTimeEntry, setCurrentTimeEntry] = useState<TimeEntry | null>(null)
  const [currentShiftLog, setCurrentShiftLog] = useState<ShiftLog | null>(null)
  const [currentBreak, setCurrentBreak] = useState<BreakLog | null>(null)
  const [todayShifts, setTodayShifts] = useState<Shift[]>([])
  const [showCamera, setShowCamera] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [weeklyHours, setWeeklyHours] = useState(0)
  const [maxWeeklyHours] = useState(40)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [verificationFailed, setVerificationFailed] = useState(false)
  
  // Shift remarks dialog state
  const [showShiftRemarksDialog, setShowShiftRemarksDialog] = useState(false)
  const [isSubmittingShiftRemarks, setIsSubmittingShiftRemarks] = useState(false)
  
  // Leave request state
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [submittingLeave, setSubmittingLeave] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    type: 'vacation' as const,
    start_date: '',
    end_date: '',
    reason: ''
  })
  
  // Swap request state
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [processingSwap, setProcessingSwap] = useState<string | null>(null)
  
  const router = useRouter()

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }
    setCurrentUser(user)
  }, [router])

  useEffect(() => {
    if (currentUser) {
      loadDashboardData()
    }
  }, [currentUser])

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoadingData(true)
      const user = AuthService.getCurrentUser()
      if (!user) return

      await refreshShiftLogData()
      await loadTodayShifts(user.id)
      await loadWeeklyHours(user.id)
      await loadLeaveRequests(user.id)
      await loadSwapRequests(user.id)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  const refreshShiftLogData = async () => {
    const user = AuthService.getCurrentUser()
    if (!user) return

    // Load current shift log
    const shiftLogsResponse = await fetch(`/api/shift-logs?employee_id=${user.id}&status=active`, { headers: { authorization: `Bearer ${user.id}` } })
    if (shiftLogsResponse.ok) {
      const shiftLogsData = await shiftLogsResponse.json()
      if (shiftLogsData.success && shiftLogsData.data.length > 0) {
        setCurrentShiftLog(shiftLogsData.data[0])
        
        // Check for active break
        const breakResponse = await fetch(`/api/time/break-status?employee_id=${user.id}`, { headers: { authorization: `Bearer ${user.id}` } })
        if (breakResponse.ok) {
          const breakData = await breakResponse.json()
          if (breakData.success && breakData.data) {
            setCurrentBreak(breakData.data)
          }
        }
      } else {
        setCurrentShiftLog(null)
        setCurrentBreak(null)
      }
    }

    // Load current time entry (legacy - for backward compatibility)
    const timeResponse = await apiService.getTimeEntries({ employee_id: user.id })
    if (timeResponse.success && timeResponse.data) {
      const currentEntry = timeResponse.data.find((entry: TimeEntry) => 
        entry.employee_id === user.id && 
        (entry.status === 'in-progress' || entry.status === 'break')
      )
      setCurrentTimeEntry(currentEntry || null)
    }
  }

  const loadTodayShifts = async (userId: string) => {
    // Load today's shifts using the new scheduling API
    const today = new Date().toISOString().split('T')[0]
    try {
      const user = AuthService.getCurrentUser()
      const res = await fetch(`/api/scheduling/week/${today}?employee_id=${userId}&published_only=true`, { headers: user?.id ? { authorization: `Bearer ${user.id}` } : {} })
      if (!res.ok) {
        setTodayShifts([])
        return
      }
      const data = await res.json()
      if (!data.success) {
        setTodayShifts([])
        return
      }
      const me = (data.data.employees as any[]).find(e => e.id === userId)
      const todays = me?.assignments?.[today] || []
      const transformed = todays.map((a: any) => ({
        id: a.id,
        name: a.template_name || 'Scheduled Shift',
        start_time: a.start_time,
        end_time: a.end_time,
        date: a.date,
        status: a.status || 'scheduled',
        employee_id: a.employee_id
      }))
      setTodayShifts(transformed)
    } catch (e) {
      console.error('today shifts error', e)
      setTodayShifts([])
    }
  }

  const loadWeeklyHours = async (userId: string) => {
    // Load weekly hours from shift logs (more accurate)
    const weekStart = getWeekStart()
    const weekEnd = getWeekEnd()
    const user = AuthService.getCurrentUser()
    const weeklyShiftLogsResponse = await fetch(`/api/shift-logs?employee_id=${userId}&start_date=${weekStart}&end_date=${weekEnd}`, { headers: user?.id ? { authorization: `Bearer ${user.id}` } : {} })
    if (weeklyShiftLogsResponse.ok) {
      const weeklyShiftLogsData = await weeklyShiftLogsResponse.json()
      if (weeklyShiftLogsData.success && weeklyShiftLogsData.data) {
        const totalHours = weeklyShiftLogsData.data.reduce((sum: number, log: any) => {
          // Calculate hours from shift logs
          if (log.clock_out) {
            const startTime = new Date(log.clock_in)
            const endTime = new Date(log.clock_out)
            const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
            return sum + hours
          } else if (log.status === 'active') {
            // For active shifts, calculate up to current time
            const startTime = new Date(log.clock_in)
            const now = new Date()
            const hours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)
            return sum + hours
          }
          return sum
        }, 0)
        setWeeklyHours(totalHours)
      }
    }
  }

  const loadLeaveRequests = async (userId: string) => {
    try {
      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = {}
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      const response = await fetch(`/api/leave-requests?employee_id=${userId}`, { headers })
      if (response.ok) {
        const data = await response.json()
        if (data.data) {
          setLeaveRequests(data.data)
        }
      } else {
        console.error('Failed to load leave requests:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading leave requests:', error)
    }
  }

  const loadSwapRequests = async (userId: string) => {
    try {
      const response = await fetch(`/api/employees/requests?employee_id=${userId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setSwapRequests(data.data)
        }
      }
    } catch (error) {
      console.error('Error loading swap requests:', error)
    }
  }

  const getWeekStart = () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    return monday.toISOString().split('T')[0]
  }

  const getWeekEnd = () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? 0 : 7)
    const sunday = new Date(now.setDate(diff))
    return sunday.toISOString().split('T')[0]
  }

  const formatShiftDuration = (clockInTime: string) => {
    const startTime = new Date(clockInTime)
    const now = new Date()
    const durationMs = now.getTime() - startTime.getTime()
    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const handleClockIn = async () => {
    try {
      setIsLoading(true)
      const user = AuthService.getCurrentUser()
      if (!user) return

      const response = await fetch('/api/time/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({ employee_id: user.id }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Successfully clocked in!')
        setCurrentShiftLog(data.data)
        setCurrentTimeEntry(null) // Clear legacy time entry
        loadDashboardData()
      } else {
        toast.error(data.error || 'Failed to clock in')
      }
    } catch (error) {
      console.error('Error in clock in:', error)
      toast.error('Failed to clock in')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClockOut = () => {
    // Show shift remarks dialog instead of directly clocking out
    setShowShiftRemarksDialog(true)
  }

  const handleShiftRemarksSubmit = async (remarksData: ShiftRemarksData) => {
    try {
      setIsSubmittingShiftRemarks(true)
      const user = AuthService.getCurrentUser()
      if (!user) return

      const response = await fetch('/api/time/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({ 
          employee_id: user.id,
          ...remarksData
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Successfully clocked out with shift details!')
        setCurrentShiftLog(null)
        setCurrentBreak(null)
        setCurrentTimeEntry(null)
        setShowShiftRemarksDialog(false)
        loadDashboardData()
      } else {
        toast.error(data.error || 'Failed to clock out')
      }
    } catch (error) {
      console.error('Error in clock out:', error)
      toast.error('Failed to clock out')
    } finally {
      setIsSubmittingShiftRemarks(false)
    }
  }

  const handleBreakStart = async () => {
    try {
      setIsLoading(true)
      const user = AuthService.getCurrentUser()
      if (!user) return

      // Check if there's already an active break
      if (currentBreak) {
        toast.error('You are already on a break')
        return
      }

      const response = await fetch('/api/time/break-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({ employee_id: user.id }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Break started!')
        setCurrentBreak(data.data)
        // Refresh shift log data to get updated break metrics
        await refreshShiftLogData()
      } else {
        toast.error(data.error || 'Failed to start break')
      }
    } catch (error) {
      console.error('Error starting break:', error)
      toast.error('Failed to start break')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBreakEnd = async () => {
    try {
      setIsLoading(true)
      const user = AuthService.getCurrentUser()
      if (!user) return

      const response = await fetch('/api/time/break-end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({ employee_id: user.id }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Break ended!')
        setCurrentBreak(null)
        // Refresh shift log data to get updated break metrics
        await refreshShiftLogData()
      } else {
        toast.error(data.error || 'Failed to end break')
      }
    } catch (error) {
      console.error('Error ending break:', error)
      toast.error('Failed to end break')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCameraVerification = (success: boolean, imageData?: string) => {
    setShowCamera(false)
    if (success) {
      setVerificationFailed(false)
      // Verification now automatically clocks in the employee
      // Just refresh the dashboard data to show the updated status
      loadDashboardData()
      toast.success('Verification successful! You are now clocked in.')
    } else {
      setVerificationFailed(true)
      toast.error('Verification failed. Please try again.')
    }
  }

  const handleLogout = () => {
    AuthService.logout()
    router.push('/login')
  }

  const handleLeaveRequestSubmit = async () => {
    try {
      setSubmittingLeave(true)
      const user = AuthService.getCurrentUser()
      if (!user) {
        toast.error('User not authenticated')
        return
      }

      // Validate form
      if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) {
        toast.error('Please fill in all required fields')
        return
      }

      // Calculate days requested
      const startDate = new Date(leaveForm.start_date)
      const endDate = new Date(leaveForm.end_date)
      const daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

      const requestData = {
        employee_id: user.id,
        type: leaveForm.type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        days_requested: daysRequested,
        reason: leaveForm.reason
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData)
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          toast.success('Leave request submitted successfully')
          setShowLeaveDialog(false)
          setLeaveForm({
            type: 'vacation',
            start_date: '',
            end_date: '',
            reason: ''
          })
          // Refresh leave requests
          await loadLeaveRequests(user.id)
        } else {
          toast.error(result.message || 'Failed to submit leave request')
        }
      } else {
        toast.error('Failed to submit leave request')
      }
    } catch (error) {
      console.error('Error submitting leave request:', error)
      toast.error('Failed to submit leave request')
    } finally {
      setSubmittingLeave(false)
    }
  }

  const handleSwapRequestAction = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      setProcessingSwap(requestId)
      const user = AuthService.getCurrentUser()
      if (!user) return

      const response = await fetch(`/api/employees/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(`Swap request ${action}ed successfully`)
        await loadSwapRequests(user.id)
      } else {
        toast.error(data.error || `Failed to ${action} swap request`)
      }
    } catch (error) {
      console.error(`Error ${action}ing swap request:`, error)
      toast.error(`Failed to ${action} swap request`)
    } finally {
      setProcessingSwap(null)
    }
  }



  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="secondary">Scheduled</Badge>
      case 'in-progress':
        return <Badge variant="default">In Progress</Badge>
      case 'completed':
        return <Badge variant="outline">Completed</Badge>
      case 'break':
        return <Badge variant="destructive">On Break</Badge>
      case 'active':
        return <Badge variant="default">Active</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getLeaveStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600">Pending</Badge>
      case 'approved':
        return <Badge variant="default" className="text-green-600">Approved</Badge>
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getSwapStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600">Pending</Badge>
      case 'accepted':
        return <Badge variant="default" className="text-blue-600">Accepted</Badge>
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>
      case 'approved':
        return <Badge variant="default" className="text-green-600">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const isClockedIn = currentShiftLog?.status === 'active' || currentTimeEntry?.status === 'in-progress'
  const isOnBreak = currentBreak?.status === 'active' || currentTimeEntry?.status === 'break'
  const isClockedOut = currentShiftLog?.status === 'completed' || currentTimeEntry?.status === 'completed'

  // Calculate break time remaining with proper type checking
  const breakTimeUsed = currentShiftLog?.break_hours 
    ? (typeof currentShiftLog.break_hours === 'string' 
        ? parseFloat(currentShiftLog.break_hours) 
        : currentShiftLog.break_hours)
    : 0

  const maxBreakAllowed = currentShiftLog?.max_break_allowed 
    ? (typeof currentShiftLog.max_break_allowed === 'string' 
        ? parseFloat(currentShiftLog.max_break_allowed) 
        : currentShiftLog.max_break_allowed)
    : 1.0

  const breakTimeRemaining = maxBreakAllowed - breakTimeUsed

  // Check if there are any active entries at all
  const hasActiveEntries = currentShiftLog?.status === 'active' || 
                          currentTimeEntry?.status === 'in-progress' || 
                          currentTimeEntry?.status === 'break' ||
                          currentBreak?.status === 'active'

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-2 rounded-full">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Welcome back, {currentUser?.email || 'Employee'}!
                </h1>
                <p className="text-sm text-gray-500">Employee Dashboard</p>
              </div>
            </div>
            <NotificationBell userId={currentUser?.id} className="mr-2" />
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Impersonation Banner - Only shows when admin is impersonating */}
      <ImpersonationBanner />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Time Tracking Card */}
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time Tracking
                </CardTitle>
                <CardDescription>
                  Track your work hours and breaks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasActiveEntries ? (
                  <div className="text-center space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-lg border border-blue-200">
                      <Clock className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-blue-900 mb-2">Ready to Start Your Shift?</h3>
                      <p className="text-blue-700 mb-6">Click below to begin your work day with identity verification</p>
                      <Button 
                        onClick={() => setShowCamera(true)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        size="lg"
                        disabled={isLoading}
                      >
                        <Camera className="h-5 w-5 mr-2" />
                        {isLoading ? 'Starting...' : 'Start Shift with Verification'}
                      </Button>
                      {verificationFailed && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-red-700 text-sm">
                            Verification failed. <Button variant="link" className="text-red-600 p-0 h-auto" onClick={() => setShowCamera(true)}>Retry</Button>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Live Timers */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                        <TimerIcon className="h-5 w-5" />
                        Active Timers
                      </h3>
                      <div className="space-y-4">
                        {/* Shift Timer */}
                        {currentShiftLog?.clock_in && currentShiftLog?.status === 'active' && (
                          <div className="bg-white p-6 rounded-lg border border-blue-100 shadow-sm">
                            <TimerDisplay 
                              startTime={currentShiftLog.clock_in} 
                              label="Shift Duration" 
                              className="text-2xl"
                            />
                            <p className="text-sm text-gray-600 mt-2">
                              Started at {new Date(currentShiftLog.clock_in).toLocaleTimeString()}
                            </p>
                          </div>
                        )}
                        
                        {/* Break Timer */}
                        {currentBreak?.break_start_time && currentBreak?.status === 'active' && (
                          <div className="bg-white p-6 rounded-lg border border-orange-100 bg-orange-50 shadow-sm">
                            <TimerDisplay 
                              startTime={currentBreak.break_start_time} 
                              label="Break Duration" 
                              className="text-2xl"
                              variant="break"
                            />
                            <p className="text-sm text-gray-600 mt-2">
                              Break started at {new Date(currentBreak.break_start_time).toLocaleTimeString()}
                            </p>
                          </div>
                        )}
                        
                        {/* No active timers message */}
                        {!currentShiftLog?.clock_in && !currentBreak?.break_start_time && (
                          <div className="text-center py-8">
                            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500">No active timers</p>
                            <p className="text-sm text-gray-400">Clock in to start tracking your shift time</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-blue-900">
                          {isOnBreak && 'Currently on Break'}
                          {!isOnBreak && 'Currently Working'}
                        </p>
                        <p className="text-sm text-blue-700">
                          {currentShiftLog?.clock_in 
                            ? `Started: ${new Date(currentShiftLog.clock_in).toLocaleTimeString()}`
                            : currentTimeEntry?.clock_in 
                            ? `Started: ${new Date(currentTimeEntry.clock_in).toLocaleTimeString()}`
                            : 'Time not recorded'
                          }
                        </p>
                        {currentShiftLog && (
                          <p className="text-xs text-blue-600 mt-1">
                            Break time used: {breakTimeUsed.toFixed(2)}h / {maxBreakAllowed}h
                          </p>
                        )}
                      </div>
                      {getStatusBadge(isOnBreak ? 'break' : 'active')}
                    </div>

                    {/* Break time remaining indicator */}
                    {currentShiftLog && breakTimeRemaining <= 0.5 && (
                      <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm text-yellow-800">
                          Warning: You have used most of your break time ({breakTimeUsed.toFixed(2)}h / {maxBreakAllowed}h)
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {isClockedIn && !isOnBreak && (
                        <>
                          <Button 
                            onClick={handleBreakStart}
                            disabled={isLoading || breakTimeRemaining <= 0}
                            variant="outline"
                            className="flex-1"
                          >
                            <Coffee className="h-4 w-4 mr-2" />
                            Start Break
                            {breakTimeRemaining > 0 && ` (${breakTimeRemaining.toFixed(1)}h left)`}
                          </Button>
                          <Button 
                            onClick={handleClockOut}
                            disabled={isLoading}
                            variant="destructive"
                            className="flex-1"
                          >
                            <Square className="h-4 w-4 mr-2" />
                            Clock Out
                          </Button>
                        </>
                      )}
                      {isOnBreak && (
                        <Button 
                          onClick={handleBreakEnd}
                          disabled={isLoading}
                          className="flex-1"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          End Break
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's Shifts */}
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Today's Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayShifts.length > 0 ? (
                  <div className="space-y-3">
                    {todayShifts.map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900">{shift.name}</p>
                          <p className="text-sm text-gray-600">
                            {shift.start_time} - {shift.end_time}
                          </p>
                        </div>
                        {getStatusBadge(shift.status)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No shifts scheduled for today</p>
                    <p className="text-sm text-gray-500 mt-1">Check with your manager for upcoming assignments</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Shift History */}
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Shift History
                </CardTitle>
                <CardDescription>
                  Your recent shifts with duration information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShiftHistory employeeId={currentUser?.id} />
              </CardContent>
            </Card>

            {/* Leave Requests */}
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Leave Requests
                </CardTitle>
                <CardDescription>
                  Track your leave requests and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-gray-900">Your Requests</h3>
                    <Button 
                      onClick={() => setShowLeaveDialog(true)}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      New Request
                    </Button>
                  </div>
                  
                  {leaveRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No leave requests found</p>
                      <p className="text-sm text-gray-400 mt-1">Submit a new request to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaveRequests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 capitalize">{request.type}</span>
                              {getLeaveStatusBadge(request.status)}
                            </div>
                            <span className="text-sm text-gray-500">
                              {new Date(request.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-medium text-gray-700">Date Range:</p>
                              <p className="text-gray-600">
                                {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">Days Requested:</p>
                              <p className="text-gray-600">{request.days_requested} days</p>
                            </div>
                          </div>
                          
                          {request.reason && (
                            <div className="mt-3">
                              <p className="font-medium text-gray-700">Reason:</p>
                              <p className="text-gray-600">{request.reason}</p>
                            </div>
                          )}
                          
                          {request.admin_notes && (
                            <div className="mt-3">
                              <p className="font-medium text-gray-700">Admin Notes:</p>
                              <p className="text-gray-600">{request.admin_notes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Swap Requests */}
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Shift Swap Requests
                </CardTitle>
                <CardDescription>
                  Respond to shift swap requests from colleagues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-gray-900">Action Required</h3>
                    {swapRequests.filter(r => r.status === 'pending').length > 0 && (
                      <Badge variant="destructive" className="animate-pulse">
                        {swapRequests.filter(r => r.status === 'pending').length} pending
                      </Badge>
                    )}
                  </div>
                  
                  {swapRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No swap requests found</p>
                      <p className="text-sm text-gray-400 mt-1">You'll see requests here when colleagues want to swap shifts</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {swapRequests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {request.requester_name} wants to swap
                              </span>
                              {getSwapStatusBadge(request.status)}
                            </div>
                            <span className="text-sm text-gray-500">
                              {new Date(request.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <p className="font-medium text-blue-900 mb-1">Their Shift:</p>
                              <p className="text-blue-800">
                                {new Date(request.requester_shift_date).toLocaleDateString()}
                              </p>
                              <p className="text-blue-700">
                                {request.requester_shift_start} - {request.requester_shift_end}
                              </p>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg">
                              <p className="font-medium text-green-900 mb-1">Your Shift:</p>
                              <p className="text-green-800">
                                {new Date(request.target_shift_date).toLocaleDateString()}
                              </p>
                              <p className="text-green-700">
                                {request.target_shift_start} - {request.target_shift_end}
                              </p>
                            </div>
                          </div>
                          
                          {request.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleSwapRequestAction(request.id, 'accept')}
                                disabled={processingSwap === request.id}
                                size="sm"
                                className="flex-1"
                              >
                                {processingSwap === request.id ? 'Processing...' : 'Accept'}
                              </Button>
                              <Button
                                onClick={() => handleSwapRequestAction(request.id, 'decline')}
                                disabled={processingSwap === request.id}
                                variant="destructive"
                                size="sm"
                                className="flex-1"
                              >
                                {processingSwap === request.id ? 'Processing...' : 'Decline'}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* No Active Shift Notification */}
            {!hasActiveEntries && (
              <Card className="border-yellow-200 bg-yellow-50 dashboard-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">No active shift found</span>
                  </div>
                  <p className="text-xs text-yellow-700 mt-1">
                    Clock in to start tracking your work time
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Weekly Hours */}
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Weekly Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{(Number(weeklyHours) || 0).toFixed(1)}h</p>
                    <p className="text-sm text-gray-500">of {maxWeeklyHours}h</p>
                  </div>
                  <Progress value={((Number(weeklyHours) || 0) / maxWeeklyHours) * 100} />
                  <p className="text-xs text-gray-500 text-center">
                    {(maxWeeklyHours - (Number(weeklyHours) || 0)).toFixed(1)}h remaining this week
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Break Status Card */}
            {currentShiftLog && (
              <Card className="dashboard-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TimerIcon className="h-5 w-5" />
                    Break Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Break time used:</span>
                      <span className="font-medium">{breakTimeUsed.toFixed(2)}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Break time remaining:</span>
                      <span className="font-medium">{breakTimeRemaining.toFixed(1)}h</span>
                    </div>
                    <Progress 
                      value={(breakTimeUsed / maxBreakAllowed) * 100} 
                      className="mt-2"
                    />
                    {currentShiftLog.is_late && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-800">
                          Late by {currentShiftLog.late_minutes} minutes
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => router.push('/employee/scheduling')}
                  variant="outline" 
                  className="w-full justify-start"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  View Schedule
                </Button>
                <Button 
                  onClick={() => router.push('/employee/profile')}
                  variant="outline" 
                  className="w-full justify-start"
                >
                  <User className="h-4 w-4 mr-2" />
                  Update Profile
                </Button>
                <Button 
                  onClick={() => router.push('/employee/timesheet')}
                  variant="outline" 
                  className="w-full justify-start"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Timesheet
                </Button>
                <Button 
                  onClick={() => setShowLeaveDialog(true)}
                  variant="outline" 
                  className="w-full justify-start"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Request Leave
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>



      {/* Leave Request Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>
              Submit a leave request for approval. Please provide all required information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="leave-type" className="text-right">
                Type
              </Label>
              <Select 
                value={leaveForm.type} 
                onValueChange={(value) => setLeaveForm({...leaveForm, type: value as any})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="bereavement">Bereavement</SelectItem>
                  <SelectItem value="jury-duty">Jury Duty</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="start-date" className="text-right">
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm({...leaveForm, start_date: e.target.value})}
                className="col-span-3"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="end-date" className="text-right">
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={leaveForm.end_date}
                onChange={(e) => setLeaveForm({...leaveForm, end_date: e.target.value})}
                className="col-span-3"
                min={leaveForm.start_date || new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reason" className="text-right">
                Reason
              </Label>
              <Textarea
                id="reason"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
                placeholder="Please provide a reason for your leave request..."
                className="col-span-3"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowLeaveDialog(false)}
              disabled={submittingLeave}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={handleLeaveRequestSubmit}
              disabled={submittingLeave}
            >
              {submittingLeave ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera Verification Modal */}
      {showCamera && (
        <CameraVerification
          onVerificationComplete={handleCameraVerification}
          onCancel={() => setShowCamera(false)}
          title="Shift Verification"
          description="Please verify your identity to start your shift."
          employeeId={currentUser?.email}
        />
      )}

      {/* Shift Remarks Dialog */}
      <ShiftRemarksDialog
        isOpen={showShiftRemarksDialog}
        onClose={() => setShowShiftRemarksDialog(false)}
        onSubmit={handleShiftRemarksSubmit}
        isLoading={isSubmittingShiftRemarks}
        shiftDuration={currentShiftLog?.clock_in ? 
          formatShiftDuration(currentShiftLog.clock_in) : undefined}
        clockInTime={currentShiftLog?.clock_in}
      />
    </div>
  )
}
