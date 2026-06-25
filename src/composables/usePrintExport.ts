import L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { PrintAreaInfo } from '@/components/PrintAreaDrawer.vue'
import type { Caption, MapStyle, Pin, PrintArea, PrintOrientation, PrintPaperSize, Route } from '@/types'

import type { ExportQuality } from './useMapExport'
import { exportMapToPdf } from './useMapExport'

export type PaperSize = PrintPaperSize
export type Orientation = PrintOrientation

export const PAPERS: PaperSize[] = ['letter', 'tabloid', 'a']
export const PAPER_LABELS: Record<PaperSize, string> = { letter: 'Letter', tabloid: 'Tabloid', a: 'A (ISO)' }
export const ASPECT_RATIOS: Record<PaperSize, Record<Orientation, number>> = {
  letter: { portrait: 8.5 / 11, landscape: 11 / 8.5 },
  tabloid: { portrait: 11 / 17, landscape: 17 / 11 },
  a: { portrait: 1 / Math.SQRT2, landscape: Math.SQRT2 }
}
export const GRID_PRESETS = ['1x1', '2x1', '1x2', '2x2', '3x2', '2x3', '3x3'] as const

const PAPER_PT: Record<PaperSize, Record<Orientation, [number, number]>> = {
  letter: { portrait: [612, 792], landscape: [792, 612] },
  tabloid: { portrait: [792, 1224], landscape: [1224, 792] },
  a: { portrait: [595, 842], landscape: [842, 595] }
}

const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'CO', 'VE', 'CL', 'PH'])
function regionDefaultPaper(): PaperSize {
  return LETTER_REGIONS.has((navigator.language.split('-')[1] ?? '').toUpperCase()) ? 'letter' : 'a'
}

export function defaultPrintAreaSettings(): Omit<PrintArea, 'id' | 'corners' | 'angle'> {
  return {
    paper: regionDefaultPaper(),
    orientation: 'portrait',
    grid: '1x1'
  }
}

