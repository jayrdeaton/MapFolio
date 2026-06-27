import type { Caption, Pin, PrintArea, Route } from '@/types'

interface Selection {
  selectPin: (id: number, additive: boolean) => void
  selectRoute: (id: number, additive: boolean) => void
  selectCaption: (id: number, additive: boolean) => void
  selectWaypoint: (routeId: number, pointIndex: number) => void
  clearSelection: () => void
  selectedPinIds: Ref<Set<number>>
  selectedRouteIds: Ref<Set<number>>
  selectedCaptionIds: Ref<Set<number>>
  selectedPrintAreaIds: Ref<Set<string>>
  selectedWaypointKey: Ref<{ routeId: number; pointIndex: number } | null>
}

interface MapClipboard {
  set: (pins: Pin[], routes: Route[], captions: Caption[], printAreas?: PrintArea[], mapId?: string) => void
}

interface UseSelectionActionsOptions {
  selection: Selection
  pins: Ref<Pin[]>
  routes: Ref<Route[]>
  captions: Ref<Caption[]>
  printAreas: Ref<PrintArea[]>
  updatePrintAreas: (areas: PrintArea[]) => void
  mapClipboard: MapClipboard
  activeMapId: Ref<string>
  history: { push: (label?: string) => void }
  cleanupOrphanedLinks: (id: number | Set<number>) => void
  isDrawingRoute: Ref<boolean>
  stopDrawing: () => void
  drawingRoute: Ref<Route | null>
  showNotification: (msg: string) => void
  openEditPin: (pin: Pin) => void
  openEditRoute: (route: Route) => void
  openEditCaption: (caption: Caption) => void
  openEditPrintArea: (id: string) => void
  isAdjustingPrintArea: Ref<boolean>
  leafletMap: Ref<import('leaflet').Map | null>
  removePoint: (routeId: number, pointIndex: number) => void
}

