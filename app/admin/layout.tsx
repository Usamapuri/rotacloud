"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { AuthService } from "@/lib/auth"
import { DashboardShell } from "@/components/layouts/DashboardShell"
import { ReactNode } from "react"
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  Clock,
  MapPin,
  Settings as SettingsIcon,
  HelpCircle,
  CheckCircle,
} from "lucide-react"

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [role, setRole] = useState<'admin' | 'manager' | 'employee' | null>(null)
  const [isImpersonating, setIsImpersonating] = useState(false)

  useEffect(() => {
    const user = AuthService.getCurrentUser()
    setRole(user?.role ?? null)
    setIsImpersonating(AuthService.isImpersonating())
  }, [])

  const links = useMemo(() => {
    const base = [
      { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
      { href: "/admin/scheduling", label: "Rota", icon: <Calendar /> },
      { href: "/admin/employees", label: "Employees", icon: <Users /> },
      { href: "/admin/timesheet", label: "Timesheets", icon: <Clock /> },
      { href: "/admin/shift-approvals", label: "Approvals", icon: <CheckCircle /> },
      { href: "/admin/reports", label: "Reports", icon: <BarChart3 /> },
      { href: "/admin/leave", label: "Leave", icon: <Calendar /> },
      { href: "/admin/locations", label: "Locations", icon: <MapPin /> },
      { href: "/admin/settings", label: "Settings", icon: <SettingsIcon /> },
      { href: "/admin/help", label: "Help / Support", icon: <HelpCircle /> },
    ]
    return base
  }, [role])

  const crumbs = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean)
    const items: { name: string; href?: string }[] = []
    let acc = ''
    for (let i = 0; i < parts.length; i++) {
      acc += '/' + parts[i]
      items.push({ name: decodeURIComponent(parts[i]), href: i < parts.length - 1 ? acc : undefined })
    }
    return items
  }, [pathname])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Hide chrome (sidebar/breadcrumb) on auth page
  const isAuthPage = pathname === '/login'
  if (isAuthPage) {
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <DashboardShell headerLabel="Admin" links={links.map(l => ({ href: l.href, label: l.label, icon: l.icon }))}>
      {children}
    </DashboardShell>
  )
}
