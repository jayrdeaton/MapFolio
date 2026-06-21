import L from 'leaflet'

import type { Pin, Route } from '@/types'

interface UseDrawingPreviewOptions {
  leafletMap: Ref<L.Map | null>
  isDrawingRoute: Ref<boolean>
  drawingAnchorIndex: Ref<number | null>
  drawingRoute: Ref<Route | null>
  routeSnapEnabled: Ref<boolean>
  angleSnapEnabled: Ref<boolean>
  pins: Ref<Pin[]>
  routes: Ref<Route[]>
  hiddenPinIds: Ref<Set<number>>
  hiddenRouteIds: Ref<Set<number>>
  linkedPinIds: Ref<Set<number>>
}

export function useDrawingPreview({ leafletMap, isDrawingRoute, drawingAnchorIndex, drawingRoute, routeSnapEnabled, angleSnapEnabled, pins, routes, hiddenPinIds, hiddenRouteIds, linkedPinIds }: UseDrawingPreviewOptions) {
  const pointerCoords = ref<{ lat: number; lng: number } | null>(null)
  const drawingPreviewLine = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  watch(leafletMap, (map, _, onCleanup) => {
    if (!map) return

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      pointerCoords.value = { lat: e.latlng.lat, lng: e.latlng.lng }
      const anchorIdx = drawingAnchorIndex.value
      const anchorPt = anchorIdx !== null ? drawingRoute.value?.points[anchorIdx] : undefined
      if (isDrawingRoute.value && anchorPt && map.dragging.enabled()) {
        const fromPx = map.latLngToContainerPoint([anchorPt.lat, anchorPt.lng])
        const toPxRaw = map.latLngToContainerPoint(e.latlng)
        const dx = toPxRaw.x - fromPx.x
        const dy = toPxRaw.y - fromPx.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        let x2 = toPxRaw.x
        let y2 = toPxRaw.y
        // Pin snap preview (magnet)
        if (routeSnapEnabled.value) {
          const SNAP_PX = 28
          for (const pin of pins.value) {
            if (hiddenPinIds.value.has(pin.id) || linkedPinIds.value.has(pin.id)) continue
            const pinPx = map.latLngToContainerPoint([pin.lat, pin.lng])
            if (Math.hypot(toPxRaw.x - pinPx.x, toPxRaw.y - pinPx.y) < SNAP_PX) {
              x2 = pinPx.x
              y2 = pinPx.y
              break
            }
          }
        }
        // Waypoint snap preview (skip if already pin-snapped)
        if (x2 === toPxRaw.x && y2 === toPxRaw.y && routeSnapEnabled.value) {
          const SNAP_PX = 28
          outer: for (const route of routes.value) {
            if (hiddenRouteIds.value.has(route.id)) continue
            for (const pt of route.points) {
              const ptPx = map.latLngToContainerPoint([pt.lat, pt.lng])
              if (Math.hypot(toPxRaw.x - ptPx.x, toPxRaw.y - ptPx.y) < SNAP_PX) {
                x2 = ptPx.x
                y2 = ptPx.y
                break outer
              }
            }
          }
        }
        // Angle snap (skip if already snapped); shift toggles the persistent setting
        if (x2 === toPxRaw.x && y2 === toPxRaw.y && angleSnapEnabled.value !== e.originalEvent.shiftKey && dist > 0) {
          const snappedAngle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12)
          x2 = fromPx.x + dist * Math.cos(snappedAngle)
          y2 = fromPx.y + dist * Math.sin(snappedAngle)
        }
        drawingPreviewLine.value = { x1: fromPx.x, y1: fromPx.y, x2, y2 }
      } else {
        drawingPreviewLine.value = null
      }
    }

    const onMouseOut = () => {
      pointerCoords.value = null
      drawingPreviewLine.value = null
    }

    map.on('mousemove', onMouseMove as L.LeafletEventHandlerFn)
    map.on('mouseout', onMouseOut)
    onCleanup(() => {
      map.off('mousemove', onMouseMove as L.LeafletEventHandlerFn)
      map.off('mouseout', onMouseOut)
    })
  })

  return { pointerCoords, drawingPreviewLine }
}
