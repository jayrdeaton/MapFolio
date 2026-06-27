import type L from 'leaflet'
import type { Ref, ShallowRef } from 'vue'

import type { SearchLocation } from '@/components/MapSearch.vue'
import type { Caption, Pin, PrintArea, Route } from '@/types'

interface UseLocateOptions {
  pins: Ref<Pin[]>
  hiddenPinIds: Ref<Set<number>>
  routes: Ref<Route[]>
  hiddenRouteIds: Ref<Set<number>>
  captions: Ref<Caption[]>
  hiddenCaptionIds: Ref<Set<number>>
  printAreas: Ref<PrintArea[]>
  leafletMap: ShallowRef<L.Map | null>
  searchLocation: Ref<SearchLocation | null>
  showNotification: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function useLocate({ pins, hiddenPinIds, routes, hiddenRouteIds, captions, hiddenCaptionIds, printAreas, leafletMap, searchLocation, showNotification }: UseLocateOptions) {
  const isLocating = ref(false)

  const canFitAll = computed(() => {
    const hasPins = pins.value.some((p) => !hiddenPinIds.value.has(p.id))
    const hasRoutes = routes.value.some((r) => !hiddenRouteIds.value.has(r.id) && r.points.length > 0)
    const hasCaptions = captions.value.some((c) => !hiddenCaptionIds.value.has(c.id))
    const hasPrintAreas = printAreas.value.some((a) => !a.hidden && a.corners.length > 0)
    return hasPins || hasRoutes || hasCaptions || hasPrintAreas
  })

  function fitAllToView() {
    if (!leafletMap.value) return
    const coords: [number, number][] = []
    for (const p of pins.value) if (!hiddenPinIds.value.has(p.id)) coords.push([p.lat, p.lng])
    for (const r of routes.value) if (!hiddenRouteIds.value.has(r.id)) for (const pt of r.points) coords.push([pt.lat, pt.lng])
    for (const c of captions.value) if (!hiddenCaptionIds.value.has(c.id)) coords.push([c.lat, c.lng])
    for (const a of printAreas.value) if (!a.hidden) for (const corner of a.corners) coords.push(corner)
    if (coords.length === 0) return
    leafletMap.value.fitBounds(coords, { padding: [60, 60], animate: true })
  }

  function goToMyLocation() {
    if (!navigator.geolocation || isLocating.value) return
    isLocating.value = true
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        isLocating.value = false
        searchLocation.value = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your location' }
      },
      (err) => {
        isLocating.value = false
        showNotification(err.code === err.PERMISSION_DENIED ? 'Location blocked - enable it in browser settings' : 'Could not get your location', 'error')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  return { isLocating, canFitAll, fitAllToView, goToMyLocation }
}
