import { PDFDocument } from 'pdf-lib'

import type { Caption, MapStyle, MapStyleConfig, Pin, PinDotShape, PinDotSize, Route } from '@/types'
import { CAPTION_PT, MAP_STYLE_CONFIGS } from '@/types'

import { formatDistance, routeDistanceM } from './useRoutes'

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
  const s = subdomains[Math.abs(x + y) % subdomains.length]!
  return template
    .replace('{s}', s)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{r}', config.retina ? '@2x' : '')
}

// Sample 8×8 pixels from a loaded tile and return true if they're all near-white.
// Near-white uniform tiles are blank server responses, not real map content.
function isTileBlank(img: HTMLImageElement): boolean {
  const s = document.createElement('canvas')
  s.width = 8
  s.height = 8
  const c = s.getContext('2d')
  if (!c) return false
  c.drawImage(img, 0, 0, 8, 8)
  const { data: d } = c.getImageData(0, 0, 8, 8)
  for (let i = 0; i < d.length; i += 4) {
    if ((d[i] ?? 0) < 250 || (d[i + 1] ?? 0) < 250 || (d[i + 2] ?? 0) < 250) return false
  }
  return true
}

async function fetchTile(url: string, retries = 2): Promise<HTMLImageElement | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise<void>((r) => setTimeout(r, 400 * attempt))
    try {
      const resp = await fetch(url, { mode: 'cors' })
      if (!resp.ok) continue
      const blob = await resp.blob()
      const objectUrl = URL.createObjectURL(blob)
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const i = new Image()
        i.onload = () => {
          URL.revokeObjectURL(objectUrl)
          resolve(i)
        }
        i.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          resolve(null)
        }
        i.src = objectUrl
      })
      if (!img) continue
      if (isTileBlank(img)) continue
      return img
    } catch {
      // swallow and retry
    }
  }
  return null
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

// Inner dot diameter (px) per size — matches the on-map `.pin-dot--*` CSS rules.
const DOT_CONTENT_PX: Record<PinDotSize, number> = { none: 0, xs: 8, s: 12, m: 17, l: 22, xl: 28 }
// Number is only legible (and shown) on m/l/xl dots, mirroring the map marker.
const DOT_NUM_PX: Partial<Record<PinDotSize, number>> = { m: 8, l: 10, xl: 13 }

