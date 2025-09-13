"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Lock, Building2, Users, Shield, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"

export default function UnifiedLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const user = await AuthService.unifiedLogin(email, password)
      if (user) {
        // Route to appropriate dashboard based on role
        switch (user.role) {
          case 'admin':
            router.push("/admin/dashboard")
            break
          case 'manager':
            router.push("/manager/dashboard")
            break
          case 'project_manager':
            router.push("/project-manager/dashboard")
            break
          case 'team_lead':
            router.push("/team-lead/dashboard")
            break
          case 'employee':
            router.push("/employee/dashboard")
            break
          default:
            router.push("/employee/dashboard")
        }
        toast.success(`Welcome back! Redirecting to your dashboard...`)
      } else {
        toast.error("Invalid credentials. Please try again.")
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Building2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">RotaClock</h1>
          </div>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Enter your email and password to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>Email Address</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center space-x-2">
                  <Lock className="h-4 w-4" />
                  <span>Password</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" 
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Forgot your password?{" "}
                <a href="#" className="text-blue-600 hover:underline font-medium">
                  Contact your administrator
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Role Information */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <Shield className="h-6 w-6 text-purple-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Administrators</p>
            <p className="text-xs text-gray-500">System management</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Project Managers</p>
            <p className="text-xs text-gray-500">Project oversight</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <Users className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Team Leads</p>
            <p className="text-xs text-gray-500">Team supervision</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <Clock className="h-6 w-6 text-orange-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Employees</p>
            <p className="text-xs text-gray-500">Time tracking</p>
          </div>
        </div>

        {/* Demo Info hidden in production */}
        {process.env.NEXT_PUBLIC_SHOW_DEMO_INFO === 'true' && (
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">Demo Credentials</p>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>All Users:</strong> <code className="bg-blue-100 px-1 rounded">password123</code></p>
              <p><strong>Admin:</strong> <code className="bg-blue-100 px-1 rounded">admin@rotaclock.com</code></p>
              <p><strong>Employee:</strong> <code className="bg-blue-100 px-1 rounded">john.smith@rotaclock.com</code></p>
              <p><strong>Team Lead:</strong> <code className="bg-blue-100 px-1 rounded">david.wilson@rotaclock.com</code></p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
