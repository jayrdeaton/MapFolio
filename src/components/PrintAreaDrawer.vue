<script setup lang="ts">
import L from 'leaflet'

import { isAdditiveEvent } from '@/utils/events'
import type { RectState } from '@/utils/printAreaMath'
import { CLICK_SLOP, CORNER_CURSORS, cornerOffsets, EDGE_HIT, localToScreen, ROTATE_CURSOR, ROTATE_OFFSET, screenToLocal } from '@/utils/printAreaMath'
import type { LegendSettings } from '@/utils/printLegendPreview'
import { rebuildLegendPreview } from '@/utils/printLegendPreview'

const props = defineProps<{
  map: L.Map
  corners: [number, number][] // [[lat,lng] × 4] NW→NE→SE→SW; empty = no area
  angle: number
  aspectRatio: number | null
  snapEnabled: boolean
  gridCols?: number
  gridRows?: number
  overlayCorner?: 0 | 1 | 2 | 3
  // Footprint of the PDF info box as fractions of the print area's width; null hides the preview.
  legendBox?: { wFrac: number; hFrac: number; mFrac: number } | null
  legendSettings?: LegendSettings
  // Explicit legend position: fraction of paper width (x) and height (y) for the box's top-left.
  // null = auto-corner based on pin density (or legendCorner if set).
  legendX?: number | null
  legendY?: number | null
  // Pinned corner (0=TL,1=TR,2=BR,3=BL). Overrides overlayCorner when legendX/legendY are null.
  // null = use overlayCorner (auto pin-density detection).
  legendCorner?: 0 | 1 | 2 | 3 | null
  visibility?: 'visible' | 'opaque' | 'hidden'
  selected?: boolean
}>()

export interface PrintAreaInfo {
  bounds: L.LatLngBounds
  corners: [number, number][] // [[lat,lng] x4] in NW→NE→SE→SW order
  angle: number // rotation in radians
}

const emit = defineEmits<{
  'bounds-set': [info: PrintAreaInfo]
  select: [shiftHeld: boolean]
  // Viewport coords of the right-click — the host opens a Leaflet popup there. The print area
  // now lives in a pane below the popup pane, so the popup paints above it.
  context: [clientX: number, clientY: number]
  // Legend direct-manipulation: position (fractions of paper w/h) and scale multiplier.
  'legend-move': [xFrac: number, yFrac: number]
  'legend-scale': [scale: number]
  // Drag ended with the legend snapped to a print-area corner — store that corner instead of fracs.
  'legend-corner': [corner: 0 | 1 | 2 | 3]
  'legend-reset': []
  // Fired at the start of any user drag so the host can push an undo snapshot before state changes.
  'drag-start': [label: string]
}>()

// During a rotate/resize drag the pointer moves off the small handle, so the cursor would
// revert to whatever element is underneath. Force the handle's cursor everywhere via a
// temporary global !important rule until the drag ends. Pass null to clear.
let dragCursorStyle: HTMLStyleElement | null = null
function setDragCursor(cursor: string | null) {
  if (cursor) {
    if (!dragCursorStyle) {
      dragCursorStyle = document.createElement('style')
      document.head.appendChild(dragCursorStyle)
    }
    dragCursorStyle.textContent = `*{cursor:${cursor}!important}`
  } else if (dragCursorStyle) {
    dragCursorStyle.remove()
    dragCursorStyle = null
  }
}

// ── DOM elements ──────────────────────────────────────────────────────────────

let handleLayer: HTMLDivElement | null = null
let rectEl: HTMLDivElement | null = null
let rotateLineEl: HTMLDivElement | null = null
let cornerEls: HTMLDivElement[] = []
let edgeEls: HTMLDivElement[] = []
let rotateEl: HTMLDivElement | null = null
let legendBoxEl: HTMLDivElement | null = null
let legendResizeEl: HTMLDivElement | null = null
// Which corner of the legend box the resize handle currently sits at — tracks the caddy-corner
// from whichever print-area corner the legend is snapped to. 'br' when floating freely.
let legendResizeCorner: 'br' | 'bl' | 'tl' | 'tr' = 'br'

// ── State ─────────────────────────────────────────────────────────────────────

let isMounted = false
let localRect: RectState | null = null
let localCorners: L.LatLng[] = []
let lastEmittedCorners: [number, number][] = []
let isZooming = false
let zoomObserver: MutationObserver | null = null

function cornersMatch(a: [number, number][], b: [number, number][]): boolean {
  if (a.length !== b.length) return false
  return a.every((p, i) => Math.abs(p[0]! - b[i]![0]!) < 1e-8 && Math.abs(p[1]! - b[i]![1]!) < 1e-8)
}

function currentPixelDims(): { halfW: number; halfH: number } {
  if (!localRect || localCorners.length !== 4) return { halfW: 0, halfH: 0 }
  const cp = props.map.latLngToContainerPoint(localRect.center)
  const p0 = props.map.latLngToContainerPoint(localCorners[0]!)
  const l = screenToLocal(p0, cp.x, cp.y, localRect.angle)
  return { halfW: Math.abs(l.x), halfH: Math.abs(l.y) }
}

// ── Pointer drag helpers ───────────────────────────────────────────────────────

type PointerMoveHandler = (ev: PointerEvent) => void

