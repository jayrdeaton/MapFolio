<script setup lang="ts">
import { LMap } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

import AppHeader from './AppHeader.vue'
import MapOptions from './MapOptions.vue'
import MapSearch from './MapSearch.vue'
import SearchMarker from './SearchMarker.vue'
import ScaleBar from './ScaleBar.vue'
import type { SearchLocation } from './MapSearch.vue'
import PinMarker from './PinMarker.vue'
import RouteLayer from './RouteLayer.vue'
import PrintAreaDrawer from './PrintAreaDrawer.vue'
import PrintLegend from './PrintLegend.vue'
import WelcomeModal from './WelcomeModal.vue'
import PinEditSheet from './PinEditSheet.vue'
import RouteEditSheet from './RouteEditSheet.vue'
import PrintExportPanel from './PrintExportPanel.vue'
import PinsPanel from './PinsPanel.vue'
import RoutesPanel from './RoutesPanel.vue'
import MapFabStack from './MapFabStack.vue'
import { MapStyle, Pin, PinDotSize } from '../types'
import { decodeShareState } from '../utils'
import { useColorMode } from '../composables/useColorMode'
import { useNotification } from '../composables/useNotification'
import { usePins } from '../composables/usePins'
import { useRoutes } from '../composables/useRoutes'
import { usePrintExport } from '../composables/usePrintExport'
import { useShareClipboard } from '../composables/useShareClipboard'
import { usePrintSettings } from '../composables/usePrintSettings'
import { useMapLayers } from '../composables/useMapLayers'
import { useLongPress } from '../composables/useLongPress'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// ── Color mode ────────────────────────────────────────────────────────────────

const { preference: colorMode, isDark, cycle: cycleColorMode } = useColorMode()

// ── Welcome modal ─────────────────────────────────────────────────────────────

const WELCOME_KEY = 'mapfolio_welcome_seen'
const showInfo = ref(!localStorage.getItem(WELCOME_KEY))

function closeInfo() {
  localStorage.setItem(WELCOME_KEY, '1')
  showInfo.value = false
}

// ── Initial state: URL hash takes priority over localStorage ─────────────────

const STORAGE_KEY = 'mapfolio_v1'
const LEGACY_KEY = 'custommap_v1'

const urlHash = location.hash.slice(1)
const urlState = urlHash ? decodeShareState(urlHash) : null
const loadedFromUrl = !!urlState

const localState = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
})()

const savedState = urlState || localState

if (urlState && Array.isArray(localState?.pins)) {
  const addrById = new Map<number, string>(
    (localState.pins as Pin[]).filter(p => p.address).map(p => [p.id, p.address!])
  )
  urlState.pins = urlState.pins.map(p => addrById.has(p.id) ? { ...p, address: addrById.get(p.id) } : p)
}

// ── Core reactive state ───────────────────────────────────────────────────────

const mapStyle = ref<MapStyle>(savedState?.mapStyle === 'dark' ? 'minimal' : (savedState?.mapStyle ?? 'clean'))
const showLabels = ref<boolean>(savedState?.showLabels ?? false)
const showClusters = ref<boolean>(savedState?.showClusters ?? true)
const pinDotSize = ref<PinDotSize>(savedState?.pinDotSize ?? 'm')
const mapTitle = ref<string>(savedState?.mapTitle ?? '')

const leafletMap = shallowRef<L.Map | null>(null)
let cleanupLongPress: (() => void) | null = null
const clusterGroup = shallowRef<L.MarkerClusterGroup | null>(null)

const showSearch = ref(false)
const isPlacingPin = ref(false)
const isLocating = ref(false)
const importFileRef = ref<HTMLInputElement | null>(null)

const searchLocation = ref<SearchLocation | null>(null)
const searchClearTrigger = ref(0)
const searchMarkerRef = ref<{ fade: () => void } | null>(null)

const pointerCoords = ref<{ lat: number; lng: number } | null>(null)
const mapCenterCoords = ref<{ lat: number; lng: number } | null>(null)
const displayCoords = computed(() => pointerCoords.value ?? mapCenterCoords.value)

