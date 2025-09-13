"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar, Plus, Search, Filter, MoreHorizontal, Users, Send, Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ModernShiftCell from './ModernShiftCell'
import SelectivePublishModal from './SelectivePublishModal'
import { toast } from 'sonner'

interface Employee {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  department: string
  job_position: string
  assignments?: { [date: string]: any[] }
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

interface ModernWeekGridProps {
  employees: Employee[]
  templates: ShiftTemplate[]
  selectedDate: string
  viewMode: 'grid' | 'list'
  onDateChange: (date: string) => void
  onAssignShift: (employeeId: string, date: string) => void
  onDragDrop: (employeeId: string, date: string, templateId: string) => void
  onRemoveShift: (assignmentId: string) => void
  onAssignmentCreated?: () => void
  onEditShift?: (assignment: any) => void
  currentRotaId?: string | null
  currentRota?: any | null
  rotas?: any[]
  onCreateRota?: (name: string, weekStart: string) => void
  onPublishRota?: (rotaId: string) => void
  onPublishShifts?: () => void
  onSelectRota?: (rotaId: string | null) => void
}

export default function ModernWeekGrid({
  employees,
  templates,
  selectedDate,
  viewMode,
  onDateChange,
  onAssignShift,
  onDragDrop,
  onRemoveShift,
  onAssignmentCreated,
  onEditShift,
  currentRotaId,
  currentRota,
  rotas = [],
  onCreateRota,
  onPublishRota,
  onPublishShifts,
  onSelectRota
}: ModernWeekGridProps) {
  const [weekStart, setWeekStart] = useState(new Date())
  const [weekDays, setWeekDays] = useState<string[]>([])
  const [search, setSearch] = useState<string>('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [draggedTemplate, setDraggedTemplate] = useState<ShiftTemplate | null>(null)
  const [dragOverCell, setDragOverCell] = useState<{ employeeId: string; date: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [showCreateRotaDialog, setShowCreateRotaDialog] = useState(false)
  const [newRotaName, setNewRotaName] = useState('')
  const [isCreatingRota, setIsCreatingRota] = useState(false)
  const [showSelectivePublishModal, setShowSelectivePublishModal] = useState(false)

  // Calculate draft count
  const draftCount = employees.reduce((count, employee) => {
    return count + Object.values(employee.assignments || {}).reduce((dayCount, dayAssignments) => {
      return dayCount + (dayAssignments as any[]).filter(assignment => !assignment.is_published).length
    }, 0)
  }, 0)
  const [isPublishingRota, setIsPublishingRota] = useState(false)
  const dragTimeoutRef = useRef<NodeJS.Timeout>()

  // Initialize week when selectedDate changes
  useEffect(() => {
    const date = new Date(selectedDate)
    const dayOfWeek = date.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(date)
    monday.setDate(date.getDate() - daysToMonday)
    
    setWeekStart(monday)
  }, [selectedDate])

  // Generate week days
  useEffect(() => {
    const days: string[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + i)
      days.push(day.toISOString().split('T')[0])
    }
    setWeekDays(days)
  }, [weekStart])

  const goToPreviousWeek = async () => {
    const newWeekStart = new Date(weekStart)
    newWeekStart.setDate(weekStart.getDate() - 7)
    setWeekStart(newWeekStart)
    await onDateChange(newWeekStart.toISOString().split('T')[0])
  }

  const goToNextWeek = async () => {
    const newWeekStart = new Date(weekStart)
    newWeekStart.setDate(weekStart.getDate() + 7)
    setWeekStart(newWeekStart)
    await onDateChange(newWeekStart.toISOString().split('T')[0])
  }

  const goToCurrentWeek = async () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(today)
    monday.setDate(today.getDate() - daysToMonday)
    
    setWeekStart(monday)
    await onDateChange(today.toISOString().split('T')[0])
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const isToday = (dateString: string) => {
    const today = new Date().toISOString().split('T')[0]
    return dateString === today
  }

  const isWeekend = (dateString: string) => {
    const date = new Date(dateString)
    return date.getDay() === 0 || date.getDay() === 6
  }

  const filteredEmployees = employees.filter((e) => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || 
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employee_code.toLowerCase().includes(q) ||
      (e.department || '').toLowerCase().includes(q)
    
    const matchesDepartment = departmentFilter === 'all' || e.department === departmentFilter
    
    return matchesSearch && matchesDepartment
  })

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)))

  const handleDragStart = (template: ShiftTemplate) => {
    setDraggedTemplate(template)
    setIsDragging(true)
  }

  const handleDragOver = (e: React.DragEvent, employeeId: string, date: string) => {
    e.preventDefault()
    // Clear any existing timeout to prevent flickering
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current)
    }
    setDragOverCell({ employeeId, date })
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Add a small delay before clearing the drag over state to prevent flickering
    dragTimeoutRef.current = setTimeout(() => {
      setDragOverCell(null)
    }, 50)
  }

  const handleDrop = async (e: React.DragEvent, employeeId: string, date: string) => {
    e.preventDefault()
    setDragOverCell(null)
    
    if (!draggedTemplate || isAssigning) return

    try {
      setIsAssigning(true)
      await onDragDrop(employeeId, date, draggedTemplate.id)
    } finally {
      setIsAssigning(false)
      setDraggedTemplate(null)
      setIsDragging(false)
    }
  }

  const handleDragEnd = () => {
    setDraggedTemplate(null)
    setIsDragging(false)
    setDragOverCell(null)
  }

  const handleCreateRota = async () => {
    if (!newRotaName.trim()) {
      toast.error('Please enter a rota name')
      return
    }

    setIsCreatingRota(true)
    try {
      const weekStartStr = weekStart.toISOString().split('T')[0]
      await onCreateRota?.(newRotaName.trim(), weekStartStr)
      setNewRotaName('')
      setShowCreateRotaDialog(false)
      toast.success('Rota created successfully')
    } catch (error) {
      console.error('Error creating rota:', error)
      toast.error('Failed to create rota')
    } finally {
      setIsCreatingRota(false)
    }
  }

  const handlePublishRota = async () => {
    if (!currentRota?.id) return

    setIsPublishingRota(true)
    try {
      await onPublishRota?.(currentRota.id)
      toast.success(`Rota "${currentRota.name}" published successfully`)
    } catch (error) {
      console.error('Error publishing rota:', error)
      toast.error('Failed to publish rota')
    } finally {
      setIsPublishingRota(false)
    }
  }

  const getWeekStartString = () => {
    return weekStart.toISOString().split('T')[0]
  }

  if (viewMode === 'list') {
    return (
      <Card className="bg-white shadow-sm border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Week Schedule - List View
              {currentRota && (
                <Badge variant={currentRota.status === 'published' ? 'default' : 'secondary'} className="ml-2">
                  {currentRota.name} ({currentRota.status})
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {/* Rota Management Buttons */}
              {currentRota ? (
                <>
                  {currentRota.status === 'draft' && (
                    <Button 
                      size="sm" 
                      onClick={handlePublishRota}
                      disabled={isPublishingRota}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {isPublishingRota ? 'Publishing...' : 'Publish Rota'}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => onSelectRota?.(null)}>
                    <Eye className="h-4 w-4 mr-1" />
                    View All
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    size="sm" 
                    onClick={() => setShowCreateRotaDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Rota
                  </Button>
                  {rotas.length > 0 && (
                    <Select value={currentRotaId || ''} onValueChange={(value) => onSelectRota?.(value || null)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select existing rota" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Shifts</SelectItem>
                        {rotas.map((rota) => (
                          <SelectItem key={rota.id} value={rota.id}>
                            {rota.name} ({rota.status}) - {rota.total_shifts} shifts
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}

              {/* Week Navigation */}
              <div className="flex items-center gap-1 border-l pl-2 ml-2">
                <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees..."
                className="pl-9"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  {departmentFilter === 'all' ? 'All Departments' : departmentFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setDepartmentFilter('all')}>
                  All Departments
                </DropdownMenuItem>
                {departments.map(dept => (
                  <DropdownMenuItem key={dept} onClick={() => setDepartmentFilter(dept)}>
                    {dept}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="text-sm text-gray-500">
            {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="space-y-4">
            {filteredEmployees.map((employee) => (
              <div key={employee.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {employee.first_name} {employee.last_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {employee.employee_code} • {employee.department}
                    </p>
                  </div>
                  <Badge variant="outline">{employee.job_position}</Badge>
                </div>
                
                  <div className="grid grid-cols-7 gap-3">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className={`
                          p-4 border rounded-lg min-h-[120px] relative transition-all duration-200
                          ${isWeekend(day) ? 'bg-gray-50' : 'bg-white'}
                          ${isToday(day) ? 'ring-2 ring-blue-200' : ''}
                          ${dragOverCell?.employeeId === employee.id && dragOverCell?.date === day ? 'ring-4 ring-blue-400 bg-blue-50 shadow-lg scale-[1.02]' : ''}
                          hover:shadow-md hover:bg-gray-25
                        `}
                        onDragOver={(e) => handleDragOver(e, employee.id, day)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, employee.id, day)}
                      >
                      <div className="text-xs text-gray-500 mb-2">
                        {new Date(day).toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <ModernShiftCell
                        employee={employee}
                        date={day}
                        assignments={employee.assignments?.[day] || []}
                        templates={templates}
                        onAssignShift={() => onAssignShift(employee.id, day)}
                        onRemoveShift={onRemoveShift}
                        onAssignmentCreated={onAssignmentCreated}
                        onDragStart={handleDragStart}
                        isDragOver={dragOverCell?.employeeId === employee.id && dragOverCell?.date === day}
                        onEditShift={onEditShift}
                        currentRotaId={currentRotaId}
                        isRotaMode={!!currentRotaId}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card className="bg-white shadow-sm border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Week Schedule - Grid View
              {currentRota && (
                <Badge variant={currentRota.status === 'published' ? 'default' : 'secondary'} className="ml-2">
                  {currentRota.name} ({currentRota.status})
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {/* Rota Management Buttons */}
              {currentRota ? (
                <>
                  {currentRota.status === 'draft' && (
                    <Button 
                      size="sm" 
                      onClick={handlePublishRota}
                      disabled={isPublishingRota}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {isPublishingRota ? 'Publishing...' : 'Publish Rota'}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => onSelectRota?.(null)}>
                    <Eye className="h-4 w-4 mr-1" />
                    View All
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => setShowSelectivePublishModal(true)}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={draftCount === 0}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Publish Shifts
                    </Button>
                    {draftCount > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs">
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        {draftCount} draft{draftCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => setShowCreateRotaDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Rota
                  </Button>
                  {rotas.length > 0 && (
                    <Select value={currentRotaId || ''} onValueChange={(value) => onSelectRota?.(value || null)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select existing rota" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Shifts</SelectItem>
                        {rotas.map((rota) => (
                          <SelectItem key={rota.id} value={rota.id}>
                            {rota.name} ({rota.status}) - {rota.total_shifts} shifts
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}

              {/* Week Navigation */}
              <div className="flex items-center gap-1 border-l pl-2 ml-2">
                <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="pl-9"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {departmentFilter === 'all' ? 'All Departments' : departmentFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setDepartmentFilter('all')}>
                All Departments
              </DropdownMenuItem>
              {departments.map(dept => (
                <DropdownMenuItem key={dept} onClick={() => setDepartmentFilter(dept)}>
                  {dept}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="text-sm text-gray-500">
          {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Use the full horizontal space on desktop, fall back to scroll on very small screens */}
        <div className="overflow-x-auto">
          <div className="min-w-full xl:min-w-0">
            {/* Header row with day names */}
            <div className="grid grid-cols-8 gap-1 border-b bg-gray-50">
              <div className="p-4 font-medium text-sm text-gray-600">
                Employee
              </div>
              {weekDays.map((day) => (
                <div
                  key={day}
                  className={`
                    p-4 text-center font-medium text-sm
                    ${isToday(day) ? 'bg-blue-50 text-blue-700' : ''}
                    ${isWeekend(day) ? 'bg-gray-100' : ''}
                  `}
                >
                  <div className="font-semibold">
                    {new Date(day).toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(day).getDate()}
                  </div>
                </div>
              ))}
            </div>

            {/* Employee rows */}
            {filteredEmployees.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-gray-500">
                No employees to display
              </div>
            ) : (
              <div className="space-y-1">
                {filteredEmployees.map((employee) => (
                  <div key={employee.id} className="grid grid-cols-8 gap-1 border-b hover:bg-gray-50 transition-colors">
                    <div className="p-4 border-r">
                      <div className="font-medium text-sm text-gray-900">
                        {employee.first_name} {employee.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {employee.employee_code} • {employee.department}
                      </div>
                    </div>
                    
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className={`
                          p-3 border-r min-h-[120px] relative transition-all duration-200
                          ${isWeekend(day) ? 'bg-gray-50' : ''}
                          ${isToday(day) ? 'bg-blue-25' : ''}
                          ${dragOverCell?.employeeId === employee.id && dragOverCell?.date === day ? 'ring-4 ring-blue-400 bg-blue-50 shadow-lg scale-[1.02]' : ''}
                          hover:bg-gray-25 hover:shadow-sm
                        `}
                        onDragOver={(e) => handleDragOver(e, employee.id, day)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, employee.id, day)}
                      >
                        <ModernShiftCell
                          employee={employee}
                          date={day}
                          assignments={employee.assignments?.[day] || []}
                          templates={templates}
                          onAssignShift={() => onAssignShift(employee.id, day)}
                          onRemoveShift={onRemoveShift}
                          onAssignmentCreated={onAssignmentCreated}
                          onDragStart={handleDragStart}
                          isDragOver={dragOverCell?.employeeId === employee.id && dragOverCell?.date === day}
                          onEditShift={onEditShift}
                          currentRotaId={currentRotaId}
                          isRotaMode={!!currentRotaId}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Create Rota Dialog */}
    <Dialog open={showCreateRotaDialog} onOpenChange={setShowCreateRotaDialog}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create New Rota
          </DialogTitle>
          <DialogDescription>
            Create a new rota for the week of {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rota-name">Rota Name</Label>
            <Input
              id="rota-name"
              value={newRotaName}
              onChange={(e) => setNewRotaName(e.target.value)}
              placeholder="e.g., Weekly Schedule, Holiday Coverage"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateRota()
                }
              }}
            />
          </div>
          <div className="text-sm text-gray-500">
            This rota will be created as a draft. You can add shifts and publish it when ready.
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              setShowCreateRotaDialog(false)
              setNewRotaName('')
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateRota}
            disabled={isCreatingRota || !newRotaName.trim()}
          >
            {isCreatingRota ? 'Creating...' : 'Create Rota'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Selective Publish Modal */}
    <SelectivePublishModal
      isOpen={showSelectivePublishModal}
      onClose={() => setShowSelectivePublishModal(false)}
      employees={employees}
      weekDays={weekDays}
      onPublishComplete={() => {
        // Refresh the data after publishing
        if (onAssignmentCreated) {
          onAssignmentCreated()
        }
      }}
    />
    </>
  )
}
