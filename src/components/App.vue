<script setup lang="ts">
import 'leaflet.markercluster'

import { LMap } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'

import type { SearchLocation } from '@/components/MapSearch.vue'
import type { MapStyle, Pin, PinDotSize, Route } from '@/types'
import { decodeShareState } from '@/utils'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

// ── Welcome modal ─────────────────────────────────────────────────────────────

const WELCOME_KEY = 'mapfolio_welcome_seen'
const showInfo = ref(!localStorage.getItem(WELCOME_KEY))

function closeInfo() {
  localStorage.setItem(WELCOME_KEY, '1')
  showInfo.value = false
}

// ── Multi-map state ───────────────────────────────────────────────────────────

const { maps, activeId, activeMap, updateActiveMap, createMap, switchMap, deleteMap, renameMap, duplicateMap, exportMap, exportMapAsGeoJson, exportAllMaps, importMapFromData } = useMaps()

// ── Initial state: URL hash takes priority over active map ────────────────────

const urlHash = location.hash.slice(1)
const urlState = urlHash ? decodeShareState(urlHash) : null
const loadedFromUrl = !!urlState

if (urlState && activeMap.value.pins.length > 0) {
  const addrById = new Map<number, string>(activeMap.value.pins.filter((p) => p.address).map((p) => [p.id, p.address!]))
  urlState.pins = urlState.pins.map((p) => (addrById.has(p.id) ? { ...p, address: addrById.get(p.id) } : p))
}

// ── Core reactive state ───────────────────────────────────────────────────────

const mapStyle = ref<MapStyle>(urlState?.mapStyle ?? activeMap.value.mapStyle)
const showLabels = ref<boolean>(activeMap.value.showLabels)
const showClusters = ref<boolean>(activeMap.value.showClusters)
const pinDotSize = ref<PinDotSize>(activeMap.value.pinDotSize)
const mapName = computed<string>({
  get: () => activeMap.value.name,
  set: (v: string) => updateActiveMap({ name: v })
})
const mapArea = ref<string>(activeMap.value.area ?? '')

const leafletMap = shallowRef<L.Map | null>(null)
let cleanupLongPress: (() => void) | null = null
const clusterGroup = shallowRef<L.MarkerClusterGroup | null>(null)

const showSearch = ref(false)
const isPlacingPin = ref(false)
const isLocating = ref(false)
const importFileRef = ref<HTMLInputElement | null>(null)
const routeImportFileRef = ref<HTMLInputElement | null>(null)
const mapImportFileRef = ref<HTMLInputElement | null>(null)

const searchLocation = ref<SearchLocation | null>(null)
const searchClearTrigger = ref(0)
const searchMarkerRef = ref<{ fade: () => void } | null>(null)

const pointerCoords = ref<{ lat: number; lng: number } | null>(null)
const mapCenterCoords = ref<{ lat: number; lng: number } | null>(null)
const displayCoords = computed(() => pointerCoords.value ?? mapCenterCoords.value)
const drawingPreviewLine = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

const hasExplicitLocation = !!(urlState?.center ?? (!loadedFromUrl && activeMap.value.center))
const initialCenter: [number, number] = urlState?.center ?? (!loadedFromUrl && activeMap.value.center ? activeMap.value.center : [40.7128, -74.006])
const initialZoom: number = urlState?.zoom ?? (!loadedFromUrl && activeMap.value.zoom ? activeMap.value.zoom : 13)

// ── FAB / sheet state ─────────────────────────────────────────────────────────

const activeFab = ref<'style' | 'export' | 'pins' | 'routes' | null>(null)
const bottomSheet = ref(false)
const editingPin = ref<Pin | null>(null)
const pendingPin = ref<Pin | null>(null)
const stickyEmoji = ref('📍')
const stickyColor = ref('#06b6d4')

// ── Composables ───────────────────────────────────────────────────────────────

const { notification, showNotification, cleanupNotification } = useNotification()

const { pins, hiddenPinIds, resolvingPinId, addressResolveProg, pinSearch, filteredPins, canUndo, allPinsHidden, fetchPinAddress, pushUndo, undo, handleDeletePin, handleUpdatePin, handlePinMove, togglePinVisibility, toggleAllPinVisibility, clearAllPins, fitToPins, zoomToPin, exportPinsJson, exportGeoJson, triggerImport, handleImportFile, resolveAddressesFromUrl, resetPins } = usePins({ initialPins: urlState?.pins ?? activeMap.value.pins, mapTitle: mapName, leafletMap, importFileRef, showNotification })

