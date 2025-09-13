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
  department: string
  color: string
  required_staff: number
  is_active?: boolean
}

export default function SchedulingPage() {
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
  
  // Location filtering state
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
    if (!user || user.role !== 'admin') {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    loadAll()
  }, [router])

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
    const dateToLoad = dateOverride || selectedDate
    const user = AuthService.getCurrentUser()
    
    // Build URL with rota filter if specified
    let url = `/api/scheduling/week/${dateToLoad}`
    const params = new URLSearchParams()
    if (rotaId) {
      params.append('rota_id', rotaId)
    }
    // Note: Don't add show_drafts_only by default - let it load all data initially
    // The draft/published filtering will be handled by the rota selection
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

  // Filter employees based on selected location
  useEffect(() => {
    if (selectedLocationId) {
      // Filter employees by location
      const filtered = employees.filter(emp => emp.location_id === selectedLocationId)
      setFilteredEmployees(filtered)
    } else {
      // Show all employees
      setFilteredEmployees(employees)
    }
  }, [employees, selectedLocationId])

  // Handle location filter change
  const handleLocationChange = (locationId: string | null) => {
    setSelectedLocationId(locationId)
  }

  const handleDateChange = async (date: string) => {
    setSelectedDate(date)
    await loadWeek(date, currentRotaId)
  }

  const handleCreateRota = async (name: string, weekStart: string) => {
    const user = AuthService.getCurrentUser()
    const res = await fetch('/api/rotas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(user?.id ? { authorization: `Bearer ${user.id}` } : {})
      },
      body: JSON.stringify({
        name,
        week_start_date: weekStart,
        description: `Rota for week starting ${weekStart}`
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to create rota')
    }

    const data = await res.json()
    const newRota = data.data
    
    // Switch to the new rota
    setCurrentRotaId(newRota.id)
    setCurrentRota(newRota)
    await loadWeek(selectedDate, newRota.id)
  }

  const handlePublishRota = async (rotaId: string) => {
    const user = AuthService.getCurrentUser()
    const res = await fetch(`/api/rotas/${rotaId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(user?.id ? { authorization: `Bearer ${user.id}` } : {})
      }
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to publish rota')
    }

    // Reload to get updated rota status
    await loadWeek(selectedDate, currentRotaId)
  }

  const handlePublishShifts = async () => {
    try {
      const user = AuthService.getCurrentUser()
      
      // Calculate week start and end dates
      const selectedDateObj = new Date(selectedDate)
      const dayOfWeek = selectedDateObj.getDay()
      const weekStart = new Date(selectedDateObj)
      weekStart.setDate(selectedDateObj.getDate() - dayOfWeek)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      
      const startDate = weekStart.toISOString().split('T')[0]
      const endDate = weekEnd.toISOString().split('T')[0]

      const res = await fetch('/api/scheduling/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { authorization: `Bearer ${user.id}` } : {})
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to publish shifts')
      }

      const data = await res.json()
      toast.success(data.message || 'Shifts published successfully')
      
      // Reload to get updated shift status
      await loadWeek(selectedDate, currentRotaId)
    } catch (error) {
      console.error('Error publishing shifts:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to publish shifts')
    }
  }

  const handleSelectRota = async (rotaId: string | null) => {
    setCurrentRotaId(rotaId)
    if (rotaId) {
      const selectedRota = rotas.find(r => r.id === rotaId)
      setCurrentRota(selectedRota || null)
    } else {
      setCurrentRota(null)
    }
    await loadWeek(selectedDate, rotaId)
  }

  const handleEditShift = (assignment: any) => {
    // Find the employee for this assignment
    const employee = employees.find(e => e.id === assignment.employee_id)
    setEditingAssignment(assignment)
    setSelectedEmployee(employee || null)
    setShowEditModal(true)
  }

  const handleAssignmentUpdated = async () => {
    await loadWeek(selectedDate, currentRotaId)
  }

  const handleAssignmentDeleted = async (assignmentId: string) => {
    // Remove from local state immediately for better UX
    setEmployees(prev => prev.map(e => {
      const updatedAssignments: any = {}
      Object.entries(e.assignments || {}).forEach(([d, arr]) => {
        updatedAssignments[d] = (arr as any[]).filter(a => a.id !== assignmentId)
      })
      return { ...e, assignments: updatedAssignments }
    }))
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadAll()
    setIsRefreshing(false)
  }

  const handleAssignShift = (employeeId: string, date: string) => {
    setAssignmentEmployeeId(employeeId)
    setAssignmentDate(date)
    setShowAssignmentModal(true)
  }

  const handleAssignmentCreated = async () => {
    await loadWeek()
    toast.success('Shift assigned successfully')
  }

  const handleTemplateSaved = async () => {
    await loadTemplates()
    toast.success('Template saved successfully')
  }

  const handleDragDrop = async (employeeId: string, date: string, templateId: string) => {
    try {
      const user = AuthService.getCurrentUser()
      const res = await fetch('/api/scheduling/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { authorization: `Bearer ${user.id}` } : {}),
        },
        body: JSON.stringify({
          employee_id: employeeId,
          date: date,
          template_id: templateId,
          rota_id: currentRotaId
        })
      })
      
      if (res.ok) {
        await loadWeek(selectedDate, currentRotaId)
        toast.success('Shift assigned via drag & drop')
      } else {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to assign shift')
      }
    } catch (error) {
      console.error('Drag drop error:', error)
      toast.error('Failed to assign shift')
    }
  }

  const stats = useMemo(() => {
    let totalAssignments = 0
    let assignedEmployees = 0
    employees.forEach(e => {
      Object.values(e.assignments || {}).forEach((d: any) => (totalAssignments += d.length))
      if (Object.values(e.assignments || {}).some((d: any) => d.length > 0)) assignedEmployees += 1
    })
    return {
      totalEmployees: employees.length,
      assignedEmployees,
      totalAssignments,
      coverageRate: employees.length ? Math.round((assignedEmployees / employees.length) * 100) : 0,
    }
  }, [employees])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading scheduling...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Rota Management</h1>
              <p className="text-gray-600">Create, edit, and publish rotas with full draft workflow control</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4 mr-2" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4 mr-2" />
                  List
                </Button>
              </div>
              
              <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setShowTemplateLibrary(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Template Library
              </Button>
              
              <Button 
                onClick={() => {
                  setAssignmentDate(selectedDate)
                  const defaultEmpId = selectedEmployee?.id || employees[0]?.id || ''
                  setAssignmentEmployeeId(defaultEmpId)
                  setShowAssignmentModal(true)
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Quick Assign
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Employees</p>
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
                  <p className="text-sm font-medium text-gray-600">Assigned This Week</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.assignedEmployees}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-green-600" />
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

        {/* Location Filter */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <LocationFilter
              selectedLocationId={selectedLocationId}
              onLocationChange={handleLocationChange}
              showAllOption={true}
              showRefresh={true}
            />
            {selectedLocationId && (
              <div className="text-sm text-gray-600">
                Showing {filteredEmployees.length} of {employees.length} employees
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
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
            <TabsTrigger value="master-calendar" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Master Calendar
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
                // Switch to draft-rotas tab to view the selected rota
                // Note: In a full implementation, you might want to create a separate read-only view
              }}
            />
          </TabsContent>

          <TabsContent value="current-week" className="space-y-6">
            <CurrentWeekView 
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
            />
          </TabsContent>

          <TabsContent value="master-calendar" className="space-y-6">
            <MasterCalendar 
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

        {/* Modals */}
        <ShiftAssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          employee={employees.find(e => e.id === assignmentEmployeeId) || null}
          date={assignmentDate}
          templates={templates}
          onAssignmentCreated={handleAssignmentCreated}
          currentRotaId={currentRotaId}
        />

        <ShiftEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setEditingAssignment(null)
            setSelectedEmployee(null)
          }}
          assignment={editingAssignment}
          employee={selectedEmployee}
          templates={templates}
          onAssignmentUpdated={handleAssignmentUpdated}
          onAssignmentDeleted={handleAssignmentDeleted}
        />

        <ShiftTemplateModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          template={editingTemplate}
          onTemplateSaved={handleTemplateSaved}
        />

        <TemplateLibrary
          isOpen={showTemplateLibrary}
          onClose={() => setShowTemplateLibrary(false)}
          templates={templates}
          onTemplateEdit={(template) => {
            setEditingTemplate(template)
            setShowTemplateLibrary(false)
            setShowTemplateModal(true)
          }}
          onTemplateSaved={handleTemplateSaved}
        />
      </div>
    </div>
  )
}


