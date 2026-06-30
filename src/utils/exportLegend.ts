import { formatDistance, routeDistanceM } from '@/composables/useRoutes'
import type { Pin, Route } from '@/types'

import { roundRect } from './exportDraw'

// 0=TL 1=TR 2=BR 3=BL
export type OverlayCorner = 0 | 1 | 2 | 3

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

export function drawRoutePreviewInLegend(ctx: CanvasRenderingContext2D, route: Route, ox: number, oy: number, S: number) {
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
export function legendBoxFractions(c: LegendBoxContent, scale = 1): { wFrac: number; hFrac: number; mFrac: number } | null {
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

  return { wFrac: (legendW / 612) * scale, hFrac: (boxH / 612) * scale, mFrac: (margin / 612) * scale }
}

/**
 * Collapse legend entries that would render identically. Emoji pins with the same
 * emoji + name fold into a single entry (first occurrence wins); numbered pins each
 * carry a unique number, so they never merge.
 */
export function dedupeLegendPins<T extends { pin: Pin; index?: number }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.index !== undefined ? `#${item.index}` : `${item.pin.emoji} ${item.pin.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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

export function drawInfoBox(ctx: CanvasRenderingContext2D, title: string, area: string, pins: Pin[], routes: Route[], angle: number, corners: [number, number][], scaleUnit: 'km' | 'mi', includePins: boolean, includeRoutes: boolean, includeCompass: boolean, includeScale: boolean, blankLabels: boolean, paperW: number, paperH: number, corner: OverlayCorner, legendScale = 1, legendX: number | null = null, legendY: number | null = null, allPins?: Pin[], scaleW = paperW) {
  // Compute sequence numbers from the full ordered list so legend indices match the map.
  const pinSeqMap = new Map<number, number>()
  let seq = 0
  for (const p of allPins ?? pins) {
    if (p.showNumber) pinSeqMap.set(p.id, ++seq)
  }
  const allNamedPins = dedupeLegendPins(pins.map((p) => ({ pin: p, index: pinSeqMap.get(p.id) })).filter(({ pin }) => pin.name))
  const allNamedRoutes = routes.filter((r) => r.name)
  const shownPins = includePins ? allNamedPins : []
  const shownRoutes = includeRoutes ? allNamedRoutes : []
  const hasTitle = !!title
  const hasArea = !!area
  const hasLegend = shownPins.length > 0 || shownRoutes.length > 0
  const hasHeader = hasTitle || hasArea || includeCompass
  if (!hasHeader && !hasLegend && !includeScale) return

  // scaleW is the full assembled paper width — equals paperW for single-page exports but is
  // larger for singlePageGrid cells so the legend/overlays scale to the assembled page size.
  // Cap so legendW never overflows the cell canvas.
  let S = (scaleW / 612) * legendScale
  let legendW = Math.round(190 * S)
  const maxLegendW = Math.round(paperW * 0.9)
  if (legendW > maxLegendW) {
    legendW = maxLegendW
    S = legendW / 190
  }
  const pad = Math.round(8 * S)
  const margin = Math.round(16 * S)
  const borderR = Math.round(7 * S)
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
    for (const { pin } of shownPins) {
      const rowH = pin.description ? nameSize + Math.round(2 * S) + descSize : nameSize
      legendSectionH += Math.max(emojiColW, rowH) + rowGap
    }
    for (let i = 0; i < shownRoutes.length; i++) {
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

  let boxX: number, boxY: number
  if (legendX !== null && legendY !== null) {
    boxX = Math.max(0, Math.min(paperW - legendW, Math.round(legendX * paperW)))
    boxY = Math.max(0, Math.min(paperH - boxH, Math.round(legendY * paperH)))
  } else {
    const isRight = corner === 1 || corner === 2
    const isTop = corner === 0 || corner === 1
    boxX = isRight ? paperW - legendW - margin : margin
    boxY = isTop ? margin : paperH - boxH - margin
  }

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

    for (const { pin, index } of shownPins) {
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

    for (const route of shownRoutes) {
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
