import { PDFDocument } from 'pdf-lib'

import type { Caption, MapStyle, MapStyleConfig, Pin, Route } from '@/types'
import { MAP_STYLE_CONFIGS } from '@/types'
import { drawCaptions, drawPins, drawRoutes } from '@/utils/exportDraw'
import type { OverlayCorner } from '@/utils/exportLegend'
import { drawInfoBox } from '@/utils/exportLegend'
import { renderLegendPagesToPng } from '@/utils/exportLegendPage'
import { fetchTile, fetchTilesConcurrent, latToTileFrac, lngToTileFrac, tileUrl } from '@/utils/exportTiles'

export interface ExportOptions {
  corners: [number, number][] // 4 geographic corners [[lat,lng], ...]  NW CW order
  angle: number // rectangle rotation in radians
  mapStyle: MapStyle
  mapTitle: string
  mapArea?: string
  pins: Pin[]
  hiddenPinIds: Set<number>
  routes: Route[]
  hiddenRouteIds: Set<number>
  captions: Caption[]
  hiddenCaptionIds: Set<number>
  legend: boolean // master: draw any legend box at all
  legendPins?: boolean // include pin list in legend
  legendRoutes?: boolean // include route list in legend
  legendSeparatePage?: boolean // render pin/route keys on their own page(s); on-map box keeps title/subtitle/compass/scale
  legendBlankLabels?: boolean // hide pin/route names — exploration mode so viewers can fill them in
  legendScale?: number // multiplier for the on-map legend box size (default 1)
  legendX?: number | null // explicit legend position: fraction of paper width for left edge (null = auto-corner)
  legendY?: number | null // explicit legend position: fraction of paper height for top edge (null = auto-corner)
  markerScale?: number // multiplier for pins + routes in the PDF (default 1; use < 1 for large-format prints)
  includeCompass: boolean
  includeScale: boolean
  scaleUnit: 'km' | 'mi'
  enhanceContrast: boolean
  exportQuality?: ExportQuality // 'draft' = fast/low-detail, 'standard' = default, 'hires' = large-format
  paperWidthPt: number // PDF page width in points (1pt = 1/72 inch)
  paperHeightPt: number // PDF page height in points
  gridCols?: number // poster grid columns (default 1)
  gridRows?: number // poster grid rows (default 1)
  overlayCorner?: 0 | 1 | 2 | 3 // which corner to place the info box (0=TL 1=TR 2=BR 3=BL); default 2
  onProgress?: (msg: string) => void
  signal?: AbortSignal
}

export type ExportQuality = 'draft' | 'standard' | 'hires'

const TILE_SIZE = 256 // px per tile at 1x (used for grid/zoom math regardless of retina)
const MAX_OUTPUT_PX = 7200 // standard: ~217 DPI at A0, ~800+ DPI at A4
const MAX_OUTPUT_PX_FAST = 4000 // draft: smaller + quicker to encode
const TILE_BUDGET = 750 // standard: picks the highest zoom under this ceiling
const TILE_BUDGET_FAST = 200 // draft: far fewer tiles at a lower zoom for a quick export
const TILE_BUDGET_HIRES = 50000 // hi-res: allows zoom 16 for large areas, zoom 17-18 for smaller ones
const TILE_CONCURRENCY = 24 // max simultaneous tile requests (6 connections × 4 CartoDB subdomains)

// Split a 4-corner rect [NW,NE,SE,SW] into a grid cell. Returns [NW,NE,SE,SW] for cell (ci,rj).
function subCornersForCell(corners: [number, number][], ci: number, rj: number, cols: number, rows: number): [number, number][] {
  const [nw, ne, , sw] = corners as [[number, number], [number, number], [number, number], [number, number]]
  const rLat = (ne[0] - nw[0]) / cols,
    rLng = (ne[1] - nw[1]) / cols
  const dLat = (sw[0] - nw[0]) / rows,
    dLng = (sw[1] - nw[1]) / rows
  const cnw: [number, number] = [nw[0] + ci * rLat + rj * dLat, nw[1] + ci * rLng + rj * dLng]
  const cne: [number, number] = [cnw[0] + rLat, cnw[1] + rLng]
  const cse: [number, number] = [cne[0] + dLat, cne[1] + dLng]
  const csw: [number, number] = [cnw[0] + dLat, cnw[1] + dLng]
  return [cnw, cne, cse, csw]
}

