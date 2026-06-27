<script setup lang="ts">
import { LMap } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'

import CaptionForm from '@/components/CaptionForm.vue'
import MapForm from '@/components/MapForm.vue'
import type { SearchLocation } from '@/components/MapSearch.vue'
import PinForm from '@/components/PinForm.vue'
import PrintAreaForm from '@/components/PrintAreaForm.vue'
import PrintPreviewModal from '@/components/PrintPreviewModal.vue'
import RouteForm from '@/components/RouteForm.vue'
import RouteLayer from '@/components/RouteLayer.vue'
import UndoRedoFabs from '@/components/UndoRedoFabs.vue'
import WaypointPill from '@/components/WaypointPill.vue'
import ZoomControl from '@/components/ZoomControl.vue'
import { useLegendPreview } from '@/composables/useLegendPreview'
import { useLocate } from '@/composables/useLocate'
import { useMapClick } from '@/composables/useMapClick'
import { useMapInit } from '@/composables/useMapInit'
import { usePrintAreaHandlers } from '@/composables/usePrintAreaHandlers'
import { useRubberBand } from '@/composables/useRubberBand'
import type { Caption, MapStyle, Pin, PinDotShape, PinDotSize, PrintArea, Route } from '@/types'
import { captionPlaceholder, decodeShareState, pinPlaceholder, printAreaPlaceholder, routePlaceholder } from '@/utils'

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

const { maps, activeId, activeMap, updateActiveMap, patchMap, createMap, switchMap, deleteMap, duplicateMap, exportMapData, importFromShare, importMapFromData, reorderMaps } = useMaps()

// ── Initial state: share link creates a new map ───────────────────────────────

const urlHash = location.hash.slice(1)
const urlState = urlHash ? decodeShareState(urlHash) : null
const loadedFromUrl = !!urlState

if (urlState) {
  importFromShare(urlState)
  // window.history, not a bare `history` — the local `const history = useHistory(...)` below shadows
  // the global for the whole setup scope, so a bare `history` here is a temporal-dead-zone ReferenceError.
  window.history.replaceState(null, '', location.pathname)
}

// ── Core reactive state ───────────────────────────────────────────────────────

const mapStyle = ref<MapStyle>(activeMap.value.mapStyle)
const showLabels = ref<boolean>(activeMap.value.showLabels)
const showClusters = ref<boolean>(activeMap.value.showClusters)
const { showCoords, showScale, showZoom, mapUnits, angleSnapEnabled } = useGlobalDisplaySettings()
const { stickyEmoji, stickyColor, stickyDotSize, stickyDotShape, stickyShowNumber, stickyRouteColor, stickyRouteLineStyle, stickyRouteWaypointStyle, stickyRouteWaypointSize, stickyCaptionColor, stickyCaptionSize, stickyCaptionBackground } = useStickyDefaults()

const pinNumberedIndex = computed(() => {
  const map = new Map<number, number>()
  let n = 0
  for (const p of pins.value) {
    if (p.showNumber) map.set(p.id, ++n)
  }
  return map
})
const mapName = computed<string>({
  get: () => activeMap.value.name,
  set: (v: string) => updateActiveMap({ name: v })
})
const mapArea = computed<string>({
  get: () => activeMap.value.area ?? '',
  set: (v: string) => updateActiveMap({ area: v })
})

const leafletMap = shallowRef<L.Map | null>(null)

const showSearch = ref(false)

// ── Placement / interaction mode state ───────────────────────────────────────

const isPlacingPin = ref(false)
const placingPinCount = ref(0)
const isPlacingCaption = ref(false)
const placingCaptionCount = ref(0)
// The caption dropped most recently in placing mode — made "active" without going through
// selection, so the placing pill (and its angle-snap toggle) stays open.
const lastPlacedCaptionId = ref<number | null>(null)

function stopPlacing() {
  isPlacingPin.value = false
  placingPinCount.value = 0
}

function stopPlacingCaption() {
  isPlacingCaption.value = false
  placingCaptionCount.value = 0
  lastPlacedCaptionId.value = null
}

const mapImportFileRef = ref<HTMLInputElement | null>(null)
const pinFormRef = ref<InstanceType<typeof PinForm> | null>(null)
const routeFormRef = ref<InstanceType<typeof RouteForm> | null>(null)
const captionFormRef = ref<InstanceType<typeof CaptionForm> | null>(null)

const searchLocation = ref<SearchLocation | null>(null)
const searchClearTrigger = ref(0)
const searchMarkerRef = ref<{ fade: () => void } | null>(null)

const mapCenterCoords = ref<{ lat: number; lng: number } | null>(null)

const hasExplicitLocation = !!activeMap.value.center
const initialCenter: [number, number] = activeMap.value.center ?? [40.7128, -74.006]
const initialZoom: number = activeMap.value.zoom ?? 13

// Settled map view (updated on moveend/zoomend) → tile coords for style previews.
const previewView = ref<{ lat: number; lng: number; zoom: number }>({ lat: initialCenter[0], lng: initialCenter[1], zoom: initialZoom })
const previewTile = computed(() => {
  // Clamp zoom so every tile source (Esri maxes at 17) returns a valid tile.
  const z = Math.max(0, Math.min(17, Math.round(previewView.value.zoom)))
  const n = 2 ** z
  const latRad = (previewView.value.lat * Math.PI) / 180
  const x = Math.floor(((previewView.value.lng + 180) / 360) * n)
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n)
  return { z, x: ((x % n) + n) % n, y: Math.max(0, Math.min(n - 1, y)) }
})

// ── FAB / sheet state ─────────────────────────────────────────────────────────

const activeFab = ref<'style' | 'export' | 'pins' | 'routes' | 'captions' | null>(null)
const focusMode = ref(false)
const bottomSheet = ref(false)
const editingPin = ref<Pin | null>(null)

// Caption editing state (sticky style defaults live in useStickyDefaults).
const editingCaption = ref<Caption | null>(null)

// ── Composables ───────────────────────────────────────────────────────────────

const { notification, showNotification, dismissNotification, cleanupNotification } = useNotification()
const mapClipboard = useMapClipboard()
const selection = useSelection()

// Shared push shim: lets usePins/useRoutes call history.push before history is initialized.
let _historyPush = (_label?: string) => {}
const sharedPush = (label?: string) => _historyPush(label)

const { pins, hiddenPinIds, resolvingPinId, addressResolveProg, pinSearch, filteredPins, allPinsHidden, fetchPinAddress, handleDeletePin, handleUpdatePin, handlePinMove, togglePinVisibility, toggleAllPinVisibility, clearAllPins, fitToPins, zoomToPin, resolveAddressesFromUrl, resetPins } = usePins({ initialPins: activeMap.value.pins, leafletMap, showNotification, pushHistory: sharedPush })

const printSettings = usePrintSettings()

const { routes, hiddenRouteIds, allRoutesHidden, isDrawingRoute, drawingRoute, drawingDistance, drawingAnchorIndex, editingRoute: editingRouteRef, routeSnapEnabled, startNewRoute, continueDrawing, stopDrawing, addPoint, undoLastPoint, redoLastPoint, canUndoPoint, canRedoPoint, insertPoint, removePoint, movePoint, moveRoute, deleteRoute, fitToRoute, fitToAllRoutes, openEditRoute, closeEditRoute, saveEditRoute, toggleRouteVisibility, toggleAllRouteVisibility, clearAllRoutes, resetRoutes, breakWaypointLink, cleanupOrphanedLinks, linkWaypoint } = useRoutes({ initialRoutes: activeMap.value.routes, leafletMap, showNotification, distanceUnit: mapUnits, pushHistory: sharedPush })

