"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Clock, User, Calendar } from 'lucide-react'
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
}

interface ShiftAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  employee: Employee | null
  date: string
  templates: ShiftTemplate[]
  onAssignmentCreated: () => void
  currentRotaId?: string | null
}

export default function ShiftAssignmentModal({
  isOpen,
  onClose,
  employee,
  date,
  templates,
  onAssignmentCreated,
  currentRotaId
}: ShiftAssignmentModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [customStartTime, setCustomStartTime] = useState('')
  const [customEndTime, setCustomEndTime] = useState('')
  const [customShiftName, setCustomShiftName] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [useCustomShift, setUseCustomShift] = useState(false)
  const [applyWholeWeek, setApplyWholeWeek] = useState(false)

  // Reset form when modal opens with a slight delay to avoid flicker
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        setSelectedTemplate('')
        setCustomStartTime('')
        setCustomEndTime('')
        setCustomShiftName('')
        setNotes('')
        setUseCustomShift(false)
      }, 0)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!employee) return

    setIsLoading(true)

    try {
      // Validate inputs
      if (!useCustomShift && !selectedTemplate) {
        alert('Please select a shift template or choose Custom Shift')
        setIsLoading(false)
        return
      }
      if (useCustomShift && (!customShiftName || !customStartTime || !customEndTime)) {
        alert('Please fill in all custom shift fields')
        setIsLoading(false)
        return
      }

      // Build dates array for Mon-Sun if applyWholeWeek, else single date
      const start = new Date(date)
      const dayOfWeek = start.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(start)
      monday.setDate(start.getDate() - daysToMonday)
      const dates: string[] = applyWholeWeek
        ? Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday)
            d.setDate(monday.getDate() + i)
            return d.toISOString().split('T')[0]
          })
        : [date]

      // Create assignments sequentially to keep logs simple
      for (const d of dates) {
        const user = AuthService.getCurrentUser()
        const res = await fetch('/api/scheduling/assign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(user?.id ? { authorization: `Bearer ${user.id}`, 'x-employee-id': user.id } : {}),
          },
          body: JSON.stringify({
            employee_id: employee.id,
            template_id: useCustomShift ? undefined : selectedTemplate,
            override_name: useCustomShift ? customShiftName : undefined,
            override_start_time: useCustomShift ? customStartTime : undefined,
            override_end_time: useCustomShift ? customEndTime : undefined,
            override_color: useCustomShift ? '#3B82F6' : undefined,
            date: d,
            notes: notes,
            rota_id: currentRotaId
          })
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Failed to assign shift for ${d}`)
        }
      }

      onAssignmentCreated()
      onClose()
    } catch (error) {
      console.error('Error creating assignment:', error)
      alert(error instanceof Error ? error.message : 'Failed to create assignment')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const getSelectedTemplate = () => {
    return templates.find(t => t.id === selectedTemplate)
  }

  const selectedTemplateData = getSelectedTemplate()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Assign Shift
          </DialogTitle>
          <DialogDescription>
            Assign a shift to {employee?.first_name} {employee?.last_name} on {formatDate(date)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Info */}
          {employee && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">
                  {employee.first_name} {employee.last_name}
                </div>
                <div className="text-sm text-gray-500">
                  {employee.employee_code} • {employee.department}
                </div>
              </div>
            </div>
          )}

          {/* Shift Type Selection */}
          <div className="space-y-2">
            <Label>Shift Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!useCustomShift ? "default" : "outline"}
                size="sm"
                onClick={() => setUseCustomShift(false)}
              >
                Use Template
              </Button>
              <Button
                type="button"
                variant={useCustomShift ? "default" : "outline"}
                size="sm"
                onClick={() => setUseCustomShift(true)}
              >
                Custom Shift
              </Button>
            </div>
          </div>

          {!useCustomShift ? (
            /* Template Selection */
            <div className="space-y-2">
              <Label>Select Shift Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a shift template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: template.color }}
                        />
                        <span>{template.name}</span>
                        <span className="text-gray-500">
                          ({template.start_time} - {template.end_time})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTemplateData && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: selectedTemplateData.color }}
                    />
                    <span className="font-medium">{selectedTemplateData.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {selectedTemplateData.start_time} - {selectedTemplateData.end_time}
                    </div>
                    <Badge variant="secondary">{selectedTemplateData.department}</Badge>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Custom Shift Fields */
            <div className="space-y-4">
              <div>
                <Label htmlFor="shiftName">Shift Name</Label>
                <Input
                  id="shiftName"
                  value={customShiftName}
                  onChange={(e) => setCustomShiftName(e.target.value)}
                  placeholder="e.g., Morning Shift"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes for this assignment..."
              rows={3}
            />
          </div>

          {/* Apply whole week */}
          <div className="flex items-center gap-2">
            <input
              id="apply-week"
              type="checkbox"
              checked={applyWholeWeek}
              onChange={(e) => setApplyWholeWeek(e.target.checked)}
            />
            <Label htmlFor="apply-week">Apply to whole week (Mon–Sun)</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Assigning...' : 'Assign Shift'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