function startCapture(el: HTMLElement, pointerId: number, onMove: PointerMoveHandler, onUp: () => void) {
  el.setPointerCapture(pointerId)
  const handleMove = (e: PointerEvent) => {
    if (e.pointerId === pointerId) onMove(e)
  }
  const handleUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    el.removeEventListener('pointermove', handleMove as EventListener)
    el.removeEventListener('pointerup', handleUp as EventListener)
    el.removeEventListener('pointercancel', handleUp as EventListener)
    onUp()
  }
  el.addEventListener('pointermove', handleMove as EventListener)
  el.addEventListener('pointerup', handleUp as EventListener)
  el.addEventListener('pointercancel', handleUp as EventListener)
}

function stopEventPropagation(e: Event) {
  e.stopPropagation()
}

// ── Build DOM ─────────────────────────────────────────────────────────────────

function buildHandles() {
  // Render inside a custom Leaflet pane below the overlay pane (z-index 350: below routes at 400,
  // captions at 430, markers at 600, and popups at 700) so pins/routes/captions remain clickable
  // even when they overlap the print area. Children are positioned with latLngToLayerPoint (see
  // updateHandlePositions), the same approach RouteLayer uses. An external div at any z-index
  // would lose to popups, which are trapped inside the map pane's transformed stacking context.
  const pane = props.map.getPane('mfPrintPane') ?? props.map.createPane('mfPrintPane')
  pane.style.zIndex = '350'

  handleLayer = document.createElement('div')
  // The pane sits at the map-pane origin (0,0 in layer coords); children carry layer-point lefts/tops.
  handleLayer.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;'
  handleLayer.classList.add('no-print')
  pane.appendChild(handleLayer)

  rectEl = document.createElement('div')
  rectEl.style.cssText = 'position:absolute;display:none;box-sizing:border-box;border:2px dashed #0d9488;background:rgba(13,148,136,0.06);pointer-events:auto;cursor:move;touch-action:none;'
  rectEl.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      if (e.button !== 0) return // let right/middle button reach the contextmenu handler
      e.preventDefault()
      e.stopPropagation()
      onBodyDown(e)
    },
    { passive: false }
  )
  rectEl.addEventListener('contextmenu', onContextMenu, { passive: false })
  // The pointerdown above stops Leaflet's drag, but the native click/dblclick that follow are
  // separate events that still bubble to the map container — firing map.click (handleMapClick),
  // which would deselect the area right after a move or re-select. Swallow them here.
  rectEl.addEventListener('click', stopEventPropagation)
  rectEl.addEventListener('dblclick', stopEventPropagation)
  rectEl.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      props.map.getContainer().dispatchEvent(new WheelEvent('wheel', e))
    },
    { passive: true }
  )

  // Outline hit-strips — interactive only while the area is locked (opaque), where the
  // body passes pointer events through to the map. They keep left/right click working on
  // the border. Children of rectEl so they inherit its position, size, and rotation.
  const EDGE_STYLES = [`left:${-EDGE_HIT / 2}px;right:${-EDGE_HIT / 2}px;top:${-EDGE_HIT / 2}px;height:${EDGE_HIT}px;`, `left:${-EDGE_HIT / 2}px;right:${-EDGE_HIT / 2}px;bottom:${-EDGE_HIT / 2}px;height:${EDGE_HIT}px;`, `top:${-EDGE_HIT / 2}px;bottom:${-EDGE_HIT / 2}px;left:${-EDGE_HIT / 2}px;width:${EDGE_HIT}px;`, `top:${-EDGE_HIT / 2}px;bottom:${-EDGE_HIT / 2}px;right:${-EDGE_HIT / 2}px;width:${EDGE_HIT}px;`]
  for (const edgeStyle of EDGE_STYLES) {
    const el = document.createElement('div')
    el.style.cssText = `position:absolute;${edgeStyle}pointer-events:none;cursor:pointer;`
    // Use click (not pointerdown+capture) so a drag starting on the border passes through to
    // Leaflet for panning. A real drag never fires click; a tap fires click → select.
    el.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation() // prevent map click from clearing the selection
      emit('select', isAdditiveEvent(e))
    })
    el.addEventListener('contextmenu', onContextMenu, { passive: false })
    el.addEventListener('dblclick', stopEventPropagation)
    rectEl.appendChild(el)
    edgeEls.push(el)
  }

  // Legend footprint preview — sized to the PDF info box, placed in the overlay corner.
  // A child of rectEl so it inherits the print area's rotation, position, and scale.
  // Draggable to reposition; resize handle in bottom-right corner to scale.
  legendBoxEl = document.createElement('div')
  legendBoxEl.className = 'print-legend-footprint'
  legendBoxEl.style.cssText = 'position:absolute;display:none;box-sizing:border-box;pointer-events:none;overflow:visible;'
  legendBoxEl.addEventListener('pointerdown', onLegendBoxDown, { passive: false })
  legendBoxEl.addEventListener('dblclick', onLegendDblClick)

  legendResizeEl = document.createElement('div')
  legendResizeEl.style.cssText = 'position:absolute;right:-5px;bottom:-5px;width:10px;height:10px;display:none;background:#0d9488;border:2px solid white;border-radius:2px;cursor:se-resize;touch-action:none;box-shadow:0 1px 3px rgba(0,0,0,.4);'
  legendResizeEl.addEventListener('pointerdown', onLegendResizeDown, { passive: false })
  legendResizeEl.addEventListener('click', stopEventPropagation)
  legendBoxEl.appendChild(legendResizeEl)

  rectEl.appendChild(legendBoxEl)

  handleLayer.appendChild(rectEl)

  rotateLineEl = document.createElement('div')
  rotateLineEl.style.cssText = 'position:absolute;display:none;height:1px;background:rgba(13,148,136,0.55);transform-origin:0 50%;pointer-events:none;'
  handleLayer.appendChild(rotateLineEl)

  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div')
    el.style.cssText = `position:absolute;display:none;width:12px;height:12px;transform:translate(-50%,-50%);background:#0d9488;border:2px solid white;border-radius:3px;cursor:${CORNER_CURSORS[i]};box-shadow:0 1px 4px rgba(0,0,0,.45);pointer-events:auto;user-select:none;touch-action:none;`
    const ci = i
    el.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        e.preventDefault()
        e.stopPropagation()
        startCornerDrag(el, ci, e)
      },
      { passive: false }
    )
    el.addEventListener('click', stopEventPropagation)
    el.addEventListener('dblclick', stopEventPropagation)
    handleLayer.appendChild(el)
    cornerEls.push(el)
  }

  rotateEl = document.createElement('div')
  rotateEl.style.cssText = 'position:absolute;display:none;width:16px;height:16px;transform:translate(-50%,-50%);background:#0d9488;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.45);pointer-events:auto;user-select:none;touch-action:none;'
  rotateEl.style.cursor = ROTATE_CURSOR
  rotateEl.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      startRotateDrag(rotateEl!, e)
    },
    { passive: false }
  )
  rotateEl.addEventListener('click', stopEventPropagation)
  rotateEl.addEventListener('dblclick', stopEventPropagation)
  handleLayer.appendChild(rotateEl)
}