export function usePrintExport(options: {
  leafletMap: ShallowRef<L.Map | null>
  mapStyle: Ref<MapStyle>
  mapName: Ref<string>
  mapArea: Ref<string>
  pins: Ref<Pin[]>
  hiddenPinIds: Ref<Set<number>>
  routes: Ref<Route[]>
  hiddenRouteIds: Ref<Set<number>>
  captions: Ref<Caption[]>
  hiddenCaptionIds: Ref<Set<number>>
  units: Ref<'km' | 'mi'>
  angleSnapEnabled: Ref<boolean>
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void
  printSettings: {
    contrast: Ref<boolean>
    exportQuality: Ref<ExportQuality>
  }
  printAreas: Ref<PrintArea[]>
  updatePrintAreas: (areas: PrintArea[]) => void
}) {
  const { leafletMap, mapStyle, mapName, mapArea, pins, hiddenPinIds, routes, hiddenRouteIds, captions, hiddenCaptionIds, units, showNotification, printSettings, printAreas, updatePrintAreas } = options

  // ── Active area ───────────────────────────────────────────────────────────────

  const activePrintAreaId = ref<string | null>(null)

  const activePrintArea = computed(() => printAreas.value.find((a) => a.id === activePrintAreaId.value) ?? null)

  // When the active map changes (printAreas array is replaced), deselect if active area is gone.
  watch(printAreas, (areas) => {
    if (activePrintAreaId.value && !areas.find((a) => a.id === activePrintAreaId.value)) {
      activePrintAreaId.value = null
    }
  })

  // Derived from the active area's corners + settings
  const printCorners = computed(() => activePrintArea.value?.corners ?? [])
  const printAngle = computed(() => activePrintArea.value?.angle ?? 0)

  const printBounds = computed<L.LatLngBounds | null>(() => {
    const c = printCorners.value
    if (c.length !== 4) return null
    return L.latLngBounds(c.map(([lat, lng]) => L.latLng(lat, lng)))
  })

  const printAspectRatio = computed<number | null>(() => {
    const area = activePrintArea.value
    if (!area) return null
    const [cols, rows] = area.grid.split('x').map(Number)
    const base = ASPECT_RATIOS[area.paper][area.orientation]
    return (base * (cols || 1)) / (rows || 1)
  })

  const overlayCorner = ref<0 | 1 | 2 | 3>(2)

  // Recompute the least-pin-populated corner whenever the active area's corners change.
  watch(
    printCorners,
    () => {
      overlayCorner.value = computeOverlayCorner()
    },
    { deep: true }
  )

  // ── Preview / download ────────────────────────────────────────────────────────

  const isDownloadingPdf = ref(false)
  let exportAbortController: AbortController | null = null

  function cancelExport() {
    exportAbortController?.abort()
  }
  const isPreviewOpen = ref(false)
  const previewBlobUrl = ref<string | null>(null)

  // ── Auto-area geocoding ───────────────────────────────────────────────────────

  const isAutoArea = ref(false)
  const autoArea = ref('')

  async function geocodeCenter(lat: number, lng: number) {
    isAutoArea.value = true
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`, { headers: { 'Accept-Language': 'en' } })
      const data = await res.json()
      const a = data.address ?? {}
      const city = a.city || a.town || a.village || a.municipality || a.county || ''
      const region = a.state || a.country || ''
      autoArea.value = city && region ? `${city}, ${region}` : city || region || data.display_name || ''
    } catch {
    } finally {
      isAutoArea.value = false
    }
  }

  let areaTimer: ReturnType<typeof setTimeout> | null = null
  let lastGeocodeKey = ''
  function scheduleAreaDetect() {
    if (!leafletMap.value || mapArea.value !== '') return
    if (areaTimer) clearTimeout(areaTimer)
    areaTimer = setTimeout(() => {
      const map = leafletMap.value
      if (!map || mapArea.value !== '') return
      const c = printBounds.value ? printBounds.value.getCenter() : map.getCenter()
      const key = `${c.lat.toFixed(1)},${c.lng.toFixed(1)}`
      if (key === lastGeocodeKey) return
      lastGeocodeKey = key
      geocodeCenter(c.lat, c.lng)
    }, 1200)
  }

  watch(
    leafletMap,
    (map, prev) => {
      if (prev) prev.off('moveend', scheduleAreaDetect)
      if (map) {
        map.on('moveend', scheduleAreaDetect)
        scheduleAreaDetect()
      }
    },
    { immediate: true }
  )
  watch(printBounds, scheduleAreaDetect)
  watch(mapArea, (v) => {
    if (v === '') {
      lastGeocodeKey = ''
      scheduleAreaDetect()
    }
  })

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  function patchPrintArea(id: string, patch: Partial<PrintArea>) {
    updatePrintAreas(printAreas.value.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  function calculatePrintBounds(widthToHeight: number): L.LatLngBounds {
    const map = leafletMap.value!
    const container = map.getContainer()
    const cw = container.clientWidth
    const ch = container.clientHeight
    let pw: number, ph: number
    if (cw / ch > widthToHeight) {
      ph = ch * 0.82
      pw = ph * widthToHeight
    } else {
      pw = cw * 0.82
      ph = pw / widthToHeight
    }
    const cx = cw / 2,
      cy = ch / 2
    return L.latLngBounds(map.containerPointToLatLng(L.point(cx - pw / 2, cy + ph / 2)), map.containerPointToLatLng(L.point(cx + pw / 2, cy - ph / 2)))
  }

  function boundsToCorners(bounds: L.LatLngBounds): [number, number][] {
    return [
      [bounds.getNorth(), bounds.getWest()],
      [bounds.getNorth(), bounds.getEast()],
      [bounds.getSouth(), bounds.getEast()],
      [bounds.getSouth(), bounds.getWest()]
    ]
  }

  function addPrintArea(overrides?: { paper?: PaperSize; orientation?: Orientation }): PrintArea {
    if (!leafletMap.value) throw new Error('no map')
    const defaults = defaultPrintAreaSettings()
    const paper = overrides?.paper ?? defaults.paper
    const orientation = overrides?.orientation ?? defaults.orientation
    const ratio = ASPECT_RATIOS[paper][orientation]
    const bounds = calculatePrintBounds(ratio)
    const corners = boundsToCorners(bounds)
    const area: PrintArea = {
      id: crypto.randomUUID(),
      corners,
      angle: 0,
      ...defaults,
      paper,
      orientation
    }
    updatePrintAreas([...printAreas.value, area])
    activePrintAreaId.value = area.id
    return area
  }

  function deletePrintArea(id: string) {
    updatePrintAreas(printAreas.value.filter((a) => a.id !== id))
    if (activePrintAreaId.value === id) activePrintAreaId.value = null
  }

  function selectPrintArea(id: string) {
    activePrintAreaId.value = id
  }

  function deselectPrintArea() {
    activePrintAreaId.value = null
  }

  // ── Spatial ops ───────────────────────────────────────────────────────────────

  function flipPrintAreaOrientation() {
    const area = activePrintArea.value
    if (!leafletMap.value || !area || area.corners.length !== 4) return
    const map = leafletMap.value
    const { corners, angle } = area
    const cosA = Math.cos(angle),
      sinA = Math.sin(angle)
    const latC = (corners[0]![0] + corners[2]![0]) / 2
    const lngC = (corners[0]![1] + corners[2]![1]) / 2
    const cp = map.latLngToContainerPoint(L.latLng(latC, lngC))
    const p0 = map.latLngToContainerPoint(L.latLng(corners[0]![0], corners[0]![1]))
    const dx = p0.x - cp.x,
      dy = p0.y - cp.y
    const halfW = Math.abs(dx * cosA + dy * sinA)
    const halfH = Math.abs(-dx * sinA + dy * cosA)
    const newCorners = (
      [
        [-halfH, -halfW],
        [halfH, -halfW],
        [halfH, halfW],
        [-halfH, halfW]
      ] as [number, number][]
    ).map(([lx, ly]) => {
      const ll = map.containerPointToLatLng(L.point(cp.x + lx * cosA - ly * sinA, cp.y + lx * sinA + ly * cosA))
      return [ll.lat, ll.lng] as [number, number]
    })
    patchPrintArea(area.id, { corners: newCorners })
  }

  function resnapPrintArea() {
    const area = activePrintArea.value
    if (!leafletMap.value || !area) return
    const [cols, rows] = area.grid.split('x').map(Number)
    const base = ASPECT_RATIOS[area.paper][area.orientation]
    const ratio = (base * (cols || 1)) / (rows || 1)
    const bounds = calculatePrintBounds(ratio)
    patchPrintArea(area.id, { corners: boundsToCorners(bounds), angle: 0 })
  }

  function fitToPrintArea() {
    if (!leafletMap.value || !printBounds.value) return
    const sw = printBounds.value.getSouthWest()
    const ne = printBounds.value.getNorthEast()
    leafletMap.value.fitBounds(
      [
        [sw.lat, sw.lng],
        [ne.lat, ne.lng]
      ],
      { padding: [40, 40], animate: true }
    )
  }

  function fitPrintAreaToElements() {
    const area = activePrintArea.value
    if (!leafletMap.value || !area) return
    const map = leafletMap.value
    const pts: L.Point[] = []
    for (const p of pins.value) {
      if (!hiddenPinIds.value.has(p.id)) pts.push(map.latLngToContainerPoint(L.latLng(p.lat, p.lng)))
    }
    for (const r of routes.value) {
      if (hiddenRouteIds.value.has(r.id)) continue
      for (const pt of r.points) pts.push(map.latLngToContainerPoint(L.latLng(pt.lat, pt.lng)))
    }
    if (pts.length === 0) {
      showNotification('No visible elements to fit', 'error')
      return
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    for (const pt of pts) {
      minX = Math.min(minX, pt.x)
      minY = Math.min(minY, pt.y)
      maxX = Math.max(maxX, pt.x)
      maxY = Math.max(maxY, pt.y)
    }

    const PAD = 60
    minX -= PAD
    minY -= PAD
    maxX += PAD
    maxY += PAD

    if (maxX - minX < PAD * 2) {
      const mx = (minX + maxX) / 2
      minX = mx - PAD
      maxX = mx + PAD
    }
    if (maxY - minY < PAD * 2) {
      const my = (minY + maxY) / 2
      minY = my - PAD
      maxY = my + PAD
    }

    let halfW = (maxX - minX) / 2
    let halfH = (maxY - minY) / 2
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    const [cols, rows] = area.grid.split('x').map(Number)
    const base = ASPECT_RATIOS[area.paper][area.orientation]
    const ratio = (base * (cols || 1)) / (rows || 1)
    if (ratio !== null) {
      if (halfW / halfH > ratio) halfH = halfW / ratio
      else halfW = halfH * ratio
    }

    const sw = map.containerPointToLatLng(L.point(cx - halfW, cy + halfH))
    const ne = map.containerPointToLatLng(L.point(cx + halfW, cy - halfH))
    const bounds = L.latLngBounds(sw, ne)
    patchPrintArea(area.id, { corners: boundsToCorners(bounds), angle: 0 })
    map.fitBounds(
      [
        [sw.lat, sw.lng],
        [ne.lat, ne.lng]
      ],
      { padding: [40, 40], animate: true }
    )
  }

  function computeOverlayCorner(): 0 | 1 | 2 | 3 {
    const corners = printCorners.value
    if (corners.length !== 4) return 2
    const [nw, ne, se, sw] = corners as [[number, number], [number, number], [number, number], [number, number]]
    const west = Math.min(nw[1], sw[1])
    const east = Math.max(ne[1], se[1])
    const south = Math.min(sw[0], se[0])
    const north = Math.max(nw[0], ne[0])
    const spanLng = east - west
    const spanLat = north - south
    if (spanLng < 1e-10 || spanLat < 1e-10) return 2
    const counts: [number, number, number, number] = [0, 0, 0, 0]
    for (const pin of pins.value) {
      if (hiddenPinIds.value.has(pin.id)) continue
      if (pin.lat < south || pin.lat > north || pin.lng < west || pin.lng > east) continue
      const nx = (pin.lng - west) / spanLng
      const ny = (north - pin.lat) / spanLat
      if (nx < 0.35 && ny < 0.35) counts[0]++
      else if (nx > 0.65 && ny < 0.35) counts[1]++
      else if (nx > 0.65 && ny > 0.65) counts[2]++
      else if (nx < 0.35 && ny > 0.65) counts[3]++
    }
    let best: 0 | 1 | 2 | 3 = 2
    let min = Infinity
    for (const i of [2, 3, 1, 0] as const) {
      if (counts[i] < min) {
        min = counts[i]
        best = i
      }
    }
    return best
  }

  // ── Bounds update from drawer ─────────────────────────────────────────────────

  function handleBoundsSet(id: string, info: PrintAreaInfo) {
    patchPrintArea(id, { corners: info.corners, angle: info.angle })
  }

  // ── PDF export ────────────────────────────────────────────────────────────────

  async function openPreview() {
    const area = activePrintArea.value
    if (isDownloadingPdf.value) return
    if (!area || area.corners.length !== 4) {
      showNotification('Select a print area first', 'error')
      return
    }
    exportAbortController = new AbortController()
    isDownloadingPdf.value = true
    showNotification('Building PDF…', 'info')
    try {
      const [pw, ph] = PAPER_PT[area.paper][area.orientation]
      const [gridCols, gridRows] = area.grid.split('x').map(Number)
      const pdfBytes = await exportMapToPdf({
        corners: area.corners,
        angle: area.angle,
        mapStyle: mapStyle.value,
        mapTitle: (area.legend ?? true) && (area.legendTitle ?? true) ? area.title || mapName.value : '',
        mapArea: (area.legend ?? true) && (area.legendArea ?? true) ? area.subtitle || mapArea.value || autoArea.value : '',
        pins: pins.value,
        hiddenPinIds: hiddenPinIds.value,
        routes: routes.value,
        hiddenRouteIds: hiddenRouteIds.value,
        captions: captions.value,
        hiddenCaptionIds: hiddenCaptionIds.value,
        legend: area.legend ?? true,
        legendPins: area.legendPins ?? true,
        legendRoutes: area.legendRoutes ?? true,
        legendSeparatePage: area.legendSeparatePage ?? false,
        legendBlankLabels: area.legendBlankLabels ?? false,
        legendScale: area.legendScale ?? 1,
        legendX: area.legendX ?? null,
        legendY: area.legendY ?? null,
        markerScale: area.markerScale ?? 1,
        includeCompass: area.compass ?? true,
        includeScale: area.scale ?? true,
        scaleUnit: units.value,
        enhanceContrast: printSettings.contrast.value,
        exportQuality: printSettings.exportQuality.value,
        overlayCorner: area.legendCorner ?? overlayCorner.value,
        paperWidthPt: pw,
        paperHeightPt: ph,
        gridCols: gridCols || 1,
        gridRows: gridRows || 1,
        onProgress: (msg) => showNotification(msg, 'info'),
        signal: exportAbortController.signal
      })
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
      if (previewBlobUrl.value) URL.revokeObjectURL(previewBlobUrl.value)
      previewBlobUrl.value = URL.createObjectURL(blob)
      isPreviewOpen.value = true
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        showNotification('Export cancelled', 'info')
      } else {
        // eslint-disable-next-line no-console
        console.error('[MapFolio] PDF export error:', e)
        showNotification('Export failed - check console', 'error')
      }
    } finally {
      isDownloadingPdf.value = false
      exportAbortController = null
    }
  }

  function downloadFromPreview() {
    if (!previewBlobUrl.value) return
    const a = document.createElement('a')
    a.href = previewBlobUrl.value
    a.download = `${mapName.value || 'mapfolio'}.pdf`
    a.click()
    showNotification('PDF downloaded')
    closePreview()
  }

  function closePreview() {
    if (previewBlobUrl.value) {
      URL.revokeObjectURL(previewBlobUrl.value)
      previewBlobUrl.value = null
    }
    isPreviewOpen.value = false
  }

  return {
    activePrintAreaId,
    activePrintArea,
    printCorners,
    printAngle,
    printBounds,
    printAspectRatio,
    overlayCorner,
    isDownloadingPdf,
    isPreviewOpen,
    previewBlobUrl,
    isAutoArea,
    autoArea,
    addPrintArea,
    deletePrintArea,
    selectPrintArea,
    deselectPrintArea,
    patchPrintArea,
    flipPrintAreaOrientation,
    resnapPrintArea,
    fitToPrintArea,
    fitPrintAreaToElements,
    handleBoundsSet,
    openPreview,
    cancelExport,
    downloadFromPreview,
    closePreview
  }
}