const { captions, hiddenCaptionIds, captionSearch, filteredCaptions, allCaptionsHidden, handleDeleteCaption, handleUpdateCaption, handleCaptionMove, toggleCaptionVisibility, toggleAllCaptionVisibility, clearAllCaptions, fitToCaptions, zoomToCaption, resetCaptions } = useCaptions({ initialCaptions: activeMap.value.captions ?? [], leafletMap, showNotification, pushHistory: sharedPush })

const editingPinPlaceholder = computed(() => (editingPin.value && !editingPin.value.name ? pinPlaceholder(editingPin.value, pins.value) : undefined))
const editingRoutePlaceholder = computed(() => (editingRouteRef.value && !editingRouteRef.value.name ? routePlaceholder(editingRouteRef.value, routes.value) : undefined))
const editingCaptionPlaceholder = computed(() => (editingCaption.value && !editingCaption.value.text ? captionPlaceholder(editingCaption.value, captions.value) : undefined))

const printAreas = computed<PrintArea[]>(() => activeMap.value.printAreas ?? [])
function updatePrintAreas(areas: PrintArea[]) {
  updateActiveMap({ printAreas: areas })
}

const { activePrintAreaId, activePrintArea, printBounds, printAspectRatio, overlayCorner, isDownloadingPdf, isPreviewOpen, previewBlobUrl, autoArea, addPrintArea, deletePrintArea, selectPrintArea, deselectPrintArea, patchPrintArea, flipPrintAreaOrientation, fitToPrintArea, fitPrintAreaToElements, handleBoundsSet, openPreview, cancelExport, downloadFromPreview, closePreview } = usePrintExport({ leafletMap, mapStyle, mapName, mapArea, pins, hiddenPinIds, routes, hiddenRouteIds, captions, hiddenCaptionIds, units: mapUnits, angleSnapEnabled, showNotification, dismissNotification, printSettings, printAreas, updatePrintAreas })

// isAdjustingPrintArea syncs with activePrintAreaId for backwards compat with composables
// that read/write it (useMapModeState, useKeyboardShortcuts, useSelectionActions).
const isAdjustingPrintArea = ref(false)
watch(activePrintAreaId, (id) => {
  isAdjustingPrintArea.value = id !== null
})
watch(isAdjustingPrintArea, (v) => {
  if (!v && activePrintAreaId.value !== null) deselectPrintArea()
})

// Dummy ref: useMapModeState writes visibility here; we compute per-area visibility in template.
const dummyPrintVisibility = ref<'visible' | 'opaque' | 'hidden'>('visible')

// MapForm state
const editingMapId = ref<string | null>(null)
const editingMapData = computed(() => maps.value.find((m) => m.id === editingMapId.value) ?? null)

function handleMapFormSave(name: string, area: string) {
  if (editingMapId.value) patchMap(editingMapId.value, { name, area })
  editingMapId.value = null
}

function handleMapFormDelete() {
  if (!editingMapId.value || !editingMapData.value) return
  const m = editingMapData.value
  const id = editingMapId.value
  editingMapId.value = null
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const parts: string[] = []
      if (m.pins.length) parts.push(`${m.pins.length} pin${m.pins.length === 1 ? '' : 's'}`)
      if (m.routes.length) parts.push(`${m.routes.length} route${m.routes.length === 1 ? '' : 's'}`)
      if (m.captions?.length) parts.push(`${m.captions.length} caption${m.captions.length === 1 ? '' : 's'}`)
      const detail = parts.length ? `\n\nThis will also permanently delete ${parts.join(', ')}.` : ''
      if (!window.confirm(`Delete "${m.name}"?${detail}\n\nThis is permanent and cannot be undone.`)) return
      doDeleteMap(id)
    })
  )
}

const history = useHistory({
  pins,
  routes,
  captions,
  showNotification,
  printAreas,
  updatePrintAreas
})
_historyPush = history.push
const { canUndo, canRedo, undo, redo, clear: clearHistory } = history

watch(activeId, clearHistory)

const linkedPinIds = computed(() => new Set(routes.value.flatMap((r) => r.points.map((p) => p.pinId).filter((id): id is number => id !== undefined))))

const pinsLinkedToSelectedRoutes = computed(() => {
  const ids = new Set<number>()
  // Only highlight the pin linked to the specifically selected waypoint
  const wpKey = selection.selectedWaypointKey.value
  if (wpKey) {
    const route = routes.value.find((r) => r.id === wpKey.routeId)
    const pinId = route?.points[wpKey.pointIndex]?.pinId
    if (pinId !== undefined) ids.add(pinId)
  }
  return ids
})

const selectedWaypointRoute = computed(() => {
  const key = selection.selectedWaypointKey.value
  if (!key) return null
  return routes.value.find((r) => r.id === key.routeId) ?? null
})

const selectedWaypointLinkedPin = computed(() => {
  const key = selection.selectedWaypointKey.value
  if (!key || !selectedWaypointRoute.value) return null
  const pt = selectedWaypointRoute.value.points[key.pointIndex]
  return pt?.pinId !== undefined ? (pins.value.find((p) => p.id === pt.pinId) ?? null) : null
})

// useMapModeState must only see pin/route/caption selection — print area selection must be
// invisible to it, otherwise the hasSelection watcher kills isAdjustingPrintArea the moment
// a print area row is selected, and the clearSelection watcher wipes selectedPrintAreaIds
// the moment the adjusting state turns on.
const hasNonPrintSelection = computed(() => selection.selectedPinIds.value.size > 0 || selection.selectedRouteIds.value.size > 0 || selection.selectedCaptionIds.value.size > 0 || selection.selectedWaypointKey.value !== null)

// PrintAreaForm state
const { showPrintAreaForm, editingPrintArea, editingPrintAreaPlaceholder, handleAddPrintArea, handlePrintAreaSave, handlePrintAreaDelete, handlePrintAreaEdit, handlePrintAreaClose, handleSelectPrintArea, handlePrintAreaDownload, handleFitPrintAreaToElements, reorderPrintAreas } = usePrintAreaHandlers({
  printAreas,
  updatePrintAreas,
  mapName,
  selection,
  history,
  activePrintAreaId,
  activePrintArea,
  printBounds,
  hasNonPrintSelection,
  addPrintArea,
  deletePrintArea,
  selectPrintArea,
  deselectPrintArea,
  patchPrintArea,
  fitPrintAreaToElements,
  openPreview,
  printSettings,
  activeFab,
  leafletMap
})

function clearNonPrintSelection() {
  selection.selectedPinIds.value = new Set()
  selection.selectedRouteIds.value = new Set()
  selection.selectedCaptionIds.value = new Set()
  selection.selectedWaypointKey.value = null
}

useMapModeState({
  isPlacingPin,
  placingPinCount,
  isPlacingCaption,
  placingCaptionCount,
  lastPlacedCaptionId,
  isAdjustingPrintArea,
  isDrawingRoute,
  stopDrawing,
  stopPlacing,
  stopPlacingCaption,
  hasSelection: hasNonPrintSelection,
  clearSelection: clearNonPrintSelection,
  printAreaVisibility: dummyPrintVisibility,
  printBounds
})

const { openEditCaption, closeCaptionSheet, activeCaptionId, activeCaption, handleCaptionSave, onCaptionRotateStart, onCaptionRotate, handleCaptionDelete, onCaptionMoveStart, onCaptionMove, placeCaptionAt, placeCaptionDrop, startPlacingCaption, onPlacingSizeChange } = useCaptionHandlers({
  captions,
  editingCaption,
  editingRouteRef,
  isPlacingCaption,
  placingCaptionCount,
  lastPlacedCaptionId,
  stickyCaptionColor,
  stickyCaptionSize,
  stickyCaptionBackground,
  history,
  selection,
  activeFab,
  closeSheet,
  closeEditRoute,
  stopPlacing,
  stopDrawing,
  handleDeleteCaption,
  handleUpdateCaption,
  handleCaptionMove
})

