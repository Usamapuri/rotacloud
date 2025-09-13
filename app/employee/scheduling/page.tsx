"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, ArrowLeftRight } from 'lucide-react'

type Assignment = {
  id: string
  template_name: string
  start_time: string
  end_time: string
  date: string
  color?: string
}

type Employee = {
  id: string
  first_name: string
  last_name: string
  email: string
  employee_code: string
}

export default function EmployeeSchedulingPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [weekDays, setWeekDays] = useState<string[]>([])
  const [assignmentsByDate, setAssignmentsByDate] = useState<Record<string, Assignment[]>>({})
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Leave dialog
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveType, setLeaveType] = useState<'vacation' | 'sick' | 'personal' | 'bereavement' | 'other'>('vacation')
  const [leaveStart, setLeaveStart] = useState('')
  const [leaveEnd, setLeaveEnd] = useState('')
  const [leaveReason, setLeaveReason] = useState('')
  const [submittingLeave, setSubmittingLeave] = useState(false)

  // Swap dialog
  const [swapOpen, setSwapOpen] = useState(false)
  const [swapDate, setSwapDate] = useState('')
  const [swapTargetEmployeeId, setSwapTargetEmployeeId] = useState('')
  const [swapReason, setSwapReason] = useState('')
  const [submittingSwap, setSubmittingSwap] = useState(false)

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }
    setCurrentUser(user)
  }, [router])

  // Compute week days whenever selectedDate changes
  useEffect(() => {
    const date = new Date(selectedDate)
    const dayOfWeek = date.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(date)
    monday.setDate(date.getDate() - daysToMonday)
    const days: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      days.push(d.toISOString().split('T')[0])
    }
    setWeekDays(days)
  }, [selectedDate])

  // Load data when user or selectedDate changes
  useEffect(() => {
    if (!currentUser) return
    ;(async () => {
      try {
        setLoading(true)
        await Promise.all([
          loadWeek(currentUser.id, selectedDate),
          loadEmployees()
        ])
      } catch (e) {
        console.error(e)
        toast.error('Failed to load schedule')
      } finally {
        setLoading(false)
      }
    })()
  }, [currentUser, selectedDate])

  const loadEmployees = async () => {
    const user = AuthService.getCurrentUser()
    const headers: Record<string, string> = {}
    if (user?.id) headers['authorization'] = `Bearer ${user.id}`
    
    const res = await fetch('/api/scheduling/employees', { headers })
    const data = await res.json()
    if (data.success) {
      setEmployees(data.data)
    }
  }

  const loadWeek = async (employeeId: string, date: string) => {
    const user = AuthService.getCurrentUser()
    const headers: Record<string, string> = {}
    if (user?.id) headers['authorization'] = `Bearer ${user.id}`
    
    const res = await fetch(`/api/scheduling/week/${date}?employee_id=${employeeId}&published_only=true`, { headers })
    if (!res.ok) {
      console.error('Failed to load week data:', res.status, res.statusText)
      return
    }
    const data = await res.json()
    if (!data.success) {
      console.error('API returned error:', data.error)
      return
    }
    const me = (data.data.employees as any[]).find((e: any) => e.id === employeeId)
    setAssignmentsByDate(me?.assignments || {})
  }

  const goPrev = async () => {
    const base = new Date(weekDays[0] || selectedDate)
    base.setDate(base.getDate() - 7)
    setSelectedDate(base.toISOString().split('T')[0])
  }

  const goNext = async () => {
    const base = new Date(weekDays[0] || selectedDate)
    base.setDate(base.getDate() + 7)
    setSelectedDate(base.toISOString().split('T')[0])
  }

  const goToday = async () => {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }

  const handleRefresh = async () => {
    if (!currentUser) return
    setRefreshing(true)
    await loadWeek(currentUser.id, selectedDate)
    setRefreshing(false)
  }

  const requestLeave = async () => {
    if (!currentUser) return
    if (!leaveStart || !leaveEnd || !leaveReason) {
      toast.error('Please fill all leave fields')
      return
    }
    try {
      setSubmittingLeave(true)
      const res = await fetch('/api/employees/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.id}`
        },
        body: JSON.stringify({
          employee_id: currentUser.id,
          leave_type: leaveType,
          start_date: leaveStart,
          end_date: leaveEnd,
          reason: leaveReason,
          status: 'pending'
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to submit leave request')
      }
      toast.success('Leave request submitted')
      setLeaveOpen(false)
      setLeaveReason('')
      await handleRefresh()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to submit leave request')
    } finally {
      setSubmittingLeave(false)
    }
  }

  const requestSwap = async () => {
    if (!currentUser) return
    if (!swapDate || !swapTargetEmployeeId || !swapReason) {
      toast.error('Please fill all swap fields')
      return
    }
    try {
      setSubmittingSwap(true)
      const res = await fetch('/api/shifts/swap-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.id}`
        },
        body: JSON.stringify({
          target_employee_id: swapTargetEmployeeId,
          reason: swapReason,
          swap_date: swapDate
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to submit swap request')
      }
      toast.success('Swap request submitted')
      setSwapOpen(false)
      setSwapReason('')
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to submit swap request')
    } finally {
      setSubmittingSwap(false)
    }
  }

  const prettyTime = (t?: string) => (t ? t.slice(0,5) : '')

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading your schedule...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Weekly Schedule</h1>
          <p className="text-gray-600">Review shifts and submit requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="default" onClick={() => { setLeaveOpen(true); setLeaveStart(weekDays[0] || selectedDate); setLeaveEnd(weekDays[6] || selectedDate) }}>
            Request Leave
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Week of {weekDays[0]} - {weekDays[6]}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
              <Button variant="outline" size="sm" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day) => (
              <div key={day} className={`border rounded-lg p-3 ${day === todayStr ? 'bg-blue-25' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">{new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                </div>
                {(assignmentsByDate[day] || []).length === 0 ? (
                  <div className="text-sm text-gray-500">No shift</div>
                ) : (
                  <div className="space-y-2">
                    {(assignmentsByDate[day] || []).map((a) => (
                      <div key={a.id} className="p-2 rounded text-xs text-white" style={{ backgroundColor: a.color || '#3B82F6' }}>
                        <div className="font-medium">{a.template_name}</div>
                        <div>{prettyTime(a.start_time)} - {prettyTime(a.end_time)}</div>
                        <div className="mt-2">
                          <Button size="sm" variant="secondary" className="w-full" onClick={() => { setSwapOpen(true); setSwapDate(day) }}>
                            <ArrowLeftRight className="h-4 w-4 mr-2" /> Request Swap
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leave Request Dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={leaveType} onValueChange={(v: any) => setLeaveType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="bereavement">Bereavement</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="Brief reason" />
            </div>
            <div>
              <Label>Start date</Label>
              <Input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>Cancel</Button>
            <Button onClick={requestLeave} disabled={submittingLeave}>{submittingLeave ? 'Submitting...' : 'Submit'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap Request Dialog */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Request Swap</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Swap date</Label>
              <Input type="date" value={swapDate} onChange={(e) => setSwapDate(e.target.value)} />
            </div>
            <div>
              <Label>Target Employee</Label>
              <Select value={swapTargetEmployeeId} onValueChange={setSwapTargetEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.id !== currentUser?.id).map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} ({e.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={swapReason} onChange={(e) => setSwapReason(e.target.value)} placeholder="Why do you want to swap?" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSwapOpen(false)}>Cancel</Button>
            <Button onClick={requestSwap} disabled={submittingSwap}>{submittingSwap ? 'Submitting...' : 'Submit'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


