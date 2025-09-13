"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  MapPin, 
  Plus, 
  Edit, 
  Users, 
  UserCheck, 
  Building,
  RefreshCw,
  Search,
  Settings
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"

interface Location { 
  id: string
  name: string
  description?: string
  is_active: boolean
  created_at: string
  employee_count: number
  manager_count: number
}

interface Employee {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  role: string
  is_active: boolean
  location_id?: string
  location_name?: string
}

interface Manager {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  assigned_locations: Array<{
    id: string
    name: string
  }>
}

export default function LocationsAdmin() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Form states
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showManagerDialog, setShowManagerDialog] = useState(false)
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false)

  // Manager assignment states
  const [selectedManager, setSelectedManager] = useState<string>("")
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")
  const [selectedEmployeeLocation, setSelectedEmployeeLocation] = useState<string>("")

  const headers = () => {
    const user = AuthService.getCurrentUser()
    const h: Record<string,string> = { 'Content-Type': 'application/json' }
    if (user?.id) h['authorization'] = `Bearer ${user.id}`
    if (user?.tenant_id) h['x-tenant-id'] = user.tenant_id
    return h
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load locations with employee/manager counts
      const locationsRes = await fetch('/api/admin/locations/detailed', { headers: headers() })
      if (locationsRes.ok) {
        const locationsData = await locationsRes.json()
        setLocations(locationsData.data || [])
      }

      // Load all employees
      const employeesRes = await fetch('/api/employees', { headers: headers() })
      if (employeesRes.ok) {
        const employeesData = await employeesRes.json()
        setEmployees(employeesData.data || [])
      }

      // Load managers
      const managersRes = await fetch('/api/admin/managers', { headers: headers() })
      if (managersRes.ok) {
        const managersData = await managersRes.json()
        setManagers(managersData.data || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const createLocation = async () => {
    if (!name.trim()) return
    try {
      const res = await fetch('/api/locations', { 
        method: 'POST', 
        headers: headers(), 
        body: JSON.stringify({ name, description }) 
      })
      if (res.ok) {
        toast.success('Location created successfully')
        setName("")
        setDescription("")
        setShowCreateDialog(false)
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to create location')
      }
    } catch (error) {
      toast.error('Failed to create location')
    }
  }

  const updateLocation = async () => {
    if (!selectedLocation || !name.trim()) return
    try {
      const res = await fetch(`/api/locations/${selectedLocation.id}`, { 
        method: 'PUT', 
        headers: headers(), 
        body: JSON.stringify({ name, description }) 
      })
      if (res.ok) {
        toast.success('Location updated successfully')
        setShowEditDialog(false)
        setSelectedLocation(null)
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to update location')
      }
    } catch (error) {
      toast.error('Failed to update location')
    }
  }

  const assignManager = async () => {
    if (!selectedLocation || !selectedManager) return
    try {
      const res = await fetch('/api/manager-locations', { 
        method: 'POST', 
        headers: headers(), 
        body: JSON.stringify({ 
          manager_id: selectedManager, 
          location_id: selectedLocation.id 
        }) 
      })
      if (res.ok) {
        toast.success('Manager assigned successfully')
        setShowManagerDialog(false)
        setSelectedManager("")
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to assign manager')
      }
    } catch (error) {
      toast.error('Failed to assign manager')
    }
  }

  const assignEmployee = async () => {
    if (!selectedEmployee || !selectedEmployeeLocation) return
    try {
      const res = await fetch(`/api/employees/${selectedEmployee}`, { 
        method: 'PUT', 
        headers: headers(), 
        body: JSON.stringify({ location_id: selectedEmployeeLocation }) 
      })
      if (res.ok) {
        toast.success('Employee location updated successfully')
        setShowEmployeeDialog(false)
        setSelectedEmployee("")
        setSelectedEmployeeLocation("")
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to update employee location')
      }
    } catch (error) {
      toast.error('Failed to update employee location')
    }
  }

  const openEditDialog = (location: Location) => {
    setSelectedLocation(location)
    setName(location.name)
    setDescription(location.description || "")
    setShowEditDialog(true)
  }

  const openManagerDialog = (location: Location) => {
    setSelectedLocation(location)
    setShowManagerDialog(true)
  }

  const openEmployeeDialog = () => {
    setShowEmployeeDialog(true)
  }

  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (location.description && location.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  useEffect(() => { loadData() }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading locations...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
            <p className="text-gray-600 mt-1">Manage your organization's locations and assignments</p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={openEmployeeDialog} variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Assign Employees
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
            <Button onClick={loadData} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Overview
            </TabsTrigger>
            <TabsTrigger value="managers" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Manager Assignments
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Employee Assignments
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLocations.map((location) => (
                <Card key={location.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-lg">{location.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(location)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openManagerDialog(location)}
                        >
                          <UserCheck className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {location.description && (
                      <CardDescription>{location.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Employees:</span>
                        <Badge variant="secondary">{location.employee_count}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Managers:</span>
                        <Badge variant="secondary">{location.manager_count}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <Badge variant={location.is_active ? "default" : "secondary"}>
                          {location.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Manager Assignments Tab */}
          <TabsContent value="managers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Manager Assignments
                </CardTitle>
                <CardDescription>
                  View and manage manager assignments to locations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Manager</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Assigned Locations</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managers.map((manager) => (
                      <TableRow key={manager.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {manager.first_name} {manager.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{manager.employee_code}</div>
                          </div>
                        </TableCell>
                        <TableCell>{manager.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {manager.assigned_locations.map((location) => (
                              <Badge key={location.id} variant="outline">
                                {location.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/admin/locations/managers?manager_id=${manager.id}`)}
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employee Assignments Tab */}
          <TabsContent value="employees" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Employee Assignments
                </CardTitle>
                <CardDescription>
                  View and manage employee assignments to locations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Current Location</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {employee.first_name} {employee.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{employee.employee_code}</div>
                          </div>
                        </TableCell>
                        <TableCell>{employee.email}</TableCell>
                        <TableCell>
                          <Badge variant={employee.role === 'manager' ? 'default' : 'secondary'}>
                            {employee.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            {employee.location_name || 'No location'}
                          </div>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Location Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>
                Create a new location for your organization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Main Office, Warehouse"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this location"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createLocation}>
                Create Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Location Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Location</DialogTitle>
              <DialogDescription>
                Update location details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Location Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Main Office, Warehouse"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description (Optional)</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this location"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={updateLocation}>
                Update Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Manager Dialog */}
        <Dialog open={showManagerDialog} onOpenChange={setShowManagerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Manager to Location</DialogTitle>
              <DialogDescription>
                Assign a manager to {selectedLocation?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="manager-select">Select Manager</Label>
                <Select value={selectedManager} onValueChange={setSelectedManager}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.first_name} {manager.last_name} ({manager.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManagerDialog(false)}>
                Cancel
              </Button>
              <Button onClick={assignManager} disabled={!selectedManager}>
                Assign Manager
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Employee Dialog */}
        <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Employee to Location</DialogTitle>
              <DialogDescription>
                Assign an employee to a specific location
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="employee-select">Select Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name} ({employee.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="location-select">Select Location</Label>
                <Select value={selectedEmployeeLocation} onValueChange={setSelectedEmployeeLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={assignEmployee} 
                disabled={!selectedEmployee || !selectedEmployeeLocation}
              >
                Assign Employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}


