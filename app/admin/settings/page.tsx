"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { AuthService } from '@/lib/auth'

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [allowManagerApprovals, setAllowManagerApprovals] = useState(false)
  const [payType, setPayType] = useState<'weekly'|'biweekly'|'custom'>('weekly' as any)
  const [weekStart, setWeekStart] = useState<number>(1)
  const [customDays, setCustomDays] = useState<number | ''>('' as any)

  const headers = () => {
    const user = AuthService.getCurrentUser()
    const h: Record<string,string> = { 'Content-Type': 'application/json' }
    if (user?.id) h['authorization'] = `Bearer ${user.id}`
    if (user?.tenant_id) h['x-tenant-id'] = user.tenant_id
    return h
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/settings/approvals', { headers: headers() })
        if (res.ok) {
          const data = await res.json()
          const d = data.data || {}
          setAllowManagerApprovals(!!d.allow_manager_approvals)
          setPayType((d.pay_period_type || 'weekly'))
          setWeekStart(Number(d.week_start_day || 1))
          setCustomDays(d.custom_period_days || '')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const save = async () => {
    setLoading(true)
    try {
      await fetch('/api/admin/settings/approvals', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          allow_manager_approvals: allowManagerApprovals,
          pay_period_type: payType,
          week_start_day: weekStart,
          custom_period_days: payType === 'custom' ? Number(customDays || 0) : null,
        })
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-2">Settings</h1>
        <p className="text-sm text-gray-600">Configure delegation and pay period settings.</p>
      </div>

      <div className="space-y-2 p-4 border rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Allow Managers to Approve Timesheets</div>
            <div className="text-xs text-gray-500">When enabled, managers can approve timesheets for employees in their assigned locations.</div>
          </div>
          <Switch checked={allowManagerApprovals} onCheckedChange={v => setAllowManagerApprovals(!!v)} />
        </div>
      </div>

      <div className="space-y-3 p-4 border rounded-md">
        <div className="font-medium">Pay Period</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Cadence</div>
            <Select value={payType} onValueChange={(v:any)=>setPayType(v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Week Start</div>
            <Select value={String(weekStart)} onValueChange={(v:any)=>setWeekStart(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {payType === 'custom' && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Custom Period (days)</div>
              <Input type="number" min={1} value={customDays as any} onChange={e=>setCustomDays(e.target.value ? Number(e.target.value) : '')} />
            </div>
          )}
        </div>
      </div>

      <div>
        <Button disabled={loading} onClick={save}>Save</Button>
      </div>
    </div>
  )
}


