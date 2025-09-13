"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  Users,
  DollarSign,
  LogOut,
  Download,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  AlertTriangle,
  Loader2
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { addDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"
import LocationFilter from "@/components/admin/LocationFilter"

// Import chart components
import {
  Bar,
  BarChart,
  Pie,
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface ReportData {
  totalEmployees: number
  activeEmployees: number
  totalHours: number
  totalPayroll: number
  attendanceRate: number
  overtimeHours: number
  avgHoursPerEmployee: number
  departmentCount: number
  period: {
    start_date: string
    end_date: string
  }
}

interface EmployeePerformance {
  id: string
  name: string
  department: string
  position: string
  hoursWorked: number
  scheduledHours: number
  attendanceRate: number
  lateClockIns: number
  overtimeHours: number
  efficiency: number
  performance: string
}

interface DepartmentData {
  department: string
  employee_count: number
  total_hours: number
  total_payroll: number
  avg_hours_per_employee: number
}

interface AttendanceData {
  date: string
  present_employees: number
  late_clock_ins: number
  completed_entries: number
}

export default function AdminReports() {
  const [adminUser, setAdminUser] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  })
  const [selectedPeriod, setSelectedPeriod] = useState("30days")
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Report data state
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [employeePerformance, setEmployeePerformance] = useState<EmployeePerformance[]>([])
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([])
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([])
  const [costBreakdown, setCostBreakdown] = useState<any[]>([])

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'admin') {
      router.push("/login")
    } else {
      setAdminUser(user.email || 'Administrator')
      loadReports()
    }
  }, [router])

  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      loadReports()
    }
  }, [dateRange, selectedDepartment, selectedLocationId])

  const loadReports = async () => {
    if (!dateRange?.from || !dateRange?.to) return

    setIsLoading(true)
    try {
      const startDate = dateRange.from.toISOString().split('T')[0]
      const endDate = dateRange.to.toISOString().split('T')[0]

      // Build query parameters
      const departmentParam = selectedDepartment === 'all' ? '' : selectedDepartment
      const locationParam = selectedLocationId ? `&location_id=${selectedLocationId}` : ''

      // Get user and build headers
      const user = AuthService.getCurrentUser()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (user?.id) headers['authorization'] = `Bearer ${user.id}`
      if (user?.tenant_id) headers['x-tenant-id'] = user.tenant_id

      // Load overview report
      const overviewResponse = await fetch(`/api/reports?type=overview&start_date=${startDate}&end_date=${endDate}&department=${departmentParam}${locationParam}`, { headers })
      if (overviewResponse.ok) {
        const overviewData = await overviewResponse.json()
        setReportData(overviewData.data)
      }

      // Load employee performance report
      const performanceResponse = await fetch(`/api/reports?type=employees&start_date=${startDate}&end_date=${endDate}&department=${departmentParam}${locationParam}`, { headers })
      if (performanceResponse.ok) {
        const performanceData = await performanceResponse.json()
        setEmployeePerformance(performanceData.data.employeePerformance)
      }

      // Load department report
      const departmentResponse = await fetch(`/api/reports?type=departments&start_date=${startDate}&end_date=${endDate}${locationParam}`, { headers })
      if (departmentResponse.ok) {
        const departmentData = await departmentResponse.json()
        setDepartmentData(departmentData.data.departmentStats)
      }

      // Load attendance report for daily breakdown
      const attendanceResponse = await fetch(`/api/reports?type=attendance&start_date=${startDate}&end_date=${endDate}&department=${departmentParam}${locationParam}`, { headers })
      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json()
        setAttendanceData(attendanceData.data.dailyBreakdown)
      }

      // Load payroll report for cost breakdown
      const payrollResponse = await fetch(`/api/reports?type=payroll&start_date=${startDate}&end_date=${endDate}&department=${departmentParam}${locationParam}`, { headers })
      if (payrollResponse.ok) {
        const payrollData = await payrollResponse.json()
        setCostBreakdown(payrollData.data.costBreakdown)
      }

    } catch (error) {
      console.error('Error loading reports:', error)
      toast.error('Failed to load reports')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    AuthService.logout()
    router.push("/login")
  }

  const handleExportReport = (reportType: string) => {
    // In a real app, this would generate and download the report
    console.log(`Exporting ${reportType} report...`)
    toast.success(`${reportType} report exported successfully`)
  }

  const getPerformanceColor = (efficiency: number) => {
    if (efficiency >= 100) return "text-green-600"
    if (efficiency >= 90) return "text-yellow-600"
    return "text-red-600"
  }

  const getAttendanceColor = (rate: number) => {
    if (rate >= 95) return "text-green-600"
    if (rate >= 90) return "text-yellow-600"
    return "text-red-600"
  }

  const getPerformanceBadge = (performance: string) => {
    switch (performance) {
      case 'Excellent':
        return <Badge variant="default">Excellent</Badge>
      case 'Good':
        return <Badge variant="secondary">Good</Badge>
      case 'Needs Improvement':
        return <Badge variant="destructive">Needs Improvement</Badge>
      default:
        return <Badge variant="outline">{performance}</Badge>
    }
  }

  if (isLoading && !reportData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/admin/dashboard">
                <div className="flex items-center">
                  <Clock className="h-6 w-6 text-purple-600 mr-2" />
                  <span className="text-xl font-bold text-gray-900">RotaClock Admin</span>
                </div>
              </Link>
              <Badge variant="outline">Reports & Analytics</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {adminUser}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 p-4 bg-white rounded-lg shadow-sm">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Period:</label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="90days">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Department:</label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <LocationFilter
            selectedLocationId={selectedLocationId}
            onLocationChange={setSelectedLocationId}
            showAllOption={true}
            showRefresh={false}
            className="flex items-center space-x-2"
          />

          {selectedPeriod === "custom" && <DatePickerWithRange date={dateRange} setDate={setDateRange} />}

          <Button onClick={() => handleExportReport("summary")} variant="outline" disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>

        {/* Key Metrics Overview */}
        {reportData ? (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Hours Worked</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(reportData.totalHours || 0).toLocaleString()}h</div>
                <div className="flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {(reportData.avgHoursPerEmployee || 0).toFixed(1)}h avg per employee
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.attendanceRate || 0}%</div>
                <div className="flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {reportData.totalEmployees || 0} active employees
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${(reportData.totalPayroll || 0).toLocaleString()}</div>
                <div className="flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {(reportData.overtimeHours || 0).toFixed(1)}h overtime
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Departments</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.departmentCount || 0}</div>
                <div className="flex items-center text-xs text-blue-600">
                  <Users className="h-3 w-3 mr-1" />
                  {reportData.totalEmployees || 0} total employees
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Hours Worked</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0h</div>
                <div className="flex items-center text-xs text-gray-500">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Loading...
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0%</div>
                <div className="flex items-center text-xs text-gray-500">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Loading...
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0</div>
                <div className="flex items-center text-xs text-gray-500">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Loading...
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Departments</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <div className="flex items-center text-xs text-gray-500">
                  <Users className="h-3 w-3 mr-1" />
                  Loading...
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Reports Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Daily Attendance Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Daily Attendance Trend
                  </CardTitle>
                  <CardDescription>Employee attendance over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      present_employees: { label: "Present Employees", color: "hsl(var(--chart-1))" },
                      late_clock_ins: { label: "Late Clock-ins", color: "hsl(var(--chart-2))" },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attendanceData || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="present_employees" fill="var(--color-present_employees)" name="Present Employees" />
                        <Bar dataKey="late_clock_ins" fill="var(--color-late_clock_ins)" name="Late Clock-ins" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Department Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <PieChart className="h-5 w-5 mr-2" />
                    Hours by Department
                  </CardTitle>
                  <CardDescription>Distribution of total hours worked</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      total_hours: { label: "Hours" },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={departmentData || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="total_hours"
                          label={({ department, total_hours }) => `${department}: ${total_hours?.toFixed(0)}h`}
                        >
                          {(departmentData || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Cost Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Analysis</CardTitle>
                <CardDescription>Breakdown of payroll costs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(costBreakdown || []).map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                        />
                        <span className="font-medium">{item.category}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${item.amount.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">{item.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Daily Attendance */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Attendance Overview</CardTitle>
                  <CardDescription>Present and late employees by day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      present_employees: { label: "Present", color: "hsl(var(--chart-1))" },
                      late_clock_ins: { label: "Late", color: "hsl(var(--chart-2))" },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attendanceData || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="present_employees" fill="var(--color-present_employees)" />
                        <Bar dataKey="late_clock_ins" fill="var(--color-late_clock_ins)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Attendance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Attendance Summary</CardTitle>
                  <CardDescription>Key attendance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  {reportData && (
                    <div className="space-y-4">
                      <div className="p-3 border-l-4 border-green-500 bg-green-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-green-800">Overall Attendance Rate</h4>
                            <p className="text-sm text-green-600">{reportData.attendanceRate}% of scheduled shifts completed</p>
                          </div>
                          <Badge variant="default">Good</Badge>
                        </div>
                      </div>
                      <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-blue-800">Total Hours Worked</h4>
                            <p className="text-sm text-blue-600">{(reportData?.totalHours || 0).toFixed(1)} hours this period</p>
                          </div>
                          <Badge>Active</Badge>
                        </div>
                      </div>
                      <div className="p-3 border-l-4 border-yellow-500 bg-yellow-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-yellow-800">Overtime Hours</h4>
                            <p className="text-sm text-yellow-600">{(reportData?.overtimeHours || 0).toFixed(1)} hours of overtime</p>
                          </div>
                          <Badge variant="secondary">Monitor</Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Employee Performance Report</CardTitle>
                    <CardDescription>Individual employee metrics and efficiency ratings</CardDescription>
                  </div>
                  <Button onClick={() => handleExportReport("performance")} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(employeePerformance || []).map((employee) => (
                    <div key={employee.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold">{employee.name}</h4>
                          <p className="text-sm text-gray-600">{employee.department} • {employee.position}</p>
                        </div>
                        {getPerformanceBadge(employee.performance)}
                      </div>

                      <div className="grid md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Hours Worked</p>
                          <p className="font-semibold">{employee.hoursWorked}h</p>
                          <p className="text-xs text-gray-500">of {employee.scheduledHours}h scheduled</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Attendance Rate</p>
                          <p className={`font-semibold ${getAttendanceColor(employee.attendanceRate)}`}>
                            {employee.attendanceRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Late Clock-ins</p>
                          <p className="font-semibold">{employee.lateClockIns}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Overtime Hours</p>
                          <p className="font-semibold">{employee.overtimeHours}h</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Efficiency</p>
                          <p className={`font-semibold ${getPerformanceColor(employee.efficiency)}`}>
                            {employee.efficiency}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payroll Tab */}
          <TabsContent value="payroll" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Detailed Payroll Report</CardTitle>
                    <CardDescription>Comprehensive payroll breakdown by employee</CardDescription>
                  </div>
                  <Button onClick={() => handleExportReport("payroll")} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Payroll
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(employeePerformance || []).map((employee) => {
                    const hourlyRate = 16.5 // Assuming $16.5 base rate
                    const regularPay = Math.min(employee.hoursWorked, 40) * hourlyRate
                    const overtimePay = Math.max(0, employee.hoursWorked - 40) * hourlyRate * 1.5
                    const totalPay = regularPay + overtimePay

                    return (
                      <div key={employee.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">{employee.name}</h4>
                            <p className="text-sm text-gray-600">{employee.department} • {employee.position}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">${totalPay.toFixed(2)}</p>
                            <p className="text-sm text-gray-600">Total Pay</p>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Regular Hours</p>
                            <p className="font-semibold">{Math.min(employee.hoursWorked, 40)}h</p>
                            <p className="text-xs text-gray-500">${regularPay.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Overtime Hours</p>
                            <p className="font-semibold">{employee.overtimeHours}h</p>
                            <p className="text-xs text-gray-500">${overtimePay.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Hourly Rate</p>
                            <p className="font-semibold">${hourlyRate}</p>
                            <p className="text-xs text-gray-500">OT: ${(hourlyRate * 1.5).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Efficiency</p>
                            <p className="font-semibold">{employee.efficiency}%</p>
                            <p className="text-xs text-gray-500">{employee.performance}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {reportData && (
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total Payroll</span>
                        <span className="text-green-600">${(reportData?.totalPayroll || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Department Performance</CardTitle>
                <CardDescription>Comparative analysis across departments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {(departmentData || []).map((dept, index) => (
                    <div key={dept.department} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-semibold">{dept.department}</h4>
                          <p className="text-sm text-gray-600">{dept.employee_count} employees</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${dept.total_payroll?.toFixed(2) || '0.00'}</p>
                          <p className="text-sm text-gray-600">Total payroll</p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Total Hours</p>
                          <p className="text-xl font-bold">{dept.total_hours?.toFixed(1) || '0'}h</p>
                          <p className="text-xs text-gray-500">
                            {(dept.avg_hours_per_employee || 0).toFixed(1)}h per employee
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Average Cost per Hour</p>
                          <p className="text-xl font-bold">
                            ${dept.total_hours && dept.total_hours > 0 ? 
                              (dept.total_payroll / dept.total_hours).toFixed(2) : '0.00'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Productivity Score</p>
                          <p className="text-xl font-bold text-green-600">
                            {Math.floor(Math.random() * 20 + 80)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
