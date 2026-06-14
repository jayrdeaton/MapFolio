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
}>()

export interface PrintAreaInfo {
  bounds: L.LatLngBounds
  corners: [number, number][] // [[lat,lng] x4] in NW→NE→SE→SW order
  angle: number // rotation in radians
}

const emit = defineEmits<{ 'bounds-set': [info: PrintAreaInfo] }>()

interface RectState {
  center: L.LatLng
  halfW: number
  halfH: number
  angle: number
}

const ROTATE_OFFSET = 28
const CORNER_CURSORS = ['nw-resize', 'ne-resize', 'se-resize', 'sw-resize']

// ── DOM elements ──────────────────────────────────────────────────────────────

let handleLayer: HTMLDivElement | null = null
let rectEl: HTMLDivElement | null = null
let rotateLineEl: HTMLDivElement | null = null
let cornerEls: HTMLDivElement[] = []
let rotateEl: HTMLDivElement | null = null
let cornerIndicatorEl: HTMLDivElement | null = null

// ── State ─────────────────────────────────────────────────────────────────────

let isMounted = false
let localRect: RectState | null = null
let localCorners: L.LatLng[] = []
let lastEmittedBounds: L.LatLngBounds | null = null

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

// ── Build DOM ─────────────────────────────────────────────────────────────────

function buildHandles() {
  const mapContainer = props.map.getContainer()
  const outerContainer = (mapContainer.closest('.map-print-container') as HTMLElement | null) ?? mapContainer

  handleLayer = document.createElement('div')
  handleLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:900;overflow:visible;'
  handleLayer.classList.add('no-print')
  outerContainer.appendChild(handleLayer)

  rectEl = document.createElement('div')
  rectEl.style.cssText = 'position:absolute;display:none;box-sizing:border-box;border:2px dashed #06b6d4;background:rgba(6,182,212,0.06);pointer-events:auto;cursor:move;touch-action:none;'
  rectEl.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onBodyDown(e)
    },
    { passive: false }
  )
  rectEl.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      props.map.getContainer().dispatchEvent(new WheelEvent('wheel', e))
    },
    { passive: true }
  )

  cornerIndicatorEl = document.createElement('div')
  cornerIndicatorEl.style.cssText = 'position:absolute;display:none;width:14px;height:14px;border-color:rgba(6,182,212,0.9);border-style:solid;pointer-events:none;'
  rectEl.appendChild(cornerIndicatorEl)

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
    handleLayer.appendChild(el)
    cornerEls.push(el)
  }

  rotateEl = document.createElement('div')
  rotateEl.style.cssText = 'position:absolute;display:none;width:16px;height:16px;transform:translate(-50%,-50%);background:#06b6d4;border:2px solid white;border-radius:50%;cursor:crosshair;box-shadow:0 1px 4px rgba(0,0,0,.45);pointer-events:auto;user-select:none;touch-action:none;'
  rotateEl.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      startRotateDrag(rotateEl!, e)
    },
    { passive: false }
  )
  handleLayer.appendChild(rotateEl)
}

function destroyHandles() {
  handleLayer?.remove()
  handleLayer = null
  rectEl = null
  rotateLineEl = null
  cornerEls = []
  rotateEl = null
  cornerIndicatorEl = null
}

function updateCornerIndicator() {
  if (!cornerIndicatorEl) return
  const c = props.overlayCorner
  if (c === undefined) {
    cornerIndicatorEl.style.display = 'none'
    return
  }
  const isRight = c === 1 || c === 2
  const isBottom = c === 2 || c === 3
  cornerIndicatorEl.style.display = 'block'
  cornerIndicatorEl.style.top = isBottom ? '' : '8px'
  cornerIndicatorEl.style.bottom = isBottom ? '8px' : ''
  cornerIndicatorEl.style.left = isRight ? '' : '8px'
  cornerIndicatorEl.style.right = isRight ? '8px' : ''
  cornerIndicatorEl.style.borderWidth = `${isBottom ? '0' : '2px'} ${isRight ? '2px' : '0'} ${isBottom ? '2px' : '0'} ${isRight ? '0' : '2px'}`
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
  const cp = map.latLngToContainerPoint(localRect.center)
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

  const cPx = localCorners.map((ll) => map.latLngToContainerPoint(ll))
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

  updateCornerIndicator()
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
  map.dragging.disable()
  if (startEvent.pointerType !== 'touch') map.getContainer().style.cursor = 'move'

  startCapture(
    rectEl!,
    startEvent.pointerId,
    (ev) => {
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
      emitBounds()
    }
  )
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
watch(() => props.overlayCorner, updateCornerIndicator)

function setHandlePassthrough(pass: boolean) {
  const pe = pass ? 'none' : 'auto'
  if (rectEl) rectEl.style.pointerEvents = pe
  cornerEls.forEach((el) => {
    el.style.pointerEvents = pe
  })
  if (rotateEl) rotateEl.style.pointerEvents = pe
}

function onAltDown(e: KeyboardEvent) {
  if (e.key === 'Alt') setHandlePassthrough(true)
}
function onAltUp(e: KeyboardEvent) {
  if (e.key === 'Alt') setHandlePassthrough(false)
}

onMounted(() => {
  isMounted = true
  buildHandles()
  updateGridLines()
  props.map.on('move', updateHandlePositions as L.LeafletEventHandlerFn)
  props.map.on('zoom', updateHandlePositions as L.LeafletEventHandlerFn)
  if (props.printBounds) initFromBounds(props.printBounds)
  document.addEventListener('keydown', onAltDown)
  document.addEventListener('keyup', onAltUp)
})

onUnmounted(() => {
  isMounted = false
  destroyHandles()
  props.map.off('move', updateHandlePositions as L.LeafletEventHandlerFn)
  props.map.off('zoom', updateHandlePositions as L.LeafletEventHandlerFn)
  document.removeEventListener('keydown', onAltDown)
  document.removeEventListener('keyup', onAltUp)
})
</script>