const printSettings = usePrintSettings()

const { routes, hiddenRouteIds, allRoutesHidden, isDrawingRoute, drawingRoute, drawingDistance, drawingAnchorIndex, editingRoute: editingRouteRef, routeSnapEnabled, startNewRoute, continueDrawing, stopDrawing, addPoint, undoLastPoint, removePoint, movePoint, moveRoute, deleteRoute, fitToAllRoutes, openEditRoute, closeEditRoute, saveEditRoute, toggleRouteVisibility, toggleAllRouteVisibility, clearAllRoutes, exportRoutesJson, exportRoutesGeoJson, triggerRouteImport, handleRouteImportFile, resetRoutes, breakWaypointLink, cleanupOrphanedLinks } = useRoutes({ initialRoutes: activeMap.value.routes, mapTitle: mapName, leafletMap, routeImportFileRef, showNotification, distanceUnit: computed(() => (printSettings.scale.value === 'mi' ? 'mi' : 'km')) })

const linkedPinIds = computed(() => new Set(routes.value.flatMap((r) => r.points.map((p) => p.pinId).filter((id): id is number => id !== undefined))))

const { printBounds, printSnapEnabled, isDownloadingPdf, isAutoArea, printPaper, printOrientation, printAspectRatio, overlayCorner, selectPrintPreset, resnapPrintArea, fitToPrintArea, fitPrintAreaToPins, handleBoundsSet, downloadPdf } = usePrintExport({ leafletMap, mapStyle, mapName, mapArea, pins, hiddenPinIds, showNotification, printSettings })

const { scheduleUrlUpdate, copyShareLink, cleanupShareClipboard } = useShareClipboard({
  pins,
  mapStyle,
  mapTitle: mapName,
  leafletMap,
  showNotification
})

const { mapMaxZoom, applyTileLayer, applyLabelsLayer, flyToIpLocation } = useMapLayers({
  leafletMap,
  mapStyle,
  isDark,
  showLabels
})

const liveScaleUnit = computed<'km' | 'mi'>(() => (printSettings.scale.value === 'mi' ? 'mi' : 'km'))

// ── Map management ────────────────────────────────────────────────────────────

const { showMapsPanel, saveState, doSwitchMap, doCreateMap, doDeleteMap, doDuplicateMap, handleMapImportFile } = useMapManager({
  activeId,
  activeMap,
  updateActiveMap,
  createMap,
  switchMap,
  deleteMap,
  duplicateMap,
  importMapFromData,
  leafletMap,
  mapStyle,
  showLabels,
  showClusters,
  pinDotSize,
  mapArea,
  pins,
  routes,
  showNotification,
  mapImportFileRef,
  resetPins,
  resetRoutes
})

// ── Route helpers ─────────────────────────────────────────────────────────────

function handleExtendFrom(routeId: number, pointIndex: number) {
  const route = routes.value.find((r) => r.id === routeId)
  if (!route) return
  const n = route.points.length
  const insertAfter = pointIndex === 0 ? -1 : pointIndex === n - 1 ? null : pointIndex
  continueDrawing(routeId, insertAfter)
}

function handleMovePoint(routeId: number, pointIndex: number, lat: number, lng: number, pinId?: number) {
  const existingPinId = routes.value.find((r) => r.id === routeId)?.points[pointIndex]?.pinId
  const linkedPinId = pinId ?? existingPinId
  movePoint(routeId, pointIndex, lat, lng, pinId)
  if (linkedPinId) handlePinMove(linkedPinId, lat, lng)
}

function handleMoveRoute(routeId: number, points: Array<{ lat: number; lng: number }>) {
  const oldPoints = routes.value.find((r) => r.id === routeId)?.points ?? []
  oldPoints.forEach((oldPt, i) => {
    if (oldPt.pinId && points[i]) handlePinMove(oldPt.pinId, points[i]!.lat, points[i]!.lng)
  })
  moveRoute(routeId, points)
}

const { handleClickRoute, handleWaypointTap } = useRoutePopup({
  routes,
  pins,
  leafletMap,
  distanceUnit: liveScaleUnit,
  isDrawingRoute,
  onEditRoute: openEditRoute,
  onContinueDrawing: continueDrawing,
  onToggleVisibility: toggleRouteVisibility,
  onDeleteRoute: deleteRoute,
  onExtendFrom: handleExtendFrom,
  onRemoveWaypoint: removePoint,
  onBreakLink: breakWaypointLink
})

