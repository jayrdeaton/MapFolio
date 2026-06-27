import type L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { Caption, MapData, MapStyle, Pin, Route } from '@/types'

export function useMapManager(options: { activeId: Ref<string>; activeMap: ComputedRef<MapData>; updateActiveMap: (patch: Partial<MapData>) => void; createMap: (name: string) => MapData; switchMap: (id: string) => void; deleteMap: (id: string) => void; duplicateMap: (id: string) => MapData; importMapFromData: (data: unknown) => MapData | null; leafletMap: ShallowRef<L.Map | null>; mapStyle: Ref<MapStyle>; showLabels: Ref<boolean>; showClusters: Ref<boolean>; mapArea: Ref<string>; pins: Ref<Pin[]>; routes: Ref<Route[]>; captions: Ref<Caption[]>; mapImportFileRef: Ref<HTMLInputElement | null>; showNotification: (msg: string, type?: 'success' | 'error' | 'info') => void; resetPins: (pins: Pin[]) => void; resetRoutes: (routes: Route[]) => void; resetCaptions: (captions: Caption[]) => void; clearPrintBounds: () => void }) {
  const showMapsPanel = ref(false)

  function saveState() {
    const patch: Partial<MapData> = {
      pins: options.pins.value,
      routes: options.routes.value,
      captions: options.captions.value,
      mapStyle: options.mapStyle.value,
      area: options.mapArea.value,
      showLabels: options.showLabels.value,
      showClusters: options.showClusters.value
    }
    if (options.leafletMap.value) {
      const c = options.leafletMap.value.getCenter()
      patch.center = [c.lat, c.lng]
      patch.zoom = options.leafletMap.value.getZoom()
    }
    options.updateActiveMap(patch)
  }

  function applyMapData(m: MapData) {
    // The print area is map-specific and not persisted per map, so changing the
    // active map (switch / create / delete / import) clears any active print view.
    options.clearPrintBounds()
    options.mapStyle.value = m.mapStyle
    options.showLabels.value = m.showLabels
    options.showClusters.value = m.showClusters
    options.mapArea.value = m.area ?? ''
    options.resetPins(m.pins)
    options.resetRoutes(m.routes)
    options.resetCaptions(m.captions ?? [])
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

  // Shared by the Import button and the PWA file-handler launch (App.vue's
  // launchQueue consumer) — both end up here with one or more files to import.
  async function importMapFiles(files: File[]) {
    for (const file of files) {
      try {
        const parsed = JSON.parse(await file.text())
        if (Array.isArray(parsed)) {
          // All-maps export format — import each map individually.
          const imported = parsed.map((item) => options.importMapFromData(item)).filter(Boolean)
          if (imported.length > 0) options.showNotification(`Imported ${imported.length} map${imported.length === 1 ? '' : 's'}`)
          else options.showNotification('Invalid map file', 'error')
        } else {
          const m = options.importMapFromData(parsed)
          if (m) options.showNotification(`Imported "${m.name}"`)
          else options.showNotification('Invalid map file', 'error')
        }
      } catch {
        options.showNotification('Could not read file', 'error')
      }
    }
  }

  function handleMapImportFile(e: Event) {
    const input = e.target as HTMLInputElement
    const files = input.files ? Array.from(input.files) : []
    if (files.length) importMapFiles(files)
    input.value = ''
  }

  watch([options.pins, options.routes, options.captions, options.mapStyle, options.mapArea, options.showLabels, options.showClusters], saveState, { deep: true })

  return { showMapsPanel, saveState, applyMapData, doSwitchMap, doCreateMap, doDeleteMap, doDuplicateMap, handleMapImportFile, importMapFiles }
}
