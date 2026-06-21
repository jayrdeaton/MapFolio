<script setup lang="ts">
import L from 'leaflet'

import type { Caption } from '@/types'
import { CAPTION_PX } from '@/types'

const props = defineProps<{
  caption: Caption
  map: L.Map
  angleSnap: boolean
}>()

const emit = defineEmits<{
  'rotate-start': []
  rotate: [deg: number]
  'rotate-end': []
}>()

// Same custom rotate cursor as PrintAreaDrawer (circular arrow, white halo + dark glyph).
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">' + '<g stroke="white" stroke-width="4"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></g>' + '<g stroke="#1f2937" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></g>' + '</svg>')}") 12 12, grab`

// Force the rotate cursor everywhere during the drag — the pointer leaves the small handle.
let dragCursorStyle: HTMLStyleElement | null = null
function setDragCursor(on: boolean) {
  if (on) {
    if (!dragCursorStyle) {
      dragCursorStyle = document.createElement('style')
      document.head.appendChild(dragCursorStyle)
    }
    dragCursorStyle.textContent = `*{cursor:${ROTATE_CURSOR}!important}`
  } else if (dragCursorStyle) {
    dragCursorStyle.remove()
    dragCursorStyle = null
  }
}

let layer: HTMLDivElement | null = null
let stemEl: HTMLDivElement | null = null
let knobEl: HTMLDivElement | null = null

// Gap between the caption's outer edge and the rotate knob.
const HANDLE_MARGIN = 26

// The active caption always shows the selection ring, which is painted OUTSIDE the border box
// (outline-offset 2px + 2.5px outline) and so isn't counted by offsetHeight. Add it (plus a hair)
// so the stem clears the highlighted box, not just the text.
const RING_EXTENT = 5

// Rough half-height from font metrics — only a fallback for the frames before the rendered
// caption element can be measured. The measured value below is what's normally used.
function estimateHalfHeight(): number {
  const fontPx = CAPTION_PX[props.caption.size] ?? CAPTION_PX.m
  const lines = (props.caption.text || ' ').split('\n').length
  return (fontPx * 1.15 * lines) / 2 + (props.caption.background ? fontPx * 0.18 : 0)
}

// Distance from the caption center to its outer visible edge (border box + selection ring), read
// from the caption's own DOM element. offsetHeight is the border-box height (text + padding +
// border) and ignores the marker's translate/rotate, so it works at any rotation. Cached per
// (size,text,background) so reposition doesn't reflow every frame.
let cachedKey = ''
let cachedEdge = 0
function captionEdgeRadius(): number {
  const key = `${props.caption.size}|${props.caption.background}|${props.caption.text}`
  if (key === cachedKey && cachedEdge) return cachedEdge
  const el = props.map.getContainer().querySelector<HTMLElement>(`.mf-caption-inner[data-caption-id="${props.caption.id}"]`)
  const h = el?.offsetHeight ?? 0
  if (!h) return estimateHalfHeight() + RING_EXTENT // not mounted/laid out yet — retry next reposition
  cachedKey = key
  cachedEdge = h / 2 + RING_EXTENT
  return cachedEdge
}

// Distance from the caption center to the handle: clears the rendered text + ring plus a margin.
function handleOffset(): number {
  return captionEdgeRadius() + HANDLE_MARGIN
}

function positionAt(rotRad: number) {
  if (!layer || !stemEl || !knobEl) return
  const cp = props.map.latLngToContainerPoint([props.caption.lat, props.caption.lng])
  const dirX = Math.sin(rotRad)
  const dirY = -Math.cos(rotRad)
  const off = handleOffset()
  const hx = cp.x + off * dirX
  const hy = cp.y + off * dirY
  // Start the stem at the caption's outer edge (not its center) so the line stops at the
  // highlighted box and only spans the margin up to the knob, rather than running into the text.
  const edge = captionEdgeRadius()
  const sx = cp.x + edge * dirX
  const sy = cp.y + edge * dirY
  const stemAngle = Math.atan2(hy - sy, hx - sx)
  stemEl.style.left = sx + 'px'
  stemEl.style.top = sy + 'px'
  stemEl.style.width = HANDLE_MARGIN + 'px'
  stemEl.style.transform = `rotate(${stemAngle}rad)`
  knobEl.style.left = hx + 'px'
  knobEl.style.top = hy + 'px'
}

function reposition() {
  positionAt(((props.caption.rotation ?? 0) * Math.PI) / 180)
}

// During a zoom animation the marker pane is dropped to opacity 0 (no transition) and fades
// back in on zoomend — see the .leaflet-zoom-anim rules in App.vue. `zoomanim` fires only when
// the zoom is actually animated, so the handle fades in lockstep with the caption it tracks.
function onZoomAnim() {
  if (!layer) return
  layer.style.transition = 'none'
  layer.style.opacity = '0'
}
function onZoomEnd() {
  reposition()
  if (!layer) return
  layer.style.transition = 'opacity 0.2s ease'
  layer.style.opacity = '1'
}

