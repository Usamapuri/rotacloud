"use client"

import { useState, useEffect, useCallback } from 'react'
import { AuthService } from '@/lib/auth'

interface Location {
  id: string
  name: string
  description?: string
  is_active: boolean
}

interface UseLocationFilterReturn {
  locations: Location[]
  selectedLocationId: string | null
  setSelectedLocationId: (locationId: string | null) => void
  isLoading: boolean
  error: string | null
  refreshLocations: () => Promise<void>
  // Helper functions
  getSelectedLocation: () => Location | null
  getAllLocationsOption: () => Location
}

export function useLocationFilter(): UseLocationFilterReturn {
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const headers = useCallback(() => {
    const user = AuthService.getCurrentUser()
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (user?.id) h['authorization'] = `Bearer ${user.id}`
    if (user?.tenant_id) h['x-tenant-id'] = user.tenant_id
    return h
  }, [])

  const loadLocations = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/locations', { headers: headers() })
      
      if (!res.ok) {
        throw new Error('Failed to load locations')
      }
      
      const data = await res.json()
      setLocations(data.data || [])
    } catch (err) {
      console.error('Error loading locations:', err)
      setError(err instanceof Error ? err.message : 'Failed to load locations')
    } finally {
      setIsLoading(false)
    }
  }, [headers])

  const refreshLocations = useCallback(async () => {
    await loadLocations()
  }, [loadLocations])

  // Load locations on mount
  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  // Helper functions
  const getSelectedLocation = useCallback((): Location | null => {
    if (!selectedLocationId) return null
    return locations.find(loc => loc.id === selectedLocationId) || null
  }, [selectedLocationId, locations])

  const getAllLocationsOption = useCallback((): Location => {
    return {
      id: 'all',
      name: 'All Locations',
      description: 'View all locations',
      is_active: true
    }
  }, [])

  return {
    locations,
    selectedLocationId,
    setSelectedLocationId,
    isLoading,
    error,
    refreshLocations,
    getSelectedLocation,
    getAllLocationsOption
  }
}