function clearPrintBounds() {
  printBounds.value = null
}
function reorderPins(newPins: Pin[]) {
  pins.value = newPins
}
function reorderRoutes(newRoutes: Route[]) {
  routes.value = newRoutes
}

// ── URL sync ──────────────────────────────────────────────────────────────────

watch([pins, mapStyle, mapName], scheduleUrlUpdate, { deep: true })

// ── Search ────────────────────────────────────────────────────────────────────

function clearSearchLocation() {
  if (searchMarkerRef.value) searchMarkerRef.value.fade()
  else searchLocation.value = null
}

watch(searchLocation, (loc) => {
  if (!loc) searchClearTrigger.value++
  else if (leafletMap.value) leafletMap.value.setView([loc.lat, loc.lng], 15, { animate: true, duration: 1 })
})

// ── My location ───────────────────────────────────────────────────────────────

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
      showNotification(err.code === err.PERMISSION_DENIED ? 'Location blocked — enable it in browser settings' : 'Could not get your location', 'error')
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  )
}

// ── FAB / panel / sheet ───────────────────────────────────────────────────────

function toggleMapsPanel() {
  showMapsPanel.value = !showMapsPanel.value
  if (showMapsPanel.value) activeFab.value = null
}

function toggleFab(fab: 'style' | 'export' | 'pins' | 'routes') {
  if (isPlacingPin.value) isPlacingPin.value = false
  showMapsPanel.value = false
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
  if (pendingPin.value?.id !== editingPin.value.id) {
    cleanupOrphanedLinks(editingPin.value.id)
    handleDeletePin(editingPin.value.id)
  }
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
    lng: latlng.lng
  }
  pendingPin.value = pin
  isPlacingPin.value = false
  openEditPin(pin)
  fetchPinAddress(latlng.lat, latlng.lng).then((address) => {
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
    lng: latlng.lng
  }
  pendingPin.value = pin
  openEditPin(pin)
  fetchPinAddress(latlng.lat, latlng.lng).then((address) => {
    if (editingPin.value?.id === pin.id) editingPin.value = { ...editingPin.value, address }
    if (pendingPin.value?.id === pin.id) pendingPin.value = { ...pendingPin.value, address }
  })
}

function handlePendingPinMove(_id: number, lat: number, lng: number) {
  if (pendingPin.value) pendingPin.value = { ...pendingPin.value, lat, lng }
  if (editingPin.value) editingPin.value = { ...editingPin.value, lat, lng }
  fetchPinAddress(lat, lng).then((address) => {
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
    spiderfyOnMaxZoom: true
  }).addTo(map)

  leafletMap.value = map
  applyTileLayer(map)
  applyLabelsLayer(map)
  map.on('moveend', saveState)
  map.on('moveend', scheduleUrlUpdate)

  if (!hasExplicitLocation) flyToIpLocation(map)

  if (loadedFromUrl) {
    const missing = pins.value.filter((p) => !p.address)
    if (missing.length > 0) resolveAddressesFromUrl(missing)
  }

  const updateCenter = () => {
    const c = map.getCenter()
    mapCenterCoords.value = { lat: c.lat, lng: c.lng }
  }
  updateCenter()
  map.on('move', updateCenter)
  map.on('mousemove', (e: L.LeafletMouseEvent) => {
    pointerCoords.value = { lat: e.latlng.lat, lng: e.latlng.lng }
    const anchorIdx = drawingAnchorIndex.value
    const anchorPt = anchorIdx !== null ? drawingRoute.value?.points[anchorIdx] : undefined
    if (isDrawingRoute.value && anchorPt && map.dragging.enabled()) {
      const fromPx = map.latLngToContainerPoint([anchorPt.lat, anchorPt.lng])
      const toPxRaw = map.latLngToContainerPoint(e.latlng)
      const dx = toPxRaw.x - fromPx.x
      const dy = toPxRaw.y - fromPx.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      let x2 = toPxRaw.x
      let y2 = toPxRaw.y
      // Pin snap preview (magnet)
      if (routeSnapEnabled.value) {
        const SNAP_PX = 28
        for (const pin of pins.value) {
          if (hiddenPinIds.value.has(pin.id) || linkedPinIds.value.has(pin.id)) continue
          const pinPx = map.latLngToContainerPoint([pin.lat, pin.lng])
          if (Math.hypot(toPxRaw.x - pinPx.x, toPxRaw.y - pinPx.y) < SNAP_PX) {
            x2 = pinPx.x
            y2 = pinPx.y
            break
          }
        }
      }
      // Angle snap preview (shift-only, skip if already pin-snapped)
      if (x2 === toPxRaw.x && y2 === toPxRaw.y && e.originalEvent.shiftKey && dist > 0) {
        const snappedAngle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12)
        x2 = fromPx.x + dist * Math.cos(snappedAngle)
        y2 = fromPx.y + dist * Math.sin(snappedAngle)
      }
      drawingPreviewLine.value = { x1: fromPx.x, y1: fromPx.y, x2, y2 }
    } else {
      drawingPreviewLine.value = null
    }
  })
  map.on('mouseout', () => {
    pointerCoords.value = null
    drawingPreviewLine.value = null
  })

  cleanupLongPress = useLongPress(map, {
    isBlocked: () => !!(bottomSheet.value || activeFab.value || showMapsPanel.value),
    onPlace: handlePinPlace
  })

  if (loadedFromUrl && pins.value.length > 0) {
    requestAnimationFrame(() => {
      map.fitBounds(
        pins.value.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [60, 60], animate: false }
      )
    })
  }
}

