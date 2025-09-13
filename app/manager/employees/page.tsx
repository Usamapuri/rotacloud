"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Users, 
  Search, 
  RefreshCw,
  MapPin,
  Clock,
  Phone,
  Mail,
  Calendar
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"
import LocationFilter from "@/components/admin/LocationFilter"

interface Employee {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  role: string
  department?: string
  is_active: boolean
  location_id?: string
  location_name?: string
  hire_date?: string
  last_clock_in?: string
  total_hours_this_week?: number
}

export default function ManagerEmployees() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'manager') {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    loadEmployees()
  }, [router])

  useEffect(() => {
    loadEmployees()
  }, [selectedLocationId])

  const loadEmployees = async () => {
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

      const response = await fetch(`/api/manager/employees?${params.toString()}`, {
        headers
      })

      if (!response.ok) {
        throw new Error('Failed to load employees')
      }

      const data = await response.json()
      setEmployees(data.data.employees || [])
    } catch (error) {
      console.error('Error loading employees:', error)
      toast.error('Failed to load employees')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredEmployees = employees.filter(employee => {
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase()
    const searchLower = searchTerm.toLowerCase()
    return (
      fullName.includes(searchLower) ||
      employee.employee_code.toLowerCase().includes(searchLower) ||
      employee.email.toLowerCase().includes(searchLower)
    )
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (hours: number) => {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}h ${minutes}m`
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'manager':
        return <Badge variant="default" className="bg-purple-100 text-purple-800">Manager</Badge>
      case 'admin':
        return <Badge variant="default" className="bg-red-100 text-red-800">Admin</Badge>
      case 'employee':
        return <Badge variant="secondary">Employee</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading team members...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Team Members</h1>
            <p className="text-gray-600 mt-1">Manage your team across assigned locations</p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={loadEmployees} variant="outline" size="sm" disabled={isLoading}>
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

          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Total Team Members</p>
                  <p className="text-2xl font-bold text-blue-900">{employees.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Active Members</p>
                  <p className="text-2xl font-bold text-green-900">
                    {employees.filter(emp => emp.is_active).length}
                  </p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800">Currently Online</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {employees.filter(emp => emp.last_clock_in && 
                      new Date(emp.last_clock_in) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                    ).length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">Total Hours This Week</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {formatDuration(
                      employees.reduce((total, emp) => total + (emp.total_hours_this_week || 0), 0)
                    )}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({filteredEmployees.length})
            </CardTitle>
            <CardDescription>
              {selectedLocationId 
                ? 'Team members in the selected location'
                : 'All team members across your assigned locations'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEmployees.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Hire Date</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Hours This Week</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {employee.first_name} {employee.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{employee.employee_code}</div>
                            <div className="text-xs text-gray-400">{employee.email}</div>
                            {employee.phone && (
                              <div className="text-xs text-gray-400 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {employee.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            {employee.location_name || 'No location'}
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(employee.role)}</TableCell>
                        <TableCell>{employee.department || '-'}</TableCell>
                        <TableCell>
                          {employee.hire_date ? formatDate(employee.hire_date) : '-'}
                        </TableCell>
                        <TableCell>
                          {employee.last_clock_in ? formatDateTime(employee.last_clock_in) : 'Never'}
                        </TableCell>
                        <TableCell>
                          {employee.total_hours_this_week 
                            ? formatDuration(employee.total_hours_this_week)
                            : '0h 0m'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No team members found</h3>
                <p className="text-gray-600">
                  {searchTerm 
                    ? 'No team members match your search criteria.'
                    : selectedLocationId 
                      ? 'No team members found for the selected location.'
                      : 'Please select a location to view team members.'
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
