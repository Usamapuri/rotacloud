"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar, 
  Users, 
  AlertTriangle,
  RefreshCw,
  Eye,
  MapPin
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"
import LocationFilter from "@/components/admin/LocationFilter"

interface ApprovalItem {
  id: string
  employee_name: string
  employee_code: string
  location_name: string
  created_at: string
  [key: string]: any
}

interface TimesheetApproval extends ApprovalItem {
  clock_in: string
  clock_out: string
  total_hours: number
  hourly_rate: number
  break_hours: number
  admin_notes?: string
}

interface ShiftSwapApproval extends ApprovalItem {
  original_shift_date: string
  requested_shift_date: string
  reason: string
  manager_notes?: string
}

interface LeaveRequestApproval extends ApprovalItem {
  start_date: string
  end_date: string
  leave_type: string
  reason: string
  days_requested: number
  manager_notes?: string
}

interface ApprovalData {
  timesheets: TimesheetApproval[]
  shift_swaps: ShiftSwapApproval[]
  leave_requests: LeaveRequestApproval[]
}

export default function ManagerApprovals() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [approvalData, setApprovalData] = useState<ApprovalData>({
    timesheets: [],
    shift_swaps: [],
    leave_requests: []
  })
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  // Modal state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<any>(null)
  const [approvalType, setApprovalType] = useState<'timesheet' | 'shift_swap' | 'leave_request'>('timesheet')
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve')
  const [approvalNotes, setApprovalNotes] = useState('')

  // Timesheet approval specific state
  const [approvedHours, setApprovedHours] = useState<number>(0)
  const [approvedRate, setApprovedRate] = useState<number>(0)

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'manager') {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    loadApprovals()
  }, [router])

  useEffect(() => {
    loadApprovals()
  }, [selectedLocationId])

  const loadApprovals = async () => {
    try {
      setIsLoading(true)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (currentUser?.id) {
        headers['authorization'] = `Bearer ${currentUser.id}`
      }
      if (currentUser?.tenant_id) {
        headers['x-tenant-id'] = currentUser.tenant_id
      }

      const params = new URLSearchParams()
      if (selectedLocationId) {
        params.append('location_id', selectedLocationId)
      }

      const response = await fetch(`/api/manager/approvals?${params.toString()}`, {
        headers
      })

      if (!response.ok) {
        throw new Error('Failed to load approvals')
      }

      const data = await response.json()
      setApprovalData(data.data)
    } catch (error) {
      console.error('Error loading approvals:', error)
      toast.error('Failed to load approvals')
    } finally {
      setIsLoading(false)
    }
  }

  const openApprovalDialog = (
    approval: any, 
    type: 'timesheet' | 'shift_swap' | 'leave_request', 
    action: 'approve' | 'reject'
  ) => {
    setSelectedApproval(approval)
    setApprovalType(type)
    setApprovalAction(action)
    setApprovalNotes('')
    
    if (type === 'timesheet') {
      setApprovedHours(approval.total_hours)
      setApprovedRate(approval.hourly_rate)
    }
    
    setShowApprovalDialog(true)
  }

  const handleApproval = async () => {
    if (!selectedApproval) return

    try {
      setIsProcessing(true)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (currentUser?.id) {
        headers['authorization'] = `Bearer ${currentUser.id}`
      }
      if (currentUser?.tenant_id) {
        headers['x-tenant-id'] = currentUser.tenant_id
      }

      let url = ''
      let body: any = {
        action: approvalAction
      }

      switch (approvalType) {
        case 'timesheet':
          url = `/api/manager/approvals/timesheet/${selectedApproval.id}`
          body = {
            ...body,
            approved_hours: approvedHours,
            approved_rate: approvedRate,
            admin_notes: approvalNotes
          }
          if (approvalAction === 'reject') {
            body.rejection_reason = approvalNotes
            delete body.approved_hours
            delete body.approved_rate
            delete body.admin_notes
          }
          break
        case 'shift_swap':
          url = `/api/manager/approvals/shift-swap/${selectedApproval.id}`
          body.manager_notes = approvalNotes
          break
        case 'leave_request':
          url = `/api/manager/approvals/leave-request/${selectedApproval.id}`
          body.manager_notes = approvalNotes
          break
      }

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error('Failed to process approval')
      }

      const result = await response.json()
      toast.success(result.data.message)
      
      setShowApprovalDialog(false)
      loadApprovals() // Refresh the list
    } catch (error) {
      console.error('Error processing approval:', error)
      toast.error('Failed to process approval')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDuration = (hours: number) => {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}h ${minutes}m`
  }

  const getPriorityColor = (item: any) => {
    const daysSinceCreated = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceCreated >= 3) return 'destructive'
    if (daysSinceCreated >= 1) return 'default'
    return 'secondary'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading approvals...</p>
        </div>
      </div>
    )
  }

  const totalPending = approvalData.timesheets.length + approvalData.shift_swaps.length + approvalData.leave_requests.length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Approvals</h1>
            <p className="text-gray-600 mt-1">Review and approve pending requests from your team</p>
          </div>
          <div className="flex items-center gap-4">
            <LocationFilter
              selectedLocationId={selectedLocationId}
              onLocationChange={setSelectedLocationId}
              showAllOption={false}
              showRefresh={false}
              placeholder="Select location..."
            />
            <Button onClick={loadApprovals} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800">Total Pending</p>
                  <p className="text-2xl font-bold text-orange-900">{totalPending}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Timesheets</p>
                  <p className="text-2xl font-bold text-blue-900">{approvalData.timesheets.length}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Shift Swaps</p>
                  <p className="text-2xl font-bold text-green-900">{approvalData.shift_swaps.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">Leave Requests</p>
                  <p className="text-2xl font-bold text-purple-900">{approvalData.leave_requests.length}</p>
                </div>
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="timesheets" className="space-y-6">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="timesheets" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Timesheets ({approvalData.timesheets.length})
            </TabsTrigger>
            <TabsTrigger value="shift-swaps" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Shift Swaps ({approvalData.shift_swaps.length})
            </TabsTrigger>
            <TabsTrigger value="leave-requests" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Leave Requests ({approvalData.leave_requests.length})
            </TabsTrigger>
          </TabsList>

          {/* Timesheets Tab */}
          <TabsContent value="timesheets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pending Timesheet Approvals
                </CardTitle>
                <CardDescription>
                  Review and approve timesheet entries from your team
                </CardDescription>
              </CardHeader>
              <CardContent>
                {approvalData.timesheets.length > 0 ? (
                  <div className="space-y-4">
                    {approvalData.timesheets.map((timesheet) => (
                      <div key={timesheet.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <Badge variant={getPriorityColor(timesheet)}>
                            {Math.floor((Date.now() - new Date(timesheet.created_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                          </Badge>
                          <div>
                            <h4 className="font-medium">{timesheet.employee_name} ({timesheet.employee_code})</h4>
                            <p className="text-sm text-gray-600">{timesheet.location_name}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(timesheet.clock_in)} • {formatDuration(timesheet.total_hours)} • £{timesheet.hourly_rate}/hr
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openApprovalDialog(timesheet, 'timesheet', 'approve')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openApprovalDialog(timesheet, 'timesheet', 'reject')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                    <p className="text-gray-600">No pending timesheet approvals.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Shift Swaps Tab */}
          <TabsContent value="shift-swaps" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Pending Shift Swap Requests
                </CardTitle>
                <CardDescription>
                  Review shift swap requests from your team
                </CardDescription>
              </CardHeader>
              <CardContent>
                {approvalData.shift_swaps.length > 0 ? (
                  <div className="space-y-4">
                    {approvalData.shift_swaps.map((swap) => (
                      <div key={swap.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <Badge variant={getPriorityColor(swap)}>
                            {Math.floor((Date.now() - new Date(swap.created_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                          </Badge>
                          <div>
                            <h4 className="font-medium">{swap.employee_name} ({swap.employee_code})</h4>
                            <p className="text-sm text-gray-600">{swap.location_name}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(swap.original_shift_date)} → {formatDate(swap.requested_shift_date)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{swap.reason}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openApprovalDialog(swap, 'shift_swap', 'approve')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openApprovalDialog(swap, 'shift_swap', 'reject')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                    <p className="text-gray-600">No pending shift swap requests.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Requests Tab */}
          <TabsContent value="leave-requests" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Pending Leave Requests
                </CardTitle>
                <CardDescription>
                  Review leave requests from your team
                </CardDescription>
              </CardHeader>
              <CardContent>
                {approvalData.leave_requests.length > 0 ? (
                  <div className="space-y-4">
                    {approvalData.leave_requests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <Badge variant={getPriorityColor(request)}>
                            {Math.floor((Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                          </Badge>
                          <div>
                            <h4 className="font-medium">{request.employee_name} ({request.employee_code})</h4>
                            <p className="text-sm text-gray-600">{request.location_name}</p>
                            <p className="text-xs text-gray-500">
                              {request.leave_type} • {request.days_requested} days • {formatDate(request.start_date)} - {formatDate(request.end_date)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{request.reason}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openApprovalDialog(request, 'leave_request', 'approve')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openApprovalDialog(request, 'leave_request', 'reject')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                    <p className="text-gray-600">No pending leave requests.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Approval Dialog */}
        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {approvalAction === 'approve' ? 'Approve' : 'Reject'} {approvalType.replace('_', ' ')}
              </DialogTitle>
              <DialogDescription>
                {selectedApproval && (
                  <div className="mt-2">
                    <p><strong>Employee:</strong> {selectedApproval.employee_name}</p>
                    <p><strong>Location:</strong> {selectedApproval.location_name}</p>
                    {approvalType === 'timesheet' && (
                      <>
                        <p><strong>Date:</strong> {formatDate(selectedApproval.clock_in)}</p>
                        <p><strong>Duration:</strong> {formatDuration(selectedApproval.total_hours)}</p>
                      </>
                    )}
                    {approvalType === 'shift_swap' && (
                      <>
                        <p><strong>Original Shift:</strong> {formatDate(selectedApproval.original_shift_date)}</p>
                        <p><strong>Requested Shift:</strong> {formatDate(selectedApproval.requested_shift_date)}</p>
                      </>
                    )}
                    {approvalType === 'leave_request' && (
                      <>
                        <p><strong>Leave Type:</strong> {selectedApproval.leave_type}</p>
                        <p><strong>Duration:</strong> {selectedApproval.days_requested} days</p>
                        <p><strong>Dates:</strong> {formatDate(selectedApproval.start_date)} - {formatDate(selectedApproval.end_date)}</p>
                      </>
                    )}
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>

            {approvalType === 'timesheet' && approvalAction === 'approve' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="approved_hours">Approved Hours</Label>
                    <Input
                      id="approved_hours"
                      type="number"
                      step="0.25"
                      value={approvedHours}
                      onChange={(e) => setApprovedHours(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="approved_rate">Approved Rate (£)</Label>
                    <Input
                      id="approved_rate"
                      type="number"
                      step="0.01"
                      value={approvedRate}
                      onChange={(e) => setApprovedRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="notes">
                {approvalAction === 'approve' ? 'Notes (optional)' : 'Reason for rejection'}
              </Label>
              <Textarea
                id="notes"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder={
                  approvalAction === 'approve' 
                    ? 'Add any notes about this approval...'
                    : 'Please provide a reason for rejection...'
                }
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowApprovalDialog(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApproval}
                disabled={isProcessing}
                variant={approvalAction === 'approve' ? 'default' : 'destructive'}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {approvalAction === 'approve' ? (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    {approvalAction === 'approve' ? 'Approve' : 'Reject'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
