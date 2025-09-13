"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { 
  Settings as SettingsIcon, 
  MapPin, 
  Bell, 
  Shield,
  User,
  Mail,
  Phone,
  Calendar,
  Save,
  RefreshCw
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"
import LocationFilter from "@/components/admin/LocationFilter"

interface ManagerSettings {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  role: string
  is_active: boolean
  location_id?: string
  location_name?: string
  hire_date?: string
  assigned_locations: Array<{
    id: string
    name: string
    description?: string
  }>
  notification_preferences: {
    email_notifications: boolean
    shift_reminders: boolean
    approval_notifications: boolean
    weekly_reports: boolean
  }
}

export default function ManagerSettings() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [settings, setSettings] = useState<ManagerSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [shiftReminders, setShiftReminders] = useState(true)
  const [approvalNotifications, setApprovalNotifications] = useState(true)
  const [weeklyReports, setWeeklyReports] = useState(true)

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'manager') {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    loadSettings()
  }, [router])

  const loadSettings = async () => {
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

      const response = await fetch('/api/manager/settings', {
        headers
      })

      if (!response.ok) {
        throw new Error('Failed to load settings')
      }

      const data = await response.json()
      setSettings(data.data)
      
      // Populate form fields
      if (data.data) {
        setFirstName(data.data.first_name || "")
        setLastName(data.data.last_name || "")
        setEmail(data.data.email || "")
        setPhone(data.data.phone || "")
        setEmailNotifications(data.data.notification_preferences?.email_notifications ?? true)
        setShiftReminders(data.data.notification_preferences?.shift_reminders ?? true)
        setApprovalNotifications(data.data.notification_preferences?.approval_notifications ?? true)
        setWeeklyReports(data.data.notification_preferences?.weekly_reports ?? true)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (currentUser?.id) {
        headers['authorization'] = `Bearer ${currentUser.id}`
      }
      if (currentUser?.tenant_id) {
        headers['x-tenant-id'] = currentUser.tenant_id
      }

      const response = await fetch('/api/manager/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          notification_preferences: {
            email_notifications: emailNotifications,
            shift_reminders: shiftReminders,
            approval_notifications: approvalNotifications,
            weekly_reports: weeklyReports
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      toast.success('Settings saved successfully')
      loadSettings() // Reload to get updated data
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-1">Manage your account and notification preferences</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <div className="space-y-8">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Locations */}
          {settings?.assigned_locations && settings.assigned_locations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Assigned Locations
                </CardTitle>
                <CardDescription>
                  Locations you have management access to
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {settings.assigned_locations.map((location) => (
                    <div key={location.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{location.name}</h4>
                        {location.description && (
                          <p className="text-sm text-gray-600">{location.description}</p>
                        )}
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose what notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                  <p className="text-sm text-gray-600">Receive notifications via email</p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="shiftReminders">Shift Reminders</Label>
                  <p className="text-sm text-gray-600">Get reminded about upcoming shifts</p>
                </div>
                <Switch
                  id="shiftReminders"
                  checked={shiftReminders}
                  onCheckedChange={setShiftReminders}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="approvalNotifications">Approval Notifications</Label>
                  <p className="text-sm text-gray-600">Get notified when approval is needed</p>
                </div>
                <Switch
                  id="approvalNotifications"
                  checked={approvalNotifications}
                  onCheckedChange={setApprovalNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="weeklyReports">Weekly Reports</Label>
                  <p className="text-sm text-gray-600">Receive weekly team performance reports</p>
                </div>
                <Switch
                  id="weeklyReports"
                  checked={weeklyReports}
                  onCheckedChange={setWeeklyReports}
                />
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                Read-only account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Employee Code</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {settings?.employee_code}
                    </span>
                  </div>
                </div>
                <div>
                  <Label>Role</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="h-4 w-4 text-gray-400" />
                    <Badge variant="default" className="bg-purple-100 text-purple-800">
                      Manager
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Hire Date</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {settings?.hire_date ? formatDate(settings.hire_date) : 'Not available'}
                    </span>
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={settings?.is_active ? 'default' : 'secondary'}>
                      {settings?.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