const hasExplicitLocation = !!(urlState?.center ?? (!loadedFromUrl && localState?.center))
const initialCenter: [number, number] =
  urlState?.center ??
  ((!loadedFromUrl && localState?.center) ? localState.center : [40.7128, -74.006])
const initialZoom: number =
  urlState?.zoom ??
  ((!loadedFromUrl && localState?.zoom) ? localState.zoom : 13)

// ── FAB / sheet state ─────────────────────────────────────────────────────────

const activeFab = ref<'style' | 'export' | 'pins' | 'routes' | null>(null)
const bottomSheet = ref(false)
const editingPin = ref<Pin | null>(null)
const pendingPin = ref<Pin | null>(null)
const stickyEmoji = ref('📍')
const stickyColor = ref('#06b6d4')

// ── Composables ───────────────────────────────────────────────────────────────

const { notification, showNotification, cleanupNotification } = useNotification()

const {
  pins, hiddenPinIds, resolvingPinId, addressResolveProg,
  pinSearch, filteredPins, canUndo, allPinsHidden,
  fetchPinAddress, pushUndo, undo,
  handleDeletePin, handleUpdatePin, handlePinMove,
  togglePinVisibility, toggleAllPinVisibility, clearAllPins,
  fitToPins, zoomToPin,
  exportPinsJson, exportGeoJson, triggerImport, handleImportFile,
  resolveAddressesFromUrl,
} = usePins({ initialPins: savedState?.pins ?? [], mapTitle, leafletMap, importFileRef, showNotification })

const printSettings = usePrintSettings()

const {
  routes, isDrawingRoute, drawingRoute, drawingDistance,
  editingRoute: editingRouteRef,
  startNewRoute, stopDrawing, addPoint, undoLastPoint, removePoint,
  deleteRoute, fitToRoute, openEditRoute, closeEditRoute, saveEditRoute,
} = useRoutes({ initialRoutes: savedState?.routes ?? [], leafletMap, showNotification, distanceUnit: computed(() => printSettings.scale.value === 'mi' ? 'mi' : 'km') })

const {
  printBounds, printSnapEnabled, isDownloadingPdf, isAutoTitling,
  printPaper, printOrientation, printAspectRatio, overlayCorner,
  selectPrintPreset, resnapPrintArea, fitToPrintArea, fitPrintAreaToPins, handleBoundsSet, downloadPdf,
  cleanupPrintExport,
} = usePrintExport({ leafletMap, mapStyle, mapTitle, pins, hiddenPinIds, showNotification, printSettings })

const { scheduleUrlUpdate, copyShareLink, cleanupShareClipboard } = useShareClipboard({
  pins, mapStyle, mapTitle, leafletMap, showNotification,
})

const { mapMaxZoom, applyTileLayer, applyLabelsLayer, flyToIpLocation } = useMapLayers({
  leafletMap, mapStyle, isDark, showLabels,
})

const liveScaleUnit = computed<'km' | 'mi'>(() => printSettings.scale.value === 'mi' ? 'mi' : 'km')
function clearPrintBounds() { printBounds.value = null }

// ── Persistence ───────────────────────────────────────────────────────────────