function drawPins(ctx: CanvasRenderingContext2D, pins: Pin[], hiddenPinIds: Set<number>, geoToOut: (lat: number, lng: number) => [number, number], paperW: number, paperH: number) {
  // Scale pins relative to page width (same reference as drawInfoBox).
  const S = paperW / 612
  const emojiSize = Math.round(28 * S)

  // Pre-compute sequence numbers for numbered pins (order within full list).
  const pinSeqMap = new Map<number, number>()
  let seq = 0
  for (const pin of pins) {
    if (pin.showNumber) pinSeqMap.set(pin.id, ++seq)
  }

  for (const pin of pins) {
    if (hiddenPinIds.has(pin.id)) continue
    const [ox, oy] = geoToOut(pin.lat, pin.lng)

    // Skip pins outside the canvas (with small margin for clipping)
    if (ox < -emojiSize || ox > paperW + emojiSize || oy < -emojiSize || oy > paperH + emojiSize) continue

    const size = pin.dotSize ?? 'm'
    const shape: PinDotShape = pin.dotShape ?? 'circle'
    const hasDot = size !== 'none'
    // Ringless: the dot is just its colored content size, matching the on-screen .pin-dot.
    const r = hasDot ? (DOT_CONTENT_PX[size] / 2) * S : 0

    // The geo point sits at the dot centre (emoji floats above); with no dot, at the emoji base.
    if (hasDot) {
      ctx.save()
      ctx.translate(ox, oy)
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = Math.round(3 * S)
      ctx.shadowOffsetY = Math.round(1 * S)
      ctx.fillStyle = pin.color || '#06b6d4'
      if (shape === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fill()
      } else {
        if (shape === 'diamond') ctx.rotate(Math.PI / 4)
        roundRect(ctx, -r, -r, r * 2, r * 2, Math.max(1, Math.round(2 * S)))
        ctx.fill()
      }
      ctx.shadowColor = 'transparent'
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2 * S
      ctx.stroke()
      ctx.restore()

      // Number — drawn upright at the dot centre, only on sizes that can hold it.
      const pinNum = pinSeqMap.get(pin.id)
      const numPx = DOT_NUM_PX[size]
      if (pinNum !== undefined && numPx !== undefined) {
        ctx.save()
        ctx.fillStyle = 'white'
        ctx.font = `700 ${Math.round(numPx * S)}px system-ui,sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(pinNum), ox, oy)
        ctx.restore()
      }
    }

    if (pin.emoji) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = Math.round(3 * S)
      ctx.shadowOffsetY = Math.round(1 * S)
      ctx.font = `${emojiSize}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      // textBaseline='bottom' uses the em-box bottom which reserves unused descent space for emoji,
      // making glyphs appear above the dot. Measure actual descent and compensate so the rendered
      // glyph bottom aligns with the dot top (or geo point when there is no dot).
      const descent = ctx.measureText(pin.emoji).actualBoundingBoxDescent
      const emojiAlphaY = (hasDot ? oy - r : oy) - descent
      ctx.fillText(pin.emoji, ox, emojiAlphaY)
      ctx.restore()
    }
  }
}

const ROUTE_WP = {
  xs: { r: 4, sqHalf: 4, fontSize: 5 },
  s: { r: 6, sqHalf: 6, fontSize: 7 },
  m: { r: 9, sqHalf: 9, fontSize: 10 },
  l: { r: 13, sqHalf: 13, fontSize: 13 },
  xl: { r: 17, sqHalf: 17, fontSize: 16 }
} as const

const ROUTE_DASH: Partial<Record<string, number[]>> = {
  dashed: [12, 8],
  dotted: [1, 9],
  'long-dash': [22, 10],
  'dash-dot': [14, 5, 2, 5]
}

function drawRoutes(ctx: CanvasRenderingContext2D, routes: Route[], hiddenRouteIds: Set<number>, geoToOut: (lat: number, lng: number) => [number, number], paperW: number, _paperH: number) {
  const S = paperW / 612
  for (const route of routes) {
    if (hiddenRouteIds.has(route.id)) continue
    const lineStyle = route.lineStyle ?? 'solid'
    const rawWpStyle = route.waypointStyle as string | undefined
    const wpStyle = rawWpStyle === 'number' ? 'circle' : (rawWpStyle ?? 'circle')
    const wpShowNumber = rawWpStyle === 'number' ? true : (route.waypointShowNumber ?? false)
    const wpSize = route.waypointSize ?? 'm'
    const color = route.color
    const wp = ROUTE_WP[wpSize]

    const rawPoints = route.points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    const pts = rawPoints.map((p) => geoToOut(p.lat, p.lng))

    if (pts.length < 1) continue

    if (pts.length >= 2 && lineStyle !== 'none') {
      if (lineStyle === 'double') {
        ctx.save()
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = color
        ctx.lineWidth = 8 * S
        ctx.beginPath()
        ctx.moveTo(pts[0]![0], pts[0]![1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1])
        ctx.stroke()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 3 * S
        ctx.beginPath()
        ctx.moveTo(pts[0]![0], pts[0]![1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1])
        ctx.stroke()
        ctx.restore()
      } else if (lineStyle === 'arrow') {
        const arrowLen = 24 * S
        const arrowHW = 8 * S
        const wpR = wpStyle !== 'none' ? wp.r * S : 0
        for (let i = 0; i + 1 < pts.length; i++) {
          const [x1, y1] = pts[i]!
          const [x2, y2] = pts[i + 1]!
          const dx = x2 - x1,
            dy = y2 - y1
          const len = Math.hypot(dx, dy)
          if (len < 1) continue
          const ux = dx / len,
            uy = dy / len
          // Line body stops before arrowhead
          const ex = x2 - ux * (wpR + arrowLen + 6 * S)
          const ey = y2 - uy * (wpR + arrowLen + 6 * S)
          ctx.save()
          ctx.strokeStyle = color
          ctx.lineWidth = 3.5 * S
          ctx.lineCap = 'butt'
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(ex, ey)
          ctx.stroke()
          // Arrowhead
          const tipX = x2 - ux * (wpR + 2 * S)
          const tipY = y2 - uy * (wpR + 2 * S)
          const bx = tipX - ux * arrowLen
          const by = tipY - uy * arrowLen
          ctx.fillStyle = color
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 2 * S
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(tipX, tipY)
          ctx.lineTo(bx + -uy * arrowHW, by + ux * arrowHW)
          ctx.lineTo(bx - -uy * arrowHW, by - ux * arrowHW)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          ctx.restore()
        }
      } else {
        // Main line
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = (lineStyle === 'dotted' ? 4 : 3.5) * S
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const dash = ROUTE_DASH[lineStyle]
        if (dash) ctx.setLineDash(dash.map((v) => v * S))
        ctx.beginPath()
        ctx.moveTo(pts[0]![0], pts[0]![1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1])
        ctx.stroke()
        ctx.restore()
      }
    }

    if (wpStyle !== 'none') {
      for (let i = 0; i < pts.length; i++) {
        if (rawPoints[i]?.pinId !== undefined) continue
        const [x, y] = pts[i]!
        const r = wp.r * S
        ctx.save()
        ctx.fillStyle = color
        if (wpStyle === 'circle') {
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 2 * S
          ctx.stroke()
        } else if (wpStyle === 'square') {
          const half = wp.sqHalf * 0.75 * S
          roundRect(ctx, x - half, y - half, half * 2, half * 2, 1.5 * S)
          ctx.fill()
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 2 * S
          ctx.stroke()
        } else if (wpStyle === 'diamond') {
          const half = wp.sqHalf * 0.75 * S
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(Math.PI / 4)
          roundRect(ctx, -half, -half, half * 2, half * 2, 1.5 * S)
          ctx.fill()
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 2 * S
          ctx.stroke()
          ctx.restore()
        }
        if (wpShowNumber) {
          ctx.fillStyle = 'white'
          ctx.font = `bold ${Math.round(wp.fontSize * S)}px system-ui,sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(i + 1), x, y)
        }
        ctx.restore()
      }
    }
  }
}

// 0=TL 1=TR 2=BR 3=BL
type OverlayCorner = 0 | 1 | 2 | 3

function bestCorner(pinsInArea: Pin[], geoToOutputPx: (lat: number, lng: number) => [number, number], paperW: number, paperH: number): OverlayCorner {
  const zoneX = paperW * 0.35
  const zoneY = paperH * 0.35
  const counts: [number, number, number, number] = [0, 0, 0, 0] // TL, TR, BR, BL
  for (const pin of pinsInArea) {
    const [ox, oy] = geoToOutputPx(pin.lat, pin.lng)
    if (ox < zoneX && oy < zoneY) counts[0]++
    else if (ox > paperW - zoneX && oy < zoneY) counts[1]++
    else if (ox > paperW - zoneX && oy > paperH - zoneY) counts[2]++
    else if (ox < zoneX && oy > paperH - zoneY) counts[3]++
  }
  let best: OverlayCorner = 2
  let min = Infinity
  for (const i of [2, 3, 1, 0] as const) {
    if (counts[i] < min) {
      min = counts[i]
      best = i
    }
  }
  return best
}

const LEGEND_WP = {
  xs: { r: 3, sqHalf: 3, fontSize: 4 },
  s: { r: 5, sqHalf: 4, fontSize: 5.5 },
  m: { r: 7, sqHalf: 5, fontSize: 7 },
  l: { r: 9, sqHalf: 7, fontSize: 9 },
  xl: { r: 11, sqHalf: 9, fontSize: 11 }
} as const

const LEGEND_DASH: Partial<Record<string, number[]>> = {
  dashed: [12, 8],
  dotted: [1, 9],
  'long-dash': [22, 10],
  'dash-dot': [14, 5, 2, 5]
}

function drawRoutePreviewInLegend(ctx: CanvasRenderingContext2D, route: Route, ox: number, oy: number, S: number) {
  const color = route.color
  const lineStyle = route.lineStyle ?? 'solid'
  const rawLWpStyle = route.waypointStyle as string | undefined
  const wpStyle = rawLWpStyle === 'number' ? 'circle' : (rawLWpStyle ?? 'circle')
  const wpShowNumberL = rawLWpStyle === 'number' ? true : (route.waypointShowNumber ?? false)
  const wp = LEGEND_WP[route.waypointSize ?? 'm']
  const cy = oy + 10 * S
  const hasNodes = wpStyle !== 'none'
  const nr = hasNodes ? (wpStyle === 'circle' ? wp.r : wp.sqHalf) : 0
  const lx1 = ox + 8 * S
  const lx2 = ox + 44 * S
  const x1 = ox + (hasNodes ? (8 + nr) * S : 2 * S)
  const x2 = ox + (hasNodes ? (44 - nr) * S : 50 * S)

  ctx.save()

  if (lineStyle === 'none') {
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 1.5 * S
    ctx.setLineDash([3 * S, 3 * S])
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(ox + 2 * S, cy)
    ctx.lineTo(ox + 50 * S, cy)
    ctx.stroke()
  } else if (lineStyle === 'double') {
    ctx.strokeStyle = color
    ctx.lineWidth = 2 * S
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x1, cy - 2 * S)
    ctx.lineTo(x2, cy - 2 * S)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x1, cy + 2 * S)
    ctx.lineTo(x2, cy + 2 * S)
    ctx.stroke()
  } else if (lineStyle === 'arrow') {
    const arrowLen = 12 * S
    const arrowHW = 4 * S
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5 * S
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(x1, cy)
    ctx.lineTo(x2 - arrowLen, cy)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 1.5 * S
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x2, cy)
    ctx.lineTo(x2 - arrowLen, cy + arrowHW)
    ctx.lineTo(x2 - arrowLen, cy - arrowHW)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = (lineStyle === 'dotted' ? 4 : 2.5) * S
    ctx.lineCap = 'round'
    const dash = LEGEND_DASH[lineStyle]
    if (dash) ctx.setLineDash(dash.map((v) => v * S))
    ctx.beginPath()
    ctx.moveTo(x1, cy)
    ctx.lineTo(x2, cy)
    ctx.stroke()
  }

  ctx.setLineDash([]) // clear any dotted/dashed pattern so node outlines stroke solid

  if (hasNodes) {
    for (const [wx, label] of [
      [lx1, '1'],
      [lx2, '2']
    ] as [number, string][]) {
      ctx.save()
      ctx.fillStyle = color
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2 * S
      if (wpStyle === 'circle') {
        ctx.beginPath()
        ctx.arc(wx, cy, wp.r * S, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      } else if (wpStyle === 'square') {
        const h = wp.sqHalf * S
        roundRect(ctx, wx - h, cy - h, h * 2, h * 2, 1.5 * S)
        ctx.fill()
        roundRect(ctx, wx - h, cy - h, h * 2, h * 2, 1.5 * S)
        ctx.stroke()
      } else if (wpStyle === 'diamond') {
        const h = wp.sqHalf * S
        ctx.save()
        ctx.translate(wx, cy)
        ctx.rotate(Math.PI / 4)
        roundRect(ctx, -h, -h, h * 2, h * 2, 1.5 * S)
        ctx.fill()
        roundRect(ctx, -h, -h, h * 2, h * 2, 1.5 * S)
        ctx.stroke()
        ctx.restore()
      }
      if (wpShowNumberL) {
        ctx.fillStyle = 'white'
        ctx.font = `bold ${Math.round(wp.fontSize * S)}px system-ui,sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, wx, cy)
      }
      ctx.restore()
    }
  }

  ctx.restore()
}

/** What the info box will contain — enough to compute its footprint without drawing. */
export interface LegendBoxContent {
  hasTitle: boolean
  hasArea: boolean
  includeCompass: boolean
  includeScale: boolean
  /** Named pins (one entry each); `hasDescription` adds a second text line. */
  pins: { hasDescription: boolean }[]
  /** Number of named routes (each renders a name + distance line). */
  routeCount: number
}

/**
 * Footprint of the info box as fractions of paper WIDTH. Every dimension in
 * `drawInfoBox` scales with `S = paperW/612`, so the box is a fixed fraction of
 * the paper regardless of size — letting the on-screen print-area preview size a
 * matching box. Mirrors the `S = 1` constants in `drawInfoBox`; keep them in sync.
 * Returns null when nothing would be drawn.
 */
export function legendBoxFractions(c: LegendBoxContent): { wFrac: number; hFrac: number; mFrac: number } | null {
  const hasLegend = c.pins.length > 0 || c.routeCount > 0
  const hasHeader = c.hasTitle || c.hasArea || c.includeCompass
  if (!hasHeader && !hasLegend && !c.includeScale) return null

  const pad = 8
  const margin = 16
  const legendW = 190
  const divGapBefore = 2
  const divGapAfter = 3
  const divW = 1
  const titleSize = 11
  const areaSize = 8
  const areaGap = 2
  const headerSize = 7
  const nameSize = 10
  const descSize = 8
  const emojiColW = 16
  const rowGap = 3
  const previewH = 16
  const compDiam = 20

  const titleRowH = c.hasTitle ? titleSize : 0
  const areaRowH = c.hasArea ? areaSize + areaGap : 0
  const headerRowH = hasHeader ? Math.max(titleRowH + areaRowH, c.includeCompass ? compDiam : 0) : 0

  let legendSectionH = 0
  if (hasLegend) {
    legendSectionH += headerSize + 6
    for (const p of c.pins) {
      const rowH = p.hasDescription ? nameSize + 2 + descSize : nameSize
      legendSectionH += Math.max(emojiColW, rowH) + rowGap
    }
    for (let i = 0; i < c.routeCount; i++) {
      legendSectionH += Math.max(previewH, nameSize + 2 + descSize) + rowGap
    }
    legendSectionH -= rowGap
  }

  const scaleFooterH = c.includeScale ? 4 + 5 + 3 + 8 + 4 : 0

  let contentH = 0
  if (hasHeader) {
    contentH += headerRowH + divGapBefore
    if (hasLegend || c.includeScale) contentH += divW + divGapAfter
  }
  if (hasLegend) {
    contentH += legendSectionH
    if (c.includeScale) contentH += divGapBefore + divW + divGapAfter
  }
  if (c.includeScale) contentH += scaleFooterH
  const boxH = contentH + pad * 2

  return { wFrac: legendW / 612, hFrac: boxH / 612, mFrac: margin / 612 }
}

/**
 * Collapse legend entries that would render identically. Emoji pins with the same
 * emoji + name fold into a single entry (first occurrence wins); numbered pins each
 * carry a unique number, so they never merge.
 */
export function dedupeLegendPins<T extends { pin: Pin; index?: number }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.index !== undefined ? `#${item.index}` : `${item.pin.emoji} ${item.pin.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function drawInfoBox(ctx: CanvasRenderingContext2D, title: string, area: string, pins: Pin[], routes: Route[], angle: number, corners: [number, number][], scaleUnit: 'km' | 'mi', includeLegend: boolean, includeCompass: boolean, includeScale: boolean, blankLabels: boolean, paperW: number, paperH: number, corner: OverlayCorner, allPins?: Pin[]) {
  // Compute sequence numbers from the full ordered list so legend indices match the map.
  const pinSeqMap = new Map<number, number>()
  let seq = 0
  for (const p of allPins ?? pins) {
    if (p.showNumber) pinSeqMap.set(p.id, ++seq)
  }
  const namedPins = dedupeLegendPins(pins.map((p) => ({ pin: p, index: pinSeqMap.get(p.id) })).filter(({ pin }) => pin.name))
  const namedRoutes = routes.filter((r) => r.name)
  const hasTitle = includeLegend && !!title
  const hasArea = includeLegend && !!area
  const hasLegend = includeLegend && (namedPins.length > 0 || namedRoutes.length > 0)
  const hasHeader = hasTitle || hasArea || includeCompass
  if (!hasHeader && !hasLegend && !includeScale) return

  const S = paperW / 612
  const pad = Math.round(8 * S)
  const margin = Math.round(16 * S)
  const borderR = Math.round(7 * S)
  const legendW = Math.round(190 * S)
  const divGapBefore = Math.round(2 * S)
  const divGapAfter = Math.round(3 * S)
  const divW = Math.max(1, Math.round(S))
  const titleSize = Math.round(11 * S)
  const areaSize = Math.round(8 * S)
  const areaGap = Math.round(2 * S)
  const headerSize = Math.round(7 * S)
  const nameSize = Math.round(10 * S)
  const descSize = Math.round(8 * S)
  const emojiColW = Math.round(16 * S)
  const rowGap = Math.round(3 * S)
  const previewW = Math.round(44 * S)
  const previewH = Math.round(16 * S)

  // Compass — small, inline with title row
  const compCircleR = Math.round(10 * S)
  const compDiam = compCircleR * 2
  const compTipR = compCircleR
  const compTailR = compCircleR
  const compWingR = Math.round(2 * S)

  const titleRowH = hasTitle ? titleSize : 0
  const areaRowH = hasArea ? areaSize + areaGap : 0

  const headerRowH = hasHeader ? Math.max(titleRowH + areaRowH, includeCompass ? compDiam : 0) : 0

  let legendSectionH = 0
  if (hasLegend) {
    legendSectionH += headerSize + Math.round(6 * S)
    for (const { pin } of namedPins) {
      const rowH = pin.description ? nameSize + Math.round(2 * S) + descSize : nameSize
      legendSectionH += Math.max(emojiColW, rowH) + rowGap
    }
    for (let i = 0; i < namedRoutes.length; i++) {
      legendSectionH += Math.max(previewH, nameSize + Math.round(2 * S) + descSize) + rowGap
    }
    legendSectionH -= rowGap
  }

  // Compact scale footer
  const scaleBarH = Math.round(5 * S)
  const scaleFontSize = Math.round(8 * S)
  const scaleFooterH = includeScale ? Math.round(4 * S) + scaleBarH + Math.round(3 * S) + scaleFontSize + Math.round(4 * S) : 0

  let contentH = 0
  if (hasHeader) {
    contentH += headerRowH + divGapBefore
    if (hasLegend || includeScale) contentH += divW + divGapAfter
  }
  if (hasLegend) {
    contentH += legendSectionH
    if (includeScale) contentH += divGapBefore + divW + divGapAfter
  }
  if (includeScale) contentH += scaleFooterH
  const boxH = contentH + pad * 2

  const isRight = corner === 1 || corner === 2
  const isTop = corner === 0 || corner === 1
  const boxX = isRight ? paperW - legendW - margin : margin
  const boxY = isTop ? margin : paperH - boxH - margin

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.12)'
  ctx.shadowBlur = Math.round(10 * S)
  ctx.shadowOffsetY = Math.round(2 * S)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  roundRect(ctx, boxX, boxY, legendW, boxH, borderR)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = Math.max(1, Math.round(S))
  roundRect(ctx, boxX, boxY, legendW, boxH, borderR)
  ctx.stroke()

  let y = boxY + pad

  // Header row: title left, small compass right
  if (hasHeader) {
    const headerCenterY = y + headerRowH / 2

    const textMaxW = includeCompass ? legendW - pad * 2 - compDiam - Math.round(6 * S) : legendW - pad * 2

    if (hasTitle) {
      const titleY = hasArea ? boxY + pad + titleSize / 2 : headerCenterY
      ctx.save()
      ctx.fillStyle = '#111827'
      ctx.font = `700 ${titleSize}px system-ui,sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(title, boxX + pad, titleY, textMaxW)
      ctx.restore()
    }

    if (hasArea) {
      const areaY = boxY + pad + titleRowH + areaGap + areaSize / 2
      ctx.save()
      ctx.fillStyle = '#6b7280'
      ctx.font = `${areaSize}px system-ui,sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(area, boxX + pad, areaY, textMaxW)
      ctx.restore()
    }

    if (includeCompass) {
      const nx = -Math.sin(angle)
      const ny = -Math.cos(angle)
      const ex = -ny
      const ey = nx
      const cx = boxX + legendW - pad - compCircleR
      const cy = headerCenterY
      const northX = cx + nx * compTipR,
        northY = cy + ny * compTipR
      const southX = cx - nx * compTailR,
        southY = cy - ny * compTailR
      const leftX = cx + ex * compWingR,
        leftY = cy + ey * compWingR
      const rightX = cx - ex * compWingR,
        rightY = cy - ey * compWingR

      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = Math.max(1, S)
      ctx.beginPath()
      ctx.arc(cx, cy, compCircleR, 0, Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = '#1f2937'
      ctx.beginPath()
      ctx.moveTo(northX, northY)
      ctx.lineTo(leftX, leftY)
      ctx.lineTo(rightX, rightY)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = '#e5e7eb'
      ctx.beginPath()
      ctx.moveTo(southX, southY)
      ctx.lineTo(leftX, leftY)
      ctx.lineTo(rightX, rightY)
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = '#9ca3af'
      ctx.lineWidth = Math.max(1, S * 0.75)
      ctx.beginPath()
      ctx.moveTo(northX, northY)
      ctx.lineTo(leftX, leftY)
      ctx.lineTo(southX, southY)
      ctx.lineTo(rightX, rightY)
      ctx.closePath()
      ctx.stroke()

      ctx.fillStyle = '#9ca3af'
      ctx.beginPath()
      ctx.arc(cx, cy, Math.round(1.5 * S), 0, Math.PI * 2)
      ctx.fill()
    }

    y += headerRowH + divGapBefore
    if (hasLegend || includeScale) {
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = divW
      ctx.beginPath()
      ctx.moveTo(boxX + pad, y)
      ctx.lineTo(boxX + legendW - pad, y)
      ctx.stroke()
      y += divW + divGapAfter
    }
  }

  if (hasLegend) {
    ctx.save()
    ctx.fillStyle = '#9ca3af'
    ctx.font = `700 ${headerSize}px system-ui,sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.letterSpacing = `${Math.round(1 * S)}px`
    ctx.fillText('LEGEND', boxX + pad, y)
    ctx.restore()
    y += headerSize + Math.round(6 * S)

    for (const { pin, index } of namedPins) {
      const textX = boxX + pad + emojiColW + Math.round(7 * S)
      const textMaxW = legendW - pad * 2 - emojiColW - Math.round(7 * S)

      if (index !== undefined) {
        const dotR = Math.round(emojiColW * 0.45)
        const dotCX = boxX + pad + Math.round(emojiColW / 2)
        const dotCY = y + Math.round(emojiColW / 2)
        ctx.save()
        ctx.beginPath()
        ctx.arc(dotCX, dotCY, dotR, 0, Math.PI * 2)
        ctx.fillStyle = pin.color || '#06b6d4'
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = Math.max(1, Math.round(dotR * 0.3))
        ctx.stroke()
        ctx.fillStyle = 'white'
        ctx.font = `700 ${Math.round(dotR * 1.1)}px system-ui,sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(index), dotCX, dotCY)
        ctx.restore()
      } else {
        ctx.save()
        ctx.font = `${Math.round(15 * S)}px serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(pin.emoji, boxX + pad, y)
        ctx.restore()
      }

      if (blankLabels) {
        ctx.save()
        ctx.strokeStyle = '#9ca3af'
        ctx.lineWidth = Math.max(1, Math.round(S))
        ctx.beginPath()
        ctx.moveTo(textX, y + nameSize - Math.round(2 * S))
        ctx.lineTo(textX + Math.round(textMaxW * 0.85), y + nameSize - Math.round(2 * S))
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.save()
        ctx.fillStyle = '#1f2937'
        ctx.font = `600 ${nameSize}px system-ui,sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(pin.name, textX, y, textMaxW)
        ctx.restore()

        if (pin.description) {
          ctx.save()
          ctx.fillStyle = '#6b7280'
          ctx.font = `${descSize}px system-ui,sans-serif`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          ctx.fillText(pin.description, textX, y + nameSize + Math.round(2 * S), textMaxW)
          ctx.restore()
        }
      }

      const rowH = !blankLabels && pin.description ? nameSize + Math.round(2 * S) + descSize : nameSize
      y += Math.max(emojiColW, rowH) + rowGap
    }

    for (const route of namedRoutes) {
      const textH = blankLabels ? nameSize : nameSize + Math.round(2 * S) + descSize
      const rowH = Math.max(previewH, textH)
      const previewY = y + Math.round((rowH - previewH) / 2)
      drawRoutePreviewInLegend(ctx, route, boxX + pad, previewY, S)

      const textX = boxX + pad + previewW + Math.round(7 * S)
      const textMaxW = legendW - pad * 2 - previewW - Math.round(7 * S)
      const textY = y + Math.round((rowH - textH) / 2)

      if (blankLabels) {
        ctx.save()
        ctx.strokeStyle = '#9ca3af'
        ctx.lineWidth = Math.max(1, Math.round(S))
        ctx.beginPath()
        ctx.moveTo(textX, textY + nameSize - Math.round(2 * S))
        ctx.lineTo(textX + Math.round(textMaxW * 0.85), textY + nameSize - Math.round(2 * S))
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.save()
        ctx.fillStyle = '#1f2937'
        ctx.font = `600 ${nameSize}px system-ui,sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(route.name, textX, textY, textMaxW)
        ctx.restore()

        const dist = formatDistance(routeDistanceM(route.points), scaleUnit)
        const wpCount = route.points.length
        const meta = `${dist} · ${wpCount} ${wpCount === 1 ? 'waypoint' : 'waypoints'}`
        ctx.save()
        ctx.fillStyle = '#6b7280'
        ctx.font = `${descSize}px system-ui,sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(meta, textX, textY + nameSize + Math.round(2 * S), textMaxW)
        ctx.restore()
      }

      y += rowH + rowGap
    }

    if (includeScale) {
      y += divGapBefore
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = divW
      ctx.beginPath()
      ctx.moveTo(boxX + pad, y)
      ctx.lineTo(boxX + legendW - pad, y)
      ctx.stroke()
      y += divW + divGapAfter
    }
  }

  // Scale footer — compact, full width
  if (includeScale) {
    const [nw, ne] = corners as [[number, number], [number, number]]
    const widthKm = haversineKm(nw[0], nw[1], ne[0], ne[1])
    const scaleAvailW = legendW - pad * 2
    const targetPx = scaleAvailW * 0.85

    let barWidthPx: number
    let label: string

    if (scaleUnit === 'mi') {
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

    if (barWidthPx >= 10) {
      const barTopY = y + Math.round(4 * S)
      const barX = boxX + pad + Math.round((scaleAvailW - barWidthPx) / 2)

      ctx.fillStyle = '#1f2937'
      ctx.fillRect(barX, barTopY, barWidthPx / 2, scaleBarH)
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect(barX + barWidthPx / 2, barTopY, barWidthPx / 2, scaleBarH)
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = Math.max(1, S)
      ctx.strokeRect(barX, barTopY, barWidthPx, scaleBarH)
      ctx.beginPath()
      ctx.moveTo(barX + barWidthPx / 2, barTopY)
      ctx.lineTo(barX + barWidthPx / 2, barTopY + scaleBarH)
      ctx.stroke()

      const labelY = barTopY + scaleBarH + Math.round(3 * S)
      ctx.fillStyle = '#374151'
      ctx.font = `${scaleFontSize}px system-ui,sans-serif`
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      ctx.fillText('0', barX, labelY)
      ctx.textAlign = 'right'
      ctx.fillText(label, barX + barWidthPx, labelY)
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
  return steps.reduce((best, s) => (s <= value ? s : best), steps[0] ?? 0)
}

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

// Geo-anchored text labels. Centered on each caption's lat/lng, scaled by S = paperW/612
// (same reference as drawPins), optionally rotated and backed by a white pill. Off-canvas
// captions are skipped with a generous margin since text can extend well past its anchor.
function drawCaptions(ctx: CanvasRenderingContext2D, captions: Caption[], hiddenCaptionIds: Set<number>, geoToOut: (lat: number, lng: number) => [number, number], paperW: number, paperH: number) {
  const S = paperW / 612
  for (const cap of captions) {
    if (hiddenCaptionIds.has(cap.id)) continue
    const text = cap.text ?? ''
    if (!text.trim()) continue
    const [ox, oy] = geoToOut(cap.lat, cap.lng)
    if (ox < -paperW * 0.5 || ox > paperW * 1.5 || oy < -paperH * 0.5 || oy > paperH * 1.5) continue

    const fontPx = (CAPTION_PT[cap.size] ?? CAPTION_PT.m) * S
    const lines = text.split('\n')
    const lineH = fontPx * 1.15
    const totalH = lineH * lines.length

    ctx.save()
    ctx.translate(ox, oy)
    if (cap.rotation) ctx.rotate((cap.rotation * Math.PI) / 180)
    ctx.font = `600 ${fontPx}px system-ui,sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (cap.background) {
      let maxW = 0
      for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width)
      const padX = fontPx * 0.45
      const padY = fontPx * 0.18
      const boxW = maxW + padX * 2
      const boxH = totalH + padY * 2
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.2)'
      ctx.shadowBlur = fontPx * 0.25
      ctx.shadowOffsetY = fontPx * 0.06
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, fontPx * 0.35)
      ctx.fill()
      ctx.restore()
    } else {
      // White halo so dark text stays legible over busy tiles.
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = fontPx * 0.22
    }

    const startY = -totalH / 2 + lineH / 2
    for (let i = 0; i < lines.length; i++) {
      const ly = startY + i * lineH
      if (!cap.background) ctx.strokeText(lines[i]!, 0, ly)
      ctx.fillStyle = cap.color || '#111827'
      ctx.fillText(lines[i]!, 0, ly)
    }
    ctx.restore()
  }
}

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
  includeLegend: boolean
  legendSeparatePage?: boolean // render the legend on its own page(s) instead of on the map
  legendBlankLabels?: boolean // hide pin/route names — exploration mode so viewers can fill them in
  includeCompass: boolean
  includeScale: boolean
  scaleUnit: 'km' | 'mi'
  enhanceContrast: boolean
  fastExport?: boolean // "Fast draft": fewer tiles at a lower zoom + smaller output for a quick export
  paperWidthPt: number // PDF page width in points (1pt = 1/72 inch)
  paperHeightPt: number // PDF page height in points
  gridCols?: number // poster grid columns (default 1)
  gridRows?: number // poster grid rows (default 1)
  onProgress?: (msg: string) => void
}