function handleMapClick(e: L.LeafletMouseEvent) {
  if (isPlacingPin.value) handlePinPlace(e.latlng)
  else if (isDrawingRoute.value) {
    let { lat, lng } = e.latlng
    const map = leafletMap.value!
    const shiftHeld = e.originalEvent.shiftKey
    let snappedPinId: number | undefined

    // Pin snap (magnet): snap to nearest visible, unlinked pin within threshold
    if (routeSnapEnabled.value) {
      const SNAP_PX = 28
      const toPx = map.latLngToContainerPoint([lat, lng])
      for (const pin of pins.value) {
        if (hiddenPinIds.value.has(pin.id) || linkedPinIds.value.has(pin.id)) continue
        const pinPx = map.latLngToContainerPoint([pin.lat, pin.lng])
        if (Math.hypot(toPx.x - pinPx.x, toPx.y - pinPx.y) < SNAP_PX) {
          lat = pin.lat
          lng = pin.lng
          snappedPinId = pin.id
          break
        }
      }
    }

    // Angle snap (shift-only, skip when already pin-snapped)
    if (!snappedPinId && shiftHeld) {
      const snapAnchorIdx = drawingAnchorIndex.value
      const lastPt = snapAnchorIdx !== null ? drawingRoute.value?.points[snapAnchorIdx] : undefined
      if (lastPt) {
        const fromPx = map.latLngToContainerPoint([lastPt.lat, lastPt.lng])
        const toPx = map.latLngToContainerPoint([lat, lng])
        const dx = toPx.x - fromPx.x
        const dy = toPx.y - fromPx.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const snappedAngle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12)
        const snappedLatLng = map.containerPointToLatLng(L.point(fromPx.x + dist * Math.cos(snappedAngle), fromPx.y + dist * Math.sin(snappedAngle)))
        lat = snappedLatLng.lat
        lng = snappedLatLng.lng
      }
    }

    addPoint(lat, lng, snappedPinId)
  }
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

useKeyboardShortcuts({
  showInfo,
  closeInfo,
  editingRoute: editingRouteRef,
  closeEditRoute,
  bottomSheet,
  closeSheet,
  showMapsPanel,
  activeFab,
  showSearch,
  isPlacingPin,
  isDrawingRoute,
  stopDrawing,
  undoLastPoint,
  undo
})

// ── Watchers ──────────────────────────────────────────────────────────────────

watch([isPlacingPin, isDrawingRoute, leafletMap], ([placing, drawing, map]) => {
  if (map) map.getContainer().style.cursor = placing || drawing ? 'crosshair' : ''
})

watch(
  isDark,
  (dark) => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#18181b' : '#ffffff')
  },
  { immediate: true }
)

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onUnmounted(() => {
  cleanupNotification()
  cleanupShareClipboard()
  cleanupLongPress?.()
})

// ── Style helpers ─────────────────────────────────────────────────────────────

