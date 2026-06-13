import { PDFDocument } from 'pdf-lib'

import type { MapStyle, MapStyleConfig, Pin } from '../types'
import { MAP_STYLE_CONFIGS } from '../types'

// Standard Web Mercator tile math
function lngToTileFrac(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom)
}

function latToTileFrac(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
}

function tileUrl(config: MapStyleConfig, isDark: boolean, z: number, x: number, y: number): string {
  const template = isDark && config.darkUrl ? config.darkUrl : config.url
  const subdomains = config.subdomains ?? 'abc'
  const s = subdomains[Math.abs(x + y) % subdomains.length]
  return template
    .replace('{s}', s)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{r}', config.retina ? '@2x' : '')
}

async function fetchTile(url: string): Promise<HTMLImageElement | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return null
    const blob = await resp.blob()
    const objectUrl = URL.createObjectURL(blob)
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(null)
      }
      img.src = objectUrl
    })
  } catch {
    return null
  }
}

async function fetchTilesConcurrent(jobs: (() => Promise<void>)[], limit: number): Promise<void> {
  const queue = [...jobs]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const job = queue.shift()
      if (job) await job()
    }
  })
  await Promise.all(workers)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawPins(ctx: CanvasRenderingContext2D, pins: Pin[], hiddenPinIds: Set<number>, geoToOut: (lat: number, lng: number) => [number, number], paperW: number, paperH: number) {
  // Scale pins relative to page width (same reference as drawLegend/drawCompass).
  const S = paperW / 612
  const emojiSize = Math.round(28 * S)
  const dotR = Math.round(4 * S)
  const gap = Math.round(3 * S) // margin-top between emoji and dot

  for (const pin of pins) {
    if (hiddenPinIds.has(pin.id)) continue
    const [ox, oy] = geoToOut(pin.lat, pin.lng)

    // Skip pins outside the canvas (with small margin for clipping)
    if (ox < -emojiSize || ox > paperW + emojiSize || oy < -emojiSize || oy > paperH + emojiSize) continue

    // The anchor is center-bottom of the icon (bottom of the dot).
    // Draw dot first so emoji shadow renders above it.
    const dotCY = oy - dotR

    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = dotR * 1.5
    ctx.shadowOffsetY = dotR * 0.5
    ctx.beginPath()
    ctx.arc(ox, dotCY, dotR, 0, Math.PI * 2)
    ctx.fillStyle = pin.color || '#06b6d4'
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = 'white'
    ctx.lineWidth = dotR * 0.6
    ctx.stroke()
    ctx.restore()

    // Emoji above dot
    const emojiBottomY = dotCY - dotR - gap

    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = Math.round(3 * S)
    ctx.shadowOffsetY = Math.round(1 * S)
    ctx.font = `${emojiSize}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(pin.emoji, ox, emojiBottomY)
    ctx.restore()
  }
}

// 0=TL 1=TR 2=BR 3=BL
type OverlayCorner = 0 | 1 | 2 | 3

function bestCorner(
  pinsInArea: Pin[],
  geoToOutputPx: (lat: number, lng: number) => [number, number],
  paperW: number,
  paperH: number,
): OverlayCorner {
  const zoneX = paperW * 0.35
  const zoneY = paperH * 0.35
  const counts = [0, 0, 0, 0] // TL, TR, BR, BL
  for (const pin of pinsInArea) {
    const [ox, oy] = geoToOutputPx(pin.lat, pin.lng)
    if (ox < zoneX && oy < zoneY) counts[0]++
    else if (ox > paperW - zoneX && oy < zoneY) counts[1]++
    else if (ox > paperW - zoneX && oy > paperH - zoneY) counts[2]++
    else if (ox < zoneX && oy > paperH - zoneY) counts[3]++
  }
  let best: OverlayCorner = 2
  let min = Infinity
  for (let i = 0; i < 4; i++) {
    if (counts[i] < min) { min = counts[i]; best = i as OverlayCorner }
  }
  return best
}

function drawLegend(ctx: CanvasRenderingContext2D, title: string, pins: Pin[], paperW: number, paperH: number, corner: OverlayCorner) {
  const namedPins = pins.filter((p) => p.name)
  if (!title && namedPins.length === 0) return

  // Scale relative to letter page width at EXPORT_DPI (1632px = 612pt)
  const S = paperW / 612

  const pad = Math.round(12 * S)
  const titleSize = Math.round(13 * S)
  const headerSize = Math.round(9 * S)
  const nameSize = Math.round(12 * S)
  const descSize = Math.round(10 * S)
  const emojiColW = Math.round(20 * S)
  const rowGap = Math.round(5 * S)
  const legendW = Math.round(200 * S)
  const margin = Math.round(16 * S)
  const borderR = Math.round(8 * S)

  // Measure content height
  let contentH = 0
  if (title) {
    contentH += titleSize + Math.round(8 * S) // title text + separator gap
  }
  if (namedPins.length > 0) {
    contentH += headerSize + Math.round(6 * S) // "LEGEND" header
    for (const pin of namedPins) {
      const rowH = pin.description ? nameSize + Math.round(2 * S) + descSize : nameSize
      contentH += Math.max(emojiColW, rowH) + rowGap
    }
    contentH -= rowGap // no gap after last row
  }

  const boxH = contentH + pad * 2
  const isRight = corner === 1 || corner === 2
  const isTop = corner === 0 || corner === 1
  const boxX = isRight ? paperW - legendW - margin : margin
  const boxY = isTop ? margin : paperH - boxH - margin

  // Shadow + background
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.12)'
  ctx.shadowBlur = Math.round(10 * S)
  ctx.shadowOffsetY = Math.round(2 * S)
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  roundRect(ctx, boxX, boxY, legendW, boxH, borderR)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = Math.max(1, Math.round(S))
  roundRect(ctx, boxX, boxY, legendW, boxH, borderR)
  ctx.stroke()

  let y = boxY + pad

  if (title) {
    ctx.save()
    ctx.fillStyle = '#111827'
    ctx.font = `700 ${titleSize}px system-ui,sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(title, boxX + pad, y, legendW - pad * 2)
    ctx.restore()
    y += titleSize + Math.round(4 * S)

    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = Math.max(1, Math.round(S))
    ctx.beginPath()
    ctx.moveTo(boxX + pad, y)
    ctx.lineTo(boxX + legendW - pad, y)
    ctx.stroke()
    y += Math.round(6 * S)
  }

  if (namedPins.length > 0) {
    ctx.save()
    ctx.fillStyle = '#9ca3af'
    ctx.font = `700 ${headerSize}px system-ui,sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.letterSpacing = `${Math.round(1 * S)}px`
    ctx.fillText('LEGEND', boxX + pad, y)
    ctx.restore()
    y += headerSize + Math.round(6 * S)

    for (const pin of namedPins) {
      const textX = boxX + pad + emojiColW + Math.round(7 * S)
      const textMaxW = legendW - pad * 2 - emojiColW - Math.round(7 * S)

      // Emoji
      ctx.save()
      ctx.font = `${Math.round(15 * S)}px serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(pin.emoji, boxX + pad, y)
      ctx.restore()

      // Name
      ctx.save()
      ctx.fillStyle = '#1f2937'
      ctx.font = `600 ${nameSize}px system-ui,sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(pin.name, textX, y, textMaxW)
      ctx.restore()

      // Description
      if (pin.description) {
        ctx.save()
        ctx.fillStyle = '#6b7280'
        ctx.font = `${descSize}px system-ui,sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(pin.description, textX, y + nameSize + Math.round(2 * S), textMaxW)
        ctx.restore()
      }

      const rowH = pin.description ? nameSize + Math.round(2 * S) + descSize : nameSize
      y += Math.max(emojiColW, rowH) + rowGap
    }
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function niceValue(value: number, steps: number[]): number {
  return steps.reduce((best, s) => (s <= value ? s : best), steps[0])
}

