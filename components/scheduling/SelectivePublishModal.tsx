"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Users, Send, X } from 'lucide-react'
import { AuthService } from '@/lib/auth'
import { toast } from 'sonner'

interface Employee {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  department: string
  assignments: { [date: string]: any[] }
}

interface SelectivePublishModalProps {
  isOpen: boolean
  onClose: () => void
  employees: Employee[]
  weekDays: string[]
  onPublishComplete: () => void
}

interface DraftShift {
  id: string
  employee_id: string
  employee_name: string
  date: string
  shift_name: string
  start_time: string
  end_time: string
  color: string
}

export default function SelectivePublishModal({
  isOpen,
  onClose,
  employees,
  weekDays,
  onPublishComplete
}: SelectivePublishModalProps) {
  const [draftShifts, setDraftShifts] = useState<DraftShift[]>([])
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set())
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())
  const [publishMode, setPublishMode] = useState<'shifts' | 'days' | 'all'>('shifts')
  const [isPublishing, setIsPublishing] = useState(false)

  // Extract all draft shifts
  useEffect(() => {
    if (isOpen) {
      const drafts: DraftShift[] = []
      
      employees.forEach(employee => {
        weekDays.forEach(date => {
          const dayAssignments = employee.assignments?.[date] || []
          dayAssignments.forEach((assignment: any) => {
            if (!assignment.is_published) {
              drafts.push({
                id: assignment.id,
                employee_id: employee.id,
                employee_name: `${employee.first_name} ${employee.last_name}`,
                date,
                shift_name: assignment.override_name || assignment.template_name || assignment.template?.name || 'Custom Shift',
                start_time: assignment.override_start_time || assignment.template?.start_time || assignment.start_time || '00:00',
                end_time: assignment.override_end_time || assignment.template?.end_time || assignment.end_time || '00:00',
                color: assignment.override_color || assignment.template?.color || assignment.color || '#3B82F6'
              })
            }
          })
        })
      })
      
      setDraftShifts(drafts)
      setSelectedShifts(new Set())
      setSelectedDays(new Set())
    }
  }, [isOpen, employees, weekDays])

  const handleShiftSelect = (shiftId: string) => {
    const newSelected = new Set(selectedShifts)
    if (newSelected.has(shiftId)) {
      newSelected.delete(shiftId)
    } else {
      newSelected.add(shiftId)
    }
    setSelectedShifts(newSelected)
  }

  const handleDaySelect = (date: string) => {
    const newSelected = new Set(selectedDays)
    if (newSelected.has(date)) {
      newSelected.delete(date)
    } else {
      newSelected.add(date)
    }
    setSelectedDays(newSelected)
  }

  const handleSelectAll = () => {
    if (publishMode === 'shifts') {
      setSelectedShifts(new Set(draftShifts.map(s => s.id)))
    } else if (publishMode === 'days') {
      setSelectedDays(new Set(weekDays))
    }
  }

  const handleSelectNone = () => {
    setSelectedShifts(new Set())
    setSelectedDays(new Set())
  }

  const handlePublish = async () => {
    if (publishMode === 'shifts' && selectedShifts.size === 0) {
      toast.error('Please select at least one shift to publish')
      return
    }
    
    if (publishMode === 'days' && selectedDays.size === 0) {
      toast.error('Please select at least one day to publish')
      return
    }

    setIsPublishing(true)

    try {
      const user = AuthService.getCurrentUser()
      
      let requestBody: any = {}
      
      if (publishMode === 'shifts') {
        requestBody.shift_ids = Array.from(selectedShifts)
      } else if (publishMode === 'days') {
        const startDate = Math.min(...Array.from(selectedDays).map(d => new Date(d).getTime()))
        const endDate = Math.max(...Array.from(selectedDays).map(d => new Date(d).getTime()))
        requestBody.start_date = new Date(startDate).toISOString().split('T')[0]
        requestBody.end_date = new Date(endDate).toISOString().split('T')[0]
      } else {
        // Publish all
        const allDates = draftShifts.map(s => s.date)
        const startDate = Math.min(...allDates.map(d => new Date(d).getTime()))
        const endDate = Math.max(...allDates.map(d => new Date(d).getTime()))
        requestBody.start_date = new Date(startDate).toISOString().split('T')[0]
        requestBody.end_date = new Date(endDate).toISOString().split('T')[0]
      }

      const res = await fetch('/api/scheduling/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { authorization: `Bearer ${user.id}` } : {})
        },
        body: JSON.stringify(requestBody)
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to publish shifts')
      }

      const data = await res.json()
      toast.success(data.message || 'Shifts published successfully')
      onPublishComplete()
      onClose()
    } catch (error) {
      console.error('Error publishing shifts:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to publish shifts')
    } finally {
      setIsPublishing(false)
    }
  }

  const getSelectedCount = () => {
    if (publishMode === 'shifts') return selectedShifts.size
    if (publishMode === 'days') return selectedDays.size
    return draftShifts.length
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Selective Publishing
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Publish Mode Selection */}
          <div className="flex gap-2">
            <Button
              variant={publishMode === 'shifts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPublishMode('shifts')}
            >
              <Users className="h-4 w-4 mr-1" />
              Individual Shifts
            </Button>
            <Button
              variant={publishMode === 'days' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPublishMode('days')}
            >
              <Calendar className="h-4 w-4 mr-1" />
              By Days
            </Button>
            <Button
              variant={publishMode === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPublishMode('all')}
            >
              <Send className="h-4 w-4 mr-1" />
              Publish All
            </Button>
          </div>

          {/* Selection Controls */}
          {publishMode !== 'all' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleSelectNone}>
                Select None
              </Button>
              <div className="text-sm text-gray-600">
                {getSelectedCount()} selected
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-auto">
            {publishMode === 'shifts' && (
              <div className="space-y-2">
                {draftShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={selectedShifts.has(shift.id)}
                      onCheckedChange={() => handleShiftSelect(shift.id)}
                    />
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: shift.color }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{shift.shift_name}</div>
                      <div className="text-sm text-gray-600">
                        {shift.employee_name} • {formatDate(shift.date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      {shift.start_time} - {shift.end_time}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {publishMode === 'days' && (
              <div className="space-y-2">
                {weekDays.map((date) => {
                  const dayShifts = draftShifts.filter(s => s.date === date)
                  return (
                    <div
                      key={date}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={selectedDays.has(date)}
                        onCheckedChange={() => handleDaySelect(date)}
                        disabled={dayShifts.length === 0}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{formatDate(date)}</div>
                        <div className="text-sm text-gray-600">
                          {dayShifts.length} draft shift{dayShifts.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {dayShifts.length} shifts
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}

            {publishMode === 'all' && (
              <div className="text-center py-8">
                <Send className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <div className="text-lg font-medium mb-2">Publish All Draft Shifts</div>
                <div className="text-gray-600">
                  This will publish all {draftShifts.length} draft shifts for the current week.
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPublishing}>
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isPublishing || (publishMode !== 'all' && getSelectedCount() === 0)}
            className="bg-green-600 hover:bg-green-700"
          >
            {isPublishing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Publishing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                Publish {getSelectedCount()} {publishMode === 'shifts' ? 'Shift' : publishMode === 'days' ? 'Day' : 'All'}
                {getSelectedCount() !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
