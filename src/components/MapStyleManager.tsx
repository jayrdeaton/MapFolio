import { useEffect } from 'react'

import { MapOptionsState } from './MapOptions'

interface MapStyleManagerProps {
  mapOptions: MapOptionsState
}

function MapStyleManager({ mapOptions }: MapStyleManagerProps) {
  useEffect(() => {
    const styleId = 'map-options-style'
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null

    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }

    let css = ''

    if (!mapOptions.showLabels) {
      css += `
        .leaflet-container .leaflet-marker-pane,
        .leaflet-container .leaflet-popup-pane {
          display: none !important;
        }
      `
    }

    const filters: string[] = []

    if (!mapOptions.showWater) {
      filters.push('sepia(0.3) saturate(0.5)')
    }

    if (!mapOptions.showParks) {
      filters.push('hue-rotate(10deg)')
    }

    if (filters.length > 0) {
      css += `
        .leaflet-tile-pane {
          filter: ${filters.join(' ')} !important;
        }
      `
    }

    styleEl.textContent = css

    return () => {
      if (styleEl?.parentNode) {
        styleEl.parentNode.removeChild(styleEl)
      }
    }
  }, [mapOptions])

  return null
}

export default MapStyleManager