const { handlePinPlace, handlePinPlaceSingle, handleSearchMarkerPin, placeAtCenter } = usePinPlacement({
  pins,
  isPlacingPin,
  placingPinCount,
  stickyEmoji,
  stickyColor,
  stickyDotSize,
  stickyDotShape,
  stickyShowNumber,
  history,
  fetchPinAddress,
  openEditPin,
  searchLocation,
  stopDrawing,
  activeFab
})

const { handleExtendFrom, findWaypointSnapForPin, handlePinMoveWithSnap, handleMovePoint, handleMoveRoute } = useRouteHelpers({
  routes,
  hiddenRouteIds,
  routeSnapEnabled,
  leafletMap,
  history,
  stopPlacing,
  continueDrawing,
  linkWaypoint,
  handlePinMove,
  movePoint,
  moveRoute
})

const { handleMapClick } = useMapClick({
  leafletMap,
  isPlacingPin,
  isPlacingCaption,
  isDrawingRoute,
  isAdjustingPrintArea,
  routeSnapEnabled,
  angleSnapEnabled,
  pins,
  hiddenPinIds,
  routes,
  hiddenRouteIds,
  linkedPinIds,
  drawingAnchorIndex,
  drawingRoute,
  handlePinPlace,
  placeCaptionDrop,
  addPoint,
  clearSelection: selection.clearSelection
})

const { clusterGroup, initClusterGroup, refreshClusterPositions } = useMarkerCluster({
  isPlacingPin,
  isPlacingCaption,
  isDrawingRoute,
  onClusterClickPlace: handlePinPlace,
  onClusterClickDraw: handleMapClick
})

const { pointerCoords, drawingPreviewLine } = useDrawingPreview({
  leafletMap,
  isDrawingRoute,
  drawingAnchorIndex,
  drawingRoute,
  routeSnapEnabled,
  angleSnapEnabled,
  pins,
  routes,
  hiddenPinIds,
  hiddenRouteIds,
  linkedPinIds
})
const displayCoords = computed(() => pointerCoords.value ?? mapCenterCoords.value)
const atMaxZoom = computed(() => !!leafletMap.value && previewView.value.zoom >= mapMaxZoom.value)
const atMinZoom = computed(() => !!leafletMap.value && previewView.value.zoom <= (leafletMap.value.getMinZoom() ?? 0))

const { handleClipCopyPin, handleClipCutPin, handleClipCopyRoute, handleClipCutRoute, handleClipCopyCaption, handleClipCutCaption, handleClipCopyPrintArea, handleClipCutPrintArea, handlePaste, pasteAtCenter } = useClipboardActions({
  pins,
  routes,
  captions,
  printAreas,
  updatePrintAreas,
  mapClipboard,
  activeMapId: activeId,
  history,
  cleanupOrphanedLinks,
  isDrawingRoute,
  stopDrawing,
  drawingRoute,
  leafletMap,
  showNotification,
  fetchPinAddress
})

const { selectedPins, selectedRoutes, selectedCaptions, selectedPrintAreas, allSelectedHidden, handleSelectionToggleVisibility, handleSelectPin, handleSelectRoute, handleSelectCaption, handleSelectionEdit, handleSelectionFit, handleSelectionCopy, handleSelectionCut, handleSelectionDelete, handleSelectWaypoint, handleWaypointDelete } = useSelectionActions({
  selection,
  pins,
  routes,
  captions,
  printAreas,
  updatePrintAreas,
  mapClipboard,
  activeMapId: activeId,
  history,
  cleanupOrphanedLinks,
  isDrawingRoute,
  stopDrawing,
  drawingRoute,
  showNotification,
  openEditPin,
  openEditRoute,
  openEditCaption,
  openEditPrintArea: handlePrintAreaEdit,
  isAdjustingPrintArea,
  leafletMap,
  removePoint
})

// True whenever the user is mid-interaction that should suppress rubber-band.
const isInteracting = computed(() => isPlacingPin.value || isPlacingCaption.value || isDrawingRoute.value || isAdjustingPrintArea.value)

const { band: rubberBand } = useRubberBand(leafletMap, isInteracting, (bounds) => {
  selection.selectedPinIds.value = new Set(pins.value.filter((p) => !hiddenPinIds.value.has(p.id) && bounds.contains([p.lat, p.lng])).map((p) => p.id))
  selection.selectedRouteIds.value = new Set(routes.value.filter((r) => !hiddenRouteIds.value.has(r.id) && r.points.some((pt) => bounds.contains([pt.lat, pt.lng]))).map((r) => r.id))
  selection.selectedCaptionIds.value = new Set(captions.value.filter((c) => !hiddenCaptionIds.value.has(c.id) && bounds.contains([c.lat, c.lng])).map((c) => c.id))
  selection.selectedPrintAreaIds.value = new Set(printAreas.value.filter((a) => !a.hidden && a.corners.some((corner) => bounds.contains(corner as [number, number]))).map((a) => a.id))
  selection.selectedWaypointKey.value = null
})

// Subtitle shown on the print: the user's entered area, or the geocoded suggestion as a fallback.
const effectiveArea = computed(() => mapArea.value || autoArea.value)

const { activeLegendSettings, legendBox } = useLegendPreview({
  printBounds,
  activePrintArea,
  pins,
  routes,
  mapName,
  effectiveArea
})

const routeLayerRef = ref<InstanceType<typeof RouteLayer> | null>(null)

const { copyShareLink } = useShareClipboard({
  pins,
  routes,
  captions,
  printAreas,
  mapStyle,
  mapTitle: mapName,
  mapArea,
  leafletMap,
  maps,
  activeId,
  showNotification
})

const { mapMaxZoom, applyTileLayer, applyLabelsLayer, flyToIpLocation } = useMapLayers({
  leafletMap,
  mapStyle,
  isDark,
  showLabels
})

// ── Map management ────────────────────────────────────────────────────────────

const { showMapsPanel, saveState, doSwitchMap, doCreateMap, doDeleteMap, doDuplicateMap, handleMapImportFile, importMapFiles } = useMapManager({
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
  mapArea,
  pins,
  routes,
  captions,
  showNotification,
  mapImportFileRef,
  resetPins,
  resetRoutes,
  resetCaptions,
  clearPrintBounds: deselectPrintArea
})

// PWA file handler: when the installed app is launched by opening a .json/.geojson
// map file, the launchQueue hands us file handles to import (Chromium only).
interface LaunchFileHandle {
  getFile(): Promise<File>
}
onMounted(() => {
  const lq = (window as unknown as { launchQueue?: { setConsumer(cb: (params: { files?: LaunchFileHandle[] }) => void): void } }).launchQueue
  lq?.setConsumer(async (params) => {
    const handles = params.files ?? []
    if (handles.length === 0) return
    const files = await Promise.all(handles.map((h) => h.getFile()))
    importMapFiles(files)
  })
})

function handlePinDragStart(_id: number) {
  history.push('move pin')
}

function handlePinMoveOnDrop(id: number, lat: number, lng: number) {
  if (linkedPinIds.value.has(id)) {
    // Locked pin: history pushed at dragstart; clear preview and finalize routes + pin data.
    routeLayerRef.value?.clearPinDragPreview()
    for (const route of routes.value) {
      for (let i = 0; i < route.points.length; i++) {
        if (route.points[i]?.pinId === id) {
          movePoint(route.id, i, lat, lng, id)
          break
        }
      }
    }
    handlePinMove(id, lat, lng)
  } else {
    handlePinMoveWithSnap(id, lat, lng)
  }
}

