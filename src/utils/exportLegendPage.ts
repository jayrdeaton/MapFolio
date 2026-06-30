import { formatDistance, routeDistanceM } from '@/composables/useRoutes'
import type { Pin, Route } from '@/types'

import { dedupeLegendPins, drawRoutePreviewInLegend } from './exportLegend'

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
export async function renderLegendPagesToPng(c: LegendPageContent, paperWidthPt: number, paperHeightPt: number): Promise<Uint8Array[]> {
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

  const pages: OffscreenCanvas[] = []
  let canvas!: OffscreenCanvas
  let ctx!: CanvasRenderingContext2D
  let colCount = 1
  let colW = W - margin * 2
  let colLeftX: number[] = [margin]
  let top = margin
  const bottom = H - margin
  let col = 0
  let y = margin

  function newPage(withHeader: boolean) {
    canvas = new OffscreenCanvas(W, H)
    ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
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
    pages.map(async (cv) => {
      const blob = await cv.convertToBlob({ type: 'image/png' })
      return new Uint8Array(await blob.arrayBuffer())
    })
  )
}
