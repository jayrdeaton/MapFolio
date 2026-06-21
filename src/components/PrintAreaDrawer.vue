<script setup lang="ts">
import L from 'leaflet'
const props = defineProps<{
  map: L.Map
  printBounds: L.LatLngBounds | null
  aspectRatio: number | null
  snapEnabled: boolean
  gridCols?: number
  gridRows?: number
  overlayCorner?: 0 | 1 | 2 | 3
  // Footprint of the PDF info box as fractions of the print area's width; null hides the preview.
  legendBox?: { wFrac: number; hFrac: number; mFrac: number } | null
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
}>()

// Distinguish a click (select) from a drag (move): movement under this many pixels on
// pointerup counts as a click.
const CLICK_SLOP = 4
// Thickness of the invisible outline hit-strips used while the area is locked.
const EDGE_HIT = 14

interface RectState {
  center: L.LatLng
  halfW: number
  halfH: number
  angle: number
}

const ROTATE_OFFSET = 28
const CORNER_CURSORS = ['nw-resize', 'ne-resize', 'se-resize', 'sw-resize']

// Custom rotation cursor — a circular arrow (dark glyph + white halo so it reads on any
// tile). CSS has no native "rotate" cursor; data-URI SVG is the only way. Hotspot centered.
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">' + '<g stroke="white" stroke-width="4"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></g>' + '<g stroke="#1f2937" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></g>' + '</svg>')}") 12 12, grab`

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

// ── State ─────────────────────────────────────────────────────────────────────

let isMounted = false
let localRect: RectState | null = null
let localCorners: L.LatLng[] = []
let lastEmittedBounds: L.LatLngBounds | null = null
let isZooming = false
let zoomObserver: MutationObserver | null = null

// ── Math ──────────────────────────────────────────────────────────────────────

function cornerOffsets(halfW: number, halfH: number): [number, number][] {
  return [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH]
  ]
}

function localToScreen(lx: number, ly: number, cx: number, cy: number, angle: number): L.Point {
  const c = Math.cos(angle),
    s = Math.sin(angle)
  return L.point(cx + lx * c - ly * s, cy + lx * s + ly * c)
}

function screenToLocal(px: L.Point, cx: number, cy: number, angle: number): { x: number; y: number } {
  const c = Math.cos(angle),
    s = Math.sin(angle)
  const dx = px.x - cx,
    dy = px.y - cy
  return { x: dx * c + dy * s, y: -dx * s + dy * c }
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
  // Render inside a custom Leaflet pane (z-index 680: above markers/tooltips, below the popup
  // pane at 700) so Leaflet popups and menus paint above the print area. Children are positioned
  // with latLngToLayerPoint (see updateHandlePositions), the same approach RouteLayer uses. An
  // external div at any z-index would lose to popups, which are trapped inside the map pane's
  // transformed (and thus self-contained) stacking context.
  const pane = props.map.getPane('mfPrintPane') ?? props.map.createPane('mfPrintPane')
  pane.style.zIndex = '680'

  handleLayer = document.createElement('div')
  // The pane sits at the map-pane origin (0,0 in layer coords); children carry layer-point lefts/tops.
  handleLayer.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;'
  handleLayer.classList.add('no-print')
  pane.appendChild(handleLayer)

  rectEl = document.createElement('div')
  rectEl.style.cssText = 'position:absolute;display:none;box-sizing:border-box;border:2px dashed #06b6d4;background:rgba(6,182,212,0.06);pointer-events:auto;cursor:move;touch-action:none;'
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
    el.style.cssText = `position:absolute;${edgeStyle}pointer-events:none;cursor:pointer;touch-action:none;`
    el.addEventListener('pointerdown', onEdgeDown, { passive: false })
    el.addEventListener('contextmenu', onContextMenu, { passive: false })
    // Same as rectEl: keep the trailing native click from bubbling to the map, where it would
    // immediately undo the select this strip just triggered (locked-mode re-select).
    el.addEventListener('click', stopEventPropagation)
    el.addEventListener('dblclick', stopEventPropagation)
    rectEl.appendChild(el)
    edgeEls.push(el)
  }

  // Legend footprint preview — sized to the PDF info box, placed in the overlay corner.
  // A child of rectEl so it inherits the print area's rotation, position, and scale.
  legendBoxEl = document.createElement('div')
  legendBoxEl.className = 'print-legend-footprint'
  legendBoxEl.style.cssText = 'position:absolute;display:none;box-sizing:border-box;pointer-events:none;overflow:hidden;align-items:center;justify-content:center;'
  const legendBoxLabel = document.createElement('span')
  legendBoxLabel.className = 'print-legend-footprint-label'
  legendBoxLabel.textContent = 'Legend'
  legendBoxEl.appendChild(legendBoxLabel)
  rectEl.appendChild(legendBoxEl)

  handleLayer.appendChild(rectEl)

  rotateLineEl = document.createElement('div')
  rotateLineEl.style.cssText = 'position:absolute;display:none;height:1px;background:rgba(6,182,212,0.55);transform-origin:0 50%;pointer-events:none;'
  handleLayer.appendChild(rotateLineEl)

  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div')
    el.style.cssText = `position:absolute;display:none;width:12px;height:12px;transform:translate(-50%,-50%);background:#06b6d4;border:2px solid white;border-radius:3px;cursor:${CORNER_CURSORS[i]};box-shadow:0 1px 4px rgba(0,0,0,.45);pointer-events:auto;user-select:none;touch-action:none;`
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
  rotateEl.style.cssText = 'position:absolute;display:none;width:16px;height:16px;transform:translate(-50%,-50%);background:#06b6d4;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.45);pointer-events:auto;user-select:none;touch-action:none;'
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
}