// Estimates the native half-dimensions (stitch-pixels) of a print area for hi-res mode —
// same zoom selection logic as renderPageToPng but without allocating any canvas.
function estimateHiresNativeSize(corners: [number, number][], angle: number, config: MapStyleConfig): { halfW: number; halfH: number } {
  const lats = corners.map((c) => c[0])
  const lngs = corners.map((c) => c[1])
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs)
  const maxZoom = config.maxNativeZoom ?? 19
  let zoom = 1
  for (let z = 1; z <= maxZoom; z++) {
    const xSpan = (lngToTileFrac(maxLng, z) - lngToTileFrac(minLng, z)) * TILE_SIZE
    const ySpan = (latToTileFrac(minLat, z) - latToTileFrac(maxLat, z)) * TILE_SIZE
    if ((Math.floor(xSpan / TILE_SIZE) + 2) * (Math.floor(ySpan / TILE_SIZE) + 2) > TILE_BUDGET_HIRES) break
    zoom = z
  }
  const drawSize = config.retina ? 512 : TILE_SIZE
  const tileXMin = Math.floor(lngToTileFrac(minLng, zoom))
  const tileYMin = Math.floor(latToTileFrac(maxLat, zoom))
  const cx = (lngToTileFrac((minLng + maxLng) / 2, zoom) - tileXMin) * drawSize
  const cy = (latToTileFrac((minLat + maxLat) / 2, zoom) - tileYMin) * drawSize
  const cosA = Math.cos(-angle),
    sinA = Math.sin(-angle)
  let halfW = 0,
    halfH = 0
  for (const [lat, lng] of corners) {
    const dx = (lngToTileFrac(lng, zoom) - tileXMin) * drawSize - cx
    const dy = (latToTileFrac(lat, zoom) - tileYMin) * drawSize - cy
    halfW = Math.max(halfW, Math.abs(dx * cosA - dy * sinA))
    halfH = Math.max(halfH, Math.abs(dx * sinA + dy * cosA))
  }
  return { halfW, halfH }
}