function destroyHandles() {
  setDragCursor(null)
  handleLayer?.remove()
  handleLayer = null
  rectEl = null
  rotateLineEl = null
  cornerEls = []
  edgeEls = []
  rotateEl = null
  legendBoxEl = null
  legendResizeEl = null
  legendResizeCorner = 'br'
}

function updateLegendBox() {
  if (!legendBoxEl) return
  const box = props.legendBox
  // legendCorner (explicitly pinned by user) overrides the auto-detected overlayCorner.
  const c = props.legendCorner ?? props.overlayCorner
  const v = props.visibility ?? 'visible'
  if (!box || c === undefined || !localRect || v === 'hidden') {
    legendBoxEl.style.display = 'none'
    if (legendResizeEl) legendResizeEl.style.display = 'none'
    return
  }
  // All legend dimensions are fractions of the print area's WIDTH (see legendBoxFractions).
  const { halfW, halfH } = currentPixelDims()
  const rectW = halfW * 2
  const rectH = halfH * 2
  const boxW = box.wFrac * rectW
  const boxH = box.hFrac * rectW // hFrac is also fraction of WIDTH
  // S scales content relative to the legend box size, not the full print area.
  // 190 = base PDF legend width (pt) from legendBoxFractions; at scale=1, S = rectW/612.
  const S = boxW / 190

  legendBoxEl.style.width = boxW + 'px'
  legendBoxEl.style.height = boxH + 'px'
  legendBoxEl.style.borderRadius = 8 * S + 'px'

  const lx = props.legendX
  const ly = props.legendY
  if (lx !== null && lx !== undefined && ly !== null && ly !== undefined) {
    legendBoxEl.style.left = lx * rectW + 'px'
    legendBoxEl.style.top = ly * rectH + 'px'
    legendBoxEl.style.right = ''
    legendBoxEl.style.bottom = ''
  } else {
    // Corner mode (pinned or auto): anchor the legend to the corner via right/bottom CSS so the
    // box grows inward when its height changes — no drift regardless of content or orientation.
    const m = box.mFrac * rectW
    const isRight = c === 1 || c === 2
    const isBottom = c === 2 || c === 3
    legendBoxEl.style.left = isRight ? '' : m + 'px'
    legendBoxEl.style.right = isRight ? m + 'px' : ''
    legendBoxEl.style.top = isBottom ? '' : m + 'px'
    legendBoxEl.style.bottom = isBottom ? m + 'px' : ''
  }

  rebuildLegendPreview(legendBoxEl!, legendResizeEl, props.legendSettings, S)

  const interactive = v === 'visible'
  legendBoxEl.style.pointerEvents = interactive ? 'auto' : 'none'
  legendBoxEl.style.cursor = interactive ? 'move' : 'default'
  legendBoxEl.style.display = 'block'

  if (legendResizeEl) {
    legendResizeEl.style.display = interactive ? 'block' : 'none'
    if (interactive) {
      // Detect which print-area corner the legend is snapped to, then put the resize handle
      // at the caddy-corner (interior of the print area) so it never overlaps the snap zone.
      const m = box.mFrac * rectW
      let snappedCorner: 0 | 1 | 2 | 3 | null = null
      if (lx === null || lx === undefined || ly === null || ly === undefined) {
        // Corner mode — c is the active corner.
        snappedCorner = c as 0 | 1 | 2 | 3
      } else {
        const curL = lx * rectW,
          curT = ly * rectH
        const tol = 2
        const checks: [number, number, 0 | 1 | 2 | 3][] = [
          [m, m, 0],
          [rectW - boxW - m, m, 1],
          [rectW - boxW - m, rectH - boxH - m, 2],
          [m, rectH - boxH - m, 3]
        ]
        for (const [sl, st, ci] of checks) {
          if (Math.abs(curL - sl) < tol && Math.abs(curT - st) < tol) {
            snappedCorner = ci
            break
          }
        }
      }
      // Caddy-corners: TL→BR, TR→BL, BR→TL, BL→TR, null→BR
      const HANDLE: ('br' | 'bl' | 'tl' | 'tr')[] = ['br', 'bl', 'tl', 'tr']
      const CURSORS = { br: 'se-resize', bl: 'sw-resize', tl: 'nw-resize', tr: 'ne-resize' }
      legendResizeCorner = snappedCorner !== null ? HANDLE[snappedCorner]! : 'br'
      legendResizeEl.style.right = legendResizeCorner === 'br' || legendResizeCorner === 'tr' ? '-5px' : ''
      legendResizeEl.style.left = legendResizeCorner === 'bl' || legendResizeCorner === 'tl' ? '-5px' : ''
      legendResizeEl.style.bottom = legendResizeCorner === 'br' || legendResizeCorner === 'bl' ? '-5px' : ''
      legendResizeEl.style.top = legendResizeCorner === 'tl' || legendResizeCorner === 'tr' ? '-5px' : ''
      legendResizeEl.style.cursor = CURSORS[legendResizeCorner]
    }
  }
}