const TILE_SIZE = 256 // px per tile at 1x (used for grid/zoom math regardless of retina)
const MAX_OUTPUT_PX = 7200 // cap longest side — gives ~217 DPI at A0, ~800+ DPI at A4
const MAX_OUTPUT_PX_FAST = 4000 // "Fast draft" longest-side cap — smaller + quicker to encode
const TILE_BUDGET = 750 // per-page tile ceiling — picks the highest zoom under it, staying under rate limits
const TILE_BUDGET_FAST = 200 // "Fast draft" ceiling — far fewer tiles at a lower zoom for a quick export
const TILE_CONCURRENCY = 24 // max simultaneous tile requests (6 connections × 4 CartoDB subdomains)

async function renderPageToPng(corners: [number, number][], angle: number, config: MapStyleConfig, pins: Pin[], hiddenPinIds: Set<number>, routes: Route[], hiddenRouteIds: Set<number>, captions: Caption[], hiddenCaptionIds: Set<number>, includeLegend: boolean, includeCompass: boolean, includeScale: boolean, scaleUnit: 'km' | 'mi', enhanceContrast: boolean, fastExport: boolean, mapTitle: string, mapArea: string, blankLabels: boolean, legendPins?: Pin[], legendRoutes?: Route[], onProgress?: (msg: string) => void): Promise<Uint8Array> {
  // --- 1. Compute the AABB of the 4 corners in lat/lng space ---
  const lats = corners.map((c) => c[0])
  const lngs = corners.map((c) => c[1])
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs)

  // --- 2. Choose zoom level ---
  const maxZoom = config.maxNativeZoom ?? 19

  // Find the highest zoom where tile count stays under the budget ("Fast draft" lowers it).
  const tileBudget = fastExport ? TILE_BUDGET_FAST : TILE_BUDGET
  let zoom = 1
  for (let z = 1; z <= maxZoom; z++) {
    const xSpan = (lngToTileFrac(maxLng, z) - lngToTileFrac(minLng, z)) * TILE_SIZE
    const ySpan = (latToTileFrac(minLat, z) - latToTileFrac(maxLat, z)) * TILE_SIZE
    const tileCount = (Math.floor(xSpan / TILE_SIZE) + 2) * (Math.floor(ySpan / TILE_SIZE) + 2)
    if (tileCount > tileBudget) break
    zoom = z
  }

  // Canvas size guard (iOS only): step zoom down if the stitched canvas would exceed
  // ~16 million pixels. iOS WebKit silently returns a blank canvas above that limit —
  // the root cause of all-white exports on phones. Desktop browsers handle much larger
  // canvases so the guard is skipped there to preserve full quality.
  // iOS WebKit silently returns a blank canvas above ~16 million pixels.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
  if (isIOS) {
    const ds = config.retina ? 512 : TILE_SIZE
    while (zoom > 1) {
      const gW = Math.floor(lngToTileFrac(maxLng, zoom)) - Math.floor(lngToTileFrac(minLng, zoom)) + 1
      const gH = Math.floor(latToTileFrac(minLat, zoom)) - Math.floor(latToTileFrac(maxLat, zoom)) + 1
      if (gW * ds * (gH * ds) <= 16_000_000) break
      zoom--
    }
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
      d[i] = Math.round(Math.max(0, (((d[i] ?? 0) - lo) / range) * 255))
      d[i + 1] = Math.round(Math.max(0, (((d[i + 1] ?? 0) - lo) / range) * 255))
      d[i + 2] = Math.round(Math.max(0, (((d[i + 2] ?? 0) - lo) / range) * 255))
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
  const outputCap = fastExport ? MAX_OUTPUT_PX_FAST : MAX_OUTPUT_PX
  const capScale = Math.min(1, outputCap / Math.max(halfW * 2, halfH * 2))
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

  const routesInArea = routes.filter((route) => {
    if (hiddenRouteIds.has(route.id)) return false
    return route.points.some((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false
      const [ox, oy] = geoToOutputPx(p.lat, p.lng)
      return ox >= 0 && ox <= paperWidthPx && oy >= 0 && oy <= paperHeightPx
    })
  })

  const overlayCorner = includeLegend || includeCompass || includeScale ? bestCorner(pinsInArea, geoToOutputPx, paperWidthPx, paperHeightPx) : 2
  drawRoutes(outCtx, routes, hiddenRouteIds, geoToOutputPx, paperWidthPx, paperHeightPx)
  drawPins(outCtx, pins, hiddenPinIds, geoToOutputPx, paperWidthPx, paperHeightPx)
  drawCaptions(outCtx, captions, hiddenCaptionIds, geoToOutputPx, paperWidthPx, paperHeightPx)
  drawInfoBox(outCtx, mapTitle, mapArea, legendPins ?? pinsInArea, legendRoutes ?? routesInArea, angle, corners, scaleUnit, includeLegend, includeCompass, includeScale, blankLabels, paperWidthPx, paperHeightPx, overlayCorner, pins)

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

interface LegendPageContent {
  title: string
  area: string
  pins: { pin: Pin; index?: number }[]
  routes: Route[]
  unit: 'km' | 'mi'
  blankLabels?: boolean
}

/**
 * Render the legend (title, subtitle, pins, routes) as one or more standalone PDF
 * pages, flowing items into columns and spilling onto extra pages when they don't
 * fit. Used when the user chooses "legend on its own page". Compass and scale are
 * NOT drawn here — they stay on the map. Returns one PNG (page) per canvas.
 */
async function renderLegendPagesToPng(c: LegendPageContent, paperWidthPt: number, paperHeightPt: number): Promise<Uint8Array[]> {
  const K = 4 // px per point — ~288 DPI for crisp text; max paper ~1224pt → 4896px (< MAX_OUTPUT_PX)
  const pt = (n: number) => n * K
  const W = Math.round(paperWidthPt * K)
  const H = Math.round(paperHeightPt * K)

  const margin = pt(30)
  const colGap = pt(16)
  const rowGap = pt(4)
  const titleSize = pt(15)
  const subSize = pt(10)
  const sectionSize = pt(8)
  const nameSize = pt(10)
  const descSize = pt(8)
  const swatch = pt(13) // pin icon column (numbered dot / emoji)
  const gap = pt(5) // gap between icon/preview and text
  const previewScale = K * 0.8 // route preview swatch scale (drawRoutePreviewInLegend draws 52×20 at this)
  const previewW = 52 * previewScale
  const previewH = 20 * previewScale
  const lineH = pt(1) // gap between a name and its description

  const pages: HTMLCanvasElement[] = []
  let canvas!: HTMLCanvasElement
  let ctx!: CanvasRenderingContext2D
  let colCount = 1
  let colW = W - margin * 2
  let colLeftX: number[] = [margin]
  let top = margin
  const bottom = H - margin
  let col = 0
  let y = margin

  function newPage(withHeader: boolean) {
    canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    pages.push(canvas)

    let headerBottom = margin
    if (withHeader && (c.title || c.area)) {
      let hy = margin
      if (c.title) {
        ctx.fillStyle = '#111827'
        ctx.font = `700 ${titleSize}px system-ui,sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(c.title, margin, hy, W - margin * 2)
        hy += titleSize * 1.1
      }
      if (c.area) {
        ctx.fillStyle = '#6b7280'
        ctx.font = `${subSize}px system-ui,sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(c.area, margin, hy + pt(3), W - margin * 2)
        hy += pt(3) + subSize
      }
      hy += pt(6)
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = Math.max(1, K)
      ctx.beginPath()
      ctx.moveTo(margin, hy)
      ctx.lineTo(W - margin, hy)
      ctx.stroke()
      headerBottom = hy + pt(8)
    }

    const contentW = W - margin * 2
    colCount = Math.max(1, Math.floor((contentW + colGap) / (pt(165) + colGap)))
    colW = (contentW - (colCount - 1) * colGap) / colCount
    colLeftX = Array.from({ length: colCount }, (_, i) => margin + i * (colW + colGap))
    top = headerBottom
    col = 0
    y = top
  }

  // Reserve vertical space, advancing to the next column / page when it won't fit.
  // `keepWith` reserves a follow-on block too, so section headers never orphan.
  function place(height: number, keepWith = 0): [number, number] {
    if (y > top && y + height + (keepWith ? rowGap + keepWith : 0) > bottom) {
      col++
      if (col >= colCount) newPage(false)
      else y = top
    }
    const x = colLeftX[col]!
    const drawY = y
    y += height + rowGap
    return [x, drawY]
  }

  function pinHeight(p: Pin): number {
    if (c.blankLabels) return Math.max(swatch, nameSize)
    return Math.max(swatch, nameSize + (p.description ? lineH + descSize : 0))
  }
  const routeRowH = c.blankLabels ? Math.max(previewH, nameSize) : Math.max(previewH, nameSize + lineH + descSize)

  function sectionHeader(text: string, firstItemH: number) {
    const [hx, hy] = place(sectionSize + pt(3), firstItemH)
    ctx.save()
    ctx.fillStyle = '#9ca3af'
    ctx.font = `700 ${sectionSize}px system-ui,sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.letterSpacing = `${Math.round(pt(1))}px`
    ctx.fillText(text, hx, hy)
    ctx.restore()
  }

  newPage(true)

  const legendPins = dedupeLegendPins(c.pins)
  const hasPins = legendPins.length > 0
  const hasRoutes = c.routes.length > 0

  if (hasPins) {
    sectionHeader(hasRoutes ? 'PINS' : 'LEGEND', pinHeight(legendPins[0]!.pin))
    for (const { pin, index } of legendPins) {
      const [x, dy] = place(pinHeight(pin))
      const textX = x + swatch + gap
      const textMaxW = colW - swatch - gap
      if (index !== undefined) {
        const dotR = Math.round(swatch * 0.45)
        const dcx = x + Math.round(swatch / 2)
        const dcy = dy + Math.round(swatch / 2)
        ctx.save()
        ctx.beginPath()
        ctx.arc(dcx, dcy, dotR, 0, Math.PI * 2)
        ctx.fillStyle = pin.color || '#06b6d4'
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = Math.max(1, Math.round(dotR * 0.3))
        ctx.stroke()
        ctx.fillStyle = 'white'
        ctx.font = `700 ${Math.round(dotR * 1.1)}px system-ui,sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(index), dcx, dcy)
        ctx.restore()
      } else {
        ctx.save()
        ctx.font = `${Math.round(swatch * 0.95)}px serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(pin.emoji, x, dy)
        ctx.restore()
      }
      if (c.blankLabels) {
        ctx.save()
        ctx.strokeStyle = '#9ca3af'
        ctx.lineWidth = Math.max(1, pt(0.5))
        ctx.beginPath()
        ctx.moveTo(textX, dy + nameSize - pt(1))
        ctx.lineTo(textX + Math.round(textMaxW * 0.85), dy + nameSize - pt(1))
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.save()
        ctx.fillStyle = '#1f2937'
        ctx.font = `600 ${nameSize}px system-ui,sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(pin.name, textX, dy, textMaxW)
        ctx.restore()
        if (pin.description) {
          ctx.save()
          ctx.fillStyle = '#6b7280'
          ctx.font = `${descSize}px system-ui,sans-serif`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          ctx.fillText(pin.description, textX, dy + nameSize + lineH, textMaxW)
          ctx.restore()
        }
      }
    }
  }

  if (hasRoutes) {
    sectionHeader(hasPins ? 'ROUTES' : 'LEGEND', routeRowH)
    for (const route of c.routes) {
      const [x, dy] = place(routeRowH)
      drawRoutePreviewInLegend(ctx, route, x, dy + Math.round((routeRowH - previewH) / 2), previewScale)
      const textX = x + previewW + gap
      const textMaxW = colW - previewW - gap
      const textRowH = c.blankLabels ? nameSize : nameSize + lineH + descSize
      const textY = dy + Math.round((routeRowH - textRowH) / 2)
      if (c.blankLabels) {
        ctx.save()
        ctx.strokeStyle = '#9ca3af'
        ctx.lineWidth = Math.max(1, pt(0.5))
        ctx.beginPath()
        ctx.moveTo(textX, textY + nameSize - pt(1))
        ctx.lineTo(textX + Math.round(textMaxW * 0.85), textY + nameSize - pt(1))
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.save()
        ctx.fillStyle = '#1f2937'
        ctx.font = `600 ${nameSize}px system-ui,sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(route.name, textX, textY, textMaxW)
        ctx.restore()
        const dist = formatDistance(routeDistanceM(route.points), c.unit)
        const wp = route.points.length
        ctx.save()
        ctx.fillStyle = '#6b7280'
        ctx.font = `${descSize}px system-ui,sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(`${dist} · ${wp} ${wp === 1 ? 'waypoint' : 'waypoints'}`, textX, textY + nameSize + lineH, textMaxW)
        ctx.restore()
      }
    }
  }

  return Promise.all(
    pages.map(
      (cv) =>
        new Promise<Uint8Array>((resolve, reject) => {
          cv.toBlob((blob) => {
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
    )
  )
}

export async function exportMapToPdf(opts: ExportOptions): Promise<Uint8Array> {
  const { corners, angle, mapStyle, mapTitle, mapArea = '', pins, hiddenPinIds, routes, hiddenRouteIds, captions, hiddenCaptionIds, includeLegend, legendSeparatePage = false, legendBlankLabels = false, includeCompass, includeScale, scaleUnit, enhanceContrast, fastExport = false, paperWidthPt, paperHeightPt, gridCols = 1, gridRows = 1, onProgress } = opts

  // When the legend lives on its own page, keep it off the map overlay (compass/scale stay).
  const onMapLegend = includeLegend && !legendSeparatePage
  const config = MAP_STYLE_CONFIGS[mapStyle]
  const totalPages = gridCols * gridRows
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

  for (let rj = 0; rj < gridRows; rj++) {
    for (let ci = 0; ci < gridCols; ci++) {
      const pageNum = rj * gridCols + ci + 1
      const cellCorners = totalPages === 1 ? corners : subCornersForCell(corners, ci, rj, gridCols, gridRows)

      // All overlay elements go together on the bottom-right cell as a single combined box.
      const isInfoCell = ci === gridCols - 1 && rj === gridRows - 1
      const cellCompass = includeCompass && isInfoCell
      const cellLegend = onMapLegend && isInfoCell
      const cellScale = includeScale && isInfoCell

      const prefix = totalPages > 1 ? `Page ${pageNum} of ${totalPages} — ` : ''
      const pngBytes = await renderPageToPng(cellCorners, angle, config, pins, hiddenPinIds, routes, hiddenRouteIds, captions, hiddenCaptionIds, cellLegend, cellCompass, cellScale, scaleUnit, enhanceContrast, fastExport, mapTitle, mapArea, legendBlankLabels, cellLegend ? fullAreaLegendPins : undefined, cellLegend ? fullAreaLegendRoutes : undefined, (msg) => onProgress?.(`${prefix}${msg}`))

      const pdfImage = await pdfDoc.embedPng(pngBytes)
      const page = pdfDoc.addPage([paperWidthPt, paperHeightPt])
      page.drawImage(pdfImage, { x: 0, y: 0, width: paperWidthPt, height: paperHeightPt })
    }
  }

  // Dedicated legend page(s) — named pins/routes within the print area's bounding box.
  if (includeLegend && legendSeparatePage) {
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

    const legendPins = pins.filter((p) => p.name && !hiddenPinIds.has(p.id) && inArea(p.lat, p.lng)).map((pin) => ({ pin, index: seq.get(pin.id) }))
    const legendRoutes = routes.filter((r) => r.name && !hiddenRouteIds.has(r.id) && r.points.some((p) => inArea(p.lat, p.lng)))

    if (legendPins.length > 0 || legendRoutes.length > 0) {
      onProgress?.('Rendering legend…')
      const legendPages = await renderLegendPagesToPng({ title: mapTitle, area: mapArea, pins: legendPins, routes: legendRoutes, unit: scaleUnit, blankLabels: legendBlankLabels }, paperWidthPt, paperHeightPt)
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
