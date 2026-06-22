import L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { PrintAreaInfo } from '@/components/PrintAreaDrawer.vue'
import type { Caption, MapStyle, Pin, Route } from '@/types'

import { exportMapToPdf } from './useMapExport'
import type { ExportQuality } from './useMapExport'
import type { PrintOrientation, PrintPaperSize } from './usePrintSettings'

export type PaperSize = PrintPaperSize
export type Orientation = PrintOrientation

export interface PrintHistoryEntry {
  timestamp: number
  corners: [number, number][]
  angle: number
  paper: PaperSize
  orientation: Orientation
  grid: string
  snap: boolean
  legend: boolean
  separatePage?: boolean
  compass: boolean
  scale: boolean
  contrast: boolean
  exportQuality?: ExportQuality
  legendScale?: number
  legendX?: number | null
  legendY?: number | null
}

const HISTORY_KEY = 'mapfolio_print_history'
const HISTORY_MAX = 5

export const PAPERS = ['letter', 'tabloid', 'a'] as const
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
    paper: Ref<PrintPaperSize>
    orientation: Ref<PrintOrientation>
    grid: Ref<string>
    legend: Ref<boolean>
    legendSeparatePage: Ref<boolean>
    legendTitle: Ref<boolean>
    legendArea: Ref<boolean>
    legendBlankLabels: Ref<boolean>
    legendScale: Ref<number>
    legendX: Ref<number | null>
    legendY: Ref<number | null>
    compass: Ref<boolean>
    scale: Ref<boolean>
    contrast: Ref<boolean>
    exportQuality: Ref<ExportQuality>
  }
}) {
  const { leafletMap, mapStyle, mapName, mapArea, pins, hiddenPinIds, routes, hiddenRouteIds, captions, hiddenCaptionIds, units, angleSnapEnabled, showNotification, printSettings } = options

  const printBounds = shallowRef<L.LatLngBounds | null>(null)
  const printCorners = ref<[number, number][]>([])
  const printAngle = ref(0)
  const printHistory = ref<PrintHistoryEntry[]>(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'))
  const printAreaVisibility = ref<'visible' | 'opaque' | 'hidden'>((localStorage.getItem('mapfolio_print_visibility') as 'visible' | 'opaque' | 'hidden') ?? 'visible')

  watch(printAreaVisibility, (v) => localStorage.setItem('mapfolio_print_visibility', v))
  const overlayCorner = ref<0 | 1 | 2 | 3>(2)
  const isDownloadingPdf = ref(false)
  const isPreviewOpen = ref(false)
  const previewBlobUrl = ref<string | null>(null)
  const isAutoArea = ref(false)
  // Geocoded suggestion shown as the Subtitle placeholder — never written into the
  // map's stored `area`. Effective subtitle = user-entered area || this suggestion.
  const autoArea = ref('')

  const printPaper = ref<PaperSize | null>(printSettings.paper.value)
  const printOrientation = ref<Orientation | null>(printSettings.orientation.value)

  watch(printPaper, (v) => {
    if (v) printSettings.paper.value = v
  })
  watch(printOrientation, (v) => {
    if (v) printSettings.orientation.value = v
  })

  const parsedGrid = computed<[number, number]>(() => {
    const [c, r] = printSettings.grid.value.split('x').map(Number)
    return [c || 1, r || 1]
  })

  const printAspectRatio = computed<number | null>(() => {
    if (!printPaper.value || !printOrientation.value) return null
    const [cols, rows] = parsedGrid.value
    const base = ASPECT_RATIOS[printPaper.value][printOrientation.value]
    return (base * cols) / rows
  })

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

  // Detect the subtitle suggestion from the print area center (what's actually being
  // printed), falling back to the current map view. Only while the user hasn't set a
  // subtitle. Debounced + deduped by ~0.1° (~11km) so panning doesn't spam Nominatim.
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

  function selectPrintPreset(paper: PaperSize, orientation: Orientation) {
    if (!leafletMap.value) return
    printPaper.value = paper
    printOrientation.value = orientation
    printBounds.value = calculatePrintBounds(printAspectRatio.value ?? ASPECT_RATIOS[paper][orientation])
  }

  function resnapPrintArea() {
    if (!leafletMap.value || !printPaper.value || !printOrientation.value) return
    printBounds.value = calculatePrintBounds(printAspectRatio.value ?? ASPECT_RATIOS[printPaper.value][printOrientation.value])
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
    if (!leafletMap.value) return
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

    // Single-pin case: ensure minimum dimensions
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

    const ratio = printAspectRatio.value
    if (ratio !== null) {
      if (halfW / halfH > ratio) halfH = halfW / ratio
      else halfW = halfH * ratio
    }

    const sw = map.containerPointToLatLng(L.point(cx - halfW, cy + halfH))
    const ne = map.containerPointToLatLng(L.point(cx + halfW, cy - halfH))
    printBounds.value = L.latLngBounds(sw, ne)
    map.fitBounds(
      [
        [sw.lat, sw.lng],
        [ne.lat, ne.lng]
      ],
      { padding: [40, 40], animate: true }
    )
  }

  function computeOverlayCorner(): 0 | 1 | 2 | 3 {
    if (printCorners.value.length !== 4) return 2
    const [nw, ne, se, sw] = printCorners.value as [[number, number], [number, number], [number, number], [number, number]]
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

  function saveToHistory() {
    if (!printPaper.value || !printOrientation.value || printCorners.value.length !== 4) return
    const entry: PrintHistoryEntry = {
      timestamp: Date.now(),
      corners: [...printCorners.value] as [number, number][],
      angle: printAngle.value,
      paper: printPaper.value,
      orientation: printOrientation.value,
      grid: printSettings.grid.value,
      snap: angleSnapEnabled.value,
      legend: printSettings.legend.value,
      separatePage: printSettings.legendSeparatePage.value,
      compass: printSettings.compass.value,
      scale: printSettings.scale.value,
      contrast: printSettings.contrast.value,
      exportQuality: printSettings.exportQuality.value,
      legendScale: printSettings.legendScale.value,
      legendX: printSettings.legendX.value,
      legendY: printSettings.legendY.value
    }
    printHistory.value = [entry, ...printHistory.value].slice(0, HISTORY_MAX)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(printHistory.value))
  }

  function restoreSettings(entry: PrintHistoryEntry) {
    printPaper.value = entry.paper
    printOrientation.value = entry.orientation
    printSettings.grid.value = entry.grid
    angleSnapEnabled.value = entry.snap
    printSettings.legend.value = entry.legend
    printSettings.legendSeparatePage.value = entry.separatePage ?? false
    printSettings.compass.value = entry.compass
    // Coerce legacy string entries ('off' | 'km' | 'mi') to the new boolean toggle.
    printSettings.scale.value = entry.scale !== false && (entry.scale as unknown) !== 'off'
    printSettings.contrast.value = entry.contrast
    printSettings.exportQuality.value = entry.exportQuality ?? 'standard'
    printSettings.legendScale.value = entry.legendScale ?? 1
    printSettings.legendX.value = entry.legendX ?? null
    printSettings.legendY.value = entry.legendY ?? null
  }

  function handleBoundsSet(info: PrintAreaInfo) {
    printBounds.value = info.bounds
    printCorners.value = info.corners
    printAngle.value = info.angle
    overlayCorner.value = computeOverlayCorner()
  }

  async function openPreview() {
    if (isDownloadingPdf.value) return
    if (!printBounds.value || printCorners.value.length !== 4 || !printPaper.value || !printOrientation.value) {
      showNotification('Set a print area first', 'error')
      return
    }
    isDownloadingPdf.value = true
    showNotification('Building PDF…', 'info')
    try {
      const [pw, ph] = PAPER_PT[printPaper.value][printOrientation.value]
      const [gridCols, gridRows] = parsedGrid.value
      const pdfBytes = await exportMapToPdf({
        corners: printCorners.value,
        angle: printAngle.value,
        mapStyle: mapStyle.value,
        mapTitle: printSettings.legendTitle.value ? mapName.value : '',
        mapArea: printSettings.legendArea.value ? mapArea.value || autoArea.value : '',
        pins: pins.value,
        hiddenPinIds: hiddenPinIds.value,
        routes: routes.value,
        hiddenRouteIds: hiddenRouteIds.value,
        captions: captions.value,
        hiddenCaptionIds: hiddenCaptionIds.value,
        includeLegend: printSettings.legend.value,
        legendSeparatePage: printSettings.legendSeparatePage.value,
        legendBlankLabels: printSettings.legendBlankLabels.value,
        legendScale: printSettings.legendScale.value,
        legendX: printSettings.legendX.value,
        legendY: printSettings.legendY.value,
        includeCompass: printSettings.compass.value,
        includeScale: printSettings.scale.value,
        scaleUnit: units.value,
        enhanceContrast: printSettings.contrast.value,
        exportQuality: printSettings.exportQuality.value,
        paperWidthPt: pw,
        paperHeightPt: ph,
        gridCols,
        gridRows,
        onProgress: (msg) => showNotification(msg, 'info')
      })
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
      if (previewBlobUrl.value) URL.revokeObjectURL(previewBlobUrl.value)
      previewBlobUrl.value = URL.createObjectURL(blob)
      isPreviewOpen.value = true
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[MapFolio] PDF export error:', e)
      showNotification('Export failed - check console', 'error')
    } finally {
      isDownloadingPdf.value = false
    }
  }

  function downloadFromPreview() {
    if (!previewBlobUrl.value) return
    const a = document.createElement('a')
    a.href = previewBlobUrl.value
    a.download = `${mapName.value || 'mapfolio'}.pdf`
    a.click()
    saveToHistory()
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
    printBounds,
    printCorners,
    printAngle,
    printAreaVisibility,
    printHistory,
    isDownloadingPdf,
    isPreviewOpen,
    previewBlobUrl,
    isAutoArea,
    autoArea,
    printPaper,
    printOrientation,
    parsedGrid,
    printAspectRatio,
    overlayCorner,
    selectPrintPreset,
    resnapPrintArea,
    fitToPrintArea,
    fitPrintAreaToElements,
    handleBoundsSet,
    openPreview,
    downloadFromPreview,
    closePreview,
    restoreSettings
  }
}