// ── Legend drag / resize ──────────────────────────────────────────────────────

function legendCurrentPixelPos(): { left: number; top: number; boxW: number; boxH: number; rectW: number; rectH: number } | null {
  const box = props.legendBox
  if (!box || !localRect) return null
  const { halfW, halfH } = currentPixelDims()
  const rectW = halfW * 2
  const rectH = halfH * 2
  const boxW = box.wFrac * rectW
  const boxH = box.hFrac * rectW
  const lx = props.legendX
  const ly = props.legendY
  let left: number, top: number
  if (lx !== null && lx !== undefined && ly !== null && ly !== undefined) {
    left = lx * rectW
    top = ly * rectH
  } else {
    const m = box.mFrac * rectW
    const c = props.legendCorner ?? props.overlayCorner ?? 2
    const isRight = c === 1 || c === 2
    const isBottom = c === 2 || c === 3
    left = isRight ? rectW - boxW - m : m
    top = isBottom ? rectH - boxH - m : m
  }
  return { left, top, boxW, boxH, rectW, rectH }
}

function onLegendBoxDown(startEvent: PointerEvent) {
  if (startEvent.button !== 0) return
  startEvent.preventDefault()
  startEvent.stopPropagation()
  if (!legendBoxEl || !localRect) return

  const state = legendCurrentPixelPos()
  if (!state) return
  const { left: startLeft, top: startTop, boxW, boxH, rectW, rectH } = state
  const box = props.legendBox!
  const m = box.mFrac * rectW
  // Positions of the four corner snap targets (top-left of legend box in local rect coords).
  const snapCorners = [
    { left: m, top: m }, // TL
    { left: rectW - boxW - m, top: m }, // TR
    { left: rectW - boxW - m, top: rectH - boxH - m }, // BR
    { left: m, top: rectH - boxH - m } // BL
  ]
  const snapThreshold = Math.min(rectW, rectH) * 0.12
  const angle = localRect.angle
  const startClientX = startEvent.clientX
  const startClientY = startEvent.clientY
  let moved = false

  // Switch to explicit left/top positioning immediately so CSS right/bottom doesn't fight us.
  legendBoxEl.style.left = startLeft + 'px'
  legendBoxEl.style.top = startTop + 'px'
  legendBoxEl.style.right = ''
  legendBoxEl.style.bottom = ''

  startCapture(
    legendBoxEl,
    startEvent.pointerId,
    (ev) => {
      if (!moved && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) <= CLICK_SLOP) return
      if (!moved) emit('drag-start', 'move legend')
      moved = true
      ev.stopPropagation()
      // Convert screen delta → rect-local delta (unrotate by print area angle).
      const cosA = Math.cos(angle),
        sinA = Math.sin(angle)
      const dxS = ev.clientX - startClientX,
        dyS = ev.clientY - startClientY
      const localDx = dxS * cosA + dyS * sinA
      const localDy = -dxS * sinA + dyS * cosA
      let newLeft = Math.max(0, Math.min(rectW - boxW, startLeft + localDx))
      let newTop = Math.max(0, Math.min(rectH - boxH, startTop + localDy))
      // Snap to corners — same inversion as rotation snap (Shift toggles snap while dragging).
      const shiftHeld = ev.pointerType !== 'touch' && ev.shiftKey
      if (props.snapEnabled !== shiftHeld) {
        for (const sc of snapCorners) {
          if (Math.hypot(newLeft - sc.left, newTop - sc.top) < snapThreshold) {
            newLeft = sc.left
            newTop = sc.top
            break
          }
        }
      }
      legendBoxEl!.style.left = newLeft + 'px'
      legendBoxEl!.style.top = newTop + 'px'
      emit('legend-move', newLeft / rectW, newTop / rectH)
    },
    () => {
      if (!moved) return
      const finalLeft = parseFloat(legendBoxEl!.style.left)
      const finalTop = parseFloat(legendBoxEl!.style.top)
      // If the final position is exactly at a corner snap, store the corner index rather than
      // explicit fractions — this keeps the legend anchored to the corner when content changes.
      const snappedIdx = snapCorners.findIndex((sc) => Math.abs(finalLeft - sc.left) < 2 && Math.abs(finalTop - sc.top) < 2)
      if (snappedIdx !== -1) {
        emit('legend-corner', snappedIdx as 0 | 1 | 2 | 3)
      } else {
        emit('legend-move', finalLeft / rectW, finalTop / rectH)
      }
    }
  )
}