// A caption context popup opens inside the Leaflet container, but the handle lives on the outer
// print container (a sibling), so it would otherwise paint in front of the popup. Hide it while a
// caption popup is open so the menu sits cleanly on top.
function onPopupOpen(e: L.PopupEvent) {
  if (layer && e.popup.getElement()?.querySelector('.caption-popup-edit')) layer.style.display = 'none'
}
function onPopupClose() {
  if (layer) layer.style.display = ''
}

function startDrag(startEvent: PointerEvent) {
  startEvent.preventDefault()
  startEvent.stopPropagation()
  if (!knobEl) return
  const map = props.map
  map.dragging.disable()
  setDragCursor(true)
  emit('rotate-start')
  const pointerId = startEvent.pointerId
  knobEl.setPointerCapture(pointerId)

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    if (ev.pointerType === 'touch') ev.preventDefault()
    const r = map.getContainer().getBoundingClientRect()
    const dp = L.point(ev.clientX - r.left, ev.clientY - r.top)
    const cp = map.latLngToContainerPoint([props.caption.lat, props.caption.lng])
    let angle = Math.atan2(dp.x - cp.x, -(dp.y - cp.y))
    // Snap to 15° when the angle-lock setting is on; Shift inverts it (mirrors route drawing).
    if (props.angleSnap !== ev.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12)
    positionAt(angle)
    emit('rotate', Math.round((angle * 180) / Math.PI))
  }
  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    knobEl!.removeEventListener('pointermove', onMove as EventListener)
    knobEl!.removeEventListener('pointerup', onUp as EventListener)
    knobEl!.removeEventListener('pointercancel', onUp as EventListener)
    map.dragging.enable()
    setDragCursor(false)
    emit('rotate-end')
  }
  knobEl.addEventListener('pointermove', onMove as EventListener)
  knobEl.addEventListener('pointerup', onUp as EventListener)
  knobEl.addEventListener('pointercancel', onUp as EventListener)
}

function build() {
  const mapContainer = props.map.getContainer()
  const outer = (mapContainer.closest('.map-print-container') as HTMLElement | null) ?? mapContainer

  layer = document.createElement('div')
  // transition matches the .leaflet-marker-pane fade so the handle fades in/out with the caption.
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:900;overflow:visible;transition:opacity 0.2s ease;'
  layer.classList.add('no-print')
  outer.appendChild(layer)

  stemEl = document.createElement('div')
  stemEl.style.cssText = 'position:absolute;height:1px;background:rgba(6,182,212,0.7);transform-origin:0 50%;pointer-events:none;'
  layer.appendChild(stemEl)

  knobEl = document.createElement('div')
  knobEl.style.cssText = 'position:absolute;width:16px;height:16px;transform:translate(-50%,-50%);background:#06b6d4;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.45);pointer-events:auto;user-select:none;touch-action:none;'
  knobEl.style.cursor = ROTATE_CURSOR
  knobEl.addEventListener('pointerdown', startDrag as EventListener, { passive: false })
  layer.appendChild(knobEl)

  reposition()
}

function destroy() {
  setDragCursor(false)
  layer?.remove()
  layer = null
  stemEl = null
  knobEl = null
}

onMounted(() => {
  build()
  props.map.on('move', reposition as L.LeafletEventHandlerFn)
  props.map.on('zoom', reposition as L.LeafletEventHandlerFn)
  props.map.on('zoomanim', onZoomAnim as L.LeafletEventHandlerFn)
  props.map.on('zoomend', onZoomEnd as L.LeafletEventHandlerFn)
  props.map.on('popupopen', onPopupOpen as L.LeafletEventHandlerFn)
  props.map.on('popupclose', onPopupClose as L.LeafletEventHandlerFn)
})

onUnmounted(() => {
  destroy()
  props.map.off('move', reposition as L.LeafletEventHandlerFn)
  props.map.off('zoom', reposition as L.LeafletEventHandlerFn)
  props.map.off('zoomanim', onZoomAnim as L.LeafletEventHandlerFn)
  props.map.off('zoomend', onZoomEnd as L.LeafletEventHandlerFn)
  props.map.off('popupopen', onPopupOpen as L.LeafletEventHandlerFn)
  props.map.off('popupclose', onPopupClose as L.LeafletEventHandlerFn)
})

// Reposition when the caption moves, resizes, or is rotated externally.
watch(() => [props.caption.lat, props.caption.lng, props.caption.rotation, props.caption.size, props.caption.text, props.caption.background] as const, reposition)
</script>

<template></template>
