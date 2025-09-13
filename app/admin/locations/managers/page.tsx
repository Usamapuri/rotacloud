"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { AuthService } from "@/lib/auth"
import { toast } from "sonner"

interface Option { id: string; name: string }
interface Row { id: string; manager_id: string; manager_name: string; location_id: string; location_name: string }

export default function ManagerLocationsAdmin() {
  const [managers, setManagers] = useState<Option[]>([])
  const [locations, setLocations] = useState<Option[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [selectedManager, setSelectedManager] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")

  const headers = () => {
    const user = AuthService.getCurrentUser()
    const h: Record<string,string> = { 'Content-Type': 'application/json' }
    if (user?.id) h['authorization'] = `Bearer ${user.id}`
    if (user?.tenant_id) h['x-tenant-id'] = user.tenant_id
    return h
  }

  const load = async () => {
    const [locRes, mgrRes, mapRes] = await Promise.all([
      fetch('/api/locations', { headers: headers() }),
      fetch('/api/admin/employees?role=manager', { headers: headers() }),
      fetch('/api/manager-locations', { headers: headers() }),
    ])
    if (locRes.ok) {
      const data = await locRes.json(); setLocations((data.data||[]).map((l:any)=>({id:l.id,name:l.name})))
    }
    if (mgrRes.ok) {
      const data = await mgrRes.json(); setManagers((data.data||[]).map((e:any)=>({id:e.id,name:`${e.first_name} ${e.last_name}`})))
    }
    if (mapRes.ok) {
      const data = await mapRes.json(); setRows(data.data||[])
    }
  }

  const add = async () => {
    if (!selectedManager || !selectedLocation) return
    const res = await fetch('/api/manager-locations', { method:'POST', headers: headers(), body: JSON.stringify({ manager_id: selectedManager, location_id: selectedLocation }) })
    if (res.ok) { toast.success('Assigned'); setSelectedLocation(""); setSelectedManager(""); load() } else { toast.error('Failed') }
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/manager-locations?id=${id}`, { method:'DELETE', headers: headers() })
    if (res.ok) { toast.success('Removed'); load() } else { toast.error('Failed') }
  }

  useEffect(()=>{ load() }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assign Managers to Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Select value={selectedManager} onValueChange={setSelectedManager}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                {managers.map(m => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>
                {locations.map(l => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={add}>Assign</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manager</TableHead>
                <TableHead>Location</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.manager_name}</TableCell>
                  <TableCell>{r.location_name}</TableCell>
                  <TableCell><Button variant="outline" onClick={()=>remove(r.id)}>Remove</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}


