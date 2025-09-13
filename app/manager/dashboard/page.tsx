"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Calendar, 
  Clock, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign,
  TrendingUp,
  Activity,
  UserCheck,
  UserX,
  MapPin,
  RefreshCw
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"
import LocationFilter from "@/components/admin/LocationFilter"

interface ManagerDashboardData {
  assignedLocations: Array<{
    id: string
    name: string
    description?: string
  }>
  currentWeekStats: {
    totalEmployees: number
    scheduledShifts: number
    pendingApprovals: number
    clockedInNow: number
  }
  pendingActions: Array<{
    id: string
    type: 'timesheet_approval' | 'shift_swap' | 'leave_request'
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
    createdAt: string
    employeeName: string
  }>
  liveStatus: Array<{
    employeeId: string
    employeeName: string
    status: 'clocked_in' | 'on_break' | 'clocked_out' | 'on_leave'
    locationName: string
    lastActivity: string
  }>
}

export default function ManagerDashboard() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [dashboardData, setDashboardData] = useState<ManagerDashboardData | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'manager') {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    loadDashboardData()
  }, [router])

  useEffect(() => {
    if (selectedLocationId) {
      loadDashboardData()
    }
  }, [selectedLocationId])

  const loadDashboardData = async () => {
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

      const response = await fetch(`/api/manager/dashboard?${params.toString()}`, {
        headers
      })

      if (!response.ok) {
        throw new Error('Failed to load dashboard data')
      }

      const data = await response.json()
      setDashboardData(data.data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    loadDashboardData()
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'clocked_in': return <UserCheck className="h-4 w-4 text-green-600" />
      case 'on_break': return <Clock className="h-4 w-4 text-yellow-600" />
      case 'clocked_out': return <UserX className="h-4 w-4 text-gray-600" />
      case 'on_leave': return <AlertTriangle className="h-4 w-4 text-red-600" />
      default: return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {currentUser?.first_name} {currentUser?.last_name}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <LocationFilter
                selectedLocationId={selectedLocationId}
                onLocationChange={setSelectedLocationId}
                showAllOption={false}
                showRefresh={true}
              />
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Assigned Locations */}
        {dashboardData?.assignedLocations && dashboardData.assignedLocations.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Your Assigned Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {dashboardData.assignedLocations.map((location) => (
                  <Badge 
                    key={location.id} 
                    variant={selectedLocationId === location.id ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedLocationId(
                      selectedLocationId === location.id ? null : location.id
                    )}
                  >
                    {location.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        {dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">Total Employees</p>
                    <p className="text-2xl font-bold text-blue-900">{dashboardData.currentWeekStats.totalEmployees}</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">Scheduled Shifts</p>
                    <p className="text-2xl font-bold text-green-900">{dashboardData.currentWeekStats.scheduledShifts}</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center shadow-lg">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-800">Pending Approvals</p>
                    <p className="text-2xl font-bold text-orange-900">{dashboardData.currentWeekStats.pendingApprovals}</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-full flex items-center justify-center shadow-lg">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-800">Currently Clocked In</p>
                    <p className="text-2xl font-bold text-purple-900">{dashboardData.currentWeekStats.clockedInNow}</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-full flex items-center justify-center shadow-lg">
                    <UserCheck className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="actions" className="space-y-6">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="actions" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Action Required
            </TabsTrigger>
            <TabsTrigger value="live-view" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Live View
            </TabsTrigger>
            <TabsTrigger value="rota" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Current Rota
            </TabsTrigger>
          </TabsList>

          {/* Action Required Tab */}
          <TabsContent value="actions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Pending Actions
                </CardTitle>
                <CardDescription>
                  Items that require your attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData?.pendingActions && dashboardData.pendingActions.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.pendingActions.map((action) => (
                      <div key={action.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <Badge variant={getPriorityColor(action.priority)}>
                            {action.priority.toUpperCase()}
                          </Badge>
                          <div>
                            <h4 className="font-medium">{action.title}</h4>
                            <p className="text-sm text-gray-600">{action.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              From: {action.employeeName} • {new Date(action.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                    <p className="text-gray-600">No pending actions at this time.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Live View Tab */}
          <TabsContent value="live-view" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Team Live Status
                </CardTitle>
                <CardDescription>
                  Real-time status of your team members
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData?.liveStatus && dashboardData.liveStatus.length > 0 ? (
                  <div className="grid gap-4">
                    {dashboardData.liveStatus.map((member) => (
                      <div key={member.employeeId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {getStatusIcon(member.status)}
                          <div>
                            <h4 className="font-medium">{member.employeeName}</h4>
                            <p className="text-sm text-gray-600">{member.locationName}</p>
                            <p className="text-xs text-gray-500">
                              Last activity: {member.lastActivity}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {member.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No team members found</h3>
                    <p className="text-gray-600">Select a location to view team status.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Current Rota Tab */}
          <TabsContent value="rota" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Current Week Rota
                </CardTitle>
                <CardDescription>
                  This week's schedule for your assigned location(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Rota View</h3>
                  <p className="text-gray-600 mb-4">
                    Select a location to view the current week's rota.
                  </p>
                  <Button onClick={() => router.push('/manager/scheduling')}>
                    Open Full Rota
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
