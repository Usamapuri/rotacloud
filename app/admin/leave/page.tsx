"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  TrendingUp,
  Filter,
  Search,
  Eye,
  Check,
  X
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface LeaveRequest {
  id: string
  employee_id: string
  employee_first_name: string
  employee_last_name: string
  employee_email: string
  type: string
  start_date: string
  end_date: string
  days_requested: number
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
}

interface LeaveStats {
  total_requests: number
  pending_requests: number
  approved_requests: number
  rejected_requests: number
  total_days_off: number
}

export default function AdminLeavePage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<LeaveRequest[]>([])
  const [stats, setStats] = useState<LeaveStats>({
    total_requests: 0,
    pending_requests: 0,
    approved_requests: 0,
    rejected_requests: 0,
    total_days_off: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve')
  const [approvalNotes, setApprovalNotes] = useState("")
  const router = useRouter()

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'admin') {
      router.push("/login")
      return
    }
    loadLeaveData()
  }, [router])

  useEffect(() => {
    filterRequests()
  }, [leaveRequests, searchTerm, statusFilter, typeFilter])

  const loadLeaveData = async () => {
    try {
      setIsLoading(true)
      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = {}
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      // Load leave requests
      const response = await fetch('/api/leave-requests', { headers })
      if (response.ok) {
        const data = await response.json()
        setLeaveRequests(data.data || [])
        
        // Calculate stats
        const requests = data.data || []
        const stats: LeaveStats = {
          total_requests: requests.length,
          pending_requests: requests.filter((r: LeaveRequest) => r.status === 'pending').length,
          approved_requests: requests.filter((r: LeaveRequest) => r.status === 'approved').length,
          rejected_requests: requests.filter((r: LeaveRequest) => r.status === 'rejected').length,
          total_days_off: requests
            .filter((r: LeaveRequest) => r.status === 'approved')
            .reduce((sum: number, r: LeaveRequest) => sum + r.days_requested, 0)
        }
        setStats(stats)
      } else {
        console.error('Failed to load leave requests:', response.status)
        toast.error('Failed to load leave requests')
      }
    } catch (error) {
      console.error('Error loading leave data:', error)
      toast.error('Failed to load leave data')
    } finally {
      setIsLoading(false)
    }
  }

  const filterRequests = () => {
    let filtered = leaveRequests

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.employee_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.employee_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.employee_email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(request => request.status === statusFilter)
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(request => request.type === typeFilter)
    }

    setFilteredRequests(filtered)
  }

  const handleApproval = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      const response = await fetch(`/api/admin/leave-requests/${requestId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          action,
          notes: approvalNotes,
          rejection_reason: action === 'reject' ? approvalNotes : undefined
        }),
      })

      if (response.ok) {
        toast.success(`Leave request ${action}d successfully`)
        setShowApprovalDialog(false)
        setSelectedRequest(null)
        setApprovalNotes("")
        loadLeaveData() // Reload data
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || `Failed to ${action} leave request`)
      }
    } catch (error) {
      console.error(`Error ${action}ing leave request:`, error)
      toast.error(`Failed to ${action} leave request`)
    }
  }

  const openApprovalDialog = (request: LeaveRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request)
    setApprovalAction(action)
    setApprovalNotes("")
    setShowApprovalDialog(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'approved':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    const colors = {
      vacation: 'bg-blue-100 text-blue-800',
      sick: 'bg-red-100 text-red-800',
      personal: 'bg-purple-100 text-purple-800',
      bereavement: 'bg-gray-100 text-gray-800',
      'jury-duty': 'bg-yellow-100 text-yellow-800',
      other: 'bg-green-100 text-green-800'
    }
    return (
      <Badge className={colors[type as keyof typeof colors] || colors.other}>
        {type.replace('-', ' ').toUpperCase()}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading leave management data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-gray-600">Centralize holiday allowance, requests, and sickness management</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_requests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_requests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved_requests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected_requests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Days Off</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.total_days_off}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>Review and manage employee leave requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by employee name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="bereavement">Bereavement</SelectItem>
                <SelectItem value="jury-duty">Jury Duty</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Requests Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {request.employee_first_name} {request.employee_last_name}
                        </div>
                        <div className="text-sm text-gray-500">{request.employee_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(request.type)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(request.start_date)} - {formatDate(request.end_date)}
                      </div>
                    </TableCell>
                    <TableCell>{request.days_requested}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(request.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request)
                            setShowApprovalDialog(true)
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        {request.status === 'pending' && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => openApprovalDialog(request, 'approve')}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => openApprovalDialog(request, 'reject')}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredRequests.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No leave requests found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <div className="space-y-2">
                  <p><strong>Employee:</strong> {selectedRequest.employee_first_name} {selectedRequest.employee_last_name}</p>
                  <p><strong>Type:</strong> {selectedRequest.type}</p>
                  <p><strong>Dates:</strong> {formatDate(selectedRequest.start_date)} - {formatDate(selectedRequest.end_date)}</p>
                  <p><strong>Days:</strong> {selectedRequest.days_requested}</p>
                  {selectedRequest.reason && <p><strong>Reason:</strong> {selectedRequest.reason}</p>}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notes">
                {approvalAction === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Reason (Required)'}
              </Label>
              <Textarea
                id="notes"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder={approvalAction === 'approve' ? 'Add any notes about this approval...' : 'Explain why this request is being rejected...'}
                required={approvalAction === 'reject'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={approvalAction === 'approve' ? 'default' : 'destructive'}
              onClick={() => selectedRequest && handleApproval(selectedRequest.id, approvalAction)}
              disabled={approvalAction === 'reject' && !approvalNotes.trim()}
            >
              {approvalAction === 'approve' ? 'Approve Request' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