// For singlePageGrid cells: gridCols * 612 / paperWidthPt. Multiplied by the actual cell
// canvas width (paperWidthPx) inside renderPageToPng to get the overlay scaleW.
// Undefined for 1×1 or standard-grid (separate-page) exports — no scaling needed.
async function renderPageToPng(corners: [number, number][], angle: number, config: MapStyleConfig, pins: Pin[], hiddenPinIds: Set<number>, routes: Route[], hiddenRouteIds: Set<number>, captions: Caption[], hiddenCaptionIds: Set<number>, includePins: boolean, includeRoutes: boolean, includeCompass: boolean, includeScale: boolean, scaleUnit: 'km' | 'mi', enhanceContrast: boolean, exportQuality: ExportQuality, mapTitle: string, mapArea: string, blankLabels: boolean, legendScale?: number, legendX?: number | null, legendY?: number | null, legendPins?: Pin[], legendRoutes?: Route[], onProgress?: (msg: string) => void, overlaySFactor?: number, signal?: AbortSignal, markerScale?: number, overlayCorner: OverlayCorner = 2): Promise<Uint8Array> {
  // --- 1. Compute the AABB of the 4 corners in lat/lng space ---
  const lats = corners.map((c) => c[0])
  const lngs = corners.map((c) => c[1])
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs)

  // --- 2. Choose zoom level ---
  const maxZoom = config.maxNativeZoom ?? 19

  // Find the highest zoom where tile count stays under the budget (quality tier scales it).
  const tileBudget = exportQuality === 'draft' ? TILE_BUDGET_FAST : exportQuality === 'hires' ? TILE_BUDGET_HIRES : TILE_BUDGET
  let zoom = 1
  for (let z = 1; z <= maxZoom; z++) {
    const xSpan = (lngToTileFrac(maxLng, z) - lngToTileFrac(minLng, z)) * TILE_SIZE
    const ySpan = (latToTileFrac(minLat, z) - latToTileFrac(maxLat, z)) * TILE_SIZE
    const tileCount = (Math.floor(xSpan / TILE_SIZE) + 2) * (Math.floor(ySpan / TILE_SIZE) + 2)
    if (tileCount > tileBudget) break
    zoom = z
  }

  // No stitch canvas size guard needed — tiles are drawn directly to the (size-capped)
  // output canvas, so there is no intermediate giant canvas to overflow.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
  // Safari on macOS enforces a hard 268,435,456 px (width × height) canvas area limit.
  const isSafari = !isIOS && /WebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)

  // --- 3. Determine tile grid for AABB ---
  const tileXMin = Math.floor(lngToTileFrac(minLng, zoom))
  const tileXMax = Math.floor(lngToTileFrac(maxLng, zoom))
  const tileYMin = Math.floor(latToTileFrac(maxLat, zoom)) // y increases southward
  const tileYMax = Math.floor(latToTileFrac(minLat, zoom))
  const gridW = tileXMax - tileXMin + 1
  const gridH = tileYMax - tileYMin + 1

  // --- 4. Stitch-space geometry (pure math — no intermediate canvas).
  //    drawSize is 512 for @2x retina tiles, 256 for standard 1x tiles.
  const drawSize = config.retina ? 512 : TILE_SIZE
  const centerLat = (minLat + maxLat) / 2,
    centerLng = (minLng + maxLng) / 2

  function geoToStitchPx(lat: number, lng: number): [number, number] {
    return [(lngToTileFrac(lng, zoom) - tileXMin) * drawSize, (latToTileFrac(lat, zoom) - tileYMin) * drawSize]
  }

  const [cx, cy] = geoToStitchPx(centerLat, centerLng)

  // Unrotate corners to find axis-aligned half-dims in stitch-pixel space.
  const cosA = Math.cos(-angle),
    sinA = Math.sin(-angle)
  let halfW = 0,
    halfH = 0
  for (const [lat, lng] of corners) {
    const [px, py] = geoToStitchPx(lat, lng)
    const dx = px - cx,
      dy = py - cy
    halfW = Math.max(halfW, Math.abs(dx * cosA - dy * sinA))
    halfH = Math.max(halfH, Math.abs(dx * sinA + dy * cosA))
  }

  // --- 5. Build the output canvas ---
  // Hi-res: capScale = 1 — native tile pixels, no paper-size or DPI targeting.
  //   The file is as detailed as the tile source provides; the printer (or viewer) decides
  //   how to scale it. Only the browser's canvas memory limit constrains the output.
  // Standard/draft: scale to a fixed longest-side cap for speed.
  const outputCap = isIOS ? MAX_OUTPUT_PX_FAST : exportQuality === 'draft' ? MAX_OUTPUT_PX_FAST : MAX_OUTPUT_PX
  let capScale = exportQuality === 'hires' ? 1 : Math.min(1, outputCap / Math.max(halfW * 2, halfH * 2))

  // Browser canvas area limits — the only constraint on hi-res output.
  // iOS: ~16 MP hard limit. Safari macOS: 268 MP hard limit. Chrome desktop: ~500 MP practical safe limit.
  const maxCanvasArea = isIOS ? 16_000_000 : isSafari ? 268_000_000 : 500_000_000
  const projectedArea = halfW * 2 * capScale * (halfH * 2 * capScale)
  if (projectedArea > maxCanvasArea) capScale *= Math.sqrt(maxCanvasArea / projectedArea)
  const paperWidthPx = Math.ceil(halfW * 2 * capScale)
  const paperHeightPx = Math.ceil(halfH * 2 * capScale)
  const outCanvas = new OffscreenCanvas(paperWidthPx, paperHeightPx)
  const outCtx = outCanvas.getContext('2d') as unknown as CanvasRenderingContext2D
  const scaleX = capScale,
    scaleY = capScale

  outCtx.fillStyle = '#f8f8f7'
  outCtx.fillRect(0, 0, paperWidthPx, paperHeightPx)

  // --- 6. Fetch tiles and draw directly to the output canvas through the rotation/crop
  //    transform. Previously tiles were stitched into a full AABB canvas first, which for
  //    retina sources at high zoom produced canvases exceeding 600 MP that silently blank
  //    in any browser. Drawing tile-by-tile in stitch coordinates through the same
  //    transform eliminates that intermediate canvas entirely.
  const totalTiles = gridW * gridH
  let fetchedTiles = 0
  onProgress?.(`Fetching Tiles… 0 / ${totalTiles}`)

  outCtx.save()
  outCtx.translate(paperWidthPx / 2, paperHeightPx / 2)
  outCtx.scale(scaleX, scaleY)
  outCtx.rotate(-angle)
  outCtx.translate(-cx, -cy)

  const tileJobs: (() => Promise<void>)[] = []
  for (let tx = tileXMin; tx <= tileXMax; tx++) {
    for (let ty = tileYMin; ty <= tileYMax; ty++) {
      const url = tileUrl(config, false, zoom, tx, ty)
      const px = (tx - tileXMin) * drawSize,
        py = (ty - tileYMin) * drawSize
      tileJobs.push(() =>
        fetchTile(url, 2, signal).then((img) => {
          if (img) {
            outCtx.drawImage(img, px, py, drawSize, drawSize)
            img.close()
          }
          onProgress?.(`Fetching Tiles… ${++fetchedTiles} / ${totalTiles}`)
        })
      )
    }
  }
  await fetchTilesConcurrent(tileJobs, TILE_CONCURRENCY, signal)
  outCtx.restore()

  // Levels adjustment on the output canvas.
  if (enhanceContrast && config.printBlackPoint !== undefined) {
    onProgress?.('Adjusting Levels…')
    const lo = config.printBlackPoint,
      range = 255 - lo
    const imgData = outCtx.getImageData(0, 0, paperWidthPx, paperHeightPx)
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(Math.max(0, (((d[i] ?? 0) - lo) / range) * 255))
      d[i + 1] = Math.round(Math.max(0, (((d[i + 1] ?? 0) - lo) / range) * 255))
      d[i + 2] = Math.round(Math.max(0, (((d[i + 2] ?? 0) - lo) / range) * 255))
    }
    outCtx.putImageData(imgData, 0, 0)
  }

  // --- 7. Draw pins, legend, compass onto the output canvas ---
  onProgress?.('Drawing Overlays…')
  function geoToOutputPx(lat: number, lng: number): [number, number] {
    const [sx, sy] = geoToStitchPx(lat, lng)
    const dx = sx - cx,
      dy = sy - cy
    const rx = dx * cosA - dy * sinA
    const ry = dx * sinA + dy * cosA
    return [rx * scaleX + paperWidthPx / 2, ry * scaleY + paperHeightPx / 2]
  }

  const pinsInArea = pins.filter((pin) => {
    if (hiddenPinIds.has(pin.id)) return false
    const [ox, oy] = geoToOutputPx(pin.lat, pin.lng)
    return ox >= 0 && ox <= paperWidthPx && oy >= 0 && oy <= paperHeightPx
  })

  const routesInArea = routes.filter((route) => {
    if (hiddenRouteIds.has(route.id)) return false
    return route.points.some((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false
      const [ox, oy] = geoToOutputPx(p.lat, p.lng)
      return ox >= 0 && ox <= paperWidthPx && oy >= 0 && oy <= paperHeightPx
    })
  })

  // overlaySFactor = gridCols * 612 / paperWidthPt (for singlePageGrid). Multiplying by the
  // actual cell canvas width gives the scaleW that makes the assembled page S correct:
  //   S = scaleW/612 = paperWidthPx * gridCols / paperWidthPt → legend = 190pt, margin = 16pt.
  // Also used for pins/routes so they scale to the assembled page, not just the cell.
  const overlayScaleW = overlaySFactor !== undefined ? Math.round(paperWidthPx * overlaySFactor) : undefined
  drawRoutes(outCtx, routes, hiddenRouteIds, geoToOutputPx, paperWidthPx, paperHeightPx, markerScale, overlayScaleW)
  drawPins(outCtx, pins, hiddenPinIds, geoToOutputPx, paperWidthPx, paperHeightPx, markerScale, overlayScaleW)
  drawCaptions(outCtx, captions, hiddenCaptionIds, geoToOutputPx, paperWidthPx, paperHeightPx, overlayScaleW)
  drawInfoBox(outCtx, mapTitle, mapArea, legendPins ?? pinsInArea, legendRoutes ?? routesInArea, angle, corners, scaleUnit, includePins, includeRoutes, includeCompass, includeScale, blankLabels, paperWidthPx, paperHeightPx, overlayCorner, legendScale, legendX ?? null, legendY ?? null, pins, overlayScaleW)

  // --- 8. Return PNG bytes ---
  onProgress?.('Encoding…')
  const blob = await outCanvas.convertToBlob({ type: 'image/png' })
  return new Uint8Array(await blob.arrayBuffer())
}

