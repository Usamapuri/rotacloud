"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Clock, User, Calendar as CalendarIcon2, FileText, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { AuthService } from '@/lib/auth'
import { DateRange } from 'react-day-picker'

interface LeaveRequest {
  id: string
  employee_id: string
  employee_name: string
  leave_type: 'vacation' | 'sick' | 'personal' | 'bereavement' | 'other'
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
}

export function LeaveRequests() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [leaveType, setLeaveType] = useState('')
  const [reason, setReason] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (user) {
      setCurrentUser(user)
      loadData()
    }
  }, [])

  const loadData = async () => {
    try {
      setIsLoadingData(true)
      const user = AuthService.getCurrentUser()
      if (!user) return

      // Load leave requests with authentication
      const headers: Record<string, string> = {}
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      const response = await fetch('/api/leave-requests', { headers })
      if (response.ok) {
        const requests = await response.json()
        setLeaveRequests(requests.data || [])
      } else {
        console.error('Failed to load leave requests:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading leave request data:', error)
      toast.error('Failed to load data')
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleCreateRequest = async () => {
    const startDate = dateRange?.from
    const endDate = dateRange?.to
    if (!startDate || !endDate || !leaveType || !reason) {
      toast.error('Please fill in all fields')
      return
    }
    if (startDate > endDate) {
      toast.error('Start date cannot be after end date')
      return
    }
    setIsLoading(true)
    try {
      // Calculate days requested
      const daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employee_id: currentUser.id,
          type: leaveType,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          days_requested: daysRequested,
          reason,
        }),
      })
      if (response.ok) {
        const newRequest = await response.json()
        setLeaveRequests(prev => [newRequest, ...prev])
        setShowCreateDialog(false)
        setDateRange(undefined)
        setLeaveType('')
        setReason('')
        toast.success('Leave request submitted successfully!')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to submit leave request')
      }
    } catch (error) {
      console.error('Error creating leave request:', error)
      toast.error('Failed to submit leave request')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveRequest = async (requestId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/onboarding/leave-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'approved',
        }),
      })

      if (response.ok) {
        setLeaveRequests(prev => 
          prev.map(req => 
            req.id === requestId ? { ...req, status: 'approved' as const } : req
          )
        )
        toast.success('Leave request approved!')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to approve request')
      }
    } catch (error) {
      console.error('Error approving request:', error)
      toast.error('Failed to approve request')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRejectRequest = async (requestId: string, rejectionReason: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/onboarding/leave-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
          rejection_reason: rejectionReason,
        }),
      })

      if (response.ok) {
        setLeaveRequests(prev => 
          prev.map(req => 
            req.id === requestId ? { 
              ...req, 
              status: 'rejected' as const,
              rejection_reason: rejectionReason
            } : req
          )
        )
        toast.success('Leave request rejected')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to reject request')
      }
    } catch (error) {
      console.error('Error rejecting request:', error)
      toast.error('Failed to reject request')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'approved':
        return <Badge variant="default">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'Vacation'
      case 'sick':
        return 'Sick Leave'
      case 'personal':
        return 'Personal Leave'
      case 'bereavement':
        return 'Bereavement'
      case 'other':
        return 'Other'
      default:
        return type
    }
  }

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays + 1 // Include both start and end dates
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading leave requests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leave Requests</h2>
          <p className="text-gray-600">Submit and manage your leave requests</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>Submit Leave Request</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Submit Leave Request</DialogTitle>
              <DialogDescription>
                Request time off from work
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="leave-type">Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="personal">Personal Leave</SelectItem>
                    <SelectItem value="bereavement">Bereavement</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from && dateRange?.to
                        ? `${format(dateRange.from, 'PPP')} - ${format(dateRange.to, 'PPP')}`
                        : 'Pick a date range'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={1}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the reason for your leave request..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRequest} disabled={isLoading}>
                  Submit Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>My Leave Requests</CardTitle>
          <CardDescription>
            View and track your leave request status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaveRequests.length > 0 ? (
            <div className="space-y-4">
              {leaveRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <CalendarIcon2 className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{getLeaveTypeLabel(request.leave_type)}</span>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Start Date</p>
                      <p className="text-sm text-gray-600">{new Date(request.start_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">End Date</p>
                      <p className="text-sm text-gray-600">{new Date(request.end_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Duration</p>
                      <p className="text-sm text-gray-600">{calculateDays(request.start_date, request.end_date)} days</p>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">
                      <strong>Reason:</strong> {request.reason}
                    </p>
                  </div>
                  
                  {request.rejection_reason && (
                    <div className="mb-3 p-3 bg-red-50 rounded">
                      <p className="text-sm text-red-700">
                        <strong>Rejection Reason:</strong> {request.rejection_reason}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Submitted: {new Date(request.created_at).toLocaleDateString()}
                    </p>
                    {request.status === 'pending' && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest(request.id)}
                          disabled={isLoading}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isLoading}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reject Leave Request</DialogTitle>
                              <DialogDescription>
                                Please provide a reason for rejecting this request
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="rejection-reason">Rejection Reason</Label>
                                <Textarea
                                  id="rejection-reason"
                                  placeholder="Explain why this request is being rejected..."
                                  rows={3}
                                />
                              </div>
                              <div className="flex justify-end space-x-2">
                                <Button variant="outline">Cancel</Button>
                                <Button 
                                  variant="destructive"
                                  onClick={() => {
                                    const reason = (document.getElementById('rejection-reason') as HTMLTextAreaElement).value
                                    handleRejectRequest(request.id, reason)
                                  }}
                                >
                                  Reject Request
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No leave requests found</p>
              <p className="text-sm text-gray-500">Submit a new request to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 