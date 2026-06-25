import type { Caption, Pin, PrintArea, Route } from '@/types'

interface MapClipboard {
  set: (pins: Pin[], routes: Route[], captions?: Caption[], printAreas?: PrintArea[], mapId?: string) => void
  pasteAt: (lat: number, lng: number) => { pins: Pin[]; routes: Route[]; captions: Caption[]; printAreas: PrintArea[] } | null
  pasteInPlace: () => { pins: Pin[]; routes: Route[]; captions: Caption[]; printAreas: PrintArea[] } | null
  hasClipboard: Ref<boolean>
  sourceMapId: Ref<string | null>
}

interface UseClipboardActionsOptions {
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
  leafletMap: Ref<import('leaflet').Map | null>
  showNotification: (msg: string) => void
  fetchPinAddress: (lat: number, lng: number) => Promise<string | undefined>
}

export function useClipboardActions({ pins, routes, captions, printAreas, updatePrintAreas, mapClipboard, activeMapId, history, cleanupOrphanedLinks, isDrawingRoute, stopDrawing, drawingRoute, leafletMap, showNotification, fetchPinAddress }: UseClipboardActionsOptions) {
  function handleClipCopyPin(pin: Pin) {
    mapClipboard.set([pin], [], [], [], activeMapId.value)
    showNotification('Pin copied - ⌘V to paste')
  }

  function handleClipCutPin(pin: Pin) {
    mapClipboard.set([pin], [], [], [], activeMapId.value)
    cleanupOrphanedLinks(pin.id)
    history.push('cut pin')
    pins.value = pins.value.filter((p) => p.id !== pin.id)
    showNotification('Pin cut - ⌘V to paste')
  }

  function handleClipCopyRoute(route: Route) {
    mapClipboard.set([], [route], [], [], activeMapId.value)
    showNotification('Route copied - ⌘V to paste')
  }

  function handleClipCutRoute(route: Route) {
    mapClipboard.set([], [route], [], [], activeMapId.value)
    history.push('cut route')
    if (isDrawingRoute.value && drawingRoute.value?.id === route.id) stopDrawing()
    routes.value = routes.value.filter((r) => r.id !== route.id)
    showNotification('Route cut - ⌘V to paste')
  }

  function handleClipCopyCaption(caption: Caption) {
    mapClipboard.set([], [], [caption], [], activeMapId.value)
    showNotification('Caption copied - ⌘V to paste')
  }

  function handleClipCutCaption(caption: Caption) {
    mapClipboard.set([], [], [caption], [], activeMapId.value)
    history.push('cut caption')
    captions.value = captions.value.filter((c) => c.id !== caption.id)
    showNotification('Caption cut - ⌘V to paste')
  }

  function handleClipCopyPrintArea(id: string) {
    const area = printAreas.value.find((a) => a.id === id)
    if (!area) return
    mapClipboard.set([], [], [], [area], activeMapId.value)
    showNotification('Print area copied - ⌘V to paste')
  }

  function handleClipCutPrintArea(id: string) {
    const area = printAreas.value.find((a) => a.id === id)
    if (!area) return
    mapClipboard.set([], [], [], [area], activeMapId.value)
    history.push('cut print area')
    updatePrintAreas(printAreas.value.filter((a) => a.id !== id))
    showNotification('Print area cut - ⌘V to paste')
  }

  function commitPaste(result: { pins: Pin[]; routes: Route[]; captions: Caption[]; printAreas: PrintArea[] }) {
    history.push('paste')
    pins.value = [...pins.value, ...result.pins]
    routes.value = [...routes.value, ...result.routes]
    captions.value = [...captions.value, ...result.captions]
    if (result.printAreas.length) updatePrintAreas([...printAreas.value, ...result.printAreas])
    const total = result.pins.length + result.routes.length + result.captions.length + result.printAreas.length
    showNotification(`Pasted ${total} item${total !== 1 ? 's' : ''}`)
    result.pins.forEach((p) => {
      fetchPinAddress(p.lat, p.lng).then((address) => {
        if (address) pins.value = pins.value.map((existing) => (existing.id === p.id ? { ...existing, address } : existing))
      })
    })
  }

  function handlePaste(lat: number, lng: number) {
    const result = mapClipboard.pasteAt(lat, lng)
    if (!result) return
    commitPaste(result)
  }

  function pasteAtCenter() {
    if (!mapClipboard.hasClipboard.value || !leafletMap.value) return
    const result = mapClipboard.pasteInPlace()
    if (!result) return
    commitPaste(result)
    const isCrossMap = mapClipboard.sourceMapId.value !== null && mapClipboard.sourceMapId.value !== activeMapId.value
    if (isCrossMap) {
      const allLats = [...result.pins.map((p) => p.lat), ...result.routes.flatMap((r) => r.points.map((pt) => pt.lat)), ...result.captions.map((c) => c.lat), ...result.printAreas.flatMap((a) => a.corners.map((c) => c[0]))]
      const allLngs = [...result.pins.map((p) => p.lng), ...result.routes.flatMap((r) => r.points.map((pt) => pt.lng)), ...result.captions.map((c) => c.lng), ...result.printAreas.flatMap((a) => a.corners.map((c) => c[1]))]
      if (allLats.length > 0) {
        const bounds: [[number, number], [number, number]] = [
          [Math.min(...allLats), Math.min(...allLngs)],
          [Math.max(...allLats), Math.max(...allLngs)]
        ]
        leafletMap.value.flyToBounds(bounds, { padding: [60, 60], maxZoom: 14 })
      }
    }
  }

  return { handleClipCopyPin, handleClipCutPin, handleClipCopyRoute, handleClipCutRoute, handleClipCopyCaption, handleClipCutCaption, handleClipCopyPrintArea, handleClipCutPrintArea, handlePaste, pasteAtCenter }
}
