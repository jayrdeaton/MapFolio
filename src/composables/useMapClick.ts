import L from 'leaflet'
import type { ComputedRef, Ref, ShallowRef } from 'vue'

import type { Pin, Route } from '@/types'

interface UseMapClickOptions {
  leafletMap: ShallowRef<L.Map | null>
  isPlacingPin: Ref<boolean>
  isPlacingCaption: Ref<boolean>
  isDrawingRoute: Ref<boolean>
  isAdjustingPrintArea: Ref<boolean>
  routeSnapEnabled: Ref<boolean>
  angleSnapEnabled: Ref<boolean>
  pins: Ref<Pin[]>
  hiddenPinIds: Ref<Set<number>>
  routes: Ref<Route[]>
  hiddenRouteIds: Ref<Set<number>>
  linkedPinIds: ComputedRef<Set<number>>
  drawingAnchorIndex: Ref<number | null>
  drawingRoute: Ref<Route | null>
  handlePinPlace: (latlng: L.LatLng) => void
  placeCaptionDrop: (lat: number, lng: number) => void
  addPoint: (lat: number, lng: number, pinId?: number) => void
  clearSelection: () => void
}

export function useMapClick({ leafletMap, isPlacingPin, isPlacingCaption, isDrawingRoute, isAdjustingPrintArea, routeSnapEnabled, angleSnapEnabled, pins, hiddenPinIds, routes, hiddenRouteIds, linkedPinIds, drawingAnchorIndex, drawingRoute, handlePinPlace, placeCaptionDrop, addPoint, clearSelection }: UseMapClickOptions) {
  function handleMapClick(e: L.LeafletMouseEvent) {
    if (e.originalEvent.metaKey || e.originalEvent.ctrlKey) return
    if (isPlacingPin.value) {
      handlePinPlace(e.latlng)
    } else if (isPlacingCaption.value) {
      placeCaptionDrop(e.latlng.lat, e.latlng.lng)
    } else if (isDrawingRoute.value) {
      let { lat, lng } = e.latlng
      const map = leafletMap.value!
      const shiftHeld = e.originalEvent.shiftKey
      let snappedPinId: number | undefined

      // Pin snap: nearest visible, unlinked pin within threshold
      if (routeSnapEnabled.value) {
        const SNAP_PX = 28
        const toPx = map.latLngToContainerPoint([lat, lng])
        for (const pin of pins.value) {
          if (hiddenPinIds.value.has(pin.id) || linkedPinIds.value.has(pin.id)) continue
          const pinPx = map.latLngToContainerPoint([pin.lat, pin.lng])
          if (Math.hypot(toPx.x - pinPx.x, toPx.y - pinPx.y) < SNAP_PX) {
            lat = pin.lat
            lng = pin.lng
            snappedPinId = pin.id
            break
          }
        }
      }

      // Waypoint snap (skip if already pin-snapped)
      if (!snappedPinId && routeSnapEnabled.value) {
        const SNAP_PX = 28
        const toPx = map.latLngToContainerPoint([lat, lng])
        outer: for (const route of routes.value) {
          if (hiddenRouteIds.value.has(route.id)) continue
          for (const pt of route.points) {
            const ptPx = map.latLngToContainerPoint([pt.lat, pt.lng])
            if (Math.hypot(toPx.x - ptPx.x, toPx.y - ptPx.y) < SNAP_PX) {
              lat = pt.lat
              lng = pt.lng
              break outer
            }
          }
        }
      }

      // Angle snap (skip when already snapped); shift toggles the persistent setting
      if (!snappedPinId && angleSnapEnabled.value !== shiftHeld) {
        const snapAnchorIdx = drawingAnchorIndex.value
        const lastPt = snapAnchorIdx !== null ? drawingRoute.value?.points[snapAnchorIdx] : undefined
        if (lastPt) {
          const fromPx = map.latLngToContainerPoint([lastPt.lat, lastPt.lng])
          const toPx = map.latLngToContainerPoint([lat, lng])
          const dx = toPx.x - fromPx.x
          const dy = toPx.y - fromPx.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const snappedAngle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12)
          const snappedLatLng = map.containerPointToLatLng(L.point(fromPx.x + dist * Math.cos(snappedAngle), fromPx.y + dist * Math.sin(snappedAngle)))
          lat = snappedLatLng.lat
          lng = snappedLatLng.lng
        }
      }

      addPoint(lat, lng, snappedPinId)
    } else if (isAdjustingPrintArea.value) {
      isAdjustingPrintArea.value = false
    } else {
      clearSelection()
    }
  }

  return { handleMapClick }
}