const panelClass = 'absolute right-16 top-4 z-1000 w-80 max-w-[calc(100vw-80px)] bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[80vh] no-print'
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-sans transition-colors duration-200">
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <AppHeader
      :show-search="showSearch"
      :search-clear-trigger="searchClearTrigger"
      :active-map-name="activeMap.name"
      :is-locating="isLocating"
      @update:show-search="showSearch = $event"
      @location-select="
        (loc) => {
          searchLocation = loc
          showNotification(`Navigated to ${loc.label}`)
        }
      "
      @clear-search="clearSearchLocation"
      @open-info="showInfo = true"
      @open-maps="toggleMapsPanel"
      @share="copyShareLink"
      @locate="goToMyLocation"
    />

    <!-- ── Mobile search panel ──────────────────────────────────────────── -->
    <Transition name="mf-search-bar">
      <div v-if="showSearch" class="sm:hidden bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 shrink-0 z-900 no-print">
        <MapSearch
          :auto-focus="true"
          :clear-trigger="searchClearTrigger"
          @location-select="
            (loc) => {
              searchLocation = loc
              showNotification(`Navigated to ${loc.label}`)
              showSearch = false
            }
          "
          @clear="clearSearchLocation"
        />
      </div>
    </Transition>

    <!-- ── Map ──────────────────────────────────────────────────────────── -->
    <div class="flex-1 min-h-0 relative map-print-container">
      <div class="print-map-title">{{ mapName }}</div>
      <div v-if="mapArea" class="print-map-area">{{ mapArea }}</div>

      <LMap :zoom="initialZoom" :center="initialCenter" :use-global-leaflet="false" :max-zoom="mapMaxZoom" style="height: 100%; width: 100%" @ready="onMapReady" @click="handleMapClick" />

      <svg v-if="drawingPreviewLine" class="absolute inset-0 w-full h-full pointer-events-none no-print" style="z-index: 500; overflow: visible">
        <line :x1="drawingPreviewLine.x1" :y1="drawingPreviewLine.y1" :x2="drawingPreviewLine.x2" :y2="drawingPreviewLine.y2" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="5,4" stroke-linecap="round" />
      </svg>

      <template v-if="leafletMap && clusterGroup">
        <PrintAreaDrawer :map="leafletMap" :print-bounds="printBounds" :aspect-ratio="printAspectRatio" :snap-enabled="printSnapEnabled" :grid-cols="Number(printSettings.grid.value.split('x')[0]) || 1" :grid-rows="Number(printSettings.grid.value.split('x')[1]) || 1" :overlay-corner="overlayCorner" @bounds-set="handleBoundsSet" />
        <PinMarker v-for="pin in pins" :key="pin.id" :pin="pin" :map="leafletMap" :layer="showClusters ? clusterGroup : undefined" :hidden="hiddenPinIds.has(pin.id)" :dot-size="pinDotSize" :locked="linkedPinIds.has(pin.id)" @delete="handleDeletePin" @hide="togglePinVisibility" @move="handlePinMove" @edit="openEditPin" @copy="(coords) => showNotification(`Copied: ${coords}`)" />
        <PinMarker v-if="pendingPin" :key="`pending-${pendingPin.id}`" :pin="pendingPin" :map="leafletMap" :pending="true" :dot-size="pinDotSize" @move="handlePendingPinMove" />
        <SearchMarker v-if="searchLocation" :key="`${searchLocation.lat}-${searchLocation.lng}`" ref="searchMarkerRef" :lat="searchLocation.lat" :lng="searchLocation.lng" :map="leafletMap" @pin="handleSearchMarkerPin" @dismiss="searchLocation = null" />
        <RouteLayer v-if="routes.length > 0" :routes="routes" :hidden-route-ids="hiddenRouteIds" :map="leafletMap" :drawing-route-id="isDrawingRoute ? (drawingRoute?.id ?? null) : null" :drawing-anchor-index="isDrawingRoute ? drawingAnchorIndex : null" :pins="pins" @remove-point="removePoint" @move-point="handleMovePoint" @move-route="handleMoveRoute" @click-route="handleClickRoute" @tap-waypoint="handleWaypointTap" />
      </template>

      <PrintLegend :title="mapName" :area="mapArea" :pins="pins" />

      <!-- Placing indicator -->
      <Transition name="mf-fade">
        <div v-if="isPlacingPin" class="absolute top-4 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-2 bg-amber-400/95 text-gray-900 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg no-print pointer-events-auto">
          Tap map to place pin
          <button class="ml-1 hover:opacity-70 transition-opacity" @click.stop="isPlacingPin = false">✕</button>
        </div>
      </Transition>

      <!-- Drawing route indicator -->
      <Transition name="mf-fade">
        <DrawingRouteIndicator v-if="isDrawingRoute && drawingRoute" :route="drawingRoute" :distance="drawingDistance" :snap-enabled="routeSnapEnabled" @update:snap-enabled="routeSnapEnabled = $event" @undo="undoLastPoint" @done="stopDrawing" />
      </Transition>

      <!-- Maps panel backdrop -->
      <div v-if="showMapsPanel" class="absolute inset-0 z-800 no-print" @click="showMapsPanel = false" />

      <!-- Maps panel -->
      <Transition name="mf-panel">
        <div v-if="showMapsPanel" class="absolute left-4 top-4 z-1000 w-80 max-w-[calc(100vw-80px)] bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[80vh] no-print">
          <MapsPanel :maps="maps" :active-id="activeId" @switch="doSwitchMap" @create="doCreateMap" @rename="(id, name) => renameMap(id, name)" @duplicate="doDuplicateMap" @delete="doDeleteMap" @export="exportMap" @export-geojson="exportMapAsGeoJson" @export-all="exportAllMaps" @import="mapImportFileRef?.click()" @close="showMapsPanel = false" />
        </div>
      </Transition>

      <!-- FAB panel backdrop -->
      <div v-if="activeFab" class="absolute inset-0 z-800 no-print" @click="activeFab = null" />

      <!-- Map Style panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'style'" :class="panelClass">
          <div class="p-4 overflow-y-auto">
            <MapOptions :map-style="mapStyle" :show-labels="showLabels" :show-clusters="showClusters" @style-change="mapStyle = $event" @labels-change="showLabels = $event" @clusters-change="showClusters = $event" />
          </div>
        </div>
      </Transition>

      <!-- Print & Export panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'export'" :class="panelClass">
          <PrintExportPanel v-model:map-name="mapName" v-model:map-area="mapArea" v-model:print-paper="printPaper" v-model:print-orientation="printOrientation" v-model:print-grid="printSettings.grid.value" v-model:print-snap-enabled="printSnapEnabled" v-model:include-legend="printSettings.legend.value" v-model:include-compass="printSettings.compass.value" v-model:scale-unit="printSettings.scale.value" v-model:enhance-contrast="printSettings.contrast.value" :is-auto-area="isAutoArea" :print-bounds="printBounds" :print-aspect-ratio="printAspectRatio" :is-downloading-pdf="isDownloadingPdf" :map-style="mapStyle" @select-preset="selectPrintPreset" @resnap-print-area="resnapPrintArea" @fit-to-print-area="fitToPrintArea" @fit-to-pins="fitPrintAreaToPins" @clear-print-bounds="clearPrintBounds" @download-pdf="downloadPdf" />
        </div>
      </Transition>

      <!-- Routes panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'routes'" :class="panelClass">
          <RoutesPanel
            :routes="routes"
            :hidden-route-ids="hiddenRouteIds"
            :all-routes-hidden="allRoutesHidden"
            :drawing-route-id="isDrawingRoute ? (drawingRoute?.id ?? null) : null"
            :distance-unit="liveScaleUnit"
            @new-route="
              () => {
                startNewRoute()
                activeFab = null
              }
            "
            @continue-drawing="
              (id) => {
                continueDrawing(id)
                activeFab = null
              }
            "
            @fit-to-all="fitToAllRoutes"
            @edit-route="openEditRoute"
            @delete-route="deleteRoute"
            @toggle-visibility="toggleRouteVisibility"
            @toggle-all-visibility="toggleAllRouteVisibility"
            @clear-all="clearAllRoutes"
            @reorder="reorderRoutes"
            @export-json="exportRoutesJson"
            @export-geojson="exportRoutesGeoJson"
            @import="triggerRouteImport"
          />
        </div>
      </Transition>

      <!-- Pins panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'pins'" :class="panelClass">
          <PinsPanel v-model:pin-search="pinSearch" :pins="pins" :filtered-pins="filteredPins" :hidden-pin-ids="hiddenPinIds" :can-undo="canUndo" :all-pins-hidden="allPinsHidden" :resolving-pin-id="resolvingPinId" :pin-dot-size="pinDotSize" @place-at-center="placeAtCenter" @fit-to-pins="fitToPins" @undo="undo" @toggle-all-visibility="toggleAllPinVisibility" @clear-all="clearAllPins" @delete-pin="handleDeletePin" @edit-pin="openEditPin" @zoom-to-pin="zoomToPin" @toggle-visibility="togglePinVisibility" @reorder="reorderPins" @export-json="exportPinsJson" @export-geojson="exportGeoJson" @import="triggerImport" @dot-size-change="pinDotSize = $event" />
        </div>
      </Transition>

      <!-- Scale bar + coordinate display -->
      <div class="absolute left-2 z-500 no-print pointer-events-none flex flex-col items-start gap-1" style="bottom: calc(0.75rem + env(safe-area-inset-bottom))">
        <div v-if="displayCoords" class="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm text-xs font-mono text-gray-500 dark:text-zinc-400 px-2 py-1 rounded shadow-sm border border-gray-200/60 dark:border-zinc-700/60 tabular-nums">{{ displayCoords.lat.toFixed(5) }}, {{ displayCoords.lng.toFixed(5) }}</div>
        <ScaleBar v-if="printSettings.scale.value !== 'off' && leafletMap" :map="leafletMap" :unit="liveScaleUnit" />
      </div>

      <!-- FAB stack -->
      <MapFabStack :active-fab="activeFab" :pin-count="pins.length" :route-count="routes.length" @toggle="toggleFab" />
    </div>

    <!-- ── Bottom sheet backdrop ─────────────────────────────────────────── -->
    <Transition name="mf-fade">
      <div v-if="bottomSheet" class="fixed inset-0 z-1700 bg-black/30 no-print" @click="closeSheet" />
    </Transition>

    <!-- ── Edit Pin sheet ─────────────────────────────────────────────────── -->
    <Transition name="mf-sheet">
      <PinEditSheet :show="bottomSheet" :editing-pin="editingPin" :pending-pin="pendingPin" :pin-dot-size="pinDotSize" @save="handlePinSave" @delete="handlePinDelete" @close="closeSheet" />
    </Transition>

    <!-- ── Edit Route sheet ─────────────────────────────────────────────────── -->
    <Transition name="mf-fade">
      <div v-if="editingRouteRef" class="fixed inset-0 z-1700 bg-black/30 no-print" @click="closeEditRoute" />
    </Transition>
    <Transition name="mf-sheet">
      <RouteEditSheet
        :show="!!editingRouteRef"
        :editing-route="editingRouteRef"
        :distance-unit="liveScaleUnit"
        @save="saveEditRoute"
        @delete="
          () => {
            if (editingRouteRef) deleteRoute(editingRouteRef.id)
          }
        "
        @close="closeEditRoute"
      />
    </Transition>

    <!-- ── Welcome modal ──────────────────────────────────────────────────── -->
    <WelcomeModal :show="showInfo" @close="closeInfo" />

    <!-- ── Toasts ─────────────────────────────────────────────────────────── -->
    <AppToasts :notification="notification" :address-resolve-prog="addressResolveProg" />

    <!-- Hidden file inputs -->
    <input ref="importFileRef" type="file" accept=".json,.geojson" class="hidden" @change="handleImportFile" />
    <input ref="routeImportFileRef" type="file" accept=".json,.geojson" class="hidden" @change="handleRouteImportFile" />
    <input ref="mapImportFileRef" type="file" accept=".json" class="hidden" @change="handleMapImportFile" />
  </div>
</template>

<style>
.mf-panel-enter-active,
.mf-panel-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.mf-panel-enter-from,
.mf-panel-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}

.mf-sheet-enter-active,
.mf-sheet-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.mf-sheet-enter-from,
.mf-sheet-leave-to {
  transform: translateY(100%);
}

.mf-fade-enter-active,
.mf-fade-leave-active {
  transition: opacity 0.2s ease;
}
.mf-fade-enter-from,
.mf-fade-leave-to {
  opacity: 0;
}

.mf-search-bar-enter-active,
.mf-search-bar-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.mf-search-bar-enter-from,
.mf-search-bar-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.leaflet-marker-pane,
.leaflet-overlay-pane,
.leaflet-shadow-pane {
  transition: opacity 0.2s ease;
}

.leaflet-zoom-anim .leaflet-marker-pane,
.leaflet-zoom-anim .leaflet-overlay-pane,
.leaflet-zoom-anim .leaflet-shadow-pane {
  opacity: 0;
  transition: none;
}
</style>