function handlePinDragMove(id: number, lat: number, lng: number) {
  routeLayerRef.value?.setPinDragPreview(id, lat, lng)
}

function handleLockedPinContext(pin: Pin) {
  for (const route of routes.value) {
    for (let i = 0; i < route.points.length; i++) {
      if (route.points[i]?.pinId === pin.id) {
        handleContextWaypoint(route.id, i)
        return
      }
    }
  }
}

const { handleContextRoute, handleContextWaypoint } = useRoutePopup({
  routes,
  pins,
  hiddenPinIds,
  leafletMap,
  isDrawingRoute,
  onEditRoute: openEditRoute,
  onContinueDrawing: continueDrawing,
  onToggleVisibility: toggleRouteVisibility,
  onDeleteRoute: deleteRoute,
  onExtendFrom: handleExtendFrom,
  onRemoveWaypoint: removePoint,
  onBreakLink: breakWaypointLink,
  onEditPin: openEditPin,
  onHidePin: togglePinVisibility,
  onDeletePin: deletePinWithCleanup,
  onInsertWaypoint: insertPoint,
  onClipCopyRoute: handleClipCopyRoute,
  onClipCutRoute: handleClipCutRoute
})

function handleUnlinkSelectedPin() {
  const pin = selectedPins.value[0]
  if (!pin) return
  for (const r of routes.value) {
    const i = r.points.findIndex((p) => p.pinId === pin.id)
    if (i !== -1) {
      breakWaypointLink(r.id, i)
      return
    }
  }
}

function reorderPins(newPins: Pin[]) {
  history.push('reorder pins')
  pins.value = newPins
}
function reorderRoutes(newRoutes: Route[]) {
  history.push('reorder routes')
  routes.value = newRoutes
}

// ── Search ────────────────────────────────────────────────────────────────────

function clearSearchLocation() {
  if (searchMarkerRef.value) searchMarkerRef.value.fade()
  else searchLocation.value = null
}

function handleCopyCoords(text: string) {
  navigator.clipboard.writeText(text)
  showNotification(`Copied: ${text}`)
}

watch(searchLocation, (loc) => {
  if (!loc) searchClearTrigger.value++
  else if (leafletMap.value) leafletMap.value.setView([loc.lat, loc.lng], 15, { animate: true, duration: 1 })
})

// ── My location ───────────────────────────────────────────────────────────────

const { isLocating, canFitAll, fitAllToView, goToMyLocation } = useLocate({
  pins,
  hiddenPinIds,
  routes,
  hiddenRouteIds,
  captions,
  hiddenCaptionIds,
  printAreas,
  leafletMap,
  searchLocation,
  showNotification
})

const hasSelection = computed(() => selectedPins.value.length > 0 || selectedRoutes.value.length > 0 || selectedCaptions.value.length > 0 || selectedPrintAreas.value.length > 0)
const canFit = computed(() => !!activePrintAreaId.value || hasSelection.value || canFitAll.value)
const fitLabel = computed(() => (activePrintAreaId.value ? 'Zoom to print' : hasSelection.value ? 'Zoom to selection' : 'Fit all to view'))

function fitToView() {
  if (activePrintAreaId.value) return fitToPrintArea()
  if (hasSelection.value) return handleSelectionFit()
  fitAllToView()
}

// ── FAB / panel / sheet ───────────────────────────────────────────────────────

function toggleMapsPanel() {
  closeCaptionSheet()
  showMapsPanel.value = !showMapsPanel.value
  if (showMapsPanel.value) activeFab.value = null
}

function toggleFab(fab: 'style' | 'export' | 'pins' | 'routes' | 'captions') {
  closeCaptionSheet()
  stopPlacing()
  stopPlacingCaption()
  stopDrawing()
  showMapsPanel.value = false
  activeFab.value = activeFab.value === fab ? null : fab
}

function toggleFocusMode() {
  focusMode.value = !focusMode.value
  if (focusMode.value) activeFab.value = null
}

function closeSheet() {
  bottomSheet.value = false
  editingPin.value = null
}

function openEditPin(pin: Pin) {
  editingCaption.value = null
  editingPin.value = { ...pin }
  activeFab.value = null
  bottomSheet.value = true
}

function handlePinSave(updated: Pin, newEmoji: string, newColor: string, newDotSize: PinDotSize, newDotShape: PinDotShape) {
  stickyEmoji.value = newEmoji
  stickyColor.value = newColor
  stickyDotSize.value = newDotSize
  stickyDotShape.value = newDotShape
  stickyShowNumber.value = updated.showNumber ?? false
  const liveAddress = pins.value.find((p) => p.id === updated.id)?.address
  handleUpdatePin({ ...updated, address: updated.address ?? liveAddress })
  closeSheet()
}

function handleRouteSave(route: Route) {
  stickyRouteColor.value = route.color
  stickyRouteLineStyle.value = route.lineStyle
  stickyRouteWaypointStyle.value = route.waypointStyle
  stickyRouteWaypointSize.value = route.waypointSize
  saveEditRoute(route)
}

function doStartNewRoute() {
  startNewRoute({
    color: stickyRouteColor.value,
    lineStyle: stickyRouteLineStyle.value,
    waypointStyle: stickyRouteWaypointStyle.value,
    waypointSize: stickyRouteWaypointSize.value
  })
}

// Every pin delete must funnel through here so route waypoints linked to it
// (RoutePoint.pinId) don't keep a dangling reference to a pin that's gone. One
// snapshot up front captures intact pins + links, so a single undo restores both.
function deletePinWithCleanup(id: number) {
  history.push('delete pin')
  cleanupOrphanedLinks(id)
  handleDeletePin(id, false)
}

function clearAllPinsWithCleanup() {
  const ids = new Set(pins.value.map((p) => p.id))
  if (clearAllPins()) cleanupOrphanedLinks(ids)
}

function handlePinDelete() {
  if (!editingPin.value) return
  deletePinWithCleanup(editingPin.value.id)
  closeSheet()
}

// ── Context menus ─────────────────────────────────────────────────────────────

function removePrintArea() {
  if (activePrintAreaId.value) {
    history.push('remove print')
    deletePrintArea(activePrintAreaId.value)
  }
  selection.clearSelection()
}

const { openMapContextPopup, openPrintAreaContextMenu, closeMapContextPopup } = useMapContextMenu({
  leafletMap,
  hasClipboard: mapClipboard.hasClipboard,
  onPlacePinSingle: handlePinPlaceSingle,
  onPlacePinMultiple: handlePinPlace,
  onStartRoute: (latlng) => {
    activeFab.value = null
    stopPlacing()
    doStartNewRoute()
    nextTick(() => addPoint(latlng.lat, latlng.lng))
  },
  onPlaceCaption: (lat, lng) => {
    activeFab.value = null
    stopPlacing()
    stopDrawing()
    placeCaptionAt(lat, lng)
  },
  onPaste: handlePaste,
  onDownloadPdf: openPreview,
  onEditPrintArea: () => {
    if (activePrintAreaId.value) handlePrintAreaEdit(activePrintAreaId.value)
  },
  onCutPrintArea: () => {
    if (activePrintAreaId.value) handleClipCutPrintArea(activePrintAreaId.value)
  },
  onCopyPrintArea: () => {
    if (activePrintAreaId.value) handleClipCopyPrintArea(activePrintAreaId.value)
  },
  onRemovePrintArea: removePrintArea
})

// ── Map initialization ────────────────────────────────────────────────────────

