"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { 
  HelpCircle, 
  Search, 
  BookOpen, 
  MessageSquare, 
  Phone, 
  Mail,
  Video,
  Download,
  ExternalLink,
  ChevronRight,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  BarChart3
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  tags: string[]
}

interface HelpArticle {
  id: string
  title: string
  content: string
  category: string
  lastUpdated: string
  readTime: string
}

export default function ManagerHelp() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isLoading, setIsLoading] = useState(false)

  const [faqs] = useState<FAQ[]>([
    {
      id: "1",
      question: "How do I approve timesheets for my team?",
      answer: "Go to the Approvals page and click on the 'Timesheets' tab. Review each timesheet entry and click 'Approve' or 'Reject' with your notes. You can also adjust hours and rates if needed.",
      category: "Approvals",
      tags: ["timesheets", "approvals", "team management"]
    },
    {
      id: "2", 
      question: "Can I manage shifts for multiple locations?",
      answer: "Yes! You can manage shifts for all locations assigned to you. Use the location filter to switch between different locations and manage their respective rotas.",
      category: "Scheduling",
      tags: ["shifts", "locations", "rota management"]
    },
    {
      id: "3",
      question: "How do I view team performance reports?",
      answer: "Navigate to the Reports page to see detailed analytics for your team. You can filter by location, date range, and view attendance trends, hours worked, and performance metrics.",
      category: "Reports",
      tags: ["reports", "analytics", "team performance"]
    },
    {
      id: "4",
      question: "What's the difference between manager and admin roles?",
      answer: "Managers have location-scoped access to their assigned teams, while admins have organization-wide access. Managers can approve timesheets, manage shifts, and view reports for their locations only.",
      category: "Roles",
      tags: ["roles", "permissions", "access control"]
    },
    {
      id: "5",
      question: "How do I get notified about pending approvals?",
      answer: "Check your notification preferences in Settings. You can enable email notifications, shift reminders, approval notifications, and weekly reports.",
      category: "Notifications",
      tags: ["notifications", "settings", "alerts"]
    },
    {
      id: "6",
      question: "Can I export team data and reports?",
      answer: "Yes! Most reports and data tables have export functionality. Look for the 'Export' button in the top-right corner of reports and data views.",
      category: "Data Export",
      tags: ["export", "data", "reports"]
    }
  ])

  const [helpArticles] = useState<HelpArticle[]>([
    {
      id: "1",
      title: "Getting Started as a Manager",
      content: "Learn the basics of managing your team with location-scoped access...",
      category: "Getting Started",
      lastUpdated: "2024-01-15",
      readTime: "5 min"
    },
    {
      id: "2",
      title: "Managing Team Approvals",
      content: "Complete guide to approving timesheets, shift swaps, and leave requests...",
      category: "Approvals",
      lastUpdated: "2024-01-10",
      readTime: "8 min"
    },
    {
      id: "3",
      title: "Understanding Location-Based Access",
      content: "How location assignments work and what data you can access...",
      category: "Access Control",
      lastUpdated: "2024-01-08",
      readTime: "6 min"
    },
    {
      id: "4",
      title: "Team Performance Analytics",
      content: "Making the most of your team reports and analytics dashboard...",
      category: "Reports",
      lastUpdated: "2024-01-05",
      readTime: "10 min"
    }
  ])

  const categories = [
    { id: "all", name: "All Topics", icon: <BookOpen className="h-4 w-4" /> },
    { id: "Approvals", name: "Approvals", icon: <CheckCircle className="h-4 w-4" /> },
    { id: "Scheduling", name: "Scheduling", icon: <Calendar className="h-4 w-4" /> },
    { id: "Reports", name: "Reports", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "Team Management", name: "Team Management", icon: <Users className="h-4 w-4" /> },
    { id: "Notifications", name: "Notifications", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "Roles", name: "Roles & Permissions", icon: <HelpCircle className="h-4 w-4" /> },
    { id: "Data Export", name: "Data Export", icon: <Download className="h-4 w-4" /> }
  ]

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    if (!user || user.role !== 'manager') {
      router.push('/login')
      return
    }
    setCurrentUser(user)
  }, [router])

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = searchTerm === "" || 
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = selectedCategory === "all" || faq.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const filteredArticles = helpArticles.filter(article => {
    const matchesSearch = searchTerm === "" || 
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = selectedCategory === "all" || article.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const handleContactSupport = () => {
    toast.info('Contact support functionality coming soon')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <HelpCircle className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Help & Support</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Find answers to common questions and learn how to make the most of your manager dashboard
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              placeholder="Search help articles, FAQs, or topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="flex items-center gap-2"
              >
                {category.icon}
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* FAQs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Frequently Asked Questions
                  <Badge variant="secondary">{filteredFAQs.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Quick answers to the most common questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {filteredFAQs.length > 0 ? (
                  filteredFAQs.map((faq) => (
                    <div key={faq.id} className="border-b pb-6 last:border-b-0">
                      <h3 className="font-semibold text-gray-900 mb-2">{faq.question}</h3>
                      <p className="text-gray-600 mb-3">{faq.answer}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{faq.category}</Badge>
                        <div className="flex gap-1">
                          {faq.tags.map((tag, index) => (
                            <span key={index} className="text-xs text-gray-500">#{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No FAQs found</h3>
                    <p className="text-gray-600">Try adjusting your search or category filter.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Help Articles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Help Articles
                  <Badge variant="secondary">{filteredArticles.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Detailed guides and tutorials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredArticles.length > 0 ? (
                  filteredArticles.map((article) => (
                    <div key={article.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">{article.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{article.content}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{article.category}</span>
                          <span>Updated {new Date(article.lastUpdated).toLocaleDateString()}</span>
                          <span>{article.readTime} read</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
                    <p className="text-gray-600">Try adjusting your search or category filter.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/manager/approvals')}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Pending Approvals
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/manager/timesheets')}>
                  <Clock className="h-4 w-4 mr-2" />
                  Team Timesheets
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/manager/reports')}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Team Reports
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/manager/settings')}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </CardContent>
            </Card>

            {/* Contact Support */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Contact Support
                </CardTitle>
                <CardDescription>
                  Can't find what you're looking for?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleContactSupport} className="w-full">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button variant="outline" onClick={handleContactSupport} className="w-full">
                  <Phone className="h-4 w-4 mr-2" />
                  Call Support
                </Button>
                <Button variant="outline" onClick={handleContactSupport} className="w-full">
                  <Video className="h-4 w-4 mr-2" />
                  Schedule Call
                </Button>
              </CardContent>
            </Card>

            {/* Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" onClick={handleContactSupport}>
                  <Download className="h-4 w-4 mr-2" />
                  User Manual (PDF)
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleContactSupport}>
                  <Video className="h-4 w-4 mr-2" />
                  Video Tutorials
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleContactSupport}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  API Documentation
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
