import type L from 'leaflet'
import type { ComputedRef, Ref } from 'vue'

import { dedupeLegendPins, legendBoxFractions } from '@/composables/useMapExport'
import type { Pin, PrintArea, Route } from '@/types'

interface UseLegendPreviewOptions {
  printBounds: ComputedRef<L.LatLngBounds | null>
  activePrintArea: ComputedRef<PrintArea | null>
  pins: Ref<Pin[]>
  routes: Ref<Route[]>
  mapName: ComputedRef<string>
  effectiveArea: ComputedRef<string>
}

export function useLegendPreview({ printBounds, activePrintArea, pins, routes, mapName, effectiveArea }: UseLegendPreviewOptions) {
  const legendCounts = computed(() => {
    const bounds = printBounds.value
    if (!bounds) return null
    const pinCount = dedupeLegendPins(pins.value.filter((p) => p.name && bounds.contains([p.lat, p.lng])).map((p) => ({ pin: p, index: p.showNumber ? p.id : undefined }))).length
    const routeCount = routes.value.filter((r) => r.name && r.points.some((pt) => bounds.contains([pt.lat, pt.lng]))).length
    return { pins: pinCount, routes: routeCount }
  })

  const activeLegendSettings = computed(() => {
    const area = activePrintArea.value
    if (!printBounds.value || !area) return undefined
    return {
      legend: area.legend ?? true,
      separatePage: area.legendSeparatePage ?? false,
      title: area.legendTitle ?? true,
      titleText: mapName.value,
      area: area.legendArea ?? true,
      areaText: effectiveArea.value ?? '',
      pins: area.legendPins ?? true,
      routes: area.legendRoutes ?? true,
      pinCount: legendCounts.value?.pins ?? 0,
      routeCount: legendCounts.value?.routes ?? 0,
      compass: area.compass ?? true,
      scale: area.scale ?? true
    }
  })

  const legendBox = computed(() => {
    const bounds = printBounds.value
    const area = activePrintArea.value
    if (!bounds || !area) return null
    const masterOn = area.legend ?? true
    if (!masterOn) return null
    const onMapPins = (area.legendPins ?? true) && !(area.legendSeparatePage ?? false)
    const onMapRoutes = (area.legendRoutes ?? true) && !(area.legendSeparatePage ?? false)
    const namedPins = onMapPins ? dedupeLegendPins(pins.value.filter((p) => p.name && bounds.contains([p.lat, p.lng])).map((p) => ({ pin: p, index: p.showNumber ? p.id : undefined }))) : []
    const namedRoutes = onMapRoutes ? routes.value.filter((r) => r.name && r.points.some((pt) => bounds.contains([pt.lat, pt.lng]))) : []
    return legendBoxFractions(
      {
        hasTitle: (area.legendTitle ?? true) && !!mapName.value,
        hasArea: (area.legendArea ?? true) && !!effectiveArea.value,
        includeCompass: area.compass ?? true,
        includeScale: area.scale ?? true,
        pins: namedPins.map(({ pin }) => ({ hasDescription: !!pin.description })),
        routeCount: namedRoutes.length
      },
      area.legendScale ?? 1
    )
  })

  return { legendCounts, activeLegendSettings, legendBox }
}