function drawScaleBar(ctx: CanvasRenderingContext2D, corners: [number, number][], unit: 'km' | 'mi', paperW: number, paperH: number, corner: OverlayCorner) {
  const S = paperW / 612
  const [nw, ne] = corners
  const widthKm = haversineKm(nw[0], nw[1], ne[0], ne[1])
  const targetPx = paperW * 0.22

  let barWidthPx: number
  let label: string

  if (unit === 'mi') {
    const widthMi = widthKm * 0.621371
    const targetMi = targetPx / (paperW / widthMi)
    if (targetMi >= 0.25) {
      const niceMi = niceValue(targetMi, [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000])
      barWidthPx = niceMi * (paperW / widthMi)
      label = `${niceMi} mi`
    } else {
      const widthFt = widthMi * 5280
      const targetFt = targetPx / (paperW / widthFt)
      const niceFt = niceValue(targetFt, [50, 100, 200, 300, 400, 500, 1000, 2000])
      barWidthPx = niceFt * (paperW / widthFt)
      label = `${niceFt} ft`
    }
  } else {
    const targetKm = targetPx / (paperW / widthKm)
    if (targetKm >= 1) {
      const niceKm = niceValue(targetKm, [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000])
      barWidthPx = niceKm * (paperW / widthKm)
      label = `${niceKm} km`
    } else {
      const widthM = widthKm * 1000
      const targetM = targetPx / (paperW / widthM)
      const niceM = niceValue(targetM, [50, 100, 200, 500, 1000])
      barWidthPx = niceM * (paperW / widthM)
      label = `${niceM} m`
    }
  }

  if (barWidthPx < 20) return

  const margin = Math.round(16 * S)
  const barH = Math.round(5 * S)
  const fontSize = Math.round(9 * S)
  const isRight = corner === 1 || corner === 2
  const isTop = corner === 0 || corner === 1
  const barX = isRight ? paperW - barWidthPx - margin : margin
  const barY = isTop ? margin : paperH - margin - fontSize - Math.round(5 * S) - barH

  const bgPad = Math.round(8 * S)
  const bgX = barX - bgPad
  const bgY = barY - bgPad
  const bgW = barWidthPx + bgPad * 2
  const bgH = barH + fontSize + Math.round(5 * S) + bgPad * 2
  const bgR = Math.round(6 * S)

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = Math.round(8 * S)
  ctx.shadowOffsetY = Math.round(2 * S)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  roundRect(ctx, bgX, bgY, bgW, bgH, bgR)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = Math.max(1, S)
  roundRect(ctx, bgX, bgY, bgW, bgH, bgR)
  ctx.stroke()

  // Left half: dark fill; right half: white fill
  ctx.fillStyle = '#1f2937'
  ctx.fillRect(barX, barY, barWidthPx / 2, barH)
  ctx.fillStyle = 'white'
  ctx.fillRect(barX + barWidthPx / 2, barY, barWidthPx / 2, barH)

  // Bar outline + center divider
  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = Math.max(1, S)
  ctx.strokeRect(barX, barY, barWidthPx, barH)
  ctx.beginPath()
  ctx.moveTo(barX + barWidthPx / 2, barY)
  ctx.lineTo(barX + barWidthPx / 2, barY + barH)
  ctx.stroke()

  // Labels
  const labelY = barY + barH + Math.round(4 * S)
  ctx.fillStyle = '#111827'
  ctx.font = `${fontSize}px system-ui,sans-serif`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText('0', barX, labelY)
  ctx.textAlign = 'right'
  ctx.fillText(label, barX + barWidthPx, labelY)
}

