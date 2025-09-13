"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { 
  BarChart3, 
  Download, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  DollarSign,
  MapPin
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"
import LocationFilter from "@/components/admin/LocationFilter"
import type { DateRange } from "react-day-picker"
import { addDays } from "date-fns"

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
  efficiency: number
  performance: string
}

interface EmployeePerformance {
  employee_id: string
  employee_name: string
  employee_code: string
  location_name: string
  total_hours: number
  total_pay: number
  attendance_rate: number
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

export default function ManagerReports() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  })
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Report data state
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [employeePerformance, setEmployeePerformance] = useState<EmployeePerformance[]>([])
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([])
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([])

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'manager') {
      router.push('/login')
      return
    }
    setCurrentUser(user)
  }, [router])

  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      loadReports()
    }
  }, [dateRange, selectedLocationId])

  const loadReports = async () => {
    if (!dateRange?.from || !dateRange?.to) return

    setIsLoading(true)
    try {
      const startDate = dateRange.from.toISOString().split('T')[0]
      const endDate = dateRange.to.toISOString().split('T')[0]

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (currentUser?.id) {
        headers['authorization'] = `Bearer ${currentUser.id}`
      }
      if (currentUser?.tenant_id) {
        headers['x-tenant-id'] = currentUser.tenant_id
      }

      // Build query parameters
      const locationParam = selectedLocationId ? `&location_id=${selectedLocationId}` : ''

      // Load overview report
      const overviewResponse = await fetch(`/api/manager/reports?type=overview&start_date=${startDate}&end_date=${endDate}${locationParam}`, {
        headers
      })
      if (overviewResponse.ok) {
        const overviewData = await overviewResponse.json()
        setReportData(overviewData.data)
      }

      // Load employee performance report
      const performanceResponse = await fetch(`/api/manager/reports?type=employees&start_date=${startDate}&end_date=${endDate}${locationParam}`, {
        headers
      })
      if (performanceResponse.ok) {
        const performanceData = await performanceResponse.json()
        setEmployeePerformance(performanceData.data.employeePerformance)
      }

      // Load attendance report for daily breakdown
      const attendanceResponse = await fetch(`/api/manager/reports?type=attendance&start_date=${startDate}&end_date=${endDate}${locationParam}`, {
        headers
      })
      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json()
        setAttendanceData(attendanceData.data.dailyBreakdown)
      }

    } catch (error) {
      console.error('Error loading reports:', error)
      toast.error('Failed to load reports')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportReport = (type: string) => {
    toast.info(`Export ${type} report functionality coming soon`)
  }

  const chartColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

  if (!currentUser) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Team Reports</h1>
            <p className="text-gray-600 mt-1">Analytics and insights for your assigned locations</p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => handleExportReport("summary")} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
            <Button onClick={loadReports} variant="outline" size="sm" disabled={isLoading}>
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

          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
        </div>

        {/* Key Metrics Overview */}
        {reportData ? (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">Team Members</p>
                    <p className="text-2xl font-bold text-blue-900">{reportData.totalEmployees}</p>
                    <p className="text-xs text-blue-700">{reportData.activeEmployees} active</p>
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
                    <p className="text-sm font-medium text-green-800">Total Hours</p>
                    <p className="text-2xl font-bold text-green-900">{reportData.totalHours.toFixed(1)}h</p>
                    <p className="text-xs text-green-700">{reportData.overtimeHours.toFixed(1)}h overtime</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center shadow-lg">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-800">Total Payroll</p>
                    <p className="text-2xl font-bold text-purple-900">£{reportData.totalPayroll.toFixed(2)}</p>
                    <p className="text-xs text-purple-700">{reportData.efficiency.toFixed(1)}% efficiency</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-full flex items-center justify-center shadow-lg">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-800">Attendance Rate</p>
                    <p className="text-2xl font-bold text-orange-900">{reportData.attendanceRate.toFixed(1)}%</p>
                    <p className="text-xs text-orange-700 flex items-center">
                      {reportData.performance === 'excellent' ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {reportData.performance}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-full flex items-center justify-center shadow-lg">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="performance" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Team Performance
            </TabsTrigger>
            <TabsTrigger value="attendance" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Attendance Trends
            </TabsTrigger>
          </TabsList>

          {/* Team Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Performance Overview
                </CardTitle>
                <CardDescription>
                  Performance metrics for your team members
                </CardDescription>
              </CardHeader>
              <CardContent>
                {employeePerformance.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Employee</th>
                          <th className="text-left p-3">Location</th>
                          <th className="text-right p-3">Hours</th>
                          <th className="text-right p-3">Pay</th>
                          <th className="text-right p-3">Attendance</th>
                          <th className="text-right p-3">Overtime</th>
                          <th className="text-center p-3">Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeePerformance.map((employee) => (
                          <tr key={employee.employee_id} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <div>
                                <div className="font-medium">{employee.employee_name}</div>
                                <div className="text-sm text-gray-500">{employee.employee_code}</div>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-gray-400" />
                                {employee.location_name}
                              </div>
                            </td>
                            <td className="p-3 text-right">{employee.total_hours.toFixed(1)}h</td>
                            <td className="p-3 text-right">£{employee.total_pay.toFixed(2)}</td>
                            <td className="p-3 text-right">{employee.attendance_rate.toFixed(1)}%</td>
                            <td className="p-3 text-right">{employee.overtimeHours.toFixed(1)}h</td>
                            <td className="p-3 text-center">
                              <Badge 
                                variant={employee.performance === 'excellent' ? 'default' : 
                                        employee.performance === 'good' ? 'secondary' : 'destructive'}
                              >
                                {employee.performance}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No performance data</h3>
                    <p className="text-gray-600">
                      {selectedLocationId 
                        ? 'No performance data found for the selected location and date range.'
                        : 'Please select a location to view performance data.'
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Trends Tab */}
          <TabsContent value="attendance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Attendance Trends
                </CardTitle>
                <CardDescription>
                  Daily attendance patterns for your team
                </CardDescription>
              </CardHeader>
              <CardContent>
                {attendanceData.length > 0 ? (
                  <div className="h-80">
                    <ChartContainer
                      config={{
                        present_employees: {
                          label: "Present Employees",
                          color: "#10B981",
                        },
                        late_clock_ins: {
                          label: "Late Clock-ins",
                          color: "#F59E0B",
                        },
                        completed_entries: {
                          label: "Completed Entries",
                          color: "#3B82F6",
                        },
                      }}
                      className="h-full w-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attendanceData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                          <Bar dataKey="present_employees" fill="#10B981" name="Present Employees" />
                          <Bar dataKey="late_clock_ins" fill="#F59E0B" name="Late Clock-ins" />
                          <Bar dataKey="completed_entries" fill="#3B82F6" name="Completed Entries" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No attendance data</h3>
                    <p className="text-gray-600">
                      {selectedLocationId 
                        ? 'No attendance data found for the selected location and date range.'
                        : 'Please select a location to view attendance trends.'
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
