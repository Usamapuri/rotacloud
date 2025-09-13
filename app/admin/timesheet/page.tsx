"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Clock, 
  Calendar, 
  Users, 
  ChevronLeft,
  ChevronRight,
  LogOut,
  ArrowLeft,
  Download,
  Filter,
  Search,
  BarChart3,
  TrendingUp,
  Coffee,
  Timer,
  CalendarDays,
  FileText,
  Activity,
  Eye,
  User,
  Building,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Save,
  X,
  Zap,
  Clock4,
  Clock1,
  AlertCircle,
  CheckSquare,
  Square
} from 'lucide-react'
import { AuthService } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

interface Employee {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string
  department: string
  position: string
  is_active: boolean
  location_id?: string
  location_name?: string
}

interface ShiftAssignment {
  id: string
  employee_id: string
  template_id: string
  date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'assigned' | 'completed' | 'cancelled'
  template_name?: string
}

interface TimeEntry {
  id: string
  employee_id: string
  date: string
  clock_in: string
  clock_out?: string
  break_hours: number
  total_hours: number
  status: 'in-progress' | 'completed' | 'break'
  is_approved: boolean
  approved_by?: string
  approved_at?: string
  notes?: string
  discrepancies?: string[]
}

interface BreakLog {
  id: string
  time_entry_id: string
  employee_id: string
  break_start: string
  break_end?: string
  break_duration?: number
  break_type: 'lunch' | 'rest' | 'other'
  status: 'active' | 'completed'
  created_at: string
}

interface TimesheetEntry {
  id: string
  employee_id: string
  employee_name: string
  employee_code: string
  department: string
  location_name?: string
  date: string
  scheduled_start?: string
  scheduled_end?: string
  actual_clock_in: string
  actual_clock_out?: string
  scheduled_hours?: number
  actual_hours: number
  break_hours: number
  total_approved_hours: number
  discrepancies: Discrepancy[]
  is_approved: boolean
  approved_by?: string
  approved_at?: string
  notes?: string
  breaks: BreakLog[]
}

interface Discrepancy {
  type: 'late_clock_in' | 'early_clock_out' | 'missing_clock_out' | 'overtime' | 'no_show' | 'extra_break'
  severity: 'warning' | 'error'
  message: string
  minutes?: number
}

interface TimesheetSummary {
  totalEmployees: number
  totalShifts: number
  totalHours: number
  totalBreaks: number
  averageShiftLength: number
  onTimePercentage: number
  overtimeHours: number
  activeEmployees: number
  pendingApprovals: number
  discrepanciesCount: number
}

