import type L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { MapData, MapStyle, Pin, PinDotSize, Route } from '@/types'

export function useMapManager(options: { activeId: Ref<string>; activeMap: ComputedRef<MapData>; updateActiveMap: (patch: Partial<MapData>) => void; createMap: (name: string) => MapData; switchMap: (id: string) => void; deleteMap: (id: string) => void; duplicateMap: (id: string) => MapData; importMapFromData: (data: unknown) => MapData | null; leafletMap: ShallowRef<L.Map | null>; mapStyle: Ref<MapStyle>; showLabels: Ref<boolean>; showClusters: Ref<boolean>; pinDotSize: Ref<PinDotSize>; mapArea: Ref<string>; pins: Ref<Pin[]>; routes: Ref<Route[]>; mapImportFileRef: Ref<HTMLInputElement | null>; showNotification: (msg: string, type?: 'success' | 'error' | 'info') => void; resetPins: (pins: Pin[]) => void; resetRoutes: (routes: Route[]) => void }) {
  const showMapsPanel = ref(false)

  function saveState() {
    const patch: Partial<MapData> = {
      pins: options.pins.value,
      routes: options.routes.value,
      mapStyle: options.mapStyle.value,
      area: options.mapArea.value,
      showLabels: options.showLabels.value,
      showClusters: options.showClusters.value,
      pinDotSize: options.pinDotSize.value
    }
    if (options.leafletMap.value) {
      const c = options.leafletMap.value.getCenter()
      patch.center = [c.lat, c.lng]
      patch.zoom = options.leafletMap.value.getZoom()
    }
    options.updateActiveMap(patch)
  }

  function applyMapData(m: MapData) {
    options.mapStyle.value = m.mapStyle
    options.showLabels.value = m.showLabels
    options.showClusters.value = m.showClusters
    options.pinDotSize.value = m.pinDotSize
    options.mapArea.value = m.area ?? ''
    options.resetPins(m.pins)
    options.resetRoutes(m.routes)
    if (m.center && m.zoom && options.leafletMap.value) {
      options.leafletMap.value.setView(m.center, m.zoom, { animate: true })
    }
  }

  function doSwitchMap(id: string) {
    if (id === options.activeId.value) {
      showMapsPanel.value = false
      return
    }
    saveState()
    options.switchMap(id)
    applyMapData(options.activeMap.value)
    showMapsPanel.value = false
  }

  function doCreateMap(name: string) {
    saveState()
    const m = options.createMap(name)
    options.switchMap(m.id)
    applyMapData(options.activeMap.value)
    showMapsPanel.value = false
  }

  function doDeleteMap(id: string) {
    const wasActive = id === options.activeId.value
    options.deleteMap(id)
    if (wasActive) applyMapData(options.activeMap.value)
  }

  function doDuplicateMap(id: string) {
    const copy = options.duplicateMap(id)
    options.showNotification(`Duplicated as "${copy.name}"`)
  }

  function handleMapImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const m = options.importMapFromData(JSON.parse(ev.target?.result as string))
        if (m) options.showNotification(`Imported "${m.name}"`)
        else options.showNotification('Invalid map file', 'error')
      } catch {
        options.showNotification('Could not read file', 'error')
      }
      if (options.mapImportFileRef.value) options.mapImportFileRef.value.value = ''
    }
    reader.readAsText(file)
  }

  watch([options.pins, options.routes, options.mapStyle, options.mapArea, options.showLabels, options.showClusters, options.pinDotSize], saveState, { deep: true })

  return { showMapsPanel, saveState, applyMapData, doSwitchMap, doCreateMap, doDeleteMap, doDuplicateMap, handleMapImportFile }
}
