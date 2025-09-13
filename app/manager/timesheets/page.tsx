"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Clock, 
  Download, 
  RefreshCw,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"
import LocationFilter from "@/components/admin/LocationFilter"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import type { DateRange } from "react-day-picker"
import { addDays } from "date-fns"

interface TimesheetEntry {
  id: string
  employee_id: string
  employee_name: string
  employee_code: string
  location_name: string
  clock_in: string
  clock_out: string
  total_hours: number
  hourly_rate: number
  total_pay: number
  break_hours: number
  approval_status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  admin_notes?: string
  rejection_reason?: string
  created_at: string
}

interface TimesheetSummary {
  total_entries: number
  pending_approvals: number
  approved_entries: number
  rejected_entries: number
  total_hours: number
  total_pay: number
  average_hours_per_employee: number
}

export default function ManagerTimesheets() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([])
  const [summary, setSummary] = useState<TimesheetSummary | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date(),
  })
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'manager') {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    loadTimesheets()
  }, [router])

  useEffect(() => {
    loadTimesheets()
  }, [selectedLocationId, dateRange, selectedStatus])

  const loadTimesheets = async () => {
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
      if (dateRange?.from) {
        params.append('start_date', dateRange.from.toISOString().split('T')[0])
      }
      if (dateRange?.to) {
        params.append('end_date', dateRange.to.toISOString().split('T')[0])
      }
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus)
      }

      const response = await fetch(`/api/manager/timesheets?${params.toString()}`, {
        headers
      })

      if (!response.ok) {
        throw new Error('Failed to load timesheets')
      }

      const data = await response.json()
      setTimesheets(data.data.timesheets || [])
      setSummary(data.data.summary || null)
    } catch (error) {
      console.error('Error loading timesheets:', error)
      toast.error('Failed to load timesheets')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDuration = (hours: number) => {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}h ${minutes}m`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
      case 'pending':
        return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" />Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleExport = () => {
    // Implementation for exporting timesheets
    toast.info('Export functionality coming soon')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading timesheets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Team Timesheets</h1>
            <p className="text-gray-600 mt-1">View and manage timesheet entries from your team</p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={loadTimesheets} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <LocationFilter
            selectedLocationId={selectedLocationId}
            onLocationChange={setSelectedLocationId}
            showAllOption={false}
            showRefresh={false}
            placeholder="Select location..."
          />

          <div className="flex items-center space-x-2">
            <Label className="text-sm font-medium">Status:</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">Total Entries</p>
                    <p className="text-2xl font-bold text-blue-900">{summary.total_entries}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-800">Pending</p>
                    <p className="text-2xl font-bold text-orange-900">{summary.pending_approvals}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">Total Hours</p>
                    <p className="text-2xl font-bold text-green-900">{formatDuration(summary.total_hours)}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-800">Total Pay</p>
                    <p className="text-2xl font-bold text-purple-900">£{summary.total_pay.toFixed(2)}</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Timesheets Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timesheet Entries
            </CardTitle>
            <CardDescription>
              {timesheets.length} entries found for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timesheets.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Total Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheets.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.employee_name}</div>
                            <div className="text-sm text-gray-500">{entry.employee_code}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            {entry.location_name}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(entry.clock_in)}</TableCell>
                        <TableCell>{formatDateTime(entry.clock_in)}</TableCell>
                        <TableCell>{entry.clock_out ? formatDateTime(entry.clock_out) : '-'}</TableCell>
                        <TableCell>{formatDuration(entry.total_hours)}</TableCell>
                        <TableCell>£{entry.hourly_rate.toFixed(2)}</TableCell>
                        <TableCell>£{entry.total_pay.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(entry.approval_status)}</TableCell>
                        <TableCell>
                          {entry.approval_status === 'pending' && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/manager/approvals?type=timesheet&id=${entry.id}`)}
                              >
                                Review
                              </Button>
                            </div>
                          )}
                          {entry.approval_status !== 'pending' && (
                            <span className="text-sm text-gray-500">
                              {entry.approved_at ? formatDateTime(entry.approved_at) : '-'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No timesheet entries found</h3>
                <p className="text-gray-600">
                  {selectedLocationId 
                    ? 'No timesheet entries found for the selected location and date range.'
                    : 'Please select a location to view timesheet entries.'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
