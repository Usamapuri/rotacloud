"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Clock, X } from 'lucide-react'
import { AuthService } from '@/lib/auth'

interface Employee {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  department: string
  job_position: string
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

interface Assignment {
  id: string
  employee_id: string
  template_id?: string
  date: string
  status: string
  notes?: string
  rota_id?: string
  is_published?: boolean
  // Template or override data
  template_name?: string
  start_time?: string
  end_time?: string
  color?: string
  // Override fields
  override_name?: string
  override_start_time?: string
  override_end_time?: string
  override_color?: string
  // Legacy template object (for backward compatibility)
  template?: {
    name: string
    start_time: string
    end_time: string
    color: string
    department: string
  }
  // Rota information
  rota_name?: string
  rota_status?: string
}

interface ModernShiftCellProps {
  employee: Employee
  date: string
  assignments: Assignment[]
  templates: ShiftTemplate[]
  onAssignShift: () => void
  onRemoveShift: (assignmentId: string) => void
  onAssignmentCreated?: () => void
  onDragStart: (template: ShiftTemplate) => void
  isDragOver?: boolean
  onEditShift?: (assignment: Assignment) => void
  currentRotaId?: string | null
  isRotaMode?: boolean
}

export default function ModernShiftCell({
  employee,
  date,
  assignments,
  templates,
  onAssignShift,
  onRemoveShift,
  onAssignmentCreated,
  onDragStart,
  isDragOver,
  onEditShift,
  currentRotaId,
  isRotaMode = false
}: ModernShiftCellProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const user = AuthService.getCurrentUser()
      const res = await fetch(`/api/scheduling/assign?id=${assignmentId}`, {
        method: 'DELETE',
        headers: {
          ...(user?.id ? { authorization: `Bearer ${user.id}` } : {}),
        }
      })
      
      if (res.ok) {
        onRemoveShift(assignmentId)
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Failed to remove assignment:', errorData.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Error removing assignment:', error)
    }
  }

  const handleDragStart = (e: React.DragEvent, template: ShiftTemplate | Assignment) => {
    e.dataTransfer.setData('application/json', JSON.stringify(template))
    e.dataTransfer.effectAllowed = 'move'
    if ('name' in template && 'start_time' in template) {
      // It's a ShiftTemplate
      onDragStart(template)
    } else {
      // It's an Assignment - convert to template-like object for drag
      const assignment = template as Assignment
      const templateLike: ShiftTemplate = {
        id: assignment.template_id || assignment.id,
        name: getShiftDisplayName(assignment),
        start_time: getShiftStartTime(assignment),
        end_time: getShiftEndTime(assignment),
        color: getShiftColor(assignment),
        department: assignment.template?.department || 'General',
        required_staff: 1
      }
      onDragStart(templateLike)
    }
  }

  const handleDragEnd = () => {
    // Reset any drag state
    setIsHovered(false)
  }

  // Helper functions to get shift display data
  const getShiftDisplayName = (assignment: Assignment) => {
    return assignment.override_name || assignment.template_name || assignment.template?.name || 'Unknown Shift'
  }

  const getShiftStartTime = (assignment: Assignment) => {
    return assignment.override_start_time || assignment.start_time || assignment.template?.start_time || '00:00'
  }

  const getShiftEndTime = (assignment: Assignment) => {
    return assignment.override_end_time || assignment.end_time || assignment.template?.end_time || '00:00'
  }

  const getShiftColor = (assignment: Assignment) => {
    return assignment.override_color || assignment.color || assignment.template?.color || '#3B82F6'
  }

  const handleShiftClick = (assignment: Assignment) => {
    if (onEditShift) {
      onEditShift(assignment)
    }
  }

  const handleQuickAssign = async (template: ShiftTemplate) => {
    try {
      const res = await fetch('/api/scheduling/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          date: date,
          template_id: template.id,
          rota_id: currentRotaId
        })
      })
      
      if (res.ok) {
        onAssignmentCreated?.()
      }
    } catch (error) {
      console.error('Error assigning shift:', error)
    }
  }

  return (
    <div
      className={`
        relative min-h-[80px] p-2 rounded-lg transition-all duration-200
        ${isDragOver ? 'ring-2 ring-blue-400 bg-blue-100 shadow-md' : ''}
        ${assignments.length > 0 ? 'bg-transparent' : 'bg-transparent hover:bg-gray-100'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Existing Assignments */}
      {assignments.map((assignment) => {
        const isDraft = !assignment.is_published
        return (
          <div
            key={assignment.id}
            draggable
            onDragStart={(e) => handleDragStart(e, assignment)}
            onDragEnd={handleDragEnd}
            onClick={() => handleShiftClick(assignment)}
            className={`mb-1 p-2 rounded text-xs font-medium relative group cursor-pointer hover:shadow-md transition-all ${
              isDraft 
                ? 'border-2 border-dashed border-gray-400 bg-opacity-60 text-gray-700' 
                : 'text-white'
            }`}
            style={{ 
              backgroundColor: isDraft ? `${getShiftColor(assignment)}60` : getShiftColor(assignment),
              borderColor: isDraft ? getShiftColor(assignment) : 'transparent'
            }}
          >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {getShiftDisplayName(assignment)}
              </div>
              <div className="text-xs opacity-90 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getShiftStartTime(assignment)} - {getShiftEndTime(assignment)}
              </div>
              {/* Show rota info if in rota mode */}
              {isRotaMode && assignment.rota_name && (
                <div className="text-xs opacity-75 mt-1">
                  {assignment.rota_name}
                </div>
              )}
              {/* Show status if not assigned */}
              {assignment.status && assignment.status !== 'assigned' && (
                <div className="text-xs opacity-75 mt-1 capitalize">
                  {assignment.status}
                </div>
              )}
              {/* Show draft indicator */}
              {isDraft && (
                <div className="text-xs opacity-75 mt-1 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                  Draft
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1 w-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/30"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveAssignment(assignment.id)
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        )
      })}

      {/* Empty State with Add Button */}
      {assignments.length === 0 && (
        <div className="flex items-center justify-center h-full min-h-[40px]">
          {isHovered ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
              onClick={onAssignShift}
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : (
            <div className="text-xs text-gray-400">+</div>
          )}
        </div>
      )}

      {/* Template Quick Assign Dropdown */}
      {isHovered && assignments.length === 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1 text-xs font-medium text-gray-500">Quick Assign</div>
            {templates.filter(t => t.is_active !== false).map((template) => (
              <DropdownMenuItem
                key={template.id}
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => handleQuickAssign(template)}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: template.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{template.name}</div>
                  <div className="text-xs text-gray-500">
                    {template.start_time} - {template.end_time}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer text-blue-600"
              onClick={onAssignShift}
            >
              <Plus className="h-4 w-4" />
              Custom Assignment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Drag and Drop Visual Feedback */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-80 rounded-lg border-2 border-dashed border-blue-500 flex items-center justify-center z-10 shadow-lg">
          <div className="text-sm font-medium text-blue-700 bg-white px-3 py-1 rounded-full shadow-sm">
            Drop to assign
          </div>
        </div>
      )}
    </div>
  )
}