function saveState() {
  const state: Record<string, unknown> = {
    pins: pins.value,
    routes: routes.value,
    mapStyle: mapStyle.value,
    mapTitle: mapTitle.value,
    showLabels: showLabels.value,
    showClusters: showClusters.value,
    pinDotSize: pinDotSize.value,
  }
  if (leafletMap.value) {
    const c = leafletMap.value.getCenter()
    state.center = [c.lat, c.lng]
    state.zoom = leafletMap.value.getZoom()
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

watch([pins, routes, mapStyle, mapTitle, showLabels, showClusters, pinDotSize], saveState, { deep: true })
watch([pins, mapStyle, mapTitle], scheduleUrlUpdate, { deep: true })
watch(searchLocation, (loc) => { if (!loc) searchClearTrigger.value++ })

// ── Search ────────────────────────────────────────────────────────────────────

function clearSearchLocation() {
  if (searchMarkerRef.value) searchMarkerRef.value.fade()
  else searchLocation.value = null
}

watch(searchLocation, (loc) => {
  if (loc && leafletMap.value) {
    leafletMap.value.setView([loc.lat, loc.lng], 14, { animate: true, duration: 1 })
  }
})

// ── My location ───────────────────────────────────────────────────────────────

function goToMyLocation() {
  if (!navigator.geolocation || isLocating.value) return
  isLocating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      leafletMap.value?.setView([pos.coords.latitude, pos.coords.longitude], 15, { animate: true, duration: 1 })
      isLocating.value = false
      showNotification('Navigated to your location')
    },
    (err) => {
      isLocating.value = false
      showNotification(
        err.code === err.PERMISSION_DENIED
          ? 'Location blocked — enable it in browser settings'
          : 'Could not get your location',
        'error',
      )
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  )
}

// ── FAB / panel / sheet ───────────────────────────────────────────────────────

function toggleFab(fab: 'style' | 'export' | 'pins' | 'routes') {
  if (isPlacingPin.value) isPlacingPin.value = false
  activeFab.value = activeFab.value === fab ? null : fab
}

function closeSheet() {
  bottomSheet.value = false
  editingPin.value = null
  pendingPin.value = null
}

function panMapForPin(pin: Pin) {
  if (!leafletMap.value) return
  const map = leafletMap.value
  const { clientHeight: h } = map.getContainer()
  const pinPt = map.latLngToContainerPoint([pin.lat, pin.lng])
  const newCenter = map.containerPointToLatLng(L.point(pinPt.x, pinPt.y + h * 0.28))
  map.setView(newCenter, map.getZoom(), { animate: true, duration: 0.5 })
}

function openEditPin(pin: Pin) {
  editingPin.value = { ...pin }
  activeFab.value = null
  bottomSheet.value = true
  panMapForPin(pin)
}

function handlePinSave(updated: Pin, newEmoji: string, newColor: string) {
  stickyEmoji.value = newEmoji
  stickyColor.value = newColor
  if (pendingPin.value?.id === updated.id) {
    pushUndo()
    pins.value = [...pins.value, updated]
  } else {
    handleUpdatePin(updated)
  }
  closeSheet()
}

function handlePinDelete() {
  if (!editingPin.value) return
  if (pendingPin.value?.id !== editingPin.value.id) handleDeletePin(editingPin.value.id)
  closeSheet()
}

// ── Pin placement ─────────────────────────────────────────────────────────────

function handlePinPlace(latlng: L.LatLng) {
  const pin: Pin = {
    id: Date.now(),
    name: '',
    description: '',
    emoji: stickyEmoji.value,
    color: stickyColor.value,
    lat: latlng.lat,
    lng: latlng.lng,
  }
  pendingPin.value = pin
  isPlacingPin.value = false
  openEditPin(pin)
  fetchPinAddress(latlng.lat, latlng.lng).then(address => {
    if (editingPin.value?.id === pin.id) editingPin.value = { ...editingPin.value, address }
    if (pendingPin.value?.id === pin.id) pendingPin.value = { ...pendingPin.value, address }
  })
}

function handleSearchMarkerPin(lat: number, lng: number) {
  searchLocation.value = null
  handlePinPlace(L.latLng(lat, lng))
}

function placeAtCenter() {
  if (!leafletMap.value) return
  activeFab.value = null
  const map = leafletMap.value
  const { clientWidth: w, clientHeight: h } = map.getContainer()
  const latlng = map.containerPointToLatLng(L.point(w / 2, h * 0.5))
  const pin: Pin = {
    id: Date.now(),
    name: '',
    description: '',
    emoji: stickyEmoji.value,
    color: stickyColor.value,
    lat: latlng.lat,
    lng: latlng.lng,
  }
  pendingPin.value = pin
  openEditPin(pin)
  fetchPinAddress(latlng.lat, latlng.lng).then(address => {
    if (editingPin.value?.id === pin.id) editingPin.value = { ...editingPin.value, address }
    if (pendingPin.value?.id === pin.id) pendingPin.value = { ...pendingPin.value, address }
  })
}

function handlePendingPinMove(_id: number, lat: number, lng: number) {
  if (pendingPin.value) pendingPin.value = { ...pendingPin.value, lat, lng }
  if (editingPin.value) editingPin.value = { ...editingPin.value, lat, lng }
  fetchPinAddress(lat, lng).then(address => {
    if (pendingPin.value) pendingPin.value = { ...pendingPin.value, address }
    if (editingPin.value) editingPin.value = { ...editingPin.value, address }
  })
}

// ── Map initialization ────────────────────────────────────────────────────────

function onMapReady(map: L.Map) {
  clusterGroup.value = L.markerClusterGroup({
    disableClusteringAtZoom: 17,
    showCoverageOnHover: false,
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
  }).addTo(map)

  leafletMap.value = map
  applyTileLayer(map)
  applyLabelsLayer(map)
  map.on('moveend', saveState)
  map.on('moveend', scheduleUrlUpdate)

  if (!hasExplicitLocation) flyToIpLocation(map)

  if (loadedFromUrl) {
    const missing = pins.value.filter(p => !p.address)
    if (missing.length > 0) resolveAddressesFromUrl(missing)
  }

  const updateCenter = () => { const c = map.getCenter(); mapCenterCoords.value = { lat: c.lat, lng: c.lng } }
  updateCenter()
  map.on('move', updateCenter)
  map.on('mousemove', (e: L.LeafletMouseEvent) => { pointerCoords.value = { lat: e.latlng.lat, lng: e.latlng.lng } })
  map.on('mouseout', () => { pointerCoords.value = null })

  cleanupLongPress = useLongPress(map, {
    isBlocked: () => !!(bottomSheet.value || activeFab.value),
    onPlace: handlePinPlace,
  })

  if (loadedFromUrl && pins.value.length > 0) {
    requestAnimationFrame(() => {
      map.fitBounds(pins.value.map(p => [p.lat, p.lng] as [number, number]), { padding: [60, 60], animate: false })
    })
  }
}

function handleMapClick(e: L.LeafletMouseEvent) {
  if (isPlacingPin.value) handlePinPlace(e.latlng)
  else if (isDrawingRoute.value) addPoint(e.latlng.lat, e.latlng.lng)
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showInfo.value) { closeInfo(); return }
    if (editingRouteRef.value) { closeEditRoute(); return }
    if (bottomSheet.value) { closeSheet(); return }
    if (activeFab.value) { activeFab.value = null; return }
    if (showSearch.value) { showSearch.value = false; return }
    if (isPlacingPin.value) { isPlacingPin.value = false; return }
    if (isDrawingRoute.value) { stopDrawing(); return }
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && isDrawingRoute.value) {
    const target = e.target as HTMLElement
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
      e.preventDefault()
      undoLastPoint()
      return
    }
  }
  if (!((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey)) return
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  e.preventDefault()
  undo()
}