function drawCompass(ctx: CanvasRenderingContext2D, angle: number, paperW: number, paperH: number, corner: OverlayCorner) {
  const S = paperW / 612

  const circleR = Math.round(20 * S)
  const tipR = Math.round(15 * S) // center → north tip
  const tailR = Math.round(10 * S) // center → south tip
  const wingR = Math.round(5 * S) // half-width at center
  const labelR = Math.round(25 * S) // center → N label
  const fontSize = Math.round(11 * S)

  // North direction in the output canvas.
  // Stitch canvas has north = (0,-1). After rotate(-angle) the transform maps
  // (0,-1) → (-sin(angle), -cos(angle)).  east = rotate(north, +90°) = (-ny, nx).
  const nx = -Math.sin(angle),
    ny = -Math.cos(angle)
  const ex = -ny,
    ey = nx // east (90° CW from north)

  const pad = labelR + fontSize + Math.round(8 * S)
  const isRight = corner === 1 || corner === 2
  const isTop = corner === 0 || corner === 1
  const cx = isRight ? paperW - pad : pad
  const cy = isTop ? pad : paperH - pad

  const northX = cx + nx * tipR,
    northY = cy + ny * tipR
  const southX = cx - nx * tailR,
    southY = cy - ny * tailR
  const leftX = cx + ex * wingR,
    leftY = cy + ey * wingR
  const rightX = cx - ex * wingR,
    rightY = cy - ey * wingR

  // Background circle
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = Math.round(8 * S)
  ctx.shadowOffsetY = Math.round(2 * S)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.beginPath()
  ctx.arc(cx, cy, circleR, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = Math.max(1, S)
  ctx.beginPath()
  ctx.arc(cx, cy, circleR, 0, Math.PI * 2)
  ctx.stroke()

  // North half (dark)
  ctx.fillStyle = '#1f2937'
  ctx.beginPath()
  ctx.moveTo(northX, northY)
  ctx.lineTo(leftX, leftY)
  ctx.lineTo(rightX, rightY)
  ctx.closePath()
  ctx.fill()

  // South half (white)
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.moveTo(southX, southY)
  ctx.lineTo(leftX, leftY)
  ctx.lineTo(rightX, rightY)
  ctx.closePath()
  ctx.fill()

  // Diamond outline
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = Math.max(1, S * 0.75)
  ctx.beginPath()
  ctx.moveTo(northX, northY)
  ctx.lineTo(leftX, leftY)
  ctx.lineTo(southX, southY)
  ctx.lineTo(rightX, rightY)
  ctx.closePath()
  ctx.stroke()

  // Center dot
  ctx.fillStyle = '#9ca3af'
  ctx.beginPath()
  ctx.arc(cx, cy, Math.round(2 * S), 0, Math.PI * 2)
  ctx.fill()

  // N label
  ctx.fillStyle = '#111827'
  ctx.font = `700 ${fontSize}px system-ui,sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('N', cx + nx * labelR, cy + ny * labelR)
}

// Split a 4-corner rect [NW,NE,SE,SW] into a grid cell. Returns [NW,NE,SE,SW] for cell (ci,rj).
function subCornersForCell(corners: [number, number][], ci: number, rj: number, cols: number, rows: number): [number, number][] {
  const [nw, ne, , sw] = corners
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

export interface ExportOptions {
  corners: [number, number][] // 4 geographic corners [[lat,lng], ...]  NW CW order
  angle: number // rectangle rotation in radians
  mapStyle: MapStyle
  mapTitle: string
  pins: Pin[]
  hiddenPinIds: Set<number>
  includeLegend: boolean
  includeCompass: boolean
  includeScale: boolean
  scaleUnit: 'km' | 'mi'
  enhanceContrast: boolean
  paperWidthPt: number // PDF page width in points (1pt = 1/72 inch)
  paperHeightPt: number // PDF page height in points
  gridCols?: number // poster grid columns (default 1)
  gridRows?: number // poster grid rows (default 1)
  onProgress?: (msg: string) => void
}

const TILE_SIZE = 256 // px per tile at 1x (used for grid/zoom math regardless of retina)
const MAX_OUTPUT_PX = 7200 // cap longest side — gives ~217 DPI at A0, ~800+ DPI at A4
const TILE_CONCURRENCY = 24 // max simultaneous tile requests (6 connections × 4 CartoDB subdomains)

async function renderPageToPng(corners: [number, number][], angle: number, config: MapStyleConfig, pins: Pin[], hiddenPinIds: Set<number>, includeLegend: boolean, includeCompass: boolean, includeScale: boolean, scaleUnit: 'km' | 'mi', enhanceContrast: boolean, mapTitle: string, onProgress?: (msg: string) => void): Promise<Uint8Array> {
  // --- 1. Compute the AABB of the 4 corners in lat/lng space ---
  const lats = corners.map((c) => c[0])
  const lngs = corners.map((c) => c[1])
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs)

  // --- 2. Choose zoom level ---
  const maxZoom = config.maxNativeZoom ?? 19

  // Find the highest zoom where tile count stays under 750.
  let zoom = 1
  for (let z = 1; z <= maxZoom; z++) {
    const xSpan = (lngToTileFrac(maxLng, z) - lngToTileFrac(minLng, z)) * TILE_SIZE
    const ySpan = (latToTileFrac(minLat, z) - latToTileFrac(maxLat, z)) * TILE_SIZE
    const tileCount = (Math.floor(xSpan / TILE_SIZE) + 2) * (Math.floor(ySpan / TILE_SIZE) + 2)
    if (tileCount > 750) break
    zoom = z
  }

  // --- 3. Determine tile grid for AABB ---
  const tileXMin = Math.floor(lngToTileFrac(minLng, zoom))
  const tileXMax = Math.floor(lngToTileFrac(maxLng, zoom))
  const tileYMin = Math.floor(latToTileFrac(maxLat, zoom)) // y increases southward
  const tileYMax = Math.floor(latToTileFrac(minLat, zoom))
  const gridW = tileXMax - tileXMin + 1
  const gridH = tileYMax - tileYMin + 1

  const totalTiles = gridW * gridH
  let fetchedTiles = 0
  onProgress?.(`Fetching tiles… 0 / ${totalTiles}`)

  // --- 4. Stitch tiles onto a canvas ---
  // drawSize is 512 for @2x retina tiles, 256 for standard 1x tiles.
  // TILE_SIZE (256) is kept for all grid/zoom math — tile coords are always on a 256px grid.
  const drawSize = config.retina ? 512 : TILE_SIZE
  const stitchCanvas = document.createElement('canvas')
  stitchCanvas.width = gridW * drawSize
  stitchCanvas.height = gridH * drawSize
  const stitchCtx = stitchCanvas.getContext('2d')!
  stitchCtx.fillStyle = '#f8f8f7'
  stitchCtx.fillRect(0, 0, stitchCanvas.width, stitchCanvas.height)

  const tileJobs: (() => Promise<void>)[] = []
  for (let tx = tileXMin; tx <= tileXMax; tx++) {
    for (let ty = tileYMin; ty <= tileYMax; ty++) {
      const url = tileUrl(config, false, zoom, tx, ty)
      const px = (tx - tileXMin) * drawSize,
        py = (ty - tileYMin) * drawSize
      tileJobs.push(() =>
        fetchTile(url).then((img) => {
          if (img) stitchCtx.drawImage(img, px, py, drawSize, drawSize)
          onProgress?.(`Fetching tiles… ${++fetchedTiles} / ${totalTiles}`)
        })
      )
    }
  }
  await fetchTilesConcurrent(tileJobs, TILE_CONCURRENCY)

  // Levels adjustment: stretch tonal range so light-style features are visible when printed.
  if (enhanceContrast && config.printBlackPoint !== undefined) {
    const lo = config.printBlackPoint,
      range = 255 - lo
    const imgData = stitchCtx.getImageData(0, 0, stitchCanvas.width, stitchCanvas.height)
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(Math.max(0, ((d[i] - lo) / range) * 255))
      d[i + 1] = Math.round(Math.max(0, ((d[i + 1] - lo) / range) * 255))
      d[i + 2] = Math.round(Math.max(0, ((d[i + 2] - lo) / range) * 255))
    }
    stitchCtx.putImageData(imgData, 0, 0)
  }

  // --- 5. Find pixel coords of rect center and corners in the stitched canvas ---
  const centerLat = (minLat + maxLat) / 2,
    centerLng = (minLng + maxLng) / 2

  function geoToStitchPx(lat: number, lng: number): [number, number] {
    return [(lngToTileFrac(lng, zoom) - tileXMin) * drawSize, (latToTileFrac(lat, zoom) - tileYMin) * drawSize]
  }

  const [cx, cy] = geoToStitchPx(centerLat, centerLng)

  // Unrotate corners to find axis-aligned half-dims in the stitch canvas
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

  // --- 6. Build the output canvas ---
  // Use the natural tile resolution (halfW/halfH in stitch pixels) rather than a fixed DPI.
  // This means an A4 export captures the same pixels as an A0 export would — the PDF can be
  // printed at any size and quality scales with the tiles, not the paper format chosen here.
  const capScale = Math.min(1, MAX_OUTPUT_PX / Math.max(halfW * 2, halfH * 2))
  const paperWidthPx = Math.ceil(halfW * 2 * capScale)
  const paperHeightPx = Math.ceil(halfH * 2 * capScale)
  const outCanvas = document.createElement('canvas')
  outCanvas.width = paperWidthPx
  outCanvas.height = paperHeightPx
  const outCtx = outCanvas.getContext('2d')!
  const scaleX = capScale,
    scaleY = capScale

  outCtx.save()
  outCtx.translate(paperWidthPx / 2, paperHeightPx / 2)
  outCtx.scale(scaleX, scaleY)
  outCtx.rotate(-angle)
  outCtx.drawImage(stitchCanvas, -cx, -cy)
  outCtx.restore()

  // --- 7. Draw pins, legend, compass onto the output canvas ---
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

  const overlayCorner = (includeLegend || includeCompass || includeScale)
    ? bestCorner(pinsInArea, geoToOutputPx, paperWidthPx, paperHeightPx)
    : 2
  drawPins(outCtx, pins, hiddenPinIds, geoToOutputPx, paperWidthPx, paperHeightPx)
  if (includeLegend) drawLegend(outCtx, mapTitle, pinsInArea, paperWidthPx, paperHeightPx, overlayCorner)
  if (includeCompass) drawCompass(outCtx, angle, paperWidthPx, paperHeightPx, overlayCorner)
  if (includeScale) drawScaleBar(outCtx, corners, scaleUnit, paperWidthPx, paperHeightPx, overlayCorner)

  // --- 8. Return PNG bytes ---
  return new Promise<Uint8Array>((resolve, reject) => {
    outCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas toBlob failed'))
        return
      }
      blob
        .arrayBuffer()
        .then((buf) => resolve(new Uint8Array(buf)))
        .catch(reject)
    }, 'image/png')
  })
}

export async function exportMapToPdf(opts: ExportOptions): Promise<Uint8Array> {
  const { corners, angle, mapStyle, mapTitle, pins, hiddenPinIds, includeLegend, includeCompass, includeScale, scaleUnit, enhanceContrast, paperWidthPt, paperHeightPt, gridCols = 1, gridRows = 1, onProgress } = opts

  const config = MAP_STYLE_CONFIGS[mapStyle]
  const totalPages = gridCols * gridRows
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(mapTitle || 'MapFolio')
  pdfDoc.setCreator('MapFolio')

  for (let rj = 0; rj < gridRows; rj++) {
    for (let ci = 0; ci < gridCols; ci++) {
      const pageNum = rj * gridCols + ci + 1
      const cellCorners = totalPages === 1 ? corners : subCornersForCell(corners, ci, rj, gridCols, gridRows)

      // Compass: top-right cell (col cols-1, row 0)
      // Legend:  bottom-right cell (col cols-1, row rows-1)
      // Scale:   bottom-left cell (col 0, row rows-1)
      const cellCompass = includeCompass && ci === gridCols - 1 && rj === 0
      const cellLegend = includeLegend && ci === gridCols - 1 && rj === gridRows - 1
      const cellScale = includeScale && ci === 0 && rj === gridRows - 1

      const prefix = totalPages > 1 ? `Page ${pageNum} of ${totalPages} — ` : ''
      const pngBytes = await renderPageToPng(cellCorners, angle, config, pins, hiddenPinIds, cellLegend, cellCompass, cellScale, scaleUnit, enhanceContrast, mapTitle, (msg) => onProgress?.(`${prefix}${msg}`))

      const pdfImage = await pdfDoc.embedPng(pngBytes)
      const page = pdfDoc.addPage([paperWidthPt, paperHeightPt])
      page.drawImage(pdfImage, { x: 0, y: 0, width: paperWidthPt, height: paperHeightPt })
    }
  }

  onProgress?.('Building PDF…')
  return pdfDoc.save()
}