function onLegendResizeDown(startEvent: PointerEvent) {
  if (startEvent.button !== 0) return
  startEvent.preventDefault()
  startEvent.stopPropagation()
  if (!legendResizeEl || !localRect) return
  emit('drag-start', 'resize legend')

  const box = props.legendBox
  if (!box) return
  const state = legendCurrentPixelPos()
  if (!state) return
  const { left: startLeft, top: startTop, boxW: startBoxW, boxH: startBoxH, rectW, rectH } = state
  const startRight = startLeft + startBoxW
  const startBottom = startTop + startBoxH
  const hwRatio = startBoxH / startBoxW
  const mStart = box.mFrac * rectW

  // Capture the handle corner now — reactive updates to legendResizeCorner (triggered by
  // updateLegendBox on each emit) must not flip the anchor mid-drag.
  const capturedCorner = legendResizeCorner

  // Detect whether the legend is snapped to a print-area corner at drag start.
  // For snapped resizes, we re-derive the exact corner position at each new scale so that
  // snap detection in updateLegendBox stays valid — preventing legendResizeCorner from flipping.
  let snappedAtStart: 0 | 1 | 2 | 3 | null = null
  const lx0 = props.legendX,
    ly0 = props.legendY
  if (lx0 === null || lx0 === undefined || ly0 === null || ly0 === undefined) {
    snappedAtStart = (props.legendCorner ?? props.overlayCorner ?? 0) as 0 | 1 | 2 | 3
  } else {
    const curL = lx0 * rectW,
      curT = ly0 * rectH
    const snapChecks: [number, number, 0 | 1 | 2 | 3][] = [
      [mStart, mStart, 0],
      [rectW - startBoxW - mStart, mStart, 1],
      [rectW - startBoxW - mStart, rectH - startBoxH - mStart, 2],
      [mStart, rectH - startBoxH - mStart, 3]
    ]
    for (const [sl, st, ci] of snapChecks) {
      if (Math.abs(curL - sl) < 4 && Math.abs(curT - st) < 4) {
        snappedAtStart = ci
        break
      }
    }
  }

  const angle = localRect.angle
  const startClientX = startEvent.clientX
  const startClientY = startEvent.clientY
  const resizeSign = capturedCorner === 'bl' || capturedCorner === 'tl' ? -1 : 1
  const CURSORS = { br: 'se-resize', bl: 'sw-resize', tl: 'nw-resize', tr: 'ne-resize' }
  setDragCursor(CURSORS[capturedCorner])

  startCapture(
    legendResizeEl,
    startEvent.pointerId,
    (ev) => {
      ev.stopPropagation()
      const cosA = Math.cos(angle),
        sinA = Math.sin(angle)
      const dxS = ev.clientX - startClientX,
        dyS = ev.clientY - startClientY
      const localDx = dxS * cosA + dyS * sinA
      const newBoxW = Math.max(30, startBoxW + resizeSign * localDx)
      const newScale = Math.max(0.25, Math.min(2, (newBoxW / rectW) * (612 / 190)))
      const clampedW = newScale * rectW * (190 / 612)
      const clampedH = clampedW * hwRatio
      // mFrac = (16/612) × legendScale, so margin scales proportionally with the box width.
      // newM = mStart × (newScale/startScale) = mStart × (clampedW/startBoxW).
      const newM = mStart * (clampedW / startBoxW)

      let newLeft: number, newTop: number
      if (snappedAtStart !== null) {
        // Snapped resize: re-compute the exact corner position for the new scale so that
        // snap detection continues to pass on every pointermove (mFrac changes with scale,
        // so anchoring to the start pixel edge would drift out of snap tolerance).
        if (capturedCorner === 'tl') {
          newLeft = rectW - clampedW - newM
          newTop = rectH - clampedH - newM
        } else if (capturedCorner === 'tr') {
          newLeft = newM
          newTop = rectH - clampedH - newM
        } else if (capturedCorner === 'bl') {
          newLeft = rectW - clampedW - newM
          newTop = newM
        } else {
          newLeft = newM
          newTop = newM
        } // br → TL corner
      } else {
        // Free-floating: keep the anchor corner of the legend box at its start pixel position.
        if (capturedCorner === 'tl') {
          newLeft = startRight - clampedW
          newTop = startBottom - clampedH
        } else if (capturedCorner === 'tr') {
          newLeft = startLeft
          newTop = startBottom - clampedH
        } else if (capturedCorner === 'bl') {
          newLeft = startRight - clampedW
          newTop = startTop
        } else {
          newLeft = startLeft
          newTop = startTop
        }
      }
      newLeft = Math.max(0, Math.min(rectW - clampedW, newLeft))
      newTop = Math.max(0, Math.min(rectH - clampedH, newTop))
      emit('legend-scale', newScale)
      emit('legend-move', newLeft / rectW, newTop / rectH)
    },
    () => {
      setDragCursor(null)
      // If the resize started while the legend was snapped to a corner, emit legend-corner so the
      // stored state is a corner index (not explicit fracs) — keeps the corner flush after future
      // content changes.
      if (snappedAtStart !== null) emit('legend-corner', snappedAtStart)
    }
  )
}

function onLegendDblClick(e: MouseEvent) {
  e.stopPropagation()
  emit('legend-reset')
}

