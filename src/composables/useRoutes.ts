import { ref, computed } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import type L from 'leaflet'
import type { Route, RoutePoint } from '../types'

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function routeDistanceM(points: RoutePoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
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

export function useRoutes(options: {
  initialRoutes: Route[]
  leafletMap: ShallowRef<L.Map | null>
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void
  distanceUnit: Ref<'km' | 'mi'>
}) {
  const { initialRoutes, leafletMap, showNotification, distanceUnit } = options

  const routes = ref<Route[]>(initialRoutes)
  const isDrawingRoute = ref(false)
  const drawingRouteId = ref<number | null>(null)
  const editingRoute = ref<Route | null>(null)

  const drawingRoute = computed(() =>
    drawingRouteId.value !== null
      ? (routes.value.find(r => r.id === drawingRouteId.value) ?? null)
      : null
  )

  const drawingDistance = computed(() => {
    if (!drawingRoute.value) return ''
    const m = routeDistanceM(drawingRoute.value.points)
    return m > 0 ? formatDistance(m, distanceUnit.value) : ''
  })

  function startNewRoute() {
    const id = Date.now()
    const route: Route = {
      id,
      name: `Route ${routeCounter++}`,
      color: '#06b6d4',
      points: [],
    }
    routes.value = [...routes.value, route]
    drawingRouteId.value = id
    isDrawingRoute.value = true
  }

  function continueDrawing(routeId: number) {
    drawingRouteId.value = routeId
    isDrawingRoute.value = true
  }

  function stopDrawing() {
    if (drawingRoute.value && drawingRoute.value.points.length === 0) {
      routes.value = routes.value.filter(r => r.id !== drawingRouteId.value)
      routeCounter--
    }
    isDrawingRoute.value = false
    drawingRouteId.value = null
  }

  function addPoint(lat: number, lng: number) {
    if (!isDrawingRoute.value || drawingRouteId.value === null) return
    const id = drawingRouteId.value
    routes.value = routes.value.map(r =>
      r.id === id ? { ...r, points: [...r.points, { lat, lng }] } : r
    )
  }

  function undoLastPoint() {
    if (!isDrawingRoute.value || drawingRouteId.value === null) return
    const id = drawingRouteId.value
    routes.value = routes.value.map(r =>
      r.id === id && r.points.length > 0
        ? { ...r, points: r.points.slice(0, -1) }
        : r
    )
  }

  function removePoint(routeId: number, pointIndex: number) {
    routes.value = routes.value.map(r =>
      r.id === routeId
        ? { ...r, points: r.points.filter((_, i) => i !== pointIndex) }
        : r
    )
  }

  function deleteRoute(id: number) {
    if (drawingRouteId.value === id) stopDrawing()
    routes.value = routes.value.filter(r => r.id !== id)
    showNotification('Route deleted')
  }

  function updateRoute(updated: Route) {
    routes.value = routes.value.map(r => (r.id === updated.id ? updated : r))
  }

  function fitToRoute(route: Route) {
    if (!leafletMap.value || route.points.length === 0) return
    leafletMap.value.fitBounds(
      route.points.map(p => [p.lat, p.lng] as L.LatLngTuple),
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

  return {
    routes,
    isDrawingRoute,
    drawingRouteId,
    drawingRoute,
    drawingDistance,
    editingRoute,
    startNewRoute,
    continueDrawing,
    stopDrawing,
    addPoint,
    undoLastPoint,
    removePoint,
    deleteRoute,
    updateRoute,
    fitToRoute,
    openEditRoute,
    closeEditRoute,
    saveEditRoute,
  }
}
