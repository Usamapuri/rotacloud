"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Clock,
  Users,
  Edit,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  DollarSign,
  Building,
  UserCheck,
  UserX
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"
import { ImpersonationModal } from "@/components/admin/ImpersonationModal"

interface Employee {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string
  department: string
  position: string
  job_position?: string
  hire_date: string
  hourly_rate: number
  is_active: boolean
  total_assignments: number
  total_time_entries: number
  total_hours_worked: number
  location_id?: string
  location_name?: string
  role?: string
}

interface EditEmployeeData {
  first_name?: string
  last_name?: string
  email?: string
  department?: string
  position?: string
  hourly_rate?: number
  is_active?: boolean
}

export default function AdminEmployees() {
  const [adminUser, setAdminUser] = useState("")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState<EditEmployeeData>({})
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [showImpersonationModal, setShowImpersonationModal] = useState(false)
  const [selectedEmployeeForImpersonation, setSelectedEmployeeForImpersonation] = useState<Employee | null>(null)
  const router = useRouter()

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'admin') {
      router.push("/login")
    } else {
      setAdminUser(user.email || 'Administrator')
    }
  }, [router])

  // Load employees on initial mount
  useEffect(() => {
    loadEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    filterEmployees()
  }, [employees, searchTerm, departmentFilter, statusFilter])

  const loadEmployees = async () => {
    setIsLoading(true)
    try {
      const user = AuthService.getCurrentUser()
      const response = await fetch('/api/admin/employees', {
        headers: {
          'authorization': user?.id ? `Bearer ${user.id}` : ''
        }
      })
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      } else {
        toast.error('Failed to load employees')
      }
    } catch (error) {
      console.error('Error loading employees:', error)
      toast.error('Failed to load employees')
    } finally {
      setIsLoading(false)
    }
  }

  const filterEmployees = () => {
    let filtered = employees

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(emp => emp.department === departmentFilter)
    }

    // Status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active'
      filtered = filtered.filter(emp => emp.is_active === isActive)
    }

    setFilteredEmployees(filtered)
  }

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee)
    setEditForm({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      department: employee.department,
      position: employee.position,
      hourly_rate: employee.hourly_rate,
      is_active: employee.is_active
    })
    setIsEditDialogOpen(true)
  }

  const handleSaveEmployee = async () => {
    if (!editingEmployee) return

    try {
      const response = await fetch(`/api/admin/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('Employee updated successfully')
        
        // Update the employee in the list
        setEmployees(prev => prev.map(emp => 
          emp.id === editingEmployee.id ? { ...emp, ...editForm } : emp
        ))
        
        setIsEditDialogOpen(false)
        setEditingEmployee(null)
        setEditForm({})
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update employee')
      }
    } catch (error) {
      console.error('Error updating employee:', error)
      toast.error('Failed to update employee')
    }
  }

  const handleLogout = () => {
    AuthService.logout()
    router.push("/login")
  }

  const handleImpersonateEmployee = (employee: Employee) => {
    setSelectedEmployeeForImpersonation(employee)
    setShowImpersonationModal(true)
  }

  const handleStartImpersonation = async (employee: any) => {
    try {
      console.log('🔄 Starting impersonation for:', employee.email)
      const user = AuthService.getCurrentUser()
      const response = await fetch('/api/admin/impersonation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { authorization: `Bearer ${user.id}` } : {}),
        },
        body: JSON.stringify({ targetUserId: employee.id }),
      })

      const data = await response.json()

      if (response.ok) {
        // Start impersonation in AuthService
        await AuthService.startImpersonation(employee.id, data.targetUser)
        
        toast.success(`Now impersonating ${employee.first_name} ${employee.last_name}`)
        
        const role = data.targetUser.role
        if (role === 'employee' || role === 'agent') {
          router.push('/employee/dashboard')
        } else if (role === 'manager') {
          router.push('/admin/dashboard')
        } else {
          router.push('/admin/dashboard')
        }
      } else {
        console.error('Impersonation error response:', data)
        toast.error(data.error || 'Failed to start impersonation')
      }
    } catch (error) {
      console.error('Error starting impersonation:', error)
      toast.error('Failed to start impersonation')
    }
  }

  const getDepartmentColor = (department: string) => {
    const colors: { [key: string]: string } = {
      'Sales': 'bg-green-100 text-green-800',
      'Marketing': 'bg-purple-100 text-purple-800',
      'Operations': 'bg-blue-100 text-blue-800',
      'Support': 'bg-orange-100 text-orange-800',
    }
    return colors[department] || 'bg-gray-100 text-gray-800'
  }

  const getUniqueDepartments = () => {
    return [...new Set(employees.map(emp => emp.department))].filter(Boolean)
  }

  const normalizeEmployeeCodes = async () => {
    try {
      const res = await fetch('/api/admin/employees/backfill-emp-codes', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Updated ${data.updated} employee IDs to EMP format`)
        await loadEmployees()
      } else {
        toast.error(data.error || 'Failed to normalize IDs')
      }
    } catch (err) {
      console.error('Normalize IDs error:', err)
      toast.error('Failed to normalize IDs')
    }
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
                              <Badge variant="outline">Agent Management</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {adminUser}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
              <p className="text-xs text-muted-foreground">
                {employees.filter(emp => emp.is_active).length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departments</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getUniqueDepartments().length}</div>
              <p className="text-xs text-muted-foreground">
                Across organization
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Hourly Rate</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${employees.length
                  ? (
                      employees
                        .reduce((sum, emp) => sum + Number(emp.hourly_rate || 0), 0) / employees.length
                    ).toFixed(2)
                  : '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all agents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(
                  employees.reduce((sum, emp) => sum + Number(emp.total_hours_worked || 0), 0)
                ).toFixed(0)}h
              </div>
              <p className="text-xs text-muted-foreground">
                This period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-white rounded-lg shadow-sm">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {getUniqueDepartments().map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={loadEmployees} variant="outline" disabled={isLoading}>
            <Filter className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          <Button onClick={normalizeEmployeeCodes} variant="secondary" disabled={isLoading}>
            Normalize IDs
          </Button>

          <Link href="/admin/employees/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </Link>
        </div>

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Directory</CardTitle>
            <CardDescription>
              Manage agent information, roles, and hourly rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Hourly Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours Worked</TableHead>
                  <TableHead>Actions</TableHead>
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
                        <div className="text-sm text-gray-500">
                          {employee.email}
                        </div>
                        <div className="text-xs text-gray-400">
                          ID: {employee.employee_id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.role === 'manager' ? 'default' : employee.role === 'admin' ? 'destructive' : 'secondary'}>
                        {employee.role || 'employee'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3 text-gray-400" />
                        {employee.location_name || 'No location'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {employee.hourly_rate}
                      </div>
                    </TableCell>
                    <TableCell>
                      {employee.is_active ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-800">
                          <UserX className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {Number(employee.total_hours_worked ?? 0).toFixed(1)}h
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/admin/employees/${employee.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Manage
                        </Button>
                        {employee.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImpersonateEmployee(employee)}
                            className="border-orange-300 text-orange-700 hover:bg-orange-50"
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Impersonate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information, transfer departments, or modify hourly rates.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={editForm.first_name || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={editForm.last_name || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department">Department</Label>
                <Select
                  value={editForm.department || ''}
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, department: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={editForm.position || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, position: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.hourly_rate || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, hourly_rate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={editForm.is_active ? 'active' : 'inactive'}
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, is_active: value === 'active' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEmployee}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Impersonation Modal */}
      <ImpersonationModal
        isOpen={showImpersonationModal}
        onClose={() => setShowImpersonationModal(false)}
        onImpersonate={handleStartImpersonation}
      />
    </div>
  )
}
