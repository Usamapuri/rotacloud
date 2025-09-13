"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Plus, RefreshCw, Settings, Users, Grid, List, Filter } from 'lucide-react'

import ModernWeekGrid from '@/components/scheduling/ModernWeekGrid'
import EmployeeList from '@/components/scheduling/EmployeeList'
import ShiftAssignmentModal from '@/components/scheduling/ShiftAssignmentModal'
import ShiftEditModal from '@/components/scheduling/ShiftEditModal'
import ShiftTemplateModal from '@/components/scheduling/ShiftTemplateModal'
import TemplateLibrary from '@/components/scheduling/TemplateLibrary'
import EnhancedTemplateLibrary from '@/components/scheduling/EnhancedTemplateLibrary'
import PublishedRotasView from '@/components/scheduling/PublishedRotasView'
import CurrentWeekView from '@/components/scheduling/CurrentWeekView'
import MasterCalendar from '@/components/scheduling/MasterCalendar'
import LocationFilter from '@/components/admin/LocationFilter'

interface Employee {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  department: string
  job_position: string
  location_id?: string
  location_name?: string
  assignments: { [date: string]: any[] }
}

interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  hourly_rate: number
  required_staff: number
  is_active?: boolean
}

export default function ManagerSchedulingPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false)
  
  // Location filtering state - managers can only see their assigned locations
  const [assignedLocations, setAssignedLocations] = useState<any[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])

  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null)
  const [assignmentEmployeeId, setAssignmentEmployeeId] = useState('')
  const [assignmentDate, setAssignmentDate] = useState('')

  // Rota management state
  const [rotas, setRotas] = useState<any[]>([])
  const [currentRotaId, setCurrentRotaId] = useState<string | null>(null)
  const [currentRota, setCurrentRota] = useState<any | null>(null)

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'manager') {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    loadManagerLocations()
    loadAll()
  }, [router])

  const loadManagerLocations = async () => {
    try {
      const user = AuthService.getCurrentUser()
      if (!user) return

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (user?.id) {
        headers['authorization'] = `Bearer ${user.id}`
      }
      if (user?.tenant_id) {
        headers['x-tenant-id'] = user.tenant_id
      }

      const response = await fetch('/api/manager/dashboard', { headers })
      if (response.ok) {
        const data = await response.json()
        setAssignedLocations(data.data.assignedLocations || [])
        
        // Auto-select first location if only one assigned
        if (data.data.assignedLocations.length === 1) {
          setSelectedLocationId(data.data.assignedLocations[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading manager locations:', error)
      toast.error('Failed to load assigned locations')
    }
  }

  const loadAll = async () => {
    try {
      setIsLoading(true)
      // load in parallel
      await Promise.all([loadWeek(), loadTemplates()])
    } catch (e) {
      console.error(e)
      toast.error('Failed to load scheduling data')
    } finally {
      setIsLoading(false)
    }
  }

  const loadTemplates = async () => {
    const user = AuthService.getCurrentUser()
    const res = await fetch('/api/scheduling/templates', {
      headers: user?.id ? { authorization: `Bearer ${user.id}` } : {}
    })
    const data = await res.json()
    if (data.success) setTemplates(data.data)
  }

  const loadWeek = async (dateOverride?: string, rotaId?: string | null) => {
    if (!selectedLocationId) return // Don't load if no location selected
    
    const dateToLoad = dateOverride || selectedDate
    const user = AuthService.getCurrentUser()
    
    // Build URL with rota filter and location scope
    let url = `/api/scheduling/week/${dateToLoad}`
    const params = new URLSearchParams()
    if (rotaId) {
      params.append('rota_id', rotaId)
    }
    params.append('location_id', selectedLocationId) // Add location filter for manager scope
    
    if (params.toString()) {
      url += `?${params.toString()}`
    }

    const res = await fetch(url, {
      headers: user?.id ? { authorization: `Bearer ${user.id}` } : {}
    })
    const data = await res.json()
    if (!data.success) {
      console.error('Failed to load week data:', data.error)
      return
    }
    
    console.log('Week data loaded:', data.data) // Debug log
    setEmployees(data.data.employees.map((e: any) => ({ ...e, assignments: e.assignments || {} })))
    setRotas(data.data.rotas || [])
    setCurrentRota(data.data.currentRota || null)
  }

  // Filter employees based on selected location (should already be filtered by API, but double-check)
  useEffect(() => {
    if (selectedLocationId) {
      // Filter employees by location
      const filtered = employees.filter(emp => emp.location_id === selectedLocationId)
      setFilteredEmployees(filtered)
    } else {
      // Show all employees (should be empty for managers without location selection)
      setFilteredEmployees(employees)
    }
  }, [employees, selectedLocationId])

  // Reload week data when location changes
  useEffect(() => {
    if (selectedLocationId) {
      loadWeek()
    } else {
      setEmployees([])
      setFilteredEmployees([])
    }
  }, [selectedLocationId])

  // Handle location filter change
  const handleLocationChange = (locationId: string | null) => {
    setSelectedLocationId(locationId)
  }

  const handleDateChange = async (date: string) => {
    setSelectedDate(date)
    await loadWeek(date, currentRotaId)
  }

  const handleAssignShift = (employeeId: string, date: string) => {
    setAssignmentEmployeeId(employeeId)
    setAssignmentDate(date)
    setShowAssignmentModal(true)
  }

  const handleEditShift = (assignment: any) => {
    setEditingAssignment(assignment)
    setShowEditModal(true)
  }

  const handleAssignmentCreated = () => {
    loadWeek()
    setShowAssignmentModal(false)
  }

  const handleAssignmentDeleted = () => {
    loadWeek()
  }

  const handleDragDrop = () => {
    loadWeek()
  }

  const handleCreateRota = () => {
    // Create new rota for current location
    console.log('Create rota for location:', selectedLocationId)
    // Implementation would go here
  }

  const handlePublishRota = (rotaId: string) => {
    console.log('Publish rota:', rotaId)
    // Implementation would go here
  }

  const handleSelectRota = (rotaId: string) => {
    setCurrentRotaId(rotaId)
    loadWeek(selectedDate, rotaId)
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadAll().finally(() => setIsRefreshing(false))
  }

  const stats = useMemo(() => {
    const totalAssignments = filteredEmployees.reduce((acc, emp) => {
      return acc + Object.values(emp.assignments).flat().length
    }, 0)
    
    const coverageRate = filteredEmployees.length > 0 
      ? Math.round((totalAssignments / (filteredEmployees.length * 7)) * 100)
      : 0

    return {
      totalEmployees: filteredEmployees.length,
      activeEmployees: filteredEmployees.filter(emp => emp.is_active !== false).length,
      totalAssignments,
      coverageRate
    }
  }, [filteredEmployees])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading scheduling data...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Team Scheduling</h1>
            <p className="text-gray-600 mt-1">Manage your team's shifts and schedules</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Location Filter */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <LocationFilter
              selectedLocationId={selectedLocationId}
              onLocationChange={handleLocationChange}
              showAllOption={false}
              showRefresh={false}
              placeholder="Select your location..."
            />
            {selectedLocationId && (
              <div className="text-sm text-gray-600">
                Showing {filteredEmployees.length} team members
              </div>
            )}
          </div>
        </div>

        {/* Show message if no location selected */}
        {!selectedLocationId && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Location</h3>
                <p className="text-gray-600">
                  Please select one of your assigned locations to view and manage your team's schedule.
                </p>
                {assignedLocations.length === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    No locations have been assigned to you. Contact your administrator.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {selectedLocationId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Team Members</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalEmployees}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Members</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.activeEmployees}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Shifts</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalAssignments}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Settings className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Coverage Rate</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.coverageRate}%</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-lg font-bold text-orange-600">%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        {selectedLocationId && (
          <Tabs defaultValue="draft-rotas" className="space-y-6">
            <TabsList className="bg-white shadow-sm border">
              <TabsTrigger value="draft-rotas" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                Draft Rotas
              </TabsTrigger>
              <TabsTrigger value="published-rotas" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                Published Rotas
              </TabsTrigger>
              <TabsTrigger value="current-week" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                Current Week View
              </TabsTrigger>
              <TabsTrigger value="templates" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                Shift Templates
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="draft-rotas" className="space-y-6">
              <ModernWeekGrid
                employees={filteredEmployees}
                templates={templates}
                selectedDate={selectedDate}
                viewMode={viewMode}
                onDateChange={handleDateChange}
                onAssignShift={handleAssignShift}
                onDragDrop={handleDragDrop}
                onRemoveShift={handleAssignmentDeleted}
                onAssignmentCreated={handleAssignmentCreated}
                onEditShift={handleEditShift}
                currentRotaId={currentRotaId}
                currentRota={currentRota}
                rotas={rotas}
                onCreateRota={handleCreateRota}
                onPublishRota={handlePublishRota}
                onSelectRota={handleSelectRota}
              />
            </TabsContent>
            
            <TabsContent value="published-rotas" className="space-y-6">
              <PublishedRotasView 
                onViewRota={(rotaId) => {
                  setCurrentRotaId(rotaId)
                }}
              />
            </TabsContent>

            <TabsContent value="current-week" className="space-y-6">
              <CurrentWeekView 
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
              />
            </TabsContent>
            
            <TabsContent value="templates" className="space-y-6">
              <EnhancedTemplateLibrary
                templates={templates}
                onTemplateEdit={(template) => {
                  setEditingTemplate(template)
                  setShowTemplateModal(true)
                }}
                onTemplateSaved={loadTemplates}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Modals */}
        <ShiftAssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          employeeId={assignmentEmployeeId}
          date={assignmentDate}
          onAssignmentCreated={handleAssignmentCreated}
          templates={templates}
        />

        <ShiftEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          assignment={editingAssignment}
          onAssignmentUpdated={handleAssignmentCreated}
          templates={templates}
        />

        <ShiftTemplateModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          template={editingTemplate}
          onTemplateSaved={loadTemplates}
        />
      </div>
    </div>
  )
}