function updateGridLines() {
  if (!rectEl) return
  // Remove old grid lines
  rectEl.querySelectorAll('.grid-line').forEach((el) => el.remove())
  const cols = props.gridCols ?? 1
  const rows = props.gridRows ?? 1
  if (cols <= 1 && rows <= 1) return
  const lineStyle = 'position:absolute;pointer-events:none;background:rgba(13,148,136,0.5);'
  for (let i = 1; i < cols; i++) {
    const el = document.createElement('div')
    el.className = 'grid-line'
    el.style.cssText = lineStyle + `top:0;bottom:0;left:${(i / cols) * 100}%;width:1px;`
    rectEl.appendChild(el)
  }
  for (let j = 1; j < rows; j++) {
    const el = document.createElement('div')
    el.className = 'grid-line'
    el.style.cssText = lineStyle + `left:0;right:0;top:${(j / rows) * 100}%;height:1px;`
    rectEl.appendChild(el)
  }
}

// ── Update positions ──────────────────────────────────────────────────────────

function updateHandlePositions() {
  if (!localRect || localCorners.length !== 4) {
    if (rectEl) rectEl.style.display = 'none'
    if (rotateLineEl) rotateLineEl.style.display = 'none'
    cornerEls.forEach((el) => {
      el.style.display = 'none'
    })
    if (rotateEl) rotateEl.style.display = 'none'
    return
  }

  const map = props.map
  const angle = localRect.angle
  const { halfW, halfH } = currentPixelDims()
  // Layer points (not container points): the handles live in a Leaflet pane that rides the map
  // pane's transform, so positions are relative to the map-pane origin, like RouteLayer.
  const cp = map.latLngToLayerPoint(localRect.center)
  const cx = cp.x,
    cy = cp.y

  if (rectEl) {
    rectEl.style.left = cx - halfW + 'px'
    rectEl.style.top = cy - halfH + 'px'
    rectEl.style.width = halfW * 2 + 'px'
    rectEl.style.height = halfH * 2 + 'px'
    rectEl.style.transform = `rotate(${angle}rad)`
    rectEl.style.display = 'block'
  }

  const cPx = localCorners.map((ll) => map.latLngToLayerPoint(ll))
  cornerEls.forEach((el, i) => {
    el.style.left = cPx[i]!.x + 'px'
    el.style.top = cPx[i]!.y + 'px'
    el.style.display = 'block'
  })

  const sinA = Math.sin(angle),
    cosA = Math.cos(angle)
  const tmX = (cPx[0]!.x + cPx[1]!.x) / 2
  const tmY = (cPx[0]!.y + cPx[1]!.y) / 2
  const rotX = tmX + ROTATE_OFFSET * sinA
  const rotY = tmY - ROTATE_OFFSET * cosA

  if (rotateLineEl) {
    const len = Math.sqrt((rotX - tmX) ** 2 + (rotY - tmY) ** 2)
    const stemAngle = Math.atan2(rotY - tmY, rotX - tmX)
    rotateLineEl.style.left = tmX + 'px'
    rotateLineEl.style.top = tmY + 'px'
    rotateLineEl.style.width = len + 'px'
    rotateLineEl.style.transform = `rotate(${stemAngle}rad)`
    rotateLineEl.style.display = 'block'
  }

  if (rotateEl) {
    rotateEl.style.left = rotX + 'px'
    rotateEl.style.top = rotY + 'px'
    rotateEl.style.display = 'block'
  }

  // Apply visibility overrides
  const v = props.visibility ?? 'visible'
  if (v === 'hidden') {
    if (rectEl) rectEl.style.display = 'none'
    if (rotateLineEl) rotateLineEl.style.display = 'none'
    cornerEls.forEach((el) => {
      el.style.display = 'none'
    })
    edgeEls.forEach((el) => {
      el.style.pointerEvents = 'none'
    })
    if (rotateEl) rotateEl.style.display = 'none'
  } else if (v === 'opaque') {
    // Locked: the body passes events through to the map; only the outline strips stay live so
    // left/right click still hits the border. No resize/rotate handles.
    if (rectEl) {
      rectEl.style.border = '1px dashed rgba(13,148,136,0.9)'
      rectEl.style.background = 'transparent'
      rectEl.style.pointerEvents = 'none'
      rectEl.style.cursor = 'default'
    }
    if (rotateLineEl) rotateLineEl.style.display = 'none'
    cornerEls.forEach((el) => {
      el.style.display = 'none'
    })
    edgeEls.forEach((el) => {
      el.style.pointerEvents = 'auto'
    })
    if (rotateEl) rotateEl.style.display = 'none'
  } else {
    // Unlocked (adjusting): the body is interactive — drag it to move, click to (re)select,
    // resize via the corner handles, rotate via the rotate handle. Hold Alt to pass clicks
    // through to pins/routes underneath (setHandlePassthrough). The outline strips are a
    // locked-mode affordance only, so disable them here and let the body own the whole area.
    if (rectEl) {
      rectEl.style.border = '2px dashed #0d9488'
      rectEl.style.background = 'rgba(13,148,136,0.06)'
      rectEl.style.pointerEvents = 'auto'
      rectEl.style.cursor = 'move'
    }
    edgeEls.forEach((el) => {
      el.style.pointerEvents = 'none'
    })
  }

  // Selection ring — shown in both visible and locked modes so a selected area always reads.
  if (rectEl) rectEl.style.boxShadow = props.selected ? '0 0 0 2px #0d9488, 0 0 10px rgba(13,148,136,0.45)' : 'none'

  updateLegendBox()
}

