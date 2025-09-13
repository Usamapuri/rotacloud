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
import { Clock, User, Calendar, Trash2, AlertTriangle } from 'lucide-react'
import { AuthService } from '@/lib/auth'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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

interface ShiftAssignment {
  id: string
  employee_id: string
  template_id?: string
  date: string
  status: string
  notes?: string
  rota_id?: string
  is_published: boolean
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
  // Related data
  employee_first_name?: string
  employee_last_name?: string
  rota_name?: string
  rota_status?: string
}

interface ShiftEditModalProps {
  isOpen: boolean
  onClose: () => void
  assignment: ShiftAssignment | null
  employee: Employee | null
  templates: ShiftTemplate[]
  onAssignmentUpdated: () => void
  onAssignmentDeleted: (assignmentId: string) => void
}

export default function ShiftEditModal({
  isOpen,
  onClose,
  assignment,
  employee,
  templates,
  onAssignmentUpdated,
  onAssignmentDeleted
}: ShiftEditModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [customStartTime, setCustomStartTime] = useState('')
  const [customEndTime, setCustomEndTime] = useState('')
  const [customShiftName, setCustomShiftName] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('assigned')
  const [isLoading, setIsLoading] = useState(false)
  const [useCustomShift, setUseCustomShift] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isEmergencyMode, setIsEmergencyMode] = useState(false)

  // Populate form when assignment changes
  useEffect(() => {
    if (isOpen && assignment) {
      // Determine if this is a custom shift or template-based
      const isCustom = assignment.override_name || (!assignment.template_id && assignment.template_name)
      setUseCustomShift(isCustom)

      if (isCustom) {
        // Custom shift
        setSelectedTemplate('')
        setCustomShiftName(assignment.override_name || assignment.template_name || '')
        setCustomStartTime(assignment.override_start_time || assignment.start_time || '')
        setCustomEndTime(assignment.override_end_time || assignment.end_time || '')
      } else {
        // Template-based shift
        setSelectedTemplate(assignment.template_id || '')
        setCustomShiftName('')
        setCustomStartTime('')
        setCustomEndTime('')
      }

      setNotes(assignment.notes || '')
      setStatus(assignment.status || 'assigned')
    } else if (isOpen) {
      // Reset form for new assignment
      setSelectedTemplate('')
      setCustomStartTime('')
      setCustomEndTime('')
      setCustomShiftName('')
      setNotes('')
      setStatus('assigned')
      setUseCustomShift(false)
    }
  }, [isOpen, assignment])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!assignment) return

    setIsLoading(true)

    try {
      // Validate inputs
      if (!useCustomShift && !selectedTemplate) {
        toast.error('Please select a shift template or choose Custom Shift')
        setIsLoading(false)
        return
      }
      if (useCustomShift && (!customShiftName || !customStartTime || !customEndTime)) {
        toast.error('Please fill in all custom shift fields')
        setIsLoading(false)
        return
      }

      const user = AuthService.getCurrentUser()
      const updateData: any = {
        id: assignment.id,
        status: status,
        notes: notes,
        emergency_mode: isEmergencyMode
      }

      if (useCustomShift) {
        // Custom shift - use override fields
        updateData.template_id = null
        updateData.override_name = customShiftName
        updateData.override_start_time = customStartTime
        updateData.override_end_time = customEndTime
        updateData.override_color = '#3B82F6'
      } else {
        // Template-based shift - clear override fields
        updateData.template_id = selectedTemplate
        updateData.override_name = null
        updateData.override_start_time = null
        updateData.override_end_time = null
        updateData.override_color = null
      }

      const res = await fetch('/api/scheduling/assign', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { authorization: `Bearer ${user.id}` } : {}),
        },
        body: JSON.stringify(updateData)
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update shift')
      }

      const response = await res.json()
      
      if (response.notificationSent) {
        if (response.emergencyMode) {
          toast.success('URGENT: Shift updated successfully. Employee has been notified of the emergency changes.')
        } else {
          toast.success('Shift updated successfully. Employee has been notified of the changes.')
        }
      } else {
        toast.success('Shift updated successfully')
      }
      
      onAssignmentUpdated()
      onClose()
    } catch (error) {
      console.error('Error updating assignment:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update assignment')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!assignment) return

    setIsLoading(true)

    try {
      const user = AuthService.getCurrentUser()
      const res = await fetch(`/api/scheduling/assign?id=${assignment.id}`, {
        method: 'DELETE',
        headers: {
          ...(user?.id ? { authorization: `Bearer ${user.id}` } : {}),
        }
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete shift')
      }

      toast.success('Shift deleted successfully')
      onAssignmentDeleted(assignment.id)
      setShowDeleteDialog(false)
      onClose()
    } catch (error) {
      console.error('Error deleting assignment:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete assignment')
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
  const isPublishedRota = assignment?.is_published || assignment?.rota_status === 'published'

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Edit Shift Assignment
            </DialogTitle>
            <DialogDescription>
              {assignment && employee ? (
                <>
                  Editing shift for {employee.first_name} {employee.last_name} on {formatDate(assignment.date)}
                  {assignment.rota_name && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={assignment.rota_status === 'published' ? 'default' : 'secondary'}>
                        Rota: {assignment.rota_name} ({assignment.rota_status})
                      </Badge>
                      {isPublishedRota && (
                        <Badge variant="outline" className="text-orange-600 border-orange-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Published
                        </Badge>
                      )}
                    </div>
                  )}
                </>
              ) : (
                'Loading shift details...'
              )}
            </DialogDescription>
          </DialogHeader>

          {assignment && employee && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Employee Info */}
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

              {/* Warning for published rotas */}
              {isPublishedRota && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Published Rota Warning</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEmergencyMode(!isEmergencyMode)}
                      className={`text-xs ${isEmergencyMode ? 'bg-red-50 border-red-200 text-red-700' : 'border-orange-200 text-orange-700'}`}
                    >
                      {isEmergencyMode ? 'Exit Emergency' : 'Emergency Edit'}
                    </Button>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">
                    This shift is part of a published rota. Changes will be visible to the employee immediately.
                  </p>
                  {isEmergencyMode && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Emergency Mode Active</span>
                      </div>
                      <p className="mt-1">This mode allows quick changes for urgent situations. Employee will be automatically notified.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Current Shift Details */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-800 mb-2">Current Shift</div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: assignment.override_color || assignment.color || '#3B82F6' }}
                    />
                    <span className="font-medium">
                      {assignment.override_name || assignment.template_name || 'Unknown Shift'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {(assignment.override_start_time || assignment.start_time)} - {(assignment.override_end_time || assignment.end_time)}
                  </div>
                  <Badge variant="outline">{assignment.status}</Badge>
                </div>
              </div>

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

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

              <DialogFooter className="flex justify-between">
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => setShowDeleteDialog(true)}
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Shift
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Updating...' : 'Update Shift'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shift assignment? This action cannot be undone.
              {isPublishedRota && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-orange-800 text-sm">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  This shift is part of a published rota and the employee will be notified of the change.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete Shift'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}