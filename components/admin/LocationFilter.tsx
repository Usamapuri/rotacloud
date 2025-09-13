"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, MapPin } from "lucide-react"
import { useLocationFilter } from "@/lib/hooks/use-location-filter"
import { cn } from "@/lib/utils"

interface LocationFilterProps {
  selectedLocationId?: string | null
  onLocationChange?: (locationId: string | null) => void
  showAllOption?: boolean
  showRefresh?: boolean
  className?: string
  placeholder?: string
}

export default function LocationFilter({
  selectedLocationId,
  onLocationChange,
  showAllOption = true,
  showRefresh = true,
  className,
  placeholder = "Select location..."
}: LocationFilterProps) {
  const {
    locations,
    selectedLocationId: contextSelectedId,
    setSelectedLocationId: setContextSelectedId,
    isLoading,
    error,
    refreshLocations,
    getAllLocationsOption
  } = useLocationFilter()

  // Use prop value if provided, otherwise use context value
  const currentSelection = selectedLocationId !== undefined ? selectedLocationId : contextSelectedId

  const handleLocationChange = (value: string) => {
    const newLocationId = value === 'all' ? null : value
    
    if (onLocationChange) {
      onLocationChange(newLocationId)
    } else {
      setContextSelectedId(newLocationId)
    }
  }

  const handleRefresh = async () => {
    await refreshLocations()
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge variant="destructive" className="text-xs">
          Error loading locations
        </Badge>
        {showRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-gray-500" />
        <Select
          value={currentSelection || 'all'}
          onValueChange={handleLocationChange}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {showAllOption && (
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <span>All Locations</span>
                  <Badge variant="secondary" className="text-xs">
                    {locations.length}
                  </Badge>
                </div>
              </SelectItem>
            )}
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                <div className="flex items-center gap-2">
                  <span>{location.name}</span>
                  {!location.is_active && (
                    <Badge variant="outline" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          title="Refresh locations"
        >
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
        </Button>
      )}

      {/* Show current selection info */}
      {currentSelection && currentSelection !== 'all' && (
        <Badge variant="outline" className="text-xs">
          {locations.find(l => l.id === currentSelection)?.name || 'Unknown'}
        </Badge>
      )}
    </div>
  )
}