export default function AdminTimesheet() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<TimesheetSummary>({
    totalEmployees: 0,
    totalShifts: 0,
    totalHours: 0,
    totalBreaks: 0,
    averageShiftLength: 0,
    onTimePercentage: 0,
    overtimeHours: 0,
    activeEmployees: 0,
    pendingApprovals: 0,
    discrepanciesCount: 0
  })
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [discrepancyFilter, setDiscrepancyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  
  // Editing and approval
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null)
  const [editForm, setEditForm] = useState({
    clock_in: '',
    clock_out: '',
    break_hours: 0,
    notes: ''
  })
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showBulkApprovalDialog, setShowBulkApprovalDialog] = useState(false)
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [bulkApprovalNotes, setBulkApprovalNotes] = useState('')
  
  const router = useRouter()

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'admin') {
      router.push('/login')
    } else {
      setCurrentUser(user)
      loadTimesheetData()
    }
  }, [router, selectedMonth])

  const loadTimesheetData = async () => {
    try {
      setLoading(true)
      const startDate = getMonthStart(selectedMonth)
      const endDate = getMonthEnd(selectedMonth)

      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = {}
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      // Load timesheet entries with discrepancy detection
      const response = await fetch(`/api/admin/timesheet?start_date=${startDate}&end_date=${endDate}`, { headers })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setTimesheetEntries(data.data || [])
          calculateSummary(data.data || [])
        }
      } else {
        console.error('Failed to load timesheet data:', response.status)
        toast.error('Failed to load timesheet data')
      }
    } catch (error) {
      console.error('Error loading timesheet data:', error)
      toast.error('Failed to load timesheet data')
    } finally {
      setLoading(false)
    }
  }

  const calculateSummary = (entries: TimesheetEntry[]) => {
    const uniqueEmployees = new Set(entries.map(entry => entry.employee_id))
    const totalEmployees = uniqueEmployees.size
    const totalShifts = entries.length
    const totalHours = entries.reduce((sum, entry) => sum + entry.total_approved_hours, 0)
    const totalBreaks = entries.reduce((sum, entry) => sum + entry.break_hours, 0)
    const averageShiftLength = totalShifts > 0 ? totalHours / totalShifts : 0
    
    const onTimeEntries = entries.filter(entry => entry.discrepancies.length === 0).length
    const onTimePercentage = totalShifts > 0 ? (onTimeEntries / totalShifts) * 100 : 0
    
    const overtimeHours = entries.reduce((sum, entry) => {
      const overtimeDiscrepancy = entry.discrepancies.find(d => d.type === 'overtime')
      return sum + (overtimeDiscrepancy?.minutes ? overtimeDiscrepancy.minutes / 60 : 0)
    }, 0)
    
    const pendingApprovals = entries.filter(entry => !entry.is_approved).length
    const discrepanciesCount = entries.reduce((sum, entry) => sum + entry.discrepancies.length, 0)

    setSummary({
      totalEmployees,
      totalShifts,
      totalHours,
      totalBreaks,
      averageShiftLength,
      onTimePercentage,
      overtimeHours,
      activeEmployees: totalEmployees, // All employees with entries are considered active
      pendingApprovals,
      discrepanciesCount
    })
  }

  const getMonthStart = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month, 1).toISOString().split('T')[0]
  }

  const getMonthEnd = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).toISOString().split('T')[0]
  }

  const handlePreviousMonth = () => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() - 1)
    setSelectedMonth(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() + 1)
    setSelectedMonth(newDate)
  }

  const handleLogout = () => {
    AuthService.logout()
    router.push('/login')
  }

  // Discrepancy detection and display
  const getDiscrepancyIcon = (discrepancy: Discrepancy) => {
    switch (discrepancy.type) {
      case 'late_clock_in':
        return <Clock4 className="h-4 w-4 text-red-500" />
      case 'early_clock_out':
        return <Clock1 className="h-4 w-4 text-orange-500" />
      case 'missing_clock_out':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'overtime':
        return <Zap className="h-4 w-4 text-yellow-500" />
      case 'no_show':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'extra_break':
        return <Coffee className="h-4 w-4 text-orange-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getDiscrepancyBadge = (discrepancies: Discrepancy[]) => {
    if (discrepancies.length === 0) {
      return <Badge variant="default" className="bg-green-100 text-green-800">On Time</Badge>
    }
    
    const hasErrors = discrepancies.some(d => d.severity === 'error')
    const hasWarnings = discrepancies.some(d => d.severity === 'warning')
    
    if (hasErrors) {
      return <Badge variant="destructive">Issues</Badge>
    } else if (hasWarnings) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warnings</Badge>
    }
    
    return <Badge variant="outline">Discrepancies</Badge>
  }

  // Edit functionality
  const openEditDialog = (entry: TimesheetEntry) => {
    setEditingEntry(entry)
    setEditForm({
      clock_in: entry.actual_clock_in,
      clock_out: entry.actual_clock_out || '',
      break_hours: entry.break_hours,
      notes: entry.notes || ''
    })
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!editingEntry) return

    try {
      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      const response = await fetch(`/api/admin/timesheet/${editingEntry.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        toast.success('Timesheet entry updated successfully')
        setShowEditDialog(false)
        setEditingEntry(null)
        loadTimesheetData() // Reload data
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to update timesheet entry')
      }
    } catch (error) {
      console.error('Error updating timesheet entry:', error)
      toast.error('Failed to update timesheet entry')
    }
  }

  // Bulk approval functionality
  const handleSelectAll = () => {
    if (selectedEntries.length === filteredEntries.length) {
      setSelectedEntries([])
    } else {
      setSelectedEntries(filteredEntries.map(entry => entry.id))
    }
  }

  const handleSelectEntry = (entryId: string) => {
    setSelectedEntries(prev => 
      prev.includes(entryId) 
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    )
  }

  const handleBulkApproval = async () => {
    if (selectedEntries.length === 0) {
      toast.error('Please select at least one entry to approve')
      return
    }

    try {
      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`

      const response = await fetch('/api/admin/timesheet/bulk-approve', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entry_ids: selectedEntries,
          notes: bulkApprovalNotes
        }),
      })

      if (response.ok) {
        toast.success(`${selectedEntries.length} entries approved successfully`)
        setShowBulkApprovalDialog(false)
        setSelectedEntries([])
        setBulkApprovalNotes('')
        loadTimesheetData() // Reload data
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to approve entries')
      }
    } catch (error) {
      console.error('Error approving entries:', error)
      toast.error('Failed to approve entries')
    }
  }

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  // Filtering logic
  const filteredEntries = timesheetEntries.filter(entry => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      if (!entry.employee_name.toLowerCase().includes(searchLower) &&
          !entry.employee_code.toLowerCase().includes(searchLower) &&
          !entry.department.toLowerCase().includes(searchLower)) {
        return false
      }
    }

    // Department filter
    if (departmentFilter !== 'all' && entry.department !== departmentFilter) {
      return false
    }

    // Location filter
    if (locationFilter !== 'all' && entry.location_name !== locationFilter) {
      return false
    }

    // Discrepancy filter
    if (discrepancyFilter !== 'all') {
      const hasDiscrepancyType = entry.discrepancies.some(d => d.type === discrepancyFilter)
      if (!hasDiscrepancyType) {
        return false
      }
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'approved' && !entry.is_approved) return false
      if (statusFilter === 'pending' && entry.is_approved) return false
      if (statusFilter === 'discrepancies' && entry.discrepancies.length === 0) return false
    }

    // Employee filter
    if (selectedEmployee !== 'all' && entry.employee_id !== selectedEmployee) {
      return false
    }

    return true
  })

  // Get unique values for filters
  const departments = [...new Set(timesheetEntries.map(entry => entry.department))]
  const locations = [...new Set(timesheetEntries.map(entry => entry.location_name).filter(Boolean))]
  const employees = [...new Set(timesheetEntries.map(entry => ({
    id: entry.employee_id,
    name: entry.employee_name,
    code: entry.employee_code
  })))].reduce((acc, curr) => {
    if (!acc.find(item => item.id === curr.id)) {
      acc.push(curr)
    }
    return acc
  }, [] as Array<{id: string, name: string, code: string}>)

  const exportTimesheet = () => {
    const csvContent = [
      ['Employee ID', 'Employee Name', 'Department', 'Location', 'Date', 'Scheduled Start', 'Scheduled End', 'Actual Clock In', 'Actual Clock Out', 'Scheduled Hours', 'Actual Hours', 'Break Hours', 'Total Approved Hours', 'Discrepancies', 'Status', 'Approved By', 'Notes'],
      ...filteredEntries.map(entry => [
        entry.employee_code,
        entry.employee_name,
        entry.department,
        entry.location_name || '',
        formatDate(entry.date),
        entry.scheduled_start ? formatTime(entry.scheduled_start) : '',
        entry.scheduled_end ? formatTime(entry.scheduled_end) : '',
        formatTime(entry.actual_clock_in),
        entry.actual_clock_out ? formatTime(entry.actual_clock_out) : 'Ongoing',
        entry.scheduled_hours?.toString() || '',
        entry.actual_hours.toString(),
        entry.break_hours.toString(),
        entry.total_approved_hours.toString(),
        entry.discrepancies.map(d => d.message).join('; '),
        entry.is_approved ? 'Approved' : 'Pending',
        entry.approved_by || '',
        entry.notes || ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin-timesheet-${selectedMonth.toISOString().slice(0, 7)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success('Timesheet exported successfully!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading timesheet data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/admin/dashboard">
                <div className="flex items-center">
                  <ArrowLeft className="h-6 w-6 text-purple-600 mr-2" />
                  <span className="text-xl font-bold text-gray-900">← Admin Timesheet</span>
                </div>
              </Link>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <Users className="h-3 w-3 mr-1" />
                Employee Time Management
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Admin: {currentUser?.email}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Month Navigation and Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous Month
            </Button>
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900">
                {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <p className="text-sm text-gray-600">Employee timesheet overview</p>
            </div>
            <Button variant="outline" onClick={handleNextMonth}>
              Next Month
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="default" 
              onClick={() => setShowBulkApprovalDialog(true)}
              disabled={selectedEntries.length === 0}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Bulk Approval ({selectedEntries.length})
            </Button>
            <Button variant="outline" onClick={exportTimesheet}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Employees</p>
                  <p className="text-2xl font-bold">{summary.totalEmployees}</p>
                </div>
                <Users className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Shifts</p>
                  <p className="text-2xl font-bold">{summary.totalShifts}</p>
                </div>
                <Calendar className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Hours</p>
                  <p className="text-2xl font-bold">{summary.totalHours.toFixed(1)}h</p>
                </div>
                <Clock className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Breaks</p>
                  <p className="text-2xl font-bold">{summary.totalBreaks.toFixed(1)}h</p>
                </div>
                <Coffee className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Avg Shift</p>
                  <p className="text-2xl font-bold">{summary.averageShiftLength.toFixed(1)}h</p>
                </div>
                <Timer className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">On Time</p>
                  <p className="text-2xl font-bold">{summary.onTimePercentage.toFixed(0)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Discrepancies</p>
                  <p className="text-2xl font-bold">{summary.discrepanciesCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Pending</p>
                  <p className="text-2xl font-bold">{summary.pendingApprovals}</p>
                </div>
                <Clock4 className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <Label htmlFor="search">Search Employees</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="search"
                    placeholder="Search by name, email, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="department">Department</Label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(location => (
                      <SelectItem key={location} value={location}>{location}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="discrepancies">Has Discrepancies</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="discrepancy">Discrepancy Type</Label>
                <Select value={discrepancyFilter} onValueChange={setDiscrepancyFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="late_clock_in">Late Clock-in</SelectItem>
                    <SelectItem value="early_clock_out">Early Clock-out</SelectItem>
                    <SelectItem value="missing_clock_out">Missing Clock-out</SelectItem>
                    <SelectItem value="overtime">Overtime</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="employee">Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Timesheet Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Employee Timesheet Entries
            </CardTitle>
            <CardDescription>
              Complete overview of all employee time entries with discrepancy flags and editing capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedEntries.length === filteredEntries.length && filteredEntries.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Scheduled Times</TableHead>
                    <TableHead>Actual Times</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Breaks</TableHead>
                    <TableHead>Discrepancies</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow 
                      key={entry.id} 
                      className={`${entry.discrepancies.length > 0 ? 'bg-yellow-50' : ''} hover:bg-gray-50`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedEntries.includes(entry.id)}
                          onCheckedChange={() => handleSelectEntry(entry.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{entry.employee_name}</div>
                          <div className="text-sm text-gray-500">{entry.employee_code}</div>
                          <div className="text-xs text-gray-400">{entry.department}</div>
                          {entry.location_name && (
                            <div className="text-xs text-blue-600">{entry.location_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(entry.date)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {entry.scheduled_start ? (
                            <>
                              <div className="font-medium">{formatTime(entry.scheduled_start)}</div>
                              <div className="text-gray-500">{formatTime(entry.scheduled_end || '')}</div>
                              <div className="text-xs text-gray-400">
                                {entry.scheduled_hours?.toFixed(1)}h scheduled
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-400">No schedule</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{formatTime(entry.actual_clock_in)}</div>
                          <div className="text-gray-500">
                            {entry.actual_clock_out ? formatTime(entry.actual_clock_out) : 'Ongoing'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {entry.actual_hours.toFixed(1)}h worked
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium text-green-600">
                            {entry.total_approved_hours.toFixed(1)}h
                          </div>
                          <div className="text-xs text-gray-400">
                            Approved hours
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{entry.break_hours.toFixed(1)}h</div>
                          {entry.breaks.length > 0 && (
                            <div className="text-xs text-gray-400">
                              {entry.breaks.length} break{entry.breaks.length > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {entry.discrepancies.map((discrepancy, index) => (
                            <div key={index} className="flex items-center gap-1">
                              {getDiscrepancyIcon(discrepancy)}
                              <span className="text-xs text-gray-600" title={discrepancy.message}>
                                {discrepancy.minutes ? `${discrepancy.minutes}m` : '!'}
                              </span>
                            </div>
                          ))}
                          {entry.discrepancies.length === 0 && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.is_approved ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            <Clock4 className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(entry)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredEntries.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No time entries found for the selected filters.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Timesheet Entry Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Timesheet Entry</DialogTitle>
              <DialogDescription>
                {editingEntry && (
                  <div className="space-y-2">
                    <p><strong>Employee:</strong> {editingEntry.employee_name}</p>
                    <p><strong>Date:</strong> {formatDate(editingEntry.date)}</p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clock_in">Clock In Time</Label>
                  <Input
                    id="clock_in"
                    type="datetime-local"
                    value={editForm.clock_in}
                    onChange={(e) => setEditForm(prev => ({ ...prev, clock_in: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="clock_out">Clock Out Time</Label>
                  <Input
                    id="clock_out"
                    type="datetime-local"
                    value={editForm.clock_out}
                    onChange={(e) => setEditForm(prev => ({ ...prev, clock_out: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="break_hours">Break Hours</Label>
                <Input
                  id="break_hours"
                  type="number"
                  step="0.1"
                  min="0"
                  value={editForm.break_hours}
                  onChange={(e) => setEditForm(prev => ({ ...prev, break_hours: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes about this correction..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Approval Dialog */}
        <Dialog open={showBulkApprovalDialog} onOpenChange={setShowBulkApprovalDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Approve Timesheet Entries</DialogTitle>
              <DialogDescription>
                Approve {selectedEntries.length} selected timesheet entries. This action will mark them as approved and ready for payroll.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="bulk_notes">Approval Notes (Optional)</Label>
                <Textarea
                  id="bulk_notes"
                  value={bulkApprovalNotes}
                  onChange={(e) => setBulkApprovalNotes(e.target.value)}
                  placeholder="Add any notes about this bulk approval..."
                />
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Important</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  This action will approve all selected entries and mark them as ready for payroll. 
                  Make sure all discrepancies have been reviewed and corrected before approving.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkApprovalDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkApproval}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Approve {selectedEntries.length} Entries
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
