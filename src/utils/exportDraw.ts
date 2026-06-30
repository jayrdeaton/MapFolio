import type { Caption, Pin, PinDotShape, PinDotSize, Route } from '@/types'
import { CAPTION_PT } from '@/types'

import { isDarkColor } from './color'

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
const DOT_CONTENT_PX: Record<PinDotSize, number> = { xs: 8, s: 12, m: 17, l: 22, xl: 28 }
// Number is only legible (and shown) on m/l/xl dots, mirroring the map marker.
const DOT_NUM_PX: Partial<Record<PinDotSize, number>> = { m: 8, l: 10, xl: 13 }

// Bubble emoji size per dot-size step — matches BUBBLE_EMOJI_SIZE in PinMarker/PinPreview.
const BUBBLE_EMOJI_PX: Record<PinDotSize, number> = { xs: 14, s: 16, m: 20, l: 24, xl: 30 }
const BUBBLE_PAD_V = 2 // equal padding all around
const BUBBLE_PAD_H = 2
const BUBBLE_TIP_H = 7

export function drawPins(ctx: CanvasRenderingContext2D, pins: Pin[], hiddenPinIds: Set<number>, geoToOut: (lat: number, lng: number) => [number, number], paperW: number, paperH: number, markerScale = 1, scaleW = paperW) {
  // scaleW = paperW for 1×1 exports; larger for singlePageGrid cells so pins scale to the
  // assembled page size rather than the individual cell canvas (same pattern as drawCaptions).
  const S = (scaleW / 612) * markerScale

  // Pre-compute sequence numbers for numbered pins (order within full list).
  const pinSeqMap = new Map<number, number>()
  let seq = 0
  for (const pin of pins) {
    if (pin.showNumber) pinSeqMap.set(pin.id, ++seq)
  }

  const margin = Math.round(50 * S)
  for (const pin of pins) {
    if (hiddenPinIds.has(pin.id)) continue
    const [ox, oy] = geoToOut(pin.lat, pin.lng)
    if (ox < -margin || ox > paperW + margin || oy < -margin || oy > paperH + margin) continue

    if (pin.emoji) {
      // Emoji bubble: colored rounded-rect + downward triangle tip. Geo anchor at tip.
      const emojiSize = Math.round(BUBBLE_EMOJI_PX[pin.dotSize ?? 'm'] * S)
      const padV = Math.round(BUBBLE_PAD_V * S)
      const padH = Math.round(BUBBLE_PAD_H * S)
      const tipH = Math.round(BUBBLE_TIP_H * S)
      const bubbleH = emojiSize + padV * 2
      const bx = ox // bubble horizontal center
      const bubbleBottom = oy - tipH
      const bubbleTop = bubbleBottom - bubbleH

      // Measure emoji to determine bubble width and ink centering offsets.
      // Set baseline/align before measuring so actualBoundingBox* are relative to alphabetic baseline.
      ctx.font = `${emojiSize}px serif`
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'left'
      const emojiMet = ctx.measureText(pin.emoji)
      const emojiW = emojiMet.width
      const bubbleW = Math.max(emojiW + padH * 2, bubbleH)
      const bLeft = bx - bubbleW / 2

      const isClear = pin.color === 'transparent'
      if (!isClear) {
        // Colored bubble + matching tip — drawn as one path so the shadow
        // applies to the combined silhouette (no seam at the chevron junction).
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.25)'
        ctx.shadowBlur = Math.round(4 * S)
        ctx.shadowOffsetY = Math.round(1 * S)
        ctx.fillStyle = pin.color || '#ffffff'
        const br = Math.round(7 * S)
        ctx.beginPath()
        ctx.moveTo(bLeft + br, bubbleTop)
        ctx.lineTo(bLeft + bubbleW - br, bubbleTop)
        ctx.quadraticCurveTo(bLeft + bubbleW, bubbleTop, bLeft + bubbleW, bubbleTop + br)
        ctx.lineTo(bLeft + bubbleW, bubbleBottom - br)
        ctx.quadraticCurveTo(bLeft + bubbleW, bubbleBottom, bLeft + bubbleW - br, bubbleBottom)
        // Go directly from each rounded-corner endpoint to the tip — no horizontal shelf
        // segments, which appeared as visible seams on the left and right sides in the PDF.
        ctx.lineTo(bx, oy)
        ctx.lineTo(bLeft + br, bubbleBottom)
        ctx.quadraticCurveTo(bLeft, bubbleBottom, bLeft, bubbleBottom - br)
        ctx.lineTo(bLeft, bubbleTop + br)
        ctx.quadraticCurveTo(bLeft, bubbleTop, bLeft + br, bubbleTop)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      // Emoji centered in bubble using actual ink bounds, not em-square 'middle'.
      // Emojis like 🕊️ and ✈️ have ink shifted well above the em-square, so
      // textBaseline:'middle' places them outside the bubble. Mirror PinMarker logic.
      ctx.save()
      if (isClear) {
        ctx.shadowColor = 'rgba(0,0,0,0.4)'
        ctx.shadowBlur = Math.round(3 * S)
        ctx.shadowOffsetY = Math.round(1 * S)
      }
      ctx.font = `${emojiSize}px serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      const emojiDrawX = bx - (emojiMet.actualBoundingBoxRight - emojiMet.actualBoundingBoxLeft) / 2
      const emojiDrawY = bubbleTop + bubbleH / 2 + (emojiMet.actualBoundingBoxAscent - emojiMet.actualBoundingBoxDescent) / 2
      ctx.fillText(pin.emoji, emojiDrawX, emojiDrawY)
      ctx.restore()
    } else {
      // Dot marker. Geo anchor at dot centre.
      const size = pin.dotSize ?? 'm'
      const shape: PinDotShape = pin.dotShape ?? 'circle'
      const r = (DOT_CONTENT_PX[size] / 2) * S

      const isTransparentDot = pin.color === 'transparent'
      const numTextColor = isDarkColor(pin.color) ? 'white' : '#1f2937'
      ctx.save()
      ctx.translate(ox, oy)
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = Math.round(3 * S)
      ctx.shadowOffsetY = Math.round(1 * S)
      ctx.fillStyle = isTransparentDot ? 'rgba(0,0,0,0)' : pin.color || '#06b6d4'
      if (shape === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fill()
      } else {
        if (shape === 'diamond') ctx.rotate(Math.PI / 4)
        roundRect(ctx, -r, -r, r * 2, r * 2, Math.max(1, Math.round(2 * S)))
        ctx.fill()
      }
      if (!isTransparentDot) {
        ctx.shadowColor = 'transparent'
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2 * S
        ctx.stroke()
      }
      ctx.restore()

      // Number inside dot — only on m/l/xl.
      const pinNum = pinSeqMap.get(pin.id)
      const numPx = DOT_NUM_PX[size]
      if (pinNum !== undefined && numPx !== undefined) {
        ctx.save()
        ctx.fillStyle = numTextColor
        ctx.font = `700 ${Math.round(numPx * S)}px system-ui,sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(pinNum), ox, oy)
        ctx.restore()
      }
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

export function drawRoutes(ctx: CanvasRenderingContext2D, routes: Route[], hiddenRouteIds: Set<number>, geoToOut: (lat: number, lng: number) => [number, number], paperW: number, _paperH: number, markerScale = 1, scaleW = paperW) {
  const S = (scaleW / 612) * markerScale
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

// Geo-anchored text labels. Centered on each caption's lat/lng, scaled by S = paperW/612
// (same reference as drawPins), optionally rotated and backed by a white pill. Off-canvas
// captions are skipped with a generous margin since text can extend well past its anchor.
export function drawCaptions(ctx: CanvasRenderingContext2D, captions: Caption[], hiddenCaptionIds: Set<number>, geoToOut: (lat: number, lng: number) => [number, number], paperW: number, paperH: number, scaleW = paperW) {
  const S = scaleW / 612
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
      ctx.fillStyle = cap.color || '#ffffff'
      roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, fontPx * 0.35)
      ctx.fill()
      ctx.restore()
    } else {
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = fontPx * 0.22
    }

    const textColor = cap.background ? (isDarkColor(cap.color) ? '#ffffff' : '#111827') : cap.color
    const startY = -totalH / 2 + lineH / 2
    for (let i = 0; i < lines.length; i++) {
      const ly = startY + i * lineH
      if (!cap.background) ctx.strokeText(lines[i]!, 0, ly)
      ctx.fillStyle = textColor
      ctx.fillText(lines[i]!, 0, ly)
    }
    ctx.restore()
  }
}
