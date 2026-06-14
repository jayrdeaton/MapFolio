import L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { PrintAreaInfo } from '@/components/PrintAreaDrawer.vue'
import type { MapStyle, Pin } from '@/types'

import { exportMapToPdf } from './useMapExport'
import type { PrintOrientation, PrintPaperSize } from './usePrintSettings'

export type PaperSize = PrintPaperSize
export type Orientation = PrintOrientation

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
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void
  printSettings: {
    paper: Ref<PrintPaperSize>
    orientation: Ref<PrintOrientation>
    grid: Ref<string>
    legend: Ref<boolean>
    compass: Ref<boolean>
    scale: Ref<'off' | 'km' | 'mi'>
    contrast: Ref<boolean>
  }
}) {
  const { leafletMap, mapStyle, mapName, mapArea, pins, hiddenPinIds, showNotification, printSettings } = options

  const printBounds = shallowRef<L.LatLngBounds | null>(null)
  const printCorners = ref<[number, number][]>([])
  const printAngle = ref(0)
  const printSnapEnabled = ref(false)
  const overlayCorner = ref<0 | 1 | 2 | 3>(2)
  const isDownloadingPdf = ref(false)
  const isAutoArea = ref(false)

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
      mapArea.value = city && region ? `${city}, ${region}` : city || region || data.display_name || ''
    } catch {
    } finally {
      isAutoArea.value = false
    }
  }

  let areaTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    [pins, mapArea],
    ([newPins, newArea]) => {
      if (newArea !== '') return
      if (newPins.length === 0) return
      if (areaTimer) clearTimeout(areaTimer)
      areaTimer = setTimeout(() => {
        const lats = newPins.map((p) => p.lat)
        const lngs = newPins.map((p) => p.lng)
        const lat = (Math.min(...lats) + Math.max(...lats)) / 2
        const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2
        geocodeCenter(lat, lng)
      }, 1500)
    },
    { deep: true, immediate: true }
  )

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

  function fitPrintAreaToPins() {
    if (!leafletMap.value) return
    const visible = pins.value.filter((p) => !hiddenPinIds.value.has(p.id))
    if (visible.length === 0) {
      showNotification('No visible pins to fit', 'error')
      return
    }

    const map = leafletMap.value
    const pts = visible.map((p) => map.latLngToContainerPoint(L.latLng(p.lat, p.lng)))

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

  function handleBoundsSet(info: PrintAreaInfo) {
    printBounds.value = info.bounds
    printCorners.value = info.corners
    printAngle.value = info.angle
    overlayCorner.value = computeOverlayCorner()
  }

  async function downloadPdf() {
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
        mapTitle: mapName.value,
        mapArea: mapArea.value,
        pins: pins.value,
        hiddenPinIds: hiddenPinIds.value,
        includeLegend: printSettings.legend.value,
        includeCompass: printSettings.compass.value,
        includeScale: printSettings.scale.value !== 'off',
        scaleUnit: printSettings.scale.value === 'off' ? 'km' : printSettings.scale.value,
        enhanceContrast: printSettings.contrast.value,
        paperWidthPt: pw,
        paperHeightPt: ph,
        gridCols,
        gridRows,
        onProgress: (msg) => showNotification(msg, 'info')
      })
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${mapName.value || 'mapfolio'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      showNotification('PDF downloaded')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[MapFolio] PDF export error:', e)
      showNotification('Export failed — check console', 'error')
    } finally {
      isDownloadingPdf.value = false
    }
  }

  return {
    printBounds,
    printCorners,
    printAngle,
    printSnapEnabled,
    isDownloadingPdf,
    isAutoArea,
    printPaper,
    printOrientation,
    parsedGrid,
    printAspectRatio,
    overlayCorner,
    selectPrintPreset,
    resnapPrintArea,
    fitToPrintArea,
    fitPrintAreaToPins,
    handleBoundsSet,
    downloadPdf
  }
}