// ── Apply state ───────────────────────────────────────────────────────────────

function applyRect(state: RectState) {
  localRect = state
  const map = props.map
  const cp = map.latLngToContainerPoint(state.center)
  const { halfW, halfH, angle } = state

  localCorners = cornerOffsets(halfW, halfH).map(([lx, ly]) => map.containerPointToLatLng(localToScreen(lx, ly, cp.x, cp.y, angle)))

  updateHandlePositions()
}

function clearAll() {
  localRect = null
  localCorners = []
  lastEmittedCorners = []
  updateHandlePositions()
}

// ── Corner drag ───────────────────────────────────────────────────────────────

function startCornerDrag(el: HTMLElement, i: number, startEvent: PointerEvent) {
  if (!localRect || !props.aspectRatio) return
  emit('drag-start', 'resize print')
  const map = props.map
  const fixedPt = map.latLngToContainerPoint(localCorners[(i + 2) % 4]!)
  const angle = localRect.angle
  const ratio = props.aspectRatio
  map.dragging.disable()
  setDragCursor(CORNER_CURSORS[i]!)

  startCapture(
    el,
    startEvent.pointerId,
    (ev) => {
      if (ev.pointerType === 'touch') ev.preventDefault()
      const r = map.getContainer().getBoundingClientRect()
      const dragPt = L.point(ev.clientX - r.left, ev.clientY - r.top)
      const { x: lx, y: ly } = screenToLocal(dragPt, fixedPt.x, fixedPt.y, angle)
      let halfW: number, halfH: number
      if (Math.abs(lx) / ratio >= Math.abs(ly)) {
        halfW = Math.abs(lx) / 2
        halfH = halfW / ratio
      } else {
        halfH = Math.abs(ly) / 2
        halfW = halfH * ratio
      }
      const cosA = Math.cos(angle),
        sinA = Math.sin(angle)
      const nlx = (lx >= 0 ? 1 : -1) * halfW * 2
      const nly = (ly >= 0 ? 1 : -1) * halfH * 2
      const newDrag = L.point(fixedPt.x + nlx * cosA - nly * sinA, fixedPt.y + nlx * sinA + nly * cosA)
      applyRect({
        center: map.containerPointToLatLng(L.point((fixedPt.x + newDrag.x) / 2, (fixedPt.y + newDrag.y) / 2)),
        halfW,
        halfH,
        angle
      })
    },
    () => {
      map.dragging.enable()
      setDragCursor(null)
      emitBounds()
    }
  )
}

// ── Rotation drag ─────────────────────────────────────────────────────────────

function startRotateDrag(el: HTMLElement, startEvent: PointerEvent) {
  if (!localRect) return
  emit('drag-start', 'rotate print')
  const map = props.map
  const centerLatLng = localRect.center
  const { halfW, halfH } = currentPixelDims()
  map.dragging.disable()
  setDragCursor(ROTATE_CURSOR)

  startCapture(
    el,
    startEvent.pointerId,
    (ev) => {
      if (ev.pointerType === 'touch') ev.preventDefault()
      const r = map.getContainer().getBoundingClientRect()
      const dp = L.point(ev.clientX - r.left, ev.clientY - r.top)
      const cp = map.latLngToContainerPoint(centerLatLng)
      let angle = Math.atan2(dp.x - cp.x, -(dp.y - cp.y))
      const shiftHeld = ev.pointerType !== 'touch' && ev.shiftKey
      const snap = props.snapEnabled !== shiftHeld
      if (snap) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12)
      applyRect({ center: centerLatLng, halfW, halfH, angle })
    },
    () => {
      map.dragging.enable()
      setDragCursor(null)
      emitBounds()
    }
  )
}

// ── Body drag ─────────────────────────────────────────────────────────────────

function onBodyDown(startEvent: PointerEvent) {
  if (!localRect) return
  const map = props.map
  const r = map.getContainer().getBoundingClientRect()
  const startMouseLatLng = map.containerPointToLatLng(L.point(startEvent.clientX - r.left, startEvent.clientY - r.top))
  const startCenter = localRect.center
  const { halfW, halfH } = currentPixelDims()
  const angle = localRect.angle
  const startX = startEvent.clientX
  const startY = startEvent.clientY
  const shiftHeld = isAdditiveEvent(startEvent)
  let moved = false
  map.dragging.disable()
  if (startEvent.pointerType !== 'touch') map.getContainer().style.cursor = 'move'

  startCapture(
    rectEl!,
    startEvent.pointerId,
    (ev) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) <= CLICK_SLOP) return
      if (!moved) emit('drag-start', 'move print')
      moved = true
      if (ev.pointerType === 'touch') ev.preventDefault()
      const r2 = map.getContainer().getBoundingClientRect()
      const ll = map.containerPointToLatLng(L.point(ev.clientX - r2.left, ev.clientY - r2.top))
      applyRect({
        center: L.latLng(startCenter.lat + ll.lat - startMouseLatLng.lat, startCenter.lng + ll.lng - startMouseLatLng.lng),
        halfW,
        halfH,
        angle
      })
    },
    () => {
      map.dragging.enable()
      if (startEvent.pointerType !== 'touch') map.getContainer().style.cursor = ''
      // A press with no real movement is a click → select; an actual drag → commit the move.
      if (moved) emitBounds()
      else emit('select', shiftHeld)
    }
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  emitContext(e)
}