export async function exportMapToPdf(opts: ExportOptions): Promise<Uint8Array> {
  const { corners, angle, mapStyle, mapTitle, mapArea = '', pins, hiddenPinIds, routes, hiddenRouteIds, captions, hiddenCaptionIds, legend, legendPins: legendPinsEnabled = true, legendRoutes: legendRoutesEnabled = true, legendSeparatePage = false, legendBlankLabels = false, legendScale = 1, legendX = null, legendY = null, markerScale = 1, includeCompass, includeScale, scaleUnit, enhanceContrast, exportQuality = 'standard', paperWidthPt, paperHeightPt, onProgress, signal } = opts
  const infoCorner = (opts.overlayCorner ?? 2) as OverlayCorner
  // gridCols/gridRows are mutable — hi-res may auto-increase them to keep each cell's canvas
  // at native resolution (capScale = 1) without hitting browser memory limits.
  let gridCols = opts.gridCols ?? 1
  let gridRows = opts.gridRows ?? 1

  // When keys live on their own page, keep them off the map overlay (title/subtitle/compass/scale stay on map).
  const onMapPins = legend && legendPinsEnabled && !legendSeparatePage
  const onMapRoutes = legend && legendRoutesEnabled && !legendSeparatePage
  const onMapLegend = onMapPins || onMapRoutes // used for full-area pre-collection gate
  const config = MAP_STYLE_CONFIGS[mapStyle]

  // For hi-res: auto-compute the minimum grid so each cell's native canvas fits within
  // browser limits. Cells render at a higher zoom than the full area (smaller AABB = more
  // budget headroom), so the PDF total pixel count exceeds what any single canvas could hold.
  // This completely bypasses the per-canvas memory limit without any capScale downscaling.
  if (exportQuality === 'hires') {
    const MAX_CELL_CANVAS_AREA = 100_000_000 // conservative target; cells may render larger due to zoom boost
    const { halfW, halfH } = estimateHiresNativeSize(corners, angle, config)
    const minCells = Math.ceil((halfW * 2 * (halfH * 2)) / MAX_CELL_CANVAS_AREA)
    if (minCells > gridCols * gridRows) {
      const ratio = halfW / halfH
      gridRows = Math.max(gridRows, Math.ceil(Math.sqrt(minCells / ratio)))
      gridCols = Math.max(gridCols, Math.ceil(minCells / gridRows))
    }
  }

  const totalPages = gridCols * gridRows
  // Hi-res + grid: stitch all cells onto one PDF page (for large-format print shops).
  // Standard/draft + grid: keep separate pages (for home printers cutting and taping).
  const singlePageGrid = exportQuality === 'hires' && totalPages > 1
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(mapTitle || 'MapFolio')
  pdfDoc.setCreator('MapFolio')

  // For grid exports, pre-compute pins/routes within the full area so the on-map
  // legend shows all items across every cell, not just that cell's.
  let fullAreaLegendPins: Pin[] | undefined
  let fullAreaLegendRoutes: Route[] | undefined
  if (totalPages > 1 && onMapLegend) {
    const lats = corners.map((c) => c[0])
    const lngs = corners.map((c) => c[1])
    const minLat = Math.min(...lats),
      maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs),
      maxLng = Math.max(...lngs)
    fullAreaLegendPins = pins.filter((p) => !hiddenPinIds.has(p.id) && p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng)
    fullAreaLegendRoutes = routes.filter((r) => !hiddenRouteIds.has(r.id) && r.points.some((p) => p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng))
  }

  // For single-page grid, create the page once so all cells can be drawn onto it.
  const stitchedPage = singlePageGrid ? pdfDoc.addPage([paperWidthPt, paperHeightPt]) : null

  for (let rj = 0; rj < gridRows; rj++) {
    for (let ci = 0; ci < gridCols; ci++) {
      const pageNum = rj * gridCols + ci + 1
      const cellCorners = totalPages === 1 ? corners : subCornersForCell(corners, ci, rj, gridCols, gridRows)

      // For singlePageGrid, overlays are composited on a full-page canvas after stitching so that
      // legendX/legendY (fractions of the full paper) work correctly instead of being misinterpreted
      // as fractions of a single cell. For multi-page grids, overlays go in the bottom-right cell.
      const isInfoCell = ci === gridCols - 1 && rj === gridRows - 1
      const cellCompass = !singlePageGrid && legend && includeCompass && isInfoCell
      const cellIncludePins = !singlePageGrid && onMapPins && isInfoCell
      const cellIncludeRoutes = !singlePageGrid && onMapRoutes && isInfoCell
      const cellScale = !singlePageGrid && legend && includeScale && isInfoCell

      signal?.throwIfAborted()
      const prefix = singlePageGrid ? `Section ${pageNum} of ${totalPages} — ` : totalPages > 1 ? `Page ${pageNum} of ${totalPages} — ` : ''
      // captions still use overlaySFactor so their text scales correctly in the assembled page.
      const overlaySFactor = singlePageGrid ? (gridCols * 612) / paperWidthPt : undefined
      const cellHasKeys = cellIncludePins || cellIncludeRoutes
      // For singlePageGrid, the full-page overlay draws the title/legend after stitching — suppress
      // it in cell renders to avoid duplicate headers. For multi-page grids, only the info cell gets it.
      const cellTitle = singlePageGrid || !isInfoCell ? '' : mapTitle
      const cellArea = singlePageGrid || !isInfoCell ? '' : mapArea
      const pngBytes = await renderPageToPng(cellCorners, angle, config, pins, hiddenPinIds, routes, hiddenRouteIds, captions, hiddenCaptionIds, cellIncludePins, cellIncludeRoutes, cellCompass, cellScale, scaleUnit, enhanceContrast, exportQuality, cellTitle, cellArea, legendBlankLabels, legendScale, legendX, legendY, cellHasKeys ? fullAreaLegendPins : undefined, cellHasKeys ? fullAreaLegendRoutes : undefined, (msg) => onProgress?.(`${prefix}${msg}`), overlaySFactor, signal, markerScale, infoCorner)

      onProgress?.(`${prefix}Embedding…`)
      const pdfImage = await pdfDoc.embedPng(pngBytes)

      if (singlePageGrid) {
        const cellW = paperWidthPt / gridCols
        const cellH = paperHeightPt / gridRows
        stitchedPage!.drawImage(pdfImage, {
          x: ci * cellW,
          y: paperHeightPt - (rj + 1) * cellH,
          width: cellW,
          height: cellH
        })
      } else {
        const page = pdfDoc.addPage([paperWidthPt, paperHeightPt])
        page.drawImage(pdfImage, { x: 0, y: 0, width: paperWidthPt, height: paperHeightPt })
      }
    }
  }

  // For singlePageGrid: composite the info box on a full-page overlay canvas after all cells are
  // stitched. legendX/legendY are fractions of the full paper — using the full canvas here means
  // the coordinates map correctly regardless of grid size or which cell the box would have landed on.
  if (singlePageGrid && legend) {
    onProgress?.('Rendering overlay…')
    const infoW = Math.round(paperWidthPt * 2)
    const infoH = Math.round(paperHeightPt * 2)
    const infoCanvas = new OffscreenCanvas(infoW, infoH)
    drawInfoBox(infoCanvas.getContext('2d') as unknown as CanvasRenderingContext2D, mapTitle, mapArea, fullAreaLegendPins ?? [], fullAreaLegendRoutes ?? [], angle, corners, scaleUnit, onMapPins, onMapRoutes, includeCompass, includeScale, legendBlankLabels, infoW, infoH, infoCorner, legendScale, legendX ?? null, legendY ?? null, pins)
    const infoBlob = await infoCanvas.convertToBlob({ type: 'image/png' })
    const infoBytes = new Uint8Array(await infoBlob.arrayBuffer())
    stitchedPage!.drawImage(await pdfDoc.embedPng(infoBytes), { x: 0, y: 0, width: paperWidthPt, height: paperHeightPt })
  }

  // Dedicated legend page(s) — named pins/routes within the print area's bounding box.
  if (legend && legendSeparatePage) {
    const lats = corners.map((c) => c[0])
    const lngs = corners.map((c) => c[1])
    const minLat = Math.min(...lats),
      maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs),
      maxLng = Math.max(...lngs)
    const inArea = (lat: number, lng: number) => lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng

    // Sequence numbers must match the map — derive them from the full ordered pin list.
    const seq = new Map<number, number>()
    let n = 0
    for (const p of pins) if (p.showNumber) seq.set(p.id, ++n)

    const sepPins = legendPinsEnabled ? pins.filter((p) => p.name && !hiddenPinIds.has(p.id) && inArea(p.lat, p.lng)).map((pin) => ({ pin, index: seq.get(pin.id) })) : []
    const sepRoutes = legendRoutesEnabled ? routes.filter((r) => r.name && !hiddenRouteIds.has(r.id) && r.points.some((p) => inArea(p.lat, p.lng))) : []

    if (sepPins.length > 0 || sepRoutes.length > 0 || mapTitle || mapArea) {
      onProgress?.('Rendering legend…')
      const legendPages = await renderLegendPagesToPng({ title: mapTitle, area: mapArea, pins: sepPins, routes: sepRoutes, unit: scaleUnit, blankLabels: legendBlankLabels }, paperWidthPt, paperHeightPt)
      for (const png of legendPages) {
        const img = await pdfDoc.embedPng(png)
        const page = pdfDoc.addPage([paperWidthPt, paperHeightPt])
        page.drawImage(img, { x: 0, y: 0, width: paperWidthPt, height: paperHeightPt })
      }
    }
  }

  onProgress?.('Building PDF…')
  return pdfDoc.save()
}