export function useSelectionActions({ selection, pins, routes, captions, printAreas, updatePrintAreas, mapClipboard, activeMapId, history, cleanupOrphanedLinks, isDrawingRoute, stopDrawing, drawingRoute, showNotification, openEditPin, openEditRoute, openEditCaption, openEditPrintArea, isAdjustingPrintArea: _isAdjustingPrintArea, leafletMap, removePoint }: UseSelectionActionsOptions) {
  const selectedPins = computed(() => pins.value.filter((p) => selection.selectedPinIds.value.has(p.id)))
  const selectedRoutes = computed(() => routes.value.filter((r) => selection.selectedRouteIds.value.has(r.id)))
  const selectedCaptions = computed(() => captions.value.filter((c) => selection.selectedCaptionIds.value.has(c.id)))
  const selectedPrintAreas = computed(() => printAreas.value.filter((a) => selection.selectedPrintAreaIds.value.has(a.id)))

  const allSelectedHidden = computed(() => {
    const items = [...selectedPins.value, ...selectedRoutes.value, ...selectedCaptions.value, ...selectedPrintAreas.value]
    return items.length > 0 && items.every((i) => i.hidden)
  })

  function handleSelectionToggleVisibility() {
    const hide = !allSelectedHidden.value
    history.push(hide ? 'hide' : 'show')
    if (selection.selectedPinIds.value.size) pins.value = pins.value.map((p) => (selection.selectedPinIds.value.has(p.id) ? { ...p, hidden: hide } : p))
    if (selection.selectedRouteIds.value.size) routes.value = routes.value.map((r) => (selection.selectedRouteIds.value.has(r.id) ? { ...r, hidden: hide } : r))
    if (selection.selectedCaptionIds.value.size) captions.value = captions.value.map((c) => (selection.selectedCaptionIds.value.has(c.id) ? { ...c, hidden: hide } : c))
    if (selection.selectedPrintAreaIds.value.size) updatePrintAreas(printAreas.value.map((a) => (selection.selectedPrintAreaIds.value.has(a.id) ? { ...a, hidden: hide } : a)))
  }

  function handleSelectPin(pin: Pin, additive: boolean) {
    leafletMap.value?.closePopup()
    selection.selectPin(pin.id, additive)
  }

  function handleSelectRoute(routeId: number, additive: boolean) {
    leafletMap.value?.closePopup()
    selection.selectRoute(routeId, additive)
  }

  function handleSelectCaption(caption: Caption, additive: boolean) {
    leafletMap.value?.closePopup()
    selection.selectCaption(caption.id, additive)
  }

  function handleSelectionEdit() {
    const pin = selectedPins.value[0]
    const route = selectedRoutes.value[0]
    const caption = selectedCaptions.value[0]
    const area = selectedPrintAreas.value[0]
    selection.clearSelection()
    if (pin) openEditPin(pin)
    else if (route) openEditRoute(route)
    else if (caption) openEditCaption(caption)
    else if (area) openEditPrintArea(area.id)
  }

  function handleSelectionCopy() {
    mapClipboard.set(selectedPins.value, selectedRoutes.value, selectedCaptions.value, selectedPrintAreas.value, activeMapId.value)
    const count = selectedPins.value.length + selectedRoutes.value.length + selectedCaptions.value.length + selectedPrintAreas.value.length
    showNotification(`${count} item${count !== 1 ? 's' : ''} copied - ⌘V to paste`)
  }

  function handleSelectionCut() {
    const pinsToCut = [...selectedPins.value]
    const routesToCut = [...selectedRoutes.value]
    const captionsToCut = [...selectedCaptions.value]
    const areasToCut = [...selectedPrintAreas.value]
    mapClipboard.set(pinsToCut, routesToCut, captionsToCut, areasToCut, activeMapId.value)
    history.push('cut')
    pinsToCut.forEach((p) => cleanupOrphanedLinks(p.id))
    pins.value = pins.value.filter((p) => !selection.selectedPinIds.value.has(p.id))
    routesToCut.forEach((r) => {
      if (isDrawingRoute.value && drawingRoute.value?.id === r.id) stopDrawing()
    })
    routes.value = routes.value.filter((r) => !selection.selectedRouteIds.value.has(r.id))
    captions.value = captions.value.filter((c) => !selection.selectedCaptionIds.value.has(c.id))
    if (areasToCut.length) updatePrintAreas(printAreas.value.filter((a) => !selection.selectedPrintAreaIds.value.has(a.id)))
    const count = pinsToCut.length + routesToCut.length + captionsToCut.length + areasToCut.length
    showNotification(`${count} item${count !== 1 ? 's' : ''} cut - ⌘V to paste`)
    selection.clearSelection()
  }

  function handleSelectionFit() {
    if (!leafletMap.value) return
    const latLngs: [number, number][] = [...selectedPins.value.map((p): [number, number] => [p.lat, p.lng]), ...selectedRoutes.value.flatMap((r) => r.points.map((pt): [number, number] => [pt.lat, pt.lng])), ...selectedCaptions.value.map((c): [number, number] => [c.lat, c.lng]), ...selectedPrintAreas.value.flatMap((a) => a.corners.map((c): [number, number] => [c[0], c[1]]))]
    if (latLngs.length === 0) return
    leafletMap.value.fitBounds(latLngs, { padding: [60, 60], maxZoom: 16 })
  }

  function handleSelectWaypoint(routeId: number, pointIndex: number) {
    leafletMap.value?.closePopup()
    selection.selectWaypoint(routeId, pointIndex)
  }

  function handleWaypointDelete(routeId: number, pointIndex: number) {
    history.push('delete waypoint')
    removePoint(routeId, pointIndex)
    selection.clearSelection()
  }

  function handleSelectionDelete() {
    const pinIds = selection.selectedPinIds.value
    const routeIds = selection.selectedRouteIds.value
    const captionIds = selection.selectedCaptionIds.value
    const areaIds = selection.selectedPrintAreaIds.value
    const count = pinIds.size + routeIds.size + captionIds.size + areaIds.size
    if (count === 0) {
      const wk = selection.selectedWaypointKey.value
      if (wk) handleWaypointDelete(wk.routeId, wk.pointIndex)
      return
    }
    history.push('delete')
    selectedPins.value.forEach((p) => cleanupOrphanedLinks(p.id))
    pins.value = pins.value.filter((p) => !pinIds.has(p.id))
    routes.value = routes.value.filter((r) => !routeIds.has(r.id))
    captions.value = captions.value.filter((c) => !captionIds.has(c.id))
    if (areaIds.size) updatePrintAreas(printAreas.value.filter((a) => !areaIds.has(a.id)))
    showNotification(`${count} item${count !== 1 ? 's' : ''} deleted`)
    selection.clearSelection()
  }

  return {
    selectedPins,
    selectedRoutes,
    selectedCaptions,
    selectedPrintAreas,
    allSelectedHidden,
    handleSelectionToggleVisibility,
    handleSelectPin,
    handleSelectRoute,
    handleSelectCaption,
    handleSelectionEdit,
    handleSelectionFit,
    handleSelectionCopy,
    handleSelectionCut,
    handleSelectionDelete,
    handleSelectWaypoint,
    handleWaypointDelete
  }
}
