import type L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { Route, RoutePoint } from '@/types'

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function routeDistanceM(points: RoutePoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1]!.lat, points[i - 1]!.lng, points[i]!.lat, points[i]!.lng)
  }
  return total
}

export function formatDistance(meters: number, unit: 'km' | 'mi' = 'km'): string {
  if (unit === 'mi') {
    const miles = meters / 1609.344
    return miles < 0.1 ? `${Math.round(meters * 3.28084)} ft` : `${miles.toFixed(2)} mi`
  }
  return meters < 100 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`
}

export function useRoutes(options: { initialRoutes: Route[]; leafletMap: ShallowRef<L.Map | null>; showNotification: (message: string, type?: 'success' | 'error' | 'info') => void; distanceUnit: Ref<'km' | 'mi'>; pushHistory: (label?: string) => void }) {
  const { initialRoutes, leafletMap, showNotification, distanceUnit } = options

  const routes = ref<Route[]>(initialRoutes)
  const hiddenRouteIds = computed(() => new Set(routes.value.filter((r) => r.hidden).map((r) => r.id)))
  const isDrawingRoute = ref(false)
  const drawingRouteId = ref<number | null>(null)
  const drawingInsertAfter = ref<number | null>(null) // null=append, -1=prepend, n=insert-after-n
  const drawingRedoStack = ref<{ point: RoutePoint; index: number; insertAfter: number | null }[]>([])
  const editingRoute = ref<Route | null>(null)
  const routeSnapEnabled = ref(localStorage.getItem('mapfolio_route_snap') === 'true')

  watch(routeSnapEnabled, (v) => localStorage.setItem('mapfolio_route_snap', String(v)))

  const allRoutesHidden = computed(() => routes.value.length > 0 && routes.value.every((r) => r.hidden))

  function toggleRouteVisibility(id: number) {
    const isHidden = routes.value.find((r) => r.id === id)?.hidden ?? false
    options.pushHistory(isHidden ? 'show route' : 'hide route')
    routes.value = routes.value.map((r) => (r.id === id ? { ...r, hidden: !r.hidden } : r))
  }

  function toggleAllRouteVisibility() {
    const hide = !allRoutesHidden.value
    options.pushHistory(hide ? 'hide all routes' : 'show all routes')
    routes.value = routes.value.map((r) => ({ ...r, hidden: hide }))
  }

  const drawingRoute = computed(() => (drawingRouteId.value !== null ? (routes.value.find((r) => r.id === drawingRouteId.value) ?? null) : null))

  const drawingDistance = computed(() => {
    if (!drawingRoute.value) return ''
    const m = routeDistanceM(drawingRoute.value.points)
    return m > 0 ? formatDistance(m, distanceUnit.value) : ''
  })

  // Index of the active anchor waypoint (rubber-band preview origin)
  const drawingAnchorIndex = computed((): number | null => {
    const route = drawingRoute.value
    if (!route || route.points.length === 0) return null
    const n = route.points.length
    if (drawingInsertAfter.value === null) return n - 1
    if (drawingInsertAfter.value === -1) return 0
    return Math.min(drawingInsertAfter.value, n - 1)
  })

  const canUndoPoint = computed(() => (drawingRoute.value?.points.length ?? 0) > 0)
  const canRedoPoint = computed(() => drawingRedoStack.value.length > 0)

  function startNewRoute(defaults: { color?: string; lineStyle?: Route['lineStyle']; waypointStyle?: Route['waypointStyle']; waypointSize?: Route['waypointSize'] } = {}) {
    options.pushHistory('add route')
    const id = uid()
    const route: Route = {
      id,
      name: '',
      color: defaults.color ?? '#0d9488',
      ...(defaults.lineStyle ? { lineStyle: defaults.lineStyle } : {}),
      ...(defaults.waypointStyle ? { waypointStyle: defaults.waypointStyle } : {}),
      ...(defaults.waypointSize ? { waypointSize: defaults.waypointSize } : {}),
      points: []
    }
    routes.value = [...routes.value, route]
    drawingRouteId.value = id
    drawingInsertAfter.value = null
    drawingRedoStack.value = []
    isDrawingRoute.value = true
  }

  // insertAfter: null=append, -1=prepend, n=insert-after-n
  function continueDrawing(routeId: number, insertAfter: number | null = null) {
    drawingInsertAfter.value = insertAfter
    drawingRedoStack.value = []
    drawingRouteId.value = routeId
    isDrawingRoute.value = true
  }

  function stopDrawing() {
    if (drawingRoute.value && drawingRoute.value.points.length === 0) {
      routes.value = routes.value.filter((r) => r.id !== drawingRouteId.value)
    }
    isDrawingRoute.value = false
    drawingRouteId.value = null
    drawingInsertAfter.value = null
    drawingRedoStack.value = []
  }

  function addPoint(lat: number, lng: number, pinId?: number) {
    if (!isDrawingRoute.value || drawingRouteId.value === null) return
    const id = drawingRouteId.value
    const insertAfter = drawingInsertAfter.value
    drawingRedoStack.value = []
    const pt: RoutePoint = pinId !== undefined ? { lat, lng, pinId } : { lat, lng }
    routes.value = routes.value.map((r) => {
      if (r.id !== id) return r
      if (insertAfter === null) return { ...r, points: [...r.points, pt] }
      if (insertAfter === -1) return { ...r, points: [pt, ...r.points] }
      const idx = insertAfter + 1
      return { ...r, points: [...r.points.slice(0, idx), pt, ...r.points.slice(idx)] }
    })
    if (insertAfter !== null && insertAfter >= 0) drawingInsertAfter.value = insertAfter + 1
  }

  function undoLastPoint() {
    if (!isDrawingRoute.value || drawingRouteId.value === null) return
    const id = drawingRouteId.value
    const insertAfter = drawingInsertAfter.value
    const route = routes.value.find((r) => r.id === id)
    if (!route || route.points.length === 0) return
    const removeIndex = insertAfter === null ? route.points.length - 1 : insertAfter === -1 ? 0 : insertAfter
    const removed = route.points[removeIndex]
    if (!removed) return
    drawingRedoStack.value = [...drawingRedoStack.value, { point: removed, index: removeIndex, insertAfter }]
    routes.value = routes.value.map((r) => (r.id === id ? { ...r, points: r.points.filter((_, i) => i !== removeIndex) } : r))
    if (insertAfter !== null && insertAfter >= 0) drawingInsertAfter.value = insertAfter - 1
  }

  function redoLastPoint() {
    if (!isDrawingRoute.value || drawingRouteId.value === null) return
    const entry = drawingRedoStack.value[drawingRedoStack.value.length - 1]
    if (!entry) return
    const id = drawingRouteId.value
    drawingRedoStack.value = drawingRedoStack.value.slice(0, -1)
    routes.value = routes.value.map((r) => {
      if (r.id !== id) return r
      const points = [...r.points]
      points.splice(entry.index, 0, entry.point)
      return { ...r, points }
    })
    if (entry.insertAfter !== null && entry.insertAfter >= 0) drawingInsertAfter.value = entry.insertAfter
  }

  function nearestSegmentIndex(points: RoutePoint[], lat: number, lng: number): number {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < points.length - 1; i++) {
      const ax = points[i]!.lng,
        ay = points[i]!.lat
      const bx = points[i + 1]!.lng,
        by = points[i + 1]!.lat
      const dx = bx - ax,
        dy = by - ay
      const lenSq = dx * dx + dy * dy
      let t = lenSq > 0 ? ((lng - ax) * dx + (lat - ay) * dy) / lenSq : 0
      t = Math.max(0, Math.min(1, t))
      const nx = ax + t * dx,
        ny = ay + t * dy
      const dist = (lng - nx) ** 2 + (lat - ny) ** 2
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }
    return bestIdx
  }

  function insertPoint(routeId: number, lat: number, lng: number) {
    const route = routes.value.find((r) => r.id === routeId)
    if (!route || route.points.length < 2) return
    const segIdx = nearestSegmentIndex(route.points, lat, lng)
    options.pushHistory('insert waypoint')
    const pt: RoutePoint = { lat, lng }
    routes.value = routes.value.map((r) => {
      if (r.id !== routeId) return r
      const pts = [...r.points]
      pts.splice(segIdx + 1, 0, pt)
      return { ...r, points: pts }
    })
  }

  function removePoint(routeId: number, pointIndex: number) {
    options.pushHistory('remove waypoint')
    routes.value = routes.value.map((r) => (r.id === routeId ? { ...r, points: r.points.filter((_, i) => i !== pointIndex) } : r))
  }

  function movePoint(routeId: number, pointIndex: number, lat: number, lng: number, pinId?: number) {
    routes.value = routes.value.map((r) => (r.id === routeId ? { ...r, points: r.points.map((p, i) => (i === pointIndex ? (pinId !== undefined ? { lat, lng, pinId } : { lat, lng }) : p)) } : r))
  }

  function moveRoute(routeId: number, points: RoutePoint[]) {
    routes.value = routes.value.map((r) => {
      if (r.id !== routeId) return r
      const merged = points.map((p, i) => (r.points[i]?.pinId !== undefined ? { ...p, pinId: r.points[i]!.pinId } : p))
      return { ...r, points: merged }
    })
  }

  function linkWaypoint(routeId: number, pointIndex: number, pinId: number) {
    routes.value = routes.value.map((r) => (r.id === routeId ? { ...r, points: r.points.map((p, i) => (i === pointIndex ? { ...p, pinId } : p)) } : r))
  }

  function breakWaypointLink(routeId: number, pointIndex: number) {
    options.pushHistory('unlink waypoint')
    routes.value = routes.value.map((r) => (r.id === routeId ? { ...r, points: r.points.map((p, i) => (i === pointIndex ? { ...p, pinId: undefined } : p)) } : r))
  }

  // Unlink route waypoints that pointed at a deleted pin (single id or a set, for
  // bulk deletes). Waypoints keep their position; only the dangling pinId is cleared.
  function cleanupOrphanedLinks(pinId: number | Set<number>) {
    const orphaned = (id: number | undefined) => id !== undefined && (typeof pinId === 'number' ? id === pinId : pinId.has(id))
    routes.value = routes.value.map((r) => (r.points.some((p) => orphaned(p.pinId)) ? { ...r, points: r.points.map((p) => (orphaned(p.pinId) ? { ...p, pinId: undefined } : p)) } : r))
  }

  function deleteRoute(id: number) {
    if (drawingRouteId.value === id) stopDrawing()
    options.pushHistory('delete route')
    routes.value = routes.value.filter((r) => r.id !== id)
    showNotification('Route deleted')
  }

  function updateRoute(updated: Route) {
    routes.value = routes.value.map((r) => (r.id === updated.id ? updated : r))
  }

  function fitToRoute(route: Route) {
    if (!leafletMap.value || route.points.length === 0) return
    leafletMap.value.fitBounds(
      route.points.map((p) => [p.lat, p.lng] as L.LatLngTuple),
      { padding: [60, 60], animate: true }
    )
  }

  function fitToAllRoutes() {
    if (!leafletMap.value) return
    const visiblePoints = routes.value.filter((r) => !hiddenRouteIds.value.has(r.id)).flatMap((r) => r.points)
    if (visiblePoints.length === 0) return
    leafletMap.value.fitBounds(
      visiblePoints.map((p) => [p.lat, p.lng] as L.LatLngTuple),
      { padding: [60, 60], animate: true }
    )
  }

  function openEditRoute(route: Route) {
    editingRoute.value = { ...route }
  }

  function closeEditRoute() {
    editingRoute.value = null
  }

  function saveEditRoute(updated: Route) {
    options.pushHistory('edit route')
    updateRoute(updated)
    editingRoute.value = null
  }

  function clearAllRoutes() {
    const n = routes.value.length
    if (n === 0) return
    if (!window.confirm(`Delete all ${n} route${n === 1 ? '' : 's'}?\n\nThis is permanent and cannot be undone.`)) return
    options.pushHistory('clear routes')
    routes.value = []
    showNotification('All routes cleared')
  }

  function resetRoutes(newRoutes: Route[]) {
    if (isDrawingRoute.value) stopDrawing()
    routes.value = newRoutes
    editingRoute.value = null
  }

  return {
    routes,
    hiddenRouteIds,
    allRoutesHidden,
    isDrawingRoute,
    drawingRouteId,
    drawingRoute,
    drawingDistance,
    drawingInsertAfter,
    drawingAnchorIndex,
    editingRoute,
    startNewRoute,
    continueDrawing,
    stopDrawing,
    addPoint,
    undoLastPoint,
    redoLastPoint,
    canUndoPoint,
    canRedoPoint,
    insertPoint,
    removePoint,
    movePoint,
    moveRoute,
    deleteRoute,
    updateRoute,
    fitToRoute,
    openEditRoute,
    closeEditRoute,
    saveEditRoute,
    routeSnapEnabled,
    linkWaypoint,
    breakWaypointLink,
    cleanupOrphanedLinks,
    toggleRouteVisibility,
    toggleAllRouteVisibility,
    fitToAllRoutes,
    clearAllRoutes,
    resetRoutes
  }
}
