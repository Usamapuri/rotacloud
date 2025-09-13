"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Eye, 
  Filter, 
  Search, 
  Calendar,
  User,
  DollarSign,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Settings,
  RefreshCw,
  Lock,
  Download
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ShiftApproval {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  employee_code: string
  department: string
  job_position: string
  hourly_rate: number
  clock_in: string
  clock_out: string
  total_hours: number
  break_hours: number
  total_calls_taken: number
  leads_generated: number
  shift_remarks: string
  performance_rating: number
  approval_status: 'pending' | 'approved' | 'rejected' | 'edited'
  admin_notes: string
  rejection_reason: string
  created_at: string
  shift_date: string
  shift_name: string
  scheduled_start_time: string
  scheduled_end_time: string
  approver_first_name: string
  approver_last_name: string
  missing_events?: boolean
  is_late?: boolean
  early_leave?: boolean
  overtime?: boolean
}

interface ApprovalStats {
  pending: number
  approved: number
  rejected: number
  pendingHours: number
  approvedHours: number
}

export default function ShiftApprovalsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [approvals, setApprovals] = useState<ShiftApproval[]>([])
  const [stats, setStats] = useState<ApprovalStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    pendingHours: 0,
    approvedHours: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedApproval, setSelectedApproval] = useState<ShiftApproval | null>(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'edit'>('approve')
  const [approvalData, setApprovalData] = useState({
    approved_hours: 0,
    approved_rate: 0,
    admin_notes: '',
    rejection_reason: ''
  })
  const [editTimes, setEditTimes] = useState({ clock_in: '', clock_out: '', break_hours: '' })
  const [bulkOpen, setBulkOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [tenantSettings, setTenantSettings] = useState<any>(null)
  const [lastPeriodText, setLastPeriodText] = useState('')
  const [showPayrollDialog, setShowPayrollDialog] = useState(false)
  const [payrollStartDate, setPayrollStartDate] = useState('')
  const [payrollEndDate, setPayrollEndDate] = useState('')
  const [isLockingPeriod, setIsLockingPeriod] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'admin') {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    loadApprovals()
  }, [router, selectedStatus])

  const loadApprovals = async () => {
    try {
      setIsLoading(true)
      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`
      if (user?.tenant_id) headers['x-tenant-id'] = user.tenant_id
      
      const response = await fetch(`/api/admin/shift-approvals?status=${selectedStatus}`, { headers })
      const data = await response.json()
      
      if (data.success) {
        setApprovals(data.data.approvals)
        setStats(data.data.stats)
      } else {
        toast.error(data.error || 'Failed to load shift approvals')
      }
    } catch (error) {
      console.error('Error loading approvals:', error)
      toast.error('Failed to load shift approvals')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprovalAction = async () => {
    if (!selectedApproval) return

    try {
      if (approvalAction === 'edit') {
        const cin = editTimes.clock_in ? new Date(editTimes.clock_in) : null
        const cout = editTimes.clock_out ? new Date(editTimes.clock_out) : null
        const bh = editTimes.break_hours ? parseFloat(editTimes.break_hours) : 0
        if (cin && cout && cout <= cin) {
          return toast.error('Clock-out must be after clock-in')
        }
        if (bh < 0) return toast.error('Break hours cannot be negative')
        if (cin && cout) {
          const diff = (cout.getTime() - cin.getTime()) / 3600000
          if (bh > diff) return toast.error('Break hours cannot exceed total hours')
        }
      }

      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`
      if (user?.tenant_id) headers['x-tenant-id'] = user.tenant_id
      
      const response = await fetch(`/api/admin/shift-approvals/${selectedApproval.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          action: approvalAction,
          ...approvalData,
          clock_in: editTimes.clock_in || null,
          clock_out: editTimes.clock_out || null,
          break_hours: editTimes.break_hours ? parseFloat(editTimes.break_hours) : undefined
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(data.message)
        setShowApprovalDialog(false)
        setSelectedApproval(null)
        loadApprovals()
      } else {
        toast.error(data.error || 'Failed to process approval')
      }
    } catch (error) {
      console.error('Error processing approval:', error)
      toast.error('Failed to process approval')
    }
  }

  const openApprovalDialog = (approval: ShiftApproval, action: 'approve' | 'reject' | 'edit') => {
    setSelectedApproval(approval)
    setApprovalAction(action)
    setApprovalData({
      approved_hours: Number(approval.total_hours) || 0,
      approved_rate: Number(approval.hourly_rate) || 0,
      admin_notes: approval.admin_notes || '',
      rejection_reason: approval.rejection_reason || ''
    })
    setEditTimes({
      clock_in: approval.clock_in ? approval.clock_in.slice(0,16) : '',
      clock_out: approval.clock_out ? approval.clock_out.slice(0,16) : '',
      break_hours: String(approval.break_hours ?? '')
    })
    setShowApprovalDialog(true)
  }

  const setPreset = (type: 'last_week'|'last_period') => {
    const today = new Date()
    const d = new Date(today)
    if (type === 'last_week') {
      const day = today.getDay() || 7
      d.setDate(today.getDate() - day - 6)
      const start = new Date(d)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      setStartDate(start.toISOString().split('T')[0])
      setEndDate(end.toISOString().split('T')[0])
    } else {
      // Use tenant settings to compute the last completed pay period
      computeLastPayPeriod()
    }
  }

  const handleBulkApprove = async () => {
    if (!startDate || !endDate) return toast.error('Select a date range')
    try {
      const user = AuthService.getCurrentUser()
      const headers: Record<string,string> = { 'Content-Type':'application/json' }
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`
      const res = await fetch('/api/admin/shift-approvals/bulk', { method:'POST', headers, body: JSON.stringify({ start_date: startDate, end_date: endDate }) })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Approved ${data.approved} entries`)
        setBulkOpen(false)
        loadApprovals()
      } else {
        toast.error(data.error || 'Bulk approval failed')
      }
    } catch (e) {
      toast.error('Bulk approval failed')
    }
  }

  // Load settings when opening bulk modal
  useEffect(() => {
    if (!bulkOpen) return
    ;(async () => {
      try {
        const user = AuthService.getCurrentUser()
        const headers: Record<string,string> = {}
        if (user?.id) headers['authorization'] = `Bearer ${user.id}`
        const res = await fetch('/api/admin/settings/approvals', { headers })
        if (res.ok) {
          const data = await res.json()
          setTenantSettings(data.data)
          const r = computeLastPayPeriodRange(data.data)
          if (r) setLastPeriodText(`${r.start} → ${r.end}`)
        }
      } catch {}
    })()
  }, [bulkOpen])

  const computeLastPayPeriodRange = (settingsOverride?: any): { start: string, end: string } | null => {
    const settings = settingsOverride || tenantSettings || {}
    const type = (settings.pay_period_type || 'weekly') as 'weekly'|'biweekly'|'custom'
    const weekStart = Number(settings.week_start_day ?? 1) // 0=Sunday,1=Monday
    const customDays = Number(settings.custom_period_days || 0)

    const today = new Date()
    // Work with dates at midnight for consistency
    const toMidnight = (dt: Date) => { const x = new Date(dt); x.setHours(0,0,0,0); return x }
    const addDays = (dt: Date, n: number) => { const x = new Date(dt); x.setDate(x.getDate()+n); return x }

    const getWeekStart = (dt: Date, startDay: number) => {
      const x = toMidnight(dt)
      // JS getDay: 0=Sunday..6=Saturday
      const curr = x.getDay()
      const diff = (curr - startDay + 7) % 7
      return addDays(x, -diff)
    }

    if (type === 'weekly' || type === 'biweekly') {
      const periodDays = type === 'weekly' ? 7 : 14
      // Start of current period
      const currentStart = getWeekStart(today, weekStart)
      // Last period start/end
      const lastStart = addDays(currentStart, -periodDays)
      const lastEnd = addDays(currentStart, -1)
      return { start: lastStart.toISOString().split('T')[0], end: lastEnd.toISOString().split('T')[0] }
    }

    // Custom: last N days ending yesterday
    const n = customDays > 0 ? customDays : 14
    const end = addDays(toMidnight(today), -1)
    const start = addDays(end, -(n-1))
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
  }

  const computeLastPayPeriod = () => {
    const r = computeLastPayPeriodRange()
    if (r) { setStartDate(r.start); setEndDate(r.end) }
  }

  const handleLockPayPeriod = async () => {
    if (!payrollStartDate || !payrollEndDate) {
      return toast.error('Please select a date range')
    }

    try {
      setIsLockingPeriod(true)
      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      const response = await fetch('/api/admin/pay-periods', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          start_date: payrollStartDate,
          end_date: payrollEndDate
        })
      })

      const data = await response.json()
      if (response.ok) {
        toast.success(`Pay period locked successfully`)
        setShowPayrollDialog(false)
      } else {
        toast.error(data.error || 'Failed to lock pay period')
      }
    } catch (error) {
      console.error('Error locking pay period:', error)
      toast.error('Failed to lock pay period')
    } finally {
      setIsLockingPeriod(false)
    }
  }

  const handleExportPayroll = async () => {
    if (!payrollStartDate || !payrollEndDate) {
      return toast.error('Please select a date range')
    }

    try {
      setIsExporting(true)
      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = {}
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      const response = await fetch(
        `/api/admin/payroll/export?start_date=${payrollStartDate}&end_date=${payrollEndDate}`,
        { headers }
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `payroll-${payrollStartDate}-to-${payrollEndDate}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Payroll exported successfully')
        setShowPayrollDialog(false)
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to export payroll')
      }
    } catch (error) {
      console.error('Error exporting payroll:', error)
      toast.error('Failed to export payroll')
    } finally {
      setIsExporting(false)
    }
  }

  const formatDuration = (hours: number) => {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}h ${minutes}m`
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'edited': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredApprovals = approvals.filter(approval => {
    const searchLower = searchTerm.toLowerCase()
    return (
      approval.first_name.toLowerCase().includes(searchLower) ||
      approval.last_name.toLowerCase().includes(searchLower) ||
      approval.employee_code.toLowerCase().includes(searchLower) ||
      approval.department.toLowerCase().includes(searchLower)
    )
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading shift approvals...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Shift Approvals</h1>
              <p className="text-gray-600">Review and approve employee shift submissions</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setShowPayrollDialog(true)} 
                variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Lock className="h-4 w-4 mr-2" />
                Lock Pay Period
              </Button>
              <Button 
                onClick={() => setShowPayrollDialog(true)} 
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Payroll
              </Button>
              <Button onClick={loadApprovals} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rejected</p>
                  <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Hours</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.pendingHours.toFixed(1)}h</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved Hours</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.approvedHours.toFixed(1)}h</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={selectedStatus} onValueChange={setSelectedStatus} className="space-y-6">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-50 data-[state=active]:text-yellow-700">
              <AlertCircle className="h-4 w-4 mr-2" />
              Pending ({stats.pending})
            </TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Approved ({stats.approved})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
              <XCircle className="h-4 w-4 mr-2" />
              Rejected ({stats.rejected})
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              <Eye className="h-4 w-4 mr-2" />
              All
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={selectedStatus} className="space-y-6">
            {/* Search and Filters */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, code, or department..."
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={() => setBulkOpen(true)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Timesheets
              </Button>
            </div>

            {/* Approvals List */}
            <div className="space-y-4">
              {filteredApprovals.length === 0 ? (
                <Card className="bg-white shadow-sm border-0">
                  <CardContent className="p-12 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No shifts found</h3>
                    <p className="text-gray-600">
                      {searchTerm ? 'Try adjusting your search' : `No ${selectedStatus} shifts to display`}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredApprovals.map((approval) => (
                  <Card key={approval.id} className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-4">
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {approval.first_name} {approval.last_name}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {approval.employee_code} • {approval.department} • {approval.job_position}
                              </p>
                            </div>
                            <Badge className={getStatusColor(approval.approval_status)}>
                              {approval.approval_status.charAt(0).toUpperCase() + approval.approval_status.slice(1)}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                            <div>
                              <p className="text-sm font-medium text-gray-600">Shift Date</p>
                              <p className="text-sm text-gray-900">{formatDateTime(approval.clock_in)}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-600">Duration</p>
                              <p className="text-sm text-gray-900">{formatDuration(approval.total_hours)}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-600">Rate</p>
                              <p className="text-sm text-gray-900">£{approval.hourly_rate}/hr</p>
                            </div>
                          </div>

                          {/* Discrepancy Flags */}
                          <TooltipProvider>
                            <div className="flex items-center gap-3 mb-4 text-sm">
                              {approval.missing_events && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">🔴</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Missing clock-in or clock-out</TooltipContent>
                                </Tooltip>
                              )}
                              {approval.is_late && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">⏰</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Employee clocked in late</TooltipContent>
                                </Tooltip>
                              )}
                              {approval.early_leave && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">🏃‍♂️</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Employee left early</TooltipContent>
                                </Tooltip>
                              )}
                              {approval.overtime && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">➕</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Overtime beyond scheduled + 15m</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>
                          
                          {approval.shift_remarks && (
                            <div className="mb-4">
                              <p className="text-sm font-medium text-gray-600">Employee Notes</p>
                              <p className="text-sm text-gray-900">{approval.shift_remarks}</p>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>📞 {approval.total_calls_taken} calls</span>
                            <span>🎯 {approval.leads_generated} leads</span>
                            {approval.performance_rating && (
                              <span>⭐ {approval.performance_rating}/5 rating</span>
                            )}
                          </div>
                        </div>
                        
                        {approval.approval_status === 'pending' && (
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              size="sm"
                              onClick={() => openApprovalDialog(approval, 'approve')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openApprovalDialog(approval, 'edit')}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openApprovalDialog(approval, 'reject')}
                              className="text-red-600 hover:text-red-700"
                            >
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Approval Dialog */}
        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {approvalAction === 'approve' && <ThumbsUp className="h-5 w-5 text-green-600" />}
                {approvalAction === 'reject' && <ThumbsDown className="h-5 w-5 text-red-600" />}
                {approvalAction === 'edit' && <Edit className="h-5 w-5 text-blue-600" />}
                {approvalAction.charAt(0).toUpperCase() + approvalAction.slice(1)} Shift
              </DialogTitle>
              <DialogDescription>
                {selectedApproval && (
                  <div className="space-y-2">
                    <p><strong>Employee:</strong> {selectedApproval.first_name} {selectedApproval.last_name}</p>
                    <p><strong>Date:</strong> {formatDateTime(selectedApproval.clock_in)}</p>
                    <p><strong>Duration:</strong> {formatDuration(selectedApproval.total_hours)}</p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {(approvalAction === 'approve' || approvalAction === 'edit') && (
                <>
                  <div>
                    <Label htmlFor="approved_hours">Approved Hours</Label>
                    <Input
                      id="approved_hours"
                      type="number"
                      step="0.25"
                      value={approvalData.approved_hours || ''}
                      onChange={(e) => setApprovalData(prev => ({ ...prev, approved_hours: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="approved_rate">Hourly Rate (£)</Label>
                    <Input
                      id="approved_rate"
                      type="number"
                      step="0.01"
                      value={approvalData.approved_rate || ''}
                      onChange={(e) => setApprovalData(prev => ({ ...prev, approved_rate: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label>Clock In</Label>
                      <Input type="datetime-local" value={editTimes.clock_in} onChange={e=>setEditTimes(prev=>({ ...prev, clock_in: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Clock Out</Label>
                      <Input type="datetime-local" value={editTimes.clock_out} onChange={e=>setEditTimes(prev=>({ ...prev, clock_out: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Break Hours</Label>
                      <Input type="number" step="0.25" value={editTimes.break_hours} onChange={e=>setEditTimes(prev=>({ ...prev, break_hours: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}
              
              {approvalAction === 'reject' && (
                <div>
                  <Label htmlFor="rejection_reason">Rejection Reason *</Label>
                  <Textarea
                    id="rejection_reason"
                    value={approvalData.rejection_reason}
                    onChange={(e) => setApprovalData(prev => ({ ...prev, rejection_reason: e.target.value }))}
                    placeholder="Please provide a reason for rejection..."
                    required
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="admin_notes">Admin Notes</Label>
                <Textarea
                  id="admin_notes"
                  value={approvalData.admin_notes}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, admin_notes: e.target.value }))}
                  placeholder="Optional notes for the employee..."
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleApprovalAction}
                className={
                  approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  approvalAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }
              >
                {approvalAction.charAt(0).toUpperCase() + approvalAction.slice(1)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Approve Dialog */}
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Approve Timesheets</DialogTitle>
              <DialogDescription>Select a date range to approve.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setPreset('last_week')}>Last Week</Button>
                <div className="space-y-1">
                  <Button variant="outline" onClick={() => setPreset('last_period')}>Last Pay Period</Button>
                  {lastPeriodText && (
                    <div className="text-xs text-gray-500">{lastPeriodText}</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start</Label>
                  <Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>End</Label>
                  <Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setBulkOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkApprove}>Approve</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payroll Dialog */}
        <Dialog open={showPayrollDialog} onOpenChange={setShowPayrollDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Payroll Management</DialogTitle>
              <DialogDescription>Lock pay period or export payroll data.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => {
                  const r = computeLastPayPeriodRange()
                  if (r) { setPayrollStartDate(r.start); setPayrollEndDate(r.end) }
                }}>
                  Last Pay Period
                </Button>
                <Button variant="outline" onClick={() => {
                  const today = new Date()
                  const lastWeek = new Date(today)
                  lastWeek.setDate(today.getDate() - 7)
                  setPayrollStartDate(lastWeek.toISOString().split('T')[0])
                  setPayrollEndDate(today.toISOString().split('T')[0])
                }}>
                  Last 7 Days
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={payrollStartDate} 
                    onChange={e => setPayrollStartDate(e.target.value)} 
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input 
                    type="date" 
                    value={payrollEndDate} 
                    onChange={e => setPayrollEndDate(e.target.value)} 
                  />
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Locking a pay period prevents further edits to timesheets in that range. 
                  Export generates a CSV file with all approved timesheets for payroll processing.
                </p>
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPayrollDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleLockPayPeriod}
                disabled={isLockingPeriod || isExporting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLockingPeriod ? 'Locking...' : 'Lock Pay Period'}
              </Button>
              <Button 
                onClick={handleExportPayroll}
                disabled={isLockingPeriod || isExporting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isExporting ? 'Exporting...' : 'Export Payroll'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