const { onMapReady } = useMapInit({
  leafletMap,
  mapCenterCoords,
  previewView,
  hasExplicitLocation,
  loadedFromUrl,
  pins,
  resolveAddressesFromUrl,
  initClusterGroup,
  refreshClusterPositions,
  applyTileLayer,
  applyLabelsLayer,
  flyToIpLocation,
  saveState,
  closeMapContextPopup,
  openMapContextPopup,
  bottomSheet,
  activeFab,
  showMapsPanel,
  isPlacingPin,
  isPlacingCaption,
  isDrawingRoute,
  handlePinPlace,
  placeCaptionDrop
})

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

// Close whichever of the five pills is open (Enter / "Close" button). They're mutually
// exclusive, but call every dismisser so this stays correct regardless of which is active.
function closeAllPills() {
  stopPlacing()
  stopPlacingCaption()
  if (isDrawingRoute.value) stopDrawing()
  isAdjustingPrintArea.value = false
  selection.clearSelection()
}

useKeyboardShortcuts({
  showInfo,
  closeInfo,
  openInfo: () => {
    showInfo.value = true
  },
  editingRoute: editingRouteRef,
  closeEditRoute,
  editingCaption,
  closeCaptionSheet,
  bottomSheet,
  closeSheet,
  showMapsPanel,
  activeFab,
  showSearch,
  isPlacingPin,
  isPlacingCaption,
  stopPlacingCaption,
  isDrawingRoute,
  stopDrawing,
  isAdjustingPrintArea,
  hasSelection: selection.hasSelection,
  deleteSelection: handleSelectionDelete,
  copySelection: handleSelectionCopy,
  cutSelection: handleSelectionCut,
  toggleSelectionVisibility: handleSelectionToggleVisibility,
  editSelection: handleSelectionEdit,
  fitSelection: handleSelectionFit,
  activatePrintArea: handleAddPrintArea,
  clearPrintBounds: deselectPrintArea,
  deleteActivePrintArea: removePrintArea,
  toggleActivePrintAreaVisibility: () => {
    if (!activePrintArea.value) return
    const hide = !activePrintArea.value.hidden
    history.push(hide ? 'hide' : 'show')
    patchPrintArea(activePrintArea.value.id, { hidden: hide })
  },
  editActivePrintArea: () => {
    if (activePrintArea.value) handlePrintAreaEdit(activePrintArea.value.id)
  },
  fitActivePrintArea: fitToPrintArea,
  startPlacingPin: () => {
    isPlacingPin.value = true
  },
  startNewRoute,
  startPlacingCaption,
  closeAllPills,
  undoLastPoint,
  undo,
  redo,
  pasteAtCenter,
  saveActiveForm: () => {
    if (bottomSheet.value) pinFormRef.value?.save()
    else if (editingRouteRef.value) routeFormRef.value?.save()
    else if (editingCaption.value) captionFormRef.value?.save()
  }
})

// ── Watchers ──────────────────────────────────────────────────────────────────

watch([isPlacingPin, isPlacingCaption, isDrawingRoute, leafletMap], ([placing, placingCaption, drawing, map]) => {
  if (map) map.getContainer().style.cursor = placing || placingCaption || drawing ? 'crosshair' : ''
})

// Restore map focus when all panels/pills/forms close so Leaflet's built-in
// keyboard shortcuts (+/-/arrows) work without requiring a manual map click.
const isAnythingOpen = computed(() => bottomSheet.value || !!editingRouteRef.value || !!editingCaption.value || !!activeFab.value || showMapsPanel.value || showInfo.value || isPlacingPin.value || isPlacingCaption.value || isDrawingRoute.value || isAdjustingPrintArea.value || selection.hasSelection.value || showSearch.value)
watch(isAnythingOpen, (open, wasOpen) => {
  if (wasOpen && !open) nextTick(() => leafletMap.value?.getContainer().focus())
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
})

// ── Style helpers ─────────────────────────────────────────────────────────────

