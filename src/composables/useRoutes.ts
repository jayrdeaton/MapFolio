import type L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { Route, RoutePoint } from '../types'
import { parseGeoJsonRouteImport, parseRouteImport, routesToGeoJson } from '../utils'

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

let routeCounter = 1

export function useRoutes(options: { initialRoutes: Route[]; mapTitle: Ref<string>; leafletMap: ShallowRef<L.Map | null>; routeImportFileRef: Ref<HTMLInputElement | null>; showNotification: (message: string, type?: 'success' | 'error' | 'info') => void; distanceUnit: Ref<'km' | 'mi'> }) {
  const { initialRoutes, mapTitle, leafletMap, routeImportFileRef, showNotification, distanceUnit } = options

  const routes = ref<Route[]>(initialRoutes)
  const hiddenRouteIds = ref<Set<number>>(new Set())
  const isDrawingRoute = ref(false)
  const drawingRouteId = ref<number | null>(null)
  const drawingInsertAfter = ref<number | null>(null) // null=append, -1=prepend, n=insert-after-n
  const editingRoute = ref<Route | null>(null)
  const routeSnapEnabled = ref(false)

  const allRoutesHidden = computed(() => routes.value.length > 0 && routes.value.every((r) => hiddenRouteIds.value.has(r.id)))

  function toggleRouteVisibility(id: number) {
    const next = new Set(hiddenRouteIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    hiddenRouteIds.value = next
  }

  function toggleAllRouteVisibility() {
    hiddenRouteIds.value = allRoutesHidden.value ? new Set() : new Set(routes.value.map((r) => r.id))
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

  function startNewRoute() {
    const id = Date.now()
    const route: Route = {
      id,
      name: `Route ${routeCounter++}`,
      color: '#06b6d4',
      points: []
    }
    routes.value = [...routes.value, route]
    drawingRouteId.value = id
    drawingInsertAfter.value = null
    isDrawingRoute.value = true
  }

  // insertAfter: null=append, -1=prepend, n=insert-after-n
  function continueDrawing(routeId: number, insertAfter: number | null = null) {
    drawingInsertAfter.value = insertAfter
    drawingRouteId.value = routeId
    isDrawingRoute.value = true
  }

  function stopDrawing() {
    if (drawingRoute.value && drawingRoute.value.points.length === 0) {
      routes.value = routes.value.filter((r) => r.id !== drawingRouteId.value)
      routeCounter--
    }
    isDrawingRoute.value = false
    drawingRouteId.value = null
    drawingInsertAfter.value = null
  }

  function addPoint(lat: number, lng: number, pinId?: number) {
    if (!isDrawingRoute.value || drawingRouteId.value === null) return
    const id = drawingRouteId.value
    const insertAfter = drawingInsertAfter.value
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
    routes.value = routes.value.map((r) => {
      if (r.id !== id || r.points.length === 0) return r
      if (insertAfter === null) return { ...r, points: r.points.slice(0, -1) }
      if (insertAfter === -1) return { ...r, points: r.points.slice(1) }
      return { ...r, points: r.points.filter((_, i) => i !== insertAfter) }
    })
    if (insertAfter !== null && insertAfter >= 0) drawingInsertAfter.value = insertAfter - 1
  }

  function removePoint(routeId: number, pointIndex: number) {
    routes.value = routes.value.map((r) => (r.id === routeId ? { ...r, points: r.points.filter((_, i) => i !== pointIndex) } : r))
  }

  function movePoint(routeId: number, pointIndex: number, lat: number, lng: number, pinId?: number) {
    routes.value = routes.value.map((r) => (r.id === routeId ? { ...r, points: r.points.map((p, i) => (i === pointIndex ? (pinId !== undefined ? { ...p, lat, lng, pinId } : { ...p, lat, lng }) : p)) } : r))
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
    routes.value = routes.value.map((r) => (r.id === routeId ? { ...r, points: r.points.map((p, i) => (i === pointIndex ? { ...p, pinId: undefined } : p)) } : r))
  }

  function cleanupOrphanedLinks(pinId: number) {
    routes.value = routes.value.map((r) => ({
      ...r,
      points: r.points.map((p) => (p.pinId === pinId ? { ...p, pinId: undefined } : p))
    }))
  }

  function deleteRoute(id: number) {
    if (drawingRouteId.value === id) stopDrawing()
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
    updateRoute(updated)
    editingRoute.value = null
  }

  function clearAllRoutes() {
    if (!window.confirm('Remove all routes?')) return
    routes.value = []
    hiddenRouteIds.value = new Set()
    showNotification('All routes cleared')
  }

  function exportRoutesJson() {
    if (routes.value.length === 0) {
      showNotification('No routes to export', 'error')
      return
    }
    const data = JSON.stringify({ routes: routes.value, mapTitle: mapTitle.value }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mapTitle.value || 'mapfolio'}-routes.json`
    a.click()
    URL.revokeObjectURL(url)
    showNotification(`Exported ${routes.value.length} route${routes.value.length !== 1 ? 's' : ''}`)
  }

  function exportRoutesGeoJson() {
    if (routes.value.length === 0) {
      showNotification('No routes to export', 'error')
      return
    }
    const blob = new Blob([JSON.stringify(routesToGeoJson(routes.value), null, 2)], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mapTitle.value || 'mapfolio'}-routes.geojson`
    a.click()
    URL.revokeObjectURL(url)
    showNotification('GeoJSON exported!')
  }

  function triggerRouteImport() {
    routeImportFileRef.value?.click()
  }

  function handleRouteImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = parseRouteImport(text) ?? parseGeoJsonRouteImport(text)
      if (result) {
        routes.value = [...routes.value, ...result.routes]
        if ('mapTitle' in result && result.mapTitle && !mapTitle.value) {
          mapTitle.value = result.mapTitle as string
        }
        showNotification(`Imported ${result.routes.length} route${result.routes.length !== 1 ? 's' : ''}!`)
        if (leafletMap.value && result.routes.length > 0) {
          const allPoints = result.routes.flatMap((r) => r.points)
          if (allPoints.length > 0) {
            const bounds = allPoints.map((p) => [p.lat, p.lng] as [number, number])
            requestAnimationFrame(() => leafletMap.value?.fitBounds(bounds, { padding: [60, 60], animate: true }))
          }
        }
      } else {
        showNotification('Invalid or unreadable route file', 'error')
      }
      if (routeImportFileRef.value) routeImportFileRef.value.value = ''
    }
    reader.readAsText(file)
  }

  function resetRoutes(newRoutes: Route[]) {
    if (isDrawingRoute.value) stopDrawing()
    routes.value = newRoutes
    hiddenRouteIds.value = new Set()
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
    exportRoutesJson,
    exportRoutesGeoJson,
    triggerRouteImport,
    handleRouteImportFile,
    resetRoutes
  }
}
