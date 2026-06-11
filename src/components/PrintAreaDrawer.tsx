import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'

interface PrintAreaDrawerProps {
  isDrawing: boolean
  printBounds: L.LatLngBounds | null
  onBoundsSet: (bounds: L.LatLngBounds) => void
}

function PrintAreaDrawer({ isDrawing, printBounds, onBoundsSet }: PrintAreaDrawerProps) {
  const map = useMap()
  const drawingRef = useRef(false)
  const startLatLngRef = useRef<L.LatLng | null>(null)
  const activeRectRef = useRef<L.Rectangle | null>(null)
  const displayRectRef = useRef<L.Rectangle | null>(null)

  // Cursor style
  useEffect(() => {
    map.getContainer().style.cursor = isDrawing ? 'crosshair' : ''
  }, [isDrawing, map])

  // Clean up drawing state when draw mode is cancelled
  useEffect(() => {
    if (!isDrawing) {
      if (drawingRef.current) {
        map.dragging.enable()
        drawingRef.current = false
        startLatLngRef.current = null
      }
      if (activeRectRef.current) {
        map.removeLayer(activeRectRef.current)
        activeRectRef.current = null
      }
    }
  }, [isDrawing, map])

  // Show/update the persistent selection rectangle
  useEffect(() => {
    if (displayRectRef.current) {
      map.removeLayer(displayRectRef.current)
      displayRectRef.current = null
    }
    if (printBounds && !isDrawing) {
      displayRectRef.current = L.rectangle(printBounds, {
        color: '#3b82f6',
        weight: 2,
        fillOpacity: 0.06,
        dashArray: '6,4'
      }).addTo(map)
    }
    return () => {
      if (displayRectRef.current) {
        map.removeLayer(displayRectRef.current)
        displayRectRef.current = null
      }
    }
  }, [printBounds, isDrawing, map])

  // Global mouseup so the draw completes even if mouse leaves the map
  useEffect(() => {
    if (!isDrawing) return

    const handleMouseUp = () => {
      if (!drawingRef.current || !startLatLngRef.current) return
      map.dragging.enable()
      drawingRef.current = false
      const bounds = activeRectRef.current?.getBounds()
      startLatLngRef.current = null
      if (activeRectRef.current) {
        map.removeLayer(activeRectRef.current)
        activeRectRef.current = null
      }
      if (bounds?.isValid()) {
        const sw = bounds.getSouthWest()
        const ne = bounds.getNorthEast()
        // Reject single-point clicks (no meaningful area)
        if (Math.abs(sw.lat - ne.lat) > 0.0001 || Math.abs(sw.lng - ne.lng) > 0.0001) {
          onBoundsSet(bounds)
        }
      }
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [isDrawing, map, onBoundsSet])

  useMapEvents({
    mousedown: (e) => {
      if (!isDrawing) return
      map.dragging.disable()
      drawingRef.current = true
      startLatLngRef.current = e.latlng
      if (activeRectRef.current) map.removeLayer(activeRectRef.current)
      activeRectRef.current = L.rectangle(L.latLngBounds(e.latlng, e.latlng), {
        color: '#3b82f6',
        weight: 2,
        fillOpacity: 0.12,
        dashArray: '6,4'
      }).addTo(map)
    },
    mousemove: (e) => {
      if (!drawingRef.current || !startLatLngRef.current || !activeRectRef.current) return
      activeRectRef.current.setBounds(L.latLngBounds(startLatLngRef.current, e.latlng))
    }
  })

  return null
}

export default PrintAreaDrawer
