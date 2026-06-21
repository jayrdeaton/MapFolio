import type { Route } from '@/types'

interface UseRouteHelpersOptions {
  routes: Ref<Route[]>
  hiddenRouteIds: Ref<Set<number>>
  routeSnapEnabled: Ref<boolean>
  leafletMap: Ref<import('leaflet').Map | null>
  history: { push: (label?: string) => void }
  stopPlacing: () => void
  continueDrawing: (routeId: number, insertAfter: number | null) => void
  linkWaypoint: (routeId: number, pointIndex: number, pinId: number) => void
  handlePinMove: (id: number, lat: number, lng: number) => void
  movePoint: (routeId: number, pointIndex: number, lat: number, lng: number, pinId?: number) => void
  moveRoute: (routeId: number, points: Array<{ lat: number; lng: number }>) => void
}

export function useRouteHelpers({ routes, hiddenRouteIds, routeSnapEnabled, leafletMap, history, stopPlacing, continueDrawing, linkWaypoint, handlePinMove, movePoint, moveRoute }: UseRouteHelpersOptions) {
  function handleExtendFrom(routeId: number, pointIndex: number) {
    const route = routes.value.find((r) => r.id === routeId)
    if (!route) return
    const n = route.points.length
    const insertAfter = pointIndex === 0 ? -1 : pointIndex === n - 1 ? null : pointIndex
    stopPlacing()
    continueDrawing(routeId, insertAfter)
  }

  function findWaypointSnapForPin(lat: number, lng: number): { lat: number; lng: number } | null {
    if (!routeSnapEnabled.value || !leafletMap.value) return null
    const map = leafletMap.value
    const SNAP_PX = 28
    const rawPx = map.latLngToContainerPoint([lat, lng])
    for (const route of routes.value) {
      if (hiddenRouteIds.value.has(route.id)) continue
      for (let i = 0; i < route.points.length; i++) {
        const pt = route.points[i]!
        if (pt.pinId !== undefined) continue
        const ptPx = map.latLngToContainerPoint([pt.lat, pt.lng])
        if (Math.hypot(rawPx.x - ptPx.x, rawPx.y - ptPx.y) < SNAP_PX) {
          return { lat: pt.lat, lng: pt.lng }
        }
      }
    }
    return null
  }

  function handlePinMoveWithSnap(id: number, rawLat: number, rawLng: number) {
    let lat = rawLat
    let lng = rawLng
    let snapRouteId: number | undefined
    let snapPointIndex: number | undefined

    if (routeSnapEnabled.value && leafletMap.value) {
      const map = leafletMap.value
      const SNAP_PX = 28
      const rawPx = map.latLngToContainerPoint([rawLat, rawLng])
      outer: for (const route of routes.value) {
        if (hiddenRouteIds.value.has(route.id)) continue
        for (let i = 0; i < route.points.length; i++) {
          const pt = route.points[i]!
          if (pt.pinId !== undefined) continue
          const ptPx = map.latLngToContainerPoint([pt.lat, pt.lng])
          if (Math.hypot(rawPx.x - ptPx.x, rawPx.y - ptPx.y) < SNAP_PX) {
            lat = pt.lat
            lng = pt.lng
            snapRouteId = route.id
            snapPointIndex = i
            break outer
          }
        }
      }
    }

    history.push('move pin')
    if (snapRouteId !== undefined && snapPointIndex !== undefined) {
      linkWaypoint(snapRouteId, snapPointIndex, id)
    }
    handlePinMove(id, lat, lng)
  }

  function handleMovePoint(routeId: number, pointIndex: number, lat: number, lng: number, pinId?: number) {
    history.push('move waypoint')
    movePoint(routeId, pointIndex, lat, lng, pinId)
    if (pinId !== undefined) handlePinMove(pinId, lat, lng)
  }

  function handleMoveRoute(routeId: number, points: Array<{ lat: number; lng: number }>) {
    history.push('move route')
    const oldPoints = routes.value.find((r) => r.id === routeId)?.points ?? []
    oldPoints.forEach((oldPt, i) => {
      const newPt = points[i]
      if (oldPt.pinId && newPt && (newPt.lat !== oldPt.lat || newPt.lng !== oldPt.lng)) {
        handlePinMove(oldPt.pinId, newPt.lat, newPt.lng)
      }
    })
    moveRoute(routeId, points)
  }

  return { handleExtendFrom, findWaypointSnapForPin, handlePinMoveWithSnap, handleMovePoint, handleMoveRoute }
}
