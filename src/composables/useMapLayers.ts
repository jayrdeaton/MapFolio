import { shallowRef, computed, watch } from 'vue'
import type { Ref } from 'vue'
import L from 'leaflet'
import { MAP_STYLE_CONFIGS } from '../types'
import type { MapStyle } from '../types'

const LABEL_STYLES = new Set<MapStyle>(['clean', 'satellite'])

export function useMapLayers(options: {
  leafletMap: Ref<L.Map | null>
  mapStyle: Ref<MapStyle>
  isDark: Ref<boolean>
  showLabels: Ref<boolean>
}) {
  const { leafletMap, mapStyle, isDark, showLabels } = options

  const currentTileLayer = shallowRef<L.TileLayer | null>(null)
  const labelsLayer = shallowRef<L.TileLayer | null>(null)

  const mapMaxZoom = computed(() => MAP_STYLE_CONFIGS[mapStyle.value].maxNativeZoom ?? 19)

  function applyTileLayer(map: L.Map) {
    if (currentTileLayer.value) map.removeLayer(currentTileLayer.value)
    const cfg = MAP_STYLE_CONFIGS[mapStyle.value]
    const url = isDark.value && cfg.darkUrl ? cfg.darkUrl : cfg.url
    currentTileLayer.value = L.tileLayer(url, {
      attribution: cfg.attribution,
      subdomains: cfg.subdomains ?? '',
      maxNativeZoom: cfg.maxNativeZoom,
      maxZoom: mapMaxZoom.value,
      crossOrigin: cfg.crossOrigin ?? false,
    }).addTo(map)
  }

  function applyLabelsLayer(map: L.Map) {
    if (labelsLayer.value) { map.removeLayer(labelsLayer.value); labelsLayer.value = null }
    if (!showLabels.value || !LABEL_STYLES.has(mapStyle.value)) return
    const useDark = mapStyle.value === 'satellite' || isDark.value
    const url = useDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'
    labelsLayer.value = L.tileLayer(url, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CartoDB</a>',
      subdomains: 'abcd',
      maxNativeZoom: 19,
      crossOrigin: true,
    }).addTo(map)
  }

  async function flyToIpLocation(map: L.Map) {
    try {
      const res = await fetch('https://ipapi.co/json/')
      if (!res.ok) return
      const { latitude, longitude } = await res.json()
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        map.setView([latitude, longitude], 10, { animate: true })
      }
    } catch { }
  }

  watch([mapStyle, isDark], () => {
    if (leafletMap.value) applyTileLayer(leafletMap.value)
  })

  watch([showLabels, mapStyle, isDark], () => {
    if (leafletMap.value) applyLabelsLayer(leafletMap.value)
  })

  return { mapMaxZoom, applyTileLayer, applyLabelsLayer, flyToIpLocation }
}