function emitContext(e: { clientX: number; clientY: number }) {
  emit('context', e.clientX, e.clientY)
}

// ── Emit ──────────────────────────────────────────────────────────────────────

function emitBounds() {
  if (isMounted && localCorners.length === 4 && localRect) {
    const bounds = L.latLngBounds(localCorners)
    const corners = localCorners.map((ll) => [ll.lat, ll.lng] as [number, number])
    lastEmittedCorners = corners
    emit('bounds-set', { bounds, corners, angle: localRect.angle })
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

watch(() => props.visibility, updateHandlePositions)
watch(() => props.selected, updateHandlePositions)

watch(
  () => [props.corners, props.angle] as const,
  ([corners, angle]) => {
    if (!isMounted) return
    if (corners.length === 4) {
      if (!cornersMatch(corners, lastEmittedCorners)) initFromCorners(corners, angle)
    } else {
      clearAll()
    }
  },
  { deep: true }
)

watch(
  () => [props.gridCols, props.gridRows],
  () => updateGridLines()
)
watch(
  () => props.overlayCorner,
  () => updateLegendBox()
)
watch(
  () => props.legendCorner,
  () => updateLegendBox()
)
watch(() => props.legendBox, updateLegendBox, { deep: true })
watch(() => [props.legendX, props.legendY], updateLegendBox)
watch(() => props.legendSettings, updateLegendBox, { deep: true })

function setHandlePassthrough(pass: boolean) {
  const pe = pass ? 'none' : 'auto'
  if (rectEl) rectEl.style.pointerEvents = pe
  cornerEls.forEach((el) => {
    el.style.pointerEvents = pe
  })
  if (rotateEl) rotateEl.style.pointerEvents = pe
  // Restore the per-visibility pointer-events (edge strips and rect) when Alt is released.
  if (!pass) updateHandlePositions()
}

function onAltDown(e: KeyboardEvent) {
  if (e.key === 'Alt') setHandlePassthrough(true)
}
function onAltUp(e: KeyboardEvent) {
  if (e.key === 'Alt') setHandlePassthrough(false)
}

// Fade the whole handle layer out instantly during a zoom animation and back in over 0.2s
// once it settles — mirrors the pin/route fade. The handles ride the map pane's zoom transform,
// but their pixel dimensions are computed for the pre-zoom scale; fading hides the stretched
// state until the zoom ends and updateHandlePositions recomputes at the new zoom.
function applyLayerOpacity() {
  if (!handleLayer) return
  const hidden = (props.visibility ?? 'visible') === 'hidden'
  if (hidden || isZooming) {
    handleLayer.style.transition = 'none'
    handleLayer.style.opacity = '0'
  } else {
    handleLayer.style.transition = 'opacity 0.2s ease'
    handleLayer.style.opacity = '1'
  }
}

function applyVisibility() {
  if (!handleLayer) return
  // The layer is only a positioning container; its children (rect + handles) carry their own
  // pointer-events. Keep the container itself non-interactive so it never blocks the map.
  handleLayer.style.pointerEvents = 'none'
  applyLayerOpacity()
}

watch(() => props.visibility, applyVisibility)

function initFromCorners(corners: [number, number][], angle: number) {
  if (corners.length !== 4) return
  const map = props.map
  const latCenter = (corners[0]![0] + corners[2]![0]) / 2
  const lngCenter = (corners[0]![1] + corners[2]![1]) / 2
  const center = L.latLng(latCenter, lngCenter)
  const cp = map.latLngToContainerPoint(center)
  const p0 = map.latLngToContainerPoint(L.latLng(corners[0]![0], corners[0]![1]))
  const l = screenToLocal(p0, cp.x, cp.y, angle)
  applyRect({ center, halfW: Math.abs(l.x), halfH: Math.abs(l.y), angle })
  // Record props corners as "last emitted" so the watch doesn't re-fire after this init.
  lastEmittedCorners = [...corners] as [number, number][]
}

onMounted(() => {
  isMounted = true
  buildHandles()
  updateGridLines()
  applyVisibility()
  props.map.on('move', updateHandlePositions as L.LeafletEventHandlerFn)
  props.map.on('zoom', updateHandlePositions as L.LeafletEventHandlerFn)

  // Leaflet toggles 'leaflet-zoom-anim' on the map pane around each animated zoom. Watch it the
  // same way RouteLayer does so the print area fades out/in together with the pins and routes.
  const mapPane = props.map.getPane('mapPane') as HTMLElement | undefined
  if (mapPane) {
    zoomObserver = new MutationObserver(() => {
      isZooming = mapPane.classList.contains('leaflet-zoom-anim')
      applyLayerOpacity()
    })
    zoomObserver.observe(mapPane, { attributes: true, attributeFilter: ['class'] })
  }

  if (props.corners.length === 4) initFromCorners(props.corners, props.angle)
  document.addEventListener('keydown', onAltDown)
  document.addEventListener('keyup', onAltUp)
})

onUnmounted(() => {
  isMounted = false
  zoomObserver?.disconnect()
  zoomObserver = null
  destroyHandles()
  props.map.off('move', updateHandlePositions as L.LeafletEventHandlerFn)
  props.map.off('zoom', updateHandlePositions as L.LeafletEventHandlerFn)
  document.removeEventListener('keydown', onAltDown)
  document.removeEventListener('keyup', onAltUp)
})
</script>

<template></template>