// ── Watchers ──────────────────────────────────────────────────────────────────

watch([isPlacingPin, isDrawingRoute, leafletMap], ([placing, drawing, map]) => {
  if (map) map.getContainer().style.cursor = (placing || drawing) ? 'crosshair' : ''
})

watch(isDark, (dark) => {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#18181b' : '#ffffff')
}, { immediate: true })

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => document.addEventListener('keydown', handleGlobalKeyDown))

onUnmounted(() => {
  cleanupNotification()
  cleanupShareClipboard()
  cleanupPrintExport()
  document.removeEventListener('keydown', handleGlobalKeyDown)
  cleanupLongPress?.()
})

// ── Style helpers ─────────────────────────────────────────────────────────────

const panelClass ='absolute right-16 top-4 z-1000 w-80 max-w-[calc(100vw-80px)] bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[80vh] no-print'
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-sans transition-colors duration-200">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <AppHeader
      :color-mode="colorMode"
      :show-search="showSearch"
      :search-clear-trigger="searchClearTrigger"
      @cycle-color-mode="cycleColorMode"
      @update:show-search="showSearch = $event"
      @location-select="(loc) => { searchLocation = loc; showNotification(`Navigated to ${loc.label}`) }"
      @clear-search="clearSearchLocation"
      @open-info="showInfo = true"
    />

    <!-- ── Mobile search panel ──────────────────────────────────────────── -->
    <Transition name="mf-search-bar">
      <div
        v-if="showSearch"
        class="sm:hidden bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 shrink-0 z-900 no-print"
      >
        <MapSearch
          :auto-focus="true"
          :clear-trigger="searchClearTrigger"
          @location-select="(loc) => { searchLocation = loc; showNotification(`Navigated to ${loc.label}`); showSearch = false }"
          @clear="clearSearchLocation"
        />
      </div>
    </Transition>

    <!-- ── Map ──────────────────────────────────────────────────────────── -->
    <div class="flex-1 min-h-0 relative map-print-container">
      <div v-if="mapTitle" class="print-map-title">{{ mapTitle }}</div>

      <LMap
        :zoom="initialZoom"
        :center="initialCenter"
        :use-global-leaflet="false"
        :max-zoom="mapMaxZoom"
        style="height: 100%; width: 100%;"
        @ready="onMapReady"
        @click="handleMapClick"
      />

      <template v-if="leafletMap && clusterGroup">
        <PrintAreaDrawer
          :map="leafletMap"
          :print-bounds="printBounds"
          :aspect-ratio="printAspectRatio"
          :snap-enabled="printSnapEnabled"
          :grid-cols="Number(printSettings.grid.value.split('x')[0]) || 1"
          :grid-rows="Number(printSettings.grid.value.split('x')[1]) || 1"
          :overlay-corner="overlayCorner"
          @bounds-set="handleBoundsSet"
        />
        <PinMarker
          v-for="pin in pins"
          :key="pin.id"
          :pin="pin"
          :map="leafletMap"
          :layer="showClusters ? clusterGroup : undefined"
          :hidden="hiddenPinIds.has(pin.id)"
          :dot-size="pinDotSize"
          @delete="handleDeletePin"
          @move="handlePinMove"
          @edit="openEditPin"
          @copy="coords => showNotification(`Copied: ${coords}`)"
        />
        <PinMarker
          v-if="pendingPin"
          :key="`pending-${pendingPin.id}`"
          :pin="pendingPin"
          :map="leafletMap"
          :pending="true"
          :dot-size="pinDotSize"
          @move="handlePendingPinMove"
        />
        <SearchMarker
          v-if="searchLocation"
          :key="`${searchLocation.lat}-${searchLocation.lng}`"
          ref="searchMarkerRef"
          :lat="searchLocation.lat"
          :lng="searchLocation.lng"
          :map="leafletMap"
          @pin="handleSearchMarkerPin"
          @dismiss="searchLocation = null"
        />
        <RouteLayer
          v-if="routes.length > 0"
          :routes="routes"
          :map="leafletMap"
          :drawing-route-id="isDrawingRoute ? drawingRoute?.id ?? null : null"
          @remove-point="removePoint"
        />
      </template>

      <PrintLegend :title="mapTitle" :pins="pins" />

      <!-- Placing indicator -->
      <Transition name="mf-fade">
        <div
          v-if="isPlacingPin"
          class="absolute top-4 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-2 bg-amber-400/95 text-gray-900 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg no-print pointer-events-auto"
        >
          Tap map to place pin
          <button class="ml-1 hover:opacity-70 transition-opacity" @click.stop="isPlacingPin = false">✕</button>
        </div>
      </Transition>

      <!-- Drawing route indicator -->
      <Transition name="mf-fade">
        <div
          v-if="isDrawingRoute && drawingRoute"
          class="absolute top-4 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-2 bg-cyan-500/95 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg no-print pointer-events-auto"
        >
          <span class="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/50" :style="{ background: drawingRoute.color }" />
          {{ drawingRoute.name }}
          <span v-if="drawingDistance" class="font-normal opacity-80">· {{ drawingDistance }}</span>
          <button class="ml-1 font-normal opacity-80 hover:opacity-100 transition-opacity" @click.stop="stopDrawing">Done</button>
        </div>
      </Transition>

      <!-- FAB panel backdrop -->
      <div v-if="activeFab" class="absolute inset-0 z-800 no-print" @click="activeFab = null" />

      <!-- Map Style panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'style'" :class="panelClass">
          <div class="p-4 overflow-y-auto">
            <MapOptions
              :map-style="mapStyle"
              :show-labels="showLabels"
              :show-clusters="showClusters"
              :pin-dot-size="pinDotSize"
              @style-change="mapStyle = $event"
              @labels-change="showLabels = $event"
              @clusters-change="showClusters = $event"
              @dot-size-change="pinDotSize = $event"
            />
          </div>
        </div>
      </Transition>

      <!-- Print & Export panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'export'" :class="panelClass">
          <PrintExportPanel
            v-model:map-title="mapTitle"
            v-model:auto-title="printSettings.autoTitle.value"
            v-model:print-paper="printPaper"
            v-model:print-orientation="printOrientation"
            v-model:print-grid="printSettings.grid.value"
            v-model:print-snap-enabled="printSnapEnabled"
            v-model:include-legend="printSettings.legend.value"
            v-model:include-compass="printSettings.compass.value"
            v-model:scale-unit="printSettings.scale.value"
            v-model:enhance-contrast="printSettings.contrast.value"
            :is-auto-titling="isAutoTitling"
            :print-bounds="printBounds"
            :print-aspect-ratio="printAspectRatio"
            :is-downloading-pdf="isDownloadingPdf"
            :map-style="mapStyle"
            @select-preset="selectPrintPreset"
            @resnap-print-area="resnapPrintArea"
            @fit-to-print-area="fitToPrintArea"
            @fit-to-pins="fitPrintAreaToPins"
            @clear-print-bounds="clearPrintBounds"
            @download-pdf="downloadPdf"
          />
        </div>
      </Transition>

      <!-- Routes panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'routes'" :class="panelClass">
          <RoutesPanel
            :routes="routes"
            :drawing-route-id="isDrawingRoute ? (drawingRoute?.id ?? null) : null"
            :distance-unit="printSettings.scale.value === 'mi' ? 'mi' : 'km'"
            @new-route="() => { startNewRoute(); activeFab = null }"
            @fit-to-route="fitToRoute"
            @edit-route="openEditRoute"
            @delete-route="deleteRoute"
          />
        </div>
      </Transition>

      <!-- Pins panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'pins'" :class="panelClass">
          <PinsPanel
            v-model:pin-search="pinSearch"
            :pins="pins"
            :filtered-pins="filteredPins"
            :hidden-pin-ids="hiddenPinIds"
            :can-undo="canUndo"
            :all-pins-hidden="allPinsHidden"
            :resolving-pin-id="resolvingPinId"
            @place-at-center="placeAtCenter"
            @fit-to-pins="fitToPins"
            @undo="undo"
            @toggle-all-visibility="toggleAllPinVisibility"
            @clear-all="clearAllPins"
            @delete-pin="handleDeletePin"
            @edit-pin="openEditPin"
            @zoom-to-pin="zoomToPin"
            @toggle-visibility="togglePinVisibility"
            @export-json="exportPinsJson"
            @export-geojson="exportGeoJson"
            @import="triggerImport"
          />
        </div>
      </Transition>

      <!-- Scale bar + coordinate display -->
      <div class="absolute left-2 z-500 no-print pointer-events-none flex flex-col items-start gap-1" style="bottom: calc(0.75rem + env(safe-area-inset-bottom))">
        <div v-if="displayCoords" class="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm text-xs font-mono text-gray-500 dark:text-zinc-400 px-2 py-1 rounded shadow-sm border border-gray-200/60 dark:border-zinc-700/60 tabular-nums">
          {{ displayCoords.lat.toFixed(5) }}, {{ displayCoords.lng.toFixed(5) }}
        </div>
        <ScaleBar v-if="printSettings.scale.value !== 'off' && leafletMap" :map="leafletMap" :unit="liveScaleUnit" />
      </div>

      <!-- FAB stack -->
      <MapFabStack
        :active-fab="activeFab"
        :pin-count="pins.length"
        :route-count="routes.length"
        :is-locating="isLocating"
        @toggle="toggleFab"
        @locate="goToMyLocation"
        @share="copyShareLink"
      />
    </div>

    <!-- ── Bottom sheet backdrop ─────────────────────────────────────────── -->
    <Transition name="mf-fade">
      <div
        v-if="bottomSheet"
        class="fixed inset-0 z-1700 bg-black/30 no-print"
        @click="closeSheet"
      />
    </Transition>

    <!-- ── Edit Pin sheet ─────────────────────────────────────────────────── -->
    <Transition name="mf-sheet">
      <PinEditSheet
        :show="bottomSheet"
        :editing-pin="editingPin"
        :pending-pin="pendingPin"
        :pin-dot-size="pinDotSize"
        @save="handlePinSave"
        @delete="handlePinDelete"
        @close="closeSheet"
      />
    </Transition>

    <!-- ── Edit Route sheet ─────────────────────────────────────────────────── -->
    <Transition name="mf-fade">
      <div
        v-if="editingRouteRef"
        class="fixed inset-0 z-1700 bg-black/30 no-print"
        @click="closeEditRoute"
      />
    </Transition>
    <Transition name="mf-sheet">
      <RouteEditSheet
        :show="!!editingRouteRef"
        :editing-route="editingRouteRef"
        :distance-unit="printSettings.scale.value === 'mi' ? 'mi' : 'km'"
        @save="saveEditRoute"
        @delete="() => { if (editingRouteRef) deleteRoute(editingRouteRef.id) }"
        @close="closeEditRoute"
      />
    </Transition>

    <!-- ── Welcome modal ──────────────────────────────────────────────────── -->
    <WelcomeModal :show="showInfo" @close="closeInfo" />

    <!-- ── Address resolve toast ─────────────────────────────────────────── -->
    <Transition name="mf-toast">
      <div
        v-if="addressResolveProg"
        class="fixed top-16 left-1/2 -translate-x-1/2 bg-cyan-500 text-white text-sm px-4 pt-2.5 pb-2 rounded shadow-lg z-1999 no-print min-w-52"
      >
        <div class="whitespace-nowrap mb-1.5">Resolving addresses {{ addressResolveProg.done }} / {{ addressResolveProg.total }}</div>
        <div class="h-1 bg-cyan-400/50 rounded-full overflow-hidden">
          <div
            class="h-full bg-white/80 rounded-full transition-[width] duration-500"
            :style="{ width: `${(addressResolveProg.done / addressResolveProg.total) * 100}%` }"
          />
        </div>
      </div>
    </Transition>

    <!-- ── Notification toast ─────────────────────────────────────────────── -->
    <div
      v-if="notification"
      :class="[
        'fixed top-16 left-1/2 -translate-x-1/2 text-white text-sm px-4 py-2.5 rounded shadow-lg z-2000 animate-[slideIn_0.25s_ease] no-print whitespace-nowrap',
        notification.type === 'error' ? 'bg-rose-500' : notification.type === 'info' ? 'bg-cyan-500' : 'bg-emerald-500'
      ]"
    >
      {{ notification.message }}
    </div>

    <!-- Hidden file input -->
    <input
      ref="importFileRef"
      type="file"
      accept=".json,.geojson"
      class="hidden"
      @change="handleImportFile"
    />
  </div>
</template>

<style>
.mf-toast-enter-active,
.mf-toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.mf-toast-enter-from,
.mf-toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(-6px); }
.mf-toast-enter-to,
.mf-toast-leave-from { transform: translateX(-50%) translateY(0); }

.mf-panel-enter-active,
.mf-panel-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.mf-panel-enter-from,
.mf-panel-leave-to { opacity: 0; transform: scale(0.96) translateY(6px); }

.mf-sheet-enter-active,
.mf-sheet-leave-active { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.mf-sheet-enter-from,
.mf-sheet-leave-to { transform: translateY(100%); }

.mf-fade-enter-active,
.mf-fade-leave-active { transition: opacity 0.2s ease; }
.mf-fade-enter-from,
.mf-fade-leave-to { opacity: 0; }

.mf-search-bar-enter-active,
.mf-search-bar-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.mf-search-bar-enter-from,
.mf-search-bar-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