const panelClass = 'absolute right-16 top-2 z-1000 w-80 max-w-[calc(100vw-80px)] bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-y-auto flex flex-col max-h-[80vh] no-print'
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-sans transition-colors duration-200">
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <AppHeader
      :show-search="showSearch"
      :search-clear-trigger="searchClearTrigger"
      :active-map-name="activeMap.name"
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
    />

    <!-- ── Mobile search panel ──────────────────────────────────────────── -->
    <Transition name="mf-search-bar">
      <MobileSearchBar
        v-if="showSearch"
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
    </Transition>

    <!-- ── Map ──────────────────────────────────────────────────────────── -->
    <div class="flex-1 min-h-0 relative map-print-container">
      <div v-if="activePrintArea?.legendTitle ?? true" class="print-map-title">{{ mapName }}</div>
      <div v-if="(activePrintArea?.legendArea ?? true) && effectiveArea" class="print-map-area">{{ effectiveArea }}</div>

      <LMap :zoom="initialZoom" :center="initialCenter" :use-global-leaflet="false" :max-zoom="mapMaxZoom" :zoom-control="false" style="height: 100%; width: 100%" @ready="onMapReady" @click="handleMapClick" />

      <!-- Rubber-band selection rectangle -->
      <div v-if="rubberBand" class="absolute pointer-events-none no-print" :style="{ left: `${rubberBand.x}px`, top: `${rubberBand.y}px`, width: `${rubberBand.w}px`, height: `${rubberBand.h}px`, zIndex: 600, border: '1.5px dashed #0d9488', background: 'rgba(13,148,136,0.08)', borderRadius: '2px' }" />

      <svg v-if="drawingPreviewLine" class="absolute inset-0 w-full h-full pointer-events-none no-print" style="z-index: 500; overflow: visible">
        <line :x1="drawingPreviewLine.x1" :y1="drawingPreviewLine.y1" :x2="drawingPreviewLine.x2" :y2="drawingPreviewLine.y2" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="5,4" stroke-linecap="round" />
        <circle v-if="angleSnapEnabled" :cx="drawingPreviewLine.x2" :cy="drawingPreviewLine.y2" r="4" :fill="drawingRoute?.color ?? '#9ca3af'" stroke="white" stroke-width="1.5" />
      </svg>

      <template v-if="leafletMap && clusterGroup">
        <PrintAreaDrawer
          v-for="area in printAreas"
          :key="area.id"
          :map="leafletMap"
          :corners="area.corners"
          :angle="area.angle"
          :aspect-ratio="activePrintAreaId === area.id ? printAspectRatio : null"
          :snap-enabled="angleSnapEnabled"
          :grid-cols="activePrintAreaId === area.id ? Number(area.grid.split('x')[0]) || 1 : 1"
          :grid-rows="activePrintAreaId === area.id ? Number(area.grid.split('x')[1]) || 1 : 1"
          :overlay-corner="activePrintAreaId === area.id ? overlayCorner : undefined"
          :legend-box="activePrintAreaId === area.id ? legendBox : null"
          :legend-settings="activePrintAreaId === area.id ? activeLegendSettings : undefined"
          :legend-x="activePrintAreaId === area.id ? (area.legendX ?? null) : undefined"
          :legend-y="activePrintAreaId === area.id ? (area.legendY ?? null) : undefined"
          :legend-corner="activePrintAreaId === area.id ? (area.legendCorner ?? null) : undefined"
          :visibility="area.hidden ? 'hidden' : activePrintAreaId === area.id ? 'visible' : 'opaque'"
          :selected="selection.selectedPrintAreaIds.value.has(area.id)"
          @bounds-set="(info) => handleBoundsSet(area.id, info)"
          @select="(shiftHeld) => handleSelectPrintArea(area.id, shiftHeld)"
          @context="openPrintAreaContextMenu"
          @legend-move="(x, y) => patchPrintArea(area.id, { legendX: x, legendY: y, legendCorner: null })"
          @legend-scale="(s) => patchPrintArea(area.id, { legendScale: s })"
          @legend-corner="(c) => patchPrintArea(area.id, { legendX: null, legendY: null, legendCorner: c })"
          @legend-reset="
            () => {
              history.push('reset legend position')
              patchPrintArea(area.id, { legendX: null, legendY: null, legendCorner: null })
            }
          "
          @drag-start="(label) => history.push(label)"
        />
        <PinMarker v-for="(pin, i) in pins" :key="pin.id" :render-index="i" :pin="pin" :map="leafletMap" :layer="showClusters ? clusterGroup : undefined" :hidden="hiddenPinIds.has(pin.id)" :dot-size="stickyDotSize" :locked="linkedPinIds.has(pin.id)" :drawing="isDrawingRoute" :find-snap="findWaypointSnapForPin" :pin-index="pinNumberedIndex.get(pin.id)" :selected="selection.selectedPinIds.value.has(pin.id) || pinsLinkedToSelectedRoutes.has(pin.id)" :linked-to-selected-route="false" @delete="deletePinWithCleanup" @hide="togglePinVisibility" @drag-start="handlePinDragStart" @drag-move="handlePinDragMove" @move="handlePinMoveOnDrop" @edit="openEditPin" @copy="(coords) => showNotification(`Copied: ${coords}`)" @clip-copy="handleClipCopyPin" @clip-cut="handleClipCutPin" @place-waypoint="(lat, lng, pinId) => addPoint(lat, lng, pinId)" @select="handleSelectPin" @context-locked="handleLockedPinContext" />
        <CaptionMarker v-for="(caption, i) in captions" :key="caption.id" :render-index="i" :caption="caption" :map="leafletMap" :hidden="hiddenCaptionIds.has(caption.id)" :selected="selection.selectedCaptionIds.value.has(caption.id) || editingCaption?.id === caption.id || activeCaptionId === caption.id" :is-dark="isDark" :placeholder="caption.text ? undefined : captionPlaceholder(caption, captions)" @delete="handleDeleteCaption" @hide="toggleCaptionVisibility" @move-start="onCaptionMoveStart" @move="onCaptionMove" @edit="openEditCaption" @clip-copy="handleClipCopyCaption" @clip-cut="handleClipCutCaption" @select="handleSelectCaption" />
        <CaptionRotateHandle v-if="activeCaption && !hiddenCaptionIds.has(activeCaption.id)" :caption="activeCaption" :map="leafletMap" :angle-snap="angleSnapEnabled" @rotate-start="onCaptionRotateStart" @rotate="onCaptionRotate" />
        <SearchMarker v-if="searchLocation" :key="`${searchLocation.lat}-${searchLocation.lng}`" ref="searchMarkerRef" :lat="searchLocation.lat" :lng="searchLocation.lng" :map="leafletMap" @pin="handleSearchMarkerPin" @dismiss="searchLocation = null" />
        <RouteLayer v-if="routes.length > 0" ref="routeLayerRef" :routes="routes" :hidden-route-ids="hiddenRouteIds" :map="leafletMap" :drawing-route-id="isDrawingRoute ? (drawingRoute?.id ?? null) : null" :drawing-anchor-index="isDrawingRoute ? drawingAnchorIndex : null" :pins="pins" :snap-enabled="routeSnapEnabled" :hidden-pin-ids="hiddenPinIds" :angle-snap-enabled="angleSnapEnabled" :selected-route-ids="selection.selectedRouteIds.value" :selected-waypoint-key="selection.selectedWaypointKey.value" @remove-point="removePoint" @move-point="handleMovePoint" @move-route="handleMoveRoute" @select-route="handleSelectRoute" @select-waypoint="handleSelectWaypoint" @context-route="handleContextRoute" @context-waypoint="handleContextWaypoint" />
      </template>

      <PrintLegend :title="(activePrintArea?.legendTitle ?? true) ? mapName : ''" :area="(activePrintArea?.legendArea ?? true) ? effectiveArea : ''" :pins="pins" :routes="routes" :blank-labels="activePrintArea?.legendBlankLabels ?? false" />

      <!-- Placing indicator -->
      <Transition name="mf-fade">
        <PinPill v-if="isPlacingPin" :emoji="stickyEmoji" :color="stickyColor" :dot-size="stickyDotSize" :dot-shape="stickyDotShape" :show-number="stickyShowNumber" :count="placingPinCount" :can-undo="canUndo" :can-redo="canRedo" @undo="undo" @redo="redo" @done="stopPlacing" />
      </Transition>

      <!-- Drawing route indicator -->
      <Transition name="mf-fade">
        <RoutePill v-if="isDrawingRoute && drawingRoute" :route="drawingRoute" :distance="drawingDistance" :snap-enabled="routeSnapEnabled" :angle-snap-enabled="angleSnapEnabled" :can-undo="canUndoPoint" :can-redo="canRedoPoint" @update:snap-enabled="routeSnapEnabled = $event" @update:angle-snap-enabled="angleSnapEnabled = $event" @undo="undoLastPoint" @redo="redoLastPoint" @done="stopDrawing" />
      </Transition>

      <!-- Placing caption indicator -->
      <Transition name="mf-fade">
        <CaptionPill v-if="isPlacingCaption" :color="stickyCaptionColor" :size="stickyCaptionSize" :count="placingCaptionCount" :angle-snap-enabled="angleSnapEnabled" :can-undo="canUndo" :can-redo="canRedo" @update:angle-snap-enabled="angleSnapEnabled = $event" @update:size="onPlacingSizeChange" @undo="undo" @redo="redo" @done="stopPlacingCaption" />
      </Transition>

      <!-- Print area adjusting indicator -->
      <Transition name="mf-fade">
        <PrintPill
          v-if="activePrintArea && printBounds"
          :area-name="activePrintArea.title || printAreaPlaceholder(activePrintArea.id, printAreas, mapName)"
          :snap-enabled="angleSnapEnabled"
          :orientation="activePrintArea.orientation"
          :is-hidden="!!activePrintArea.hidden"
          :is-downloading-pdf="isDownloadingPdf"
          @update:snap-enabled="angleSnapEnabled = $event"
          @update:orientation="
            (o) => {
              // Pin the current corner so it survives the flip (overlayCorner recomputes after corners change).
              const pinnedCorner = activePrintArea!.legendCorner ?? overlayCorner
              patchPrintArea(activePrintArea!.id, { orientation: o, legendX: null, legendY: null, legendCorner: pinnedCorner })
              flipPrintAreaOrientation()
              printSettings.stickyOrientation.value = o
            }
          "
          @fit="handleFitPrintAreaToElements"
          @edit="handlePrintAreaEdit(activePrintArea.id)"
          @hide="patchPrintArea(activePrintArea.id, { hidden: !activePrintArea.hidden })"
          @delete="
            () => {
              history.push('delete print')
              deletePrintArea(activePrintArea!.id)
            }
          "
          @download="openPreview"
          @cancel="cancelExport"
          @done="deselectPrintArea"
        />
      </Transition>

      <!-- Selection pill: pins / routes / captions / print areas -->
      <Transition name="mf-fade">
        <SelectionPill v-if="(selectedPins.length > 0 || selectedRoutes.length > 0 || selectedCaptions.length > 0 || selectedPrintAreas.length > 0) && !isPlacingPin && !isPlacingCaption && !isDrawingRoute && !isAdjustingPrintArea" :selected-pins="selectedPins" :selected-routes="selectedRoutes" :selected-captions="selectedCaptions" :selected-print-areas="selectedPrintAreas" :all-pins="pins" :all-routes="routes" :all-captions="captions" :all-print-areas="printAreas" :map-name="mapName" :all-selected-hidden="allSelectedHidden" :single-pin-linked="selectedPins.length === 1 && linkedPinIds.has(selectedPins[0]!.id)" :pin-numbers="pinNumberedIndex" @clear="selection.clearSelection()" @edit="handleSelectionEdit" @unlink="handleUnlinkSelectedPin" @copy="handleSelectionCopy" @cut="handleSelectionCut" @delete="handleSelectionDelete" @toggle-visibility="handleSelectionToggleVisibility" />
      </Transition>

      <!-- Waypoint pill -->
      <Transition name="mf-fade">
        <WaypointPill v-if="selection.selectedWaypointKey.value && !isPlacingPin && !isPlacingCaption && !isDrawingRoute && !isAdjustingPrintArea" :route="selectedWaypointRoute!" :point-index="selection.selectedWaypointKey.value.pointIndex" :linked-pin="selectedWaypointLinkedPin" @edit-route="openEditRoute(selectedWaypointRoute!)" @edit-pin="selectedWaypointLinkedPin && openEditPin(selectedWaypointLinkedPin)" @delete="handleWaypointDelete(selection.selectedWaypointKey.value!.routeId, selection.selectedWaypointKey.value!.pointIndex)" @clear="selection.clearSelection()" />
      </Transition>

      <!-- Maps panel backdrop -->
      <div v-if="showMapsPanel" class="absolute inset-0 z-800 no-print" @click="showMapsPanel = false" />

      <!-- Maps panel -->
      <Transition name="mf-panel">
        <div v-if="showMapsPanel" class="absolute left-4 top-4 z-1100 w-80 max-w-[calc(100vw-80px)] bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-y-auto flex flex-col max-h-[80vh] no-print">
          <MapsPanel :maps="maps" :active-id="activeId" @switch="doSwitchMap" @edit="editingMapId = $event" @create="doCreateMap" @duplicate="doDuplicateMap" @delete="doDeleteMap" @export="exportMapData" @copy-link="(o) => copyShareLink(o.layers, o.mapId)" @import="mapImportFileRef?.click()" @close="showMapsPanel = false" @reorder="reorderMaps" />
        </div>
      </Transition>

      <!-- FAB panel backdrop -->
      <div v-if="activeFab" class="absolute inset-0 z-800 no-print" @click="activeFab = null" />

      <!-- Map Style panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'style'" :class="panelClass">
          <SettingsPanel v-model:show-coords="showCoords" v-model:show-scale="showScale" v-model:show-zoom="showZoom" v-model:map-units="mapUnits" v-model:route-snap="routeSnapEnabled" v-model:angle-snap="angleSnapEnabled" :map-style="mapStyle" :show-labels="showLabels" :is-dark="isDark" :preview-tile="previewTile" @style-change="mapStyle = $event" @labels-change="showLabels = $event" />
        </div>
      </Transition>

      <!-- Print & Export panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'export'" :class="panelClass">
          <PrintPanel
            v-model:enhance-contrast="printSettings.contrast.value"
            v-model:export-quality="printSettings.exportQuality.value"
            :print-areas="printAreas"
            :active-print-area-id="activePrintAreaId"
            :selected-print-area-ids="[...selection.selectedPrintAreaIds.value]"
            :all-print-areas-hidden="printAreas.length > 0 && printAreas.every((a) => a.hidden)"
            :is-downloading-pdf="isDownloadingPdf"
            :map-style="mapStyle"
            :map-name="mapName"
            :map-subtitle="effectiveArea"
            @add-area="handleAddPrintArea"
            @select-area="(id, additive) => handleSelectPrintArea(id, additive)"
            @edit-area="handlePrintAreaEdit"
            @toggle-visibility="(id) => patchPrintArea(id, { hidden: !printAreas.find((a) => a.id === id)?.hidden })"
            @toggle-all-visibility="
              () => {
                const hide = !printAreas.every((a) => a.hidden)
                updatePrintAreas(printAreas.map((a) => ({ ...a, hidden: hide })))
              }
            "
            @fit-to-view="fitToPrintArea"
            @copy-area="handleClipCopyPrintArea"
            @cut-area="handleClipCutPrintArea"
            @delete-area="
              (id) => {
                history.push('delete print')
                deletePrintArea(id)
              }
            "
            @clear-all="
              () => {
                history.push('delete all prints')
                updatePrintAreas([])
              }
            "
            @reorder="reorderPrintAreas"
            @download-pdf="handlePrintAreaDownload"
            @cancel-pdf="cancelExport"
          />
        </div>
      </Transition>

      <!-- Print preview modal -->
      <PrintPreviewModal v-if="isPreviewOpen && previewBlobUrl" :blob-url="previewBlobUrl" @download="downloadFromPreview" @close="closePreview" />

      <!-- Routes panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'routes'" :class="panelClass">
          <RoutesPanel
            v-model:distance-unit="mapUnits"
            :routes="routes"
            :hidden-route-ids="hiddenRouteIds"
            :all-routes-hidden="allRoutesHidden"
            :drawing-route-id="isDrawingRoute ? (drawingRoute?.id ?? null) : null"
            :selected-route-ids="selection.selectedRouteIds.value"
            @new-route="
              () => {
                stopPlacing()
                doStartNewRoute()
                activeFab = null
              }
            "
            @continue-drawing="
              (id) => {
                stopPlacing()
                continueDrawing(id)
                activeFab = null
              }
            "
            @fit-to-all="fitToAllRoutes"
            @edit-route="openEditRoute"
            @clip-copy-route="handleClipCopyRoute"
            @clip-cut-route="handleClipCutRoute"
            @delete-route="deleteRoute"
            @toggle-visibility="toggleRouteVisibility"
            @toggle-all-visibility="toggleAllRouteVisibility"
            @clear-all="clearAllRoutes"
            @reorder="reorderRoutes"
            @select-route="
              (route) => {
                fitToRoute(route)
                handleSelectRoute(route.id, false)
              }
            "
            @toggle-route="(route) => handleSelectRoute(route.id, true)"
            @range-select-routes="
              (ids) => {
                selection.selectedRouteIds.value = new Set(ids)
                selection.selectedPinIds.value = new Set()
                selection.selectedCaptionIds.value = new Set()
                selection.selectedWaypointKey.value = null
              }
            "
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
            :all-pins-hidden="allPinsHidden"
            :resolving-pin-id="resolvingPinId"
            :show-clusters="showClusters"
            :pin-numbers="pinNumberedIndex"
            :selected-pin-ids="selection.selectedPinIds.value"
            @place-at-center="placeAtCenter"
            @fit-to-pins="fitToPins"
            @toggle-all-visibility="toggleAllPinVisibility"
            @clear-all="clearAllPinsWithCleanup"
            @delete-pin="deletePinWithCleanup"
            @edit-pin="openEditPin"
            @copy-coords="handleCopyCoords"
            @clip-copy-pin="handleClipCopyPin"
            @clip-cut-pin="handleClipCutPin"
            @select-pin="
              (pin) => {
                zoomToPin(pin)
                handleSelectPin(pin, false)
              }
            "
            @toggle-pin="(pin) => handleSelectPin(pin, true)"
            @range-select-pins="
              (ids) => {
                selection.selectedPinIds.value = new Set(ids)
                selection.selectedRouteIds.value = new Set()
                selection.selectedCaptionIds.value = new Set()
                selection.selectedWaypointKey.value = null
              }
            "
            @toggle-visibility="togglePinVisibility"
            @reorder="reorderPins"
            @clusters-change="showClusters = $event"
          />
        </div>
      </Transition>

      <!-- Captions panel -->
      <Transition name="mf-panel">
        <div v-if="activeFab === 'captions'" :class="panelClass">
          <CaptionsPanel
            v-model:caption-search="captionSearch"
            :captions="captions"
            :filtered-captions="filteredCaptions"
            :hidden-caption-ids="hiddenCaptionIds"
            :all-captions-hidden="allCaptionsHidden"
            :selected-caption-ids="selection.selectedCaptionIds.value"
            @place-at-center="startPlacingCaption"
            @fit-to-captions="fitToCaptions"
            @toggle-all-visibility="toggleAllCaptionVisibility"
            @clear-all="clearAllCaptions"
            @delete-caption="handleDeleteCaption"
            @edit-caption="openEditCaption"
            @copy-coords="handleCopyCoords"
            @clip-copy-caption="handleClipCopyCaption"
            @clip-cut-caption="handleClipCutCaption"
            @select-caption="
              (caption) => {
                zoomToCaption(caption)
                handleSelectCaption(caption, false)
              }
            "
            @toggle-caption="(caption) => handleSelectCaption(caption, true)"
            @range-select-captions="
              (ids) => {
                selection.selectedCaptionIds.value = new Set(ids)
                selection.selectedPinIds.value = new Set()
                selection.selectedRouteIds.value = new Set()
                selection.selectedWaypointKey.value = null
              }
            "
            @toggle-visibility="toggleCaptionVisibility"
          />
        </div>
      </Transition>

      <!-- Bottom-left: zoom pill + coords + scale -->
      <Transition name="mf-focus-left">
        <div v-if="!focusMode" class="absolute left-2 z-1000 no-print flex flex-col items-start gap-1 pointer-events-none" style="bottom: calc(0.75rem + env(safe-area-inset-bottom))">
          <ZoomControl v-if="showZoom && leafletMap" :leaflet-map="leafletMap" :at-max-zoom="atMaxZoom" :at-min-zoom="atMinZoom" />
          <div class="pointer-events-none flex flex-col items-start gap-1">
            <div v-if="showCoords && displayCoords" class="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm text-xs font-mono text-gray-500 dark:text-zinc-400 px-2 py-1 rounded shadow-sm border border-gray-200/60 dark:border-zinc-700/60 tabular-nums">{{ displayCoords.lat.toFixed(5) }}, {{ displayCoords.lng.toFixed(5) }}</div>
            <ScaleBar v-if="showScale && leafletMap" v-model:unit="mapUnits" :map="leafletMap" />
          </div>
        </div>
      </Transition>

      <!-- Top-left: undo/redo small FABs (appear on demand) -->
      <Transition name="mf-focus-left">
        <UndoRedoFabs v-if="(canUndo || canRedo) && !focusMode" :can-undo="canUndo" :can-redo="canRedo" @undo="undo()" @redo="redo()" />
      </Transition>

      <!-- FAB stack -->
      <MapFabStack :active-fab="activeFab" :focus-mode="focusMode" :pin-count="pins.length - hiddenPinIds.size" :route-count="routes.length - hiddenRouteIds.size" :caption-count="captions.length - hiddenCaptionIds.size" :all-pins-hidden="allPinsHidden" :all-routes-hidden="allRoutesHidden" :all-captions-hidden="allCaptionsHidden" :print-area-count="printAreas.filter((a) => !a.hidden).length" @toggle="toggleFab" @toggle-focus="toggleFocusMode" />

      <!-- Bottom-right nav helpers (locate + fit-all), above the attribution -->
      <Transition name="mf-focus-right">
        <MapNavStack v-if="!focusMode" :is-locating="isLocating" :can-fit-all="canFit" :fit-label="fitLabel" @locate="goToMyLocation" @fit-all="fitToView" />
      </Transition>
    </div>

    <!-- ── Bottom sheet backdrop ─────────────────────────────────────────── -->
    <Transition name="mf-fade">
      <div v-if="bottomSheet" class="fixed inset-0 z-1700 bg-black/30 no-print" @click="closeSheet" />
    </Transition>

    <!-- ── Edit Pin sheet ─────────────────────────────────────────────────── -->
    <Transition name="mf-sheet">
      <PinForm ref="pinFormRef" :show="bottomSheet" :editing-pin="editingPin" :global-dot-size="stickyDotSize" :name-placeholder="editingPinPlaceholder" @save="handlePinSave" @delete="handlePinDelete" @close="closeSheet" />
    </Transition>

    <!-- ── Edit Route sheet ─────────────────────────────────────────────────── -->
    <Transition name="mf-fade">
      <div v-if="editingRouteRef" class="fixed inset-0 z-1700 bg-black/30 no-print" @click="closeEditRoute" />
    </Transition>
    <Transition name="mf-sheet">
      <RouteForm
        ref="routeFormRef"
        :show="!!editingRouteRef"
        :editing-route="editingRouteRef"
        :distance-unit="mapUnits"
        :name-placeholder="editingRoutePlaceholder"
        @save="handleRouteSave"
        @delete="
          () => {
            if (editingRouteRef) deleteRoute(editingRouteRef.id)
          }
        "
        @close="closeEditRoute"
      />
    </Transition>

    <!-- ── Edit Caption sheet ─────────────────────────────────────────────── -->
    <!-- No backdrop: the map stays interactive so the on-map rotate handle is usable while editing. -->
    <Transition name="mf-sheet">
      <CaptionForm ref="captionFormRef" :show="!!editingCaption" :editing-caption="editingCaption" :text-placeholder="editingCaptionPlaceholder" @save="handleCaptionSave" @delete="handleCaptionDelete" @close="closeCaptionSheet" />
    </Transition>

    <!-- ── Print Area form sheet ─────────────────────────────────────────── -->
    <Transition name="mf-fade">
      <div v-if="showPrintAreaForm" class="fixed inset-0 z-1700 bg-black/30 no-print" @click="handlePrintAreaClose" />
    </Transition>
    <Transition name="mf-sheet">
      <PrintAreaForm :show="showPrintAreaForm" :editing-area="editingPrintArea" :name-placeholder="editingPrintAreaPlaceholder" :map-title="mapName" :map-subtitle="effectiveArea" @save="handlePrintAreaSave" @delete="handlePrintAreaDelete" @close="handlePrintAreaClose" />
    </Transition>

    <!-- ── Map form sheet ──────────────────────────────────────────────────── -->
    <Transition name="mf-fade">
      <div v-if="editingMapId" class="fixed inset-0 z-1700 bg-black/30 no-print" @click="editingMapId = null" />
    </Transition>
    <Transition name="mf-sheet">
      <MapForm :show="editingMapId !== null" :editing-map="editingMapData" :auto-area="autoArea" :can-delete="maps.length > 1" @save="handleMapFormSave" @delete="handleMapFormDelete" @close="editingMapId = null" />
    </Transition>

    <!-- ── Welcome modal ──────────────────────────────────────────────────── -->
    <WelcomeModal :show="showInfo" @close="closeInfo" />

    <!-- ── Toasts ─────────────────────────────────────────────────────────── -->
    <AppToasts :notification="notification" :address-resolve-prog="addressResolveProg" :on-cancel="isDownloadingPdf ? cancelExport : null" />

    <!-- Hidden file input: map import (MapFolio JSON or GeoJSON) -->
    <input ref="mapImportFileRef" type="file" accept=".json,.geojson" class="hidden" @change="handleMapImportFile" />
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

.mf-focus-left-enter-active,
.mf-focus-left-leave-active,
.mf-focus-right-enter-active,
.mf-focus-right-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.mf-focus-left-enter-from,
.mf-focus-left-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
.mf-focus-right-enter-from,
.mf-focus-right-leave-to {
  opacity: 0;
  transform: translateX(10px);
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