function updateLegendBox() {
  if (!legendBoxEl) return
  const box = props.legendBox
  const c = props.overlayCorner
  if (!box || c === undefined || !localRect || (props.visibility ?? 'visible') === 'hidden') {
    legendBoxEl.style.display = 'none'
    return
  }
  // Legend dimensions are all fractions of the print area's WIDTH (see legendBoxFractions).
  const rectW = currentPixelDims().halfW * 2
  const S = rectW / 612
  const m = box.mFrac * rectW
  const isRight = c === 1 || c === 2
  const isBottom = c === 2 || c === 3
  legendBoxEl.style.width = box.wFrac * rectW + 'px'
  legendBoxEl.style.height = box.hFrac * rectW + 'px'
  legendBoxEl.style.borderRadius = 8 * S + 'px'
  legendBoxEl.style.left = isRight ? '' : m + 'px'
  legendBoxEl.style.right = isRight ? m + 'px' : ''
  legendBoxEl.style.top = isBottom ? '' : m + 'px'
  legendBoxEl.style.bottom = isBottom ? m + 'px' : ''
  const label = legendBoxEl.firstElementChild as HTMLElement | null
  if (label) label.style.fontSize = Math.max(6, Math.round(9 * S)) + 'px'
  legendBoxEl.style.display = 'flex'
}

function updateGridLines() {
  if (!rectEl) return
  // Remove old grid lines
  rectEl.querySelectorAll('.grid-line').forEach((el) => el.remove())
  const cols = props.gridCols ?? 1
  const rows = props.gridRows ?? 1
  if (cols <= 1 && rows <= 1) return
  const lineStyle = 'position:absolute;pointer-events:none;background:rgba(6,182,212,0.5);'
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
      rectEl.style.border = '1px dashed rgba(6,182,212,0.9)'
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
      rectEl.style.border = '2px dashed #06b6d4'
      rectEl.style.background = 'rgba(6,182,212,0.06)'
      rectEl.style.pointerEvents = 'auto'
      rectEl.style.cursor = 'move'
    }
    edgeEls.forEach((el) => {
      el.style.pointerEvents = 'none'
    })
  }

  // Selection ring — shown in both visible and locked modes so a selected area always reads.
  if (rectEl) rectEl.style.boxShadow = props.selected ? '0 0 0 2px #06b6d4, 0 0 10px rgba(6,182,212,0.45)' : 'none'

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
  lastEmittedBounds = null
  updateHandlePositions()
}

// ── Init ──────────────────────────────────────────────────────────────────────

function initFromBounds(bounds: L.LatLngBounds) {
  const map = props.map
  const center = bounds.getCenter()
  const nePx = map.latLngToContainerPoint(bounds.getNorthEast())
  const swPx = map.latLngToContainerPoint(bounds.getSouthWest())
  applyRect({ center, halfW: (nePx.x - swPx.x) / 2, halfH: (swPx.y - nePx.y) / 2, angle: 0 })
  emitBounds()
}

// ── Corner drag ───────────────────────────────────────────────────────────────

function startCornerDrag(el: HTMLElement, i: number, startEvent: PointerEvent) {
  if (!localRect || !props.aspectRatio) return
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
  const shiftHeld = startEvent.shiftKey
  let moved = false
  map.dragging.disable()
  if (startEvent.pointerType !== 'touch') map.getContainer().style.cursor = 'move'

  startCapture(
    rectEl!,
    startEvent.pointerId,
    (ev) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) <= CLICK_SLOP) return
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

// ── Outline hit (locked mode) + context menu ───────────────────────────────────

// Locked mode passes body events through to the map; the outline strips still select on a
// click. No move/resize is possible while locked, so this only distinguishes click from drag.
function onEdgeDown(startEvent: PointerEvent) {
  if (startEvent.button !== 0) return
  startEvent.preventDefault()
  startEvent.stopPropagation()
  const el = startEvent.currentTarget as HTMLElement
  const startX = startEvent.clientX
  const startY = startEvent.clientY
  const shiftHeld = startEvent.shiftKey
  let moved = false
  startCapture(
    el,
    startEvent.pointerId,
    (ev) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > CLICK_SLOP) moved = true
    },
    () => {
      if (!moved) emit('select', shiftHeld)
    }
  )
}

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
    lastEmittedBounds = bounds
    const corners = localCorners.map((ll) => [ll.lat, ll.lng] as [number, number])
    emit('bounds-set', { bounds, corners, angle: localRect.angle })
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

watch(() => props.visibility, updateHandlePositions)
watch(() => props.selected, updateHandlePositions)

watch(
  () => props.printBounds,
  (bounds) => {
    if (bounds && bounds === lastEmittedBounds) return
    if (bounds) initFromBounds(bounds)
    else clearAll()
  }
)

watch(
  () => [props.gridCols, props.gridRows],
  () => updateGridLines()
)
watch(
  () => props.overlayCorner,
  () => updateLegendBox()
)
watch(() => props.legendBox, updateLegendBox, { deep: true })

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
  emitBounds()
}

defineExpose({ initFromCorners })

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

  if (props.printBounds) initFromBounds(props.printBounds)
  document.addEventListener('keydown', onAltDown)
  document.addEventListener('keyup', onAltUp)
})

onUnmounted(() => {
  isMounted = false
  zoomObserver?.disconnect()
  zoomObserver = null
  destroyHandles()
  props.map.getPane('mfPrintPane')?.remove()
  props.map.off('move', updateHandlePositions as L.LeafletEventHandlerFn)
  props.map.off('zoom', updateHandlePositions as L.LeafletEventHandlerFn)
  document.removeEventListener('keydown', onAltDown)
  document.removeEventListener('keyup', onAltUp)
})
</script>

<template></template>
