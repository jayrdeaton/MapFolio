<script lang="ts">
// Module-level: shared across all PinMarker instances so pins shown in the same
// reactive flush get sequential indices (0, 1, 2, ...) regardless of their global position.
let _showBatchCount = 0
let _showBatchRafId: ReturnType<typeof requestAnimationFrame> | null = null

function nextShowIndex(): number {
  if (_showBatchRafId !== null) cancelAnimationFrame(_showBatchRafId)
  _showBatchRafId = requestAnimationFrame(() => {
    _showBatchCount = 0
    _showBatchRafId = null
  })
  return _showBatchCount++
}
</script>

<script setup lang="ts">
import L from 'leaflet'

import type { Pin, PinDotShape, PinDotSize } from '@/types'
import { isAdditiveEvent, isDarkColor } from '@/utils'

// Leaflet's internal Draggable, reached to re-anchor the drag origin on snap enter/exit.
// Not exposed by @types/leaflet, but stable across the snap re-anchoring path used below.
interface InternalDraggable {
  _startPos: L.Point
  _startPoint: L.Point
  _element: HTMLElement
}
type MarkerDragHandler = { _draggable?: InternalDraggable }
// Leaflet's 'drag' fires a plain LeafletEvent, but carries the source DOM event at runtime.
type LeafletDragEvent = L.LeafletEvent & { originalEvent?: MouseEvent | TouchEvent }

const PENCIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`
const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
const EYE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
const SCISSORS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`

// Emoji size per dot-size step. anchorY = emojiSize+15, iconH = emojiSize+19 (bubble+tip+margin).
const BUBBLE_EMOJI_SIZE: Record<PinDotSize, number> = { xs: 14, s: 16, m: 20, l: 24, xl: 30 }
const BUBBLE_GEO: Record<PinDotSize, { iconH: number; anchorY: number }> = {
  xs: { iconH: 33, anchorY: 29 },
  s: { iconH: 35, anchorY: 31 },
  m: { iconH: 39, anchorY: 35 },
  l: { iconH: 43, anchorY: 39 },
  xl: { iconH: 49, anchorY: 45 }
}
// Clear (transparent) bubble: no tip, anchor at bubble bottom (emojiSize+12 / emojiSize+8).
const BUBBLE_GEO_CLEAR: Record<PinDotSize, { iconH: number; anchorY: number }> = {
  xs: { iconH: 26, anchorY: 22 },
  s: { iconH: 28, anchorY: 24 },
  m: { iconH: 32, anchorY: 28 },
  l: { iconH: 36, anchorY: 32 },
  xl: { iconH: 42, anchorY: 38 }
}

// Dot-only geometry. anchorY extended +6px above dot, iconH +16px total
// (6 above + 10 below) to give a forgiving hit area around the small dot.
const DOT_GEO: Record<PinDotSize, { iconH: number; anchorY: number }> = {
  xs: { iconH: 24, anchorY: 10 },
  s: { iconH: 28, anchorY: 12 },
  m: { iconH: 33, anchorY: 14.5 },
  l: { iconH: 38, anchorY: 17 },
  xl: { iconH: 44, anchorY: 20 }
}

const props = defineProps<{
  pin: Pin
  map: L.Map
  layer?: L.LayerGroup // MarkerClusterGroup or any LayerGroup; falls back to map
  hidden?: boolean
  pending?: boolean
  dotSize?: PinDotSize
  locked?: boolean
  drawing?: boolean
  findSnap?: (lat: number, lng: number) => { lat: number; lng: number } | null
  pinIndex?: number
  renderIndex?: number
  selected?: boolean
  linkedToSelectedRoute?: boolean
}>()

const emit = defineEmits<{
  delete: [id: number]
  hide: [id: number]
  move: [id: number, lat: number, lng: number]
  'drag-start': [id: number]
  'drag-move': [id: number, lat: number, lng: number]
  edit: [pin: Pin]
  copy: [coords: string]
  'clip-copy': [pin: Pin]
  'clip-cut': [pin: Pin]
  'place-waypoint': [lat: number, lng: number, pinId: number]
  select: [pin: Pin, additive: boolean]
  'context-locked': [pin: Pin]
}>()

interface LeafletMarkerPrivate {
  _initInteraction(this: LeafletMarkerPrivate): void
  _icon: HTMLElement | null
  dragging: { _draggable: { _element: HTMLElement | null } | null; _enabled: boolean; enable(): void; disable(): void } | undefined
}

let marker: L.Marker | null = null
let popup: L.Popup | null = null
let hasAnimated = false

function ensurePopup(): L.Popup {
  if (popup) return popup
  popup = L.popup({ offset: L.point(0, -8) })
  return popup
}

function openContextPopup() {
  if (!marker) return
  const p = ensurePopup()
  p.setLatLng([props.pin.lat, props.pin.lng])
  p.setContent(buildPopupContent())
  p.openOn(props.map)
  nextTick(bindPopupButtons)
}

function target(): L.Map | L.LayerGroup {
  return props.layer ?? props.map
}

function buildIcon() {
  const hasEmoji = !!props.pin.emoji
  const cls = ['pin-marker', props.pending ? 'pin-marker--pending' : '', props.locked ? 'pin-marker--locked' : '', props.selected ? 'pin-marker--selected' : '', props.linkedToSelectedRoute ? 'pin-marker--route-linked' : ''].filter(Boolean).join(' ')
  const animDelay = Math.min((props.renderIndex ?? 0) * 25, 600)
  const animStyle = hasAnimated ? '' : `animation:pin-in 200ms ease-out both;animation-delay:${animDelay}ms;`
  hasAnimated = true

  if (hasEmoji) {
    const isClear = props.pin.color === 'transparent'
    const bubbleSize: PinDotSize = (props.pin.dotSize != null && props.pin.dotSize in BUBBLE_GEO ? props.pin.dotSize : undefined) ?? 'm'
    const { iconH, anchorY } = (isClear ? BUBBLE_GEO_CLEAR : BUBBLE_GEO)[bubbleSize]
    const emojiPx = BUBBLE_EMOJI_SIZE[bubbleSize]
    const bubbleCls = isClear ? 'pin-bubble pin-bubble--clear' : 'pin-bubble'
    const emojiStyle = `font-size:${emojiPx}px;width:${emojiPx}px;height:${emojiPx}px;${isClear ? 'filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))' : ''}`
    const bubbleStyle = isClear ? '' : `background:${props.pin.color}`
    const tip = isClear ? '' : `<div class="pin-bubble-tip" style="border-top-color:${props.pin.color}"></div>`
    const wrapFilter = isClear ? '' : 'filter:drop-shadow(0 1px 4px rgba(0,0,0,0.3))'
    const inner = `<div class="pin-inner pin-inner--bubble" style="${wrapFilter}"><div class="${bubbleCls}" style="${bubbleStyle}"><span class="pin-emoji" style="${emojiStyle}">${props.pin.emoji}</span></div>${tip}</div>`
    return L.divIcon({
      html: `<div class="${cls}" style="${animStyle}">${inner}</div>`,
      className: '',
      iconSize: [40, iconH],
      iconAnchor: [20, anchorY]
    })
  }

  const size: PinDotSize = (props.pin.dotSize != null && props.pin.dotSize in DOT_GEO ? props.pin.dotSize : undefined) ?? props.dotSize ?? 'm'
  const dotShape: PinDotShape = props.pin.dotShape ?? 'circle'
  const { iconH, anchorY } = DOT_GEO[size]
  const isTransparentDot = props.pin.color === 'transparent'
  const numColor = isDarkColor(props.pin.color) ? '#ffffff' : '#1f2937'
  const ringBox = isTransparentDot ? 'none' : '0 0 0 2px #ffffff'
  const dotFilter = isTransparentDot ? '' : 'filter:drop-shadow(0 1px 4px rgba(0,0,0,0.3))'
  const showNum = props.pin.showNumber && props.pinIndex !== undefined && (size === 'm' || size === 'l' || size === 'xl')
  const numFs = size === 'xl' ? '13' : size === 'l' ? '10' : '8'
  const numRotate = dotShape === 'diamond' ? 'transform:rotate(-45deg);' : ''
  const numSpan = showNum ? `<span style="color:${numColor};font-size:${numFs}px;font-weight:700;line-height:1;pointer-events:none;user-select:none;${numRotate}">${props.pinIndex}</span>` : ''
  const dot = `<div class="pin-dot pin-dot--${size} pin-dot--${dotShape}" style="background:${props.pin.color};box-shadow:${ringBox}">${numSpan}</div>`
  return L.divIcon({
    html: `<div class="${cls}" style="${animStyle}"><div class="pin-inner" style="${dotFilter}">${dot}</div></div>`,
    className: '',
    iconSize: [40, iconH],
    iconAnchor: [20, anchorY]
  })
}

function buildPopupContent() {
  const coords = `${props.pin.lat.toFixed(5)}, ${props.pin.lng.toFixed(5)}`
  const addrRow = props.pin.address ? `<button class="pin-popup-action-row pin-popup-copy-addr" data-pin-id="${props.pin.id}" data-copy="${props.pin.address}" data-label="${props.pin.address}">${COPY_SVG}<span class="pin-popup-action-label">${props.pin.address}</span></button>` : ''
  return `<div class="pin-popup">
    <button class="pin-popup-action-row pin-popup-edit" data-pin-id="${props.pin.id}">${PENCIL_SVG} Edit Pin</button>
    <button class="pin-popup-action-row pin-popup-copy" data-pin-id="${props.pin.id}" data-coords="${coords}" data-label="${coords}">${COPY_SVG}<span class="pin-popup-action-label">${coords}</span></button>
    ${addrRow}
    <button class="pin-popup-action-row pin-popup-clip-copy" data-pin-id="${props.pin.id}">${COPY_SVG} Copy Pin</button>
    <button class="pin-popup-action-row pin-popup-clip-cut" data-pin-id="${props.pin.id}">${SCISSORS_SVG} Cut Pin</button>
    <button class="pin-popup-action-row pin-popup-hide" data-pin-id="${props.pin.id}">${EYE_SVG} Hide Pin</button>
    <button class="pin-popup-action-row pin-popup-delete" data-pin-id="${props.pin.id}">${TRASH_SVG} Delete Pin</button>
  </div>`
}

function setupCopyBtn(selector: string, getValue: (btn: HTMLButtonElement) => string) {
  const btn = document.querySelector<HTMLButtonElement>(selector)
  if (!btn || btn.dataset.listenerBound) return
  btn.dataset.listenerBound = 'true'
  btn.addEventListener('click', () => {
    const value = getValue(btn)
    const label = btn.dataset.label || ''
    const original = label ? `${COPY_SVG}<span class="pin-popup-action-label">${label}</span>` : COPY_SVG
    const confirm = () => {
      emit('copy', value)
      btn.innerHTML = label ? `${CHECK_SVG} Copied!` : CHECK_SVG
      btn.classList.add('copied')
      setTimeout(() => {
        btn.innerHTML = original
        btn.classList.remove('copied')
      }, 1500)
    }
    navigator.clipboard
      .writeText(value)
      .then(confirm)
      .catch(() => {
        const el = document.createElement('textarea')
        el.value = value
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        confirm()
      })
  })
}

function bindPopupButtons() {
  const id = props.pin.id
  const editBtn = document.querySelector<HTMLButtonElement>(`.pin-popup-edit[data-pin-id="${id}"]`)
  editBtn?.addEventListener(
    'click',
    () => {
      emit('edit', props.pin)
      marker?.closePopup()
    },
    { once: true }
  )

  const hideBtn = document.querySelector<HTMLButtonElement>(`.pin-popup-hide[data-pin-id="${id}"]`)
  hideBtn?.addEventListener(
    'click',
    () => {
      emit('hide', props.pin.id)
      marker?.closePopup()
    },
    { once: true }
  )

  const deleteBtn = document.querySelector<HTMLButtonElement>(`.pin-popup-delete[data-pin-id="${id}"]`)
  deleteBtn?.addEventListener(
    'click',
    () => {
      emit('delete', props.pin.id)
      marker?.closePopup()
    },
    { once: true }
  )

  const clipCopyBtn = document.querySelector<HTMLButtonElement>(`.pin-popup-clip-copy[data-pin-id="${id}"]`)
  clipCopyBtn?.addEventListener(
    'click',
    () => {
      emit('clip-copy', props.pin)
      marker?.closePopup()
    },
    { once: true }
  )

  const clipCutBtn = document.querySelector<HTMLButtonElement>(`.pin-popup-clip-cut[data-pin-id="${id}"]`)
  clipCutBtn?.addEventListener(
    'click',
    () => {
      emit('clip-cut', props.pin)
      marker?.closePopup()
    },
    { once: true }
  )

  setupCopyBtn(`.pin-popup-copy[data-pin-id="${id}"]`, (btn) => btn.dataset.coords ?? '')
  setupCopyBtn(`.pin-popup-copy-addr[data-pin-id="${id}"]`, (btn) => btn.dataset.copy ?? '')
}

function patchDragging(m: L.Marker) {
  // When a cluster group calls _moveChild on dragend it does removeLayer+addLayer,
  // which goes through onRemove (sets _icon=null) then onAdd (createIcon(null) → NEW div).
  // Leaflet's _initInteraction calls dragging.enable() but since _enabled is already true
  // it returns early — leaving the Draggable bound to the old, now-detached icon element.
  // Patch _initInteraction to rebind the Draggable whenever the icon element changes.
  const mi = m as unknown as LeafletMarkerPrivate
  const orig = mi._initInteraction.bind(mi)
  mi._initInteraction = function (this: LeafletMarkerPrivate) {
    orig()
    const d = this.dragging
    if (!d?._draggable || !this._icon) return
    if (d._draggable._element === this._icon) return
    const was = d._enabled
    if (was) d.disable()
    d._draggable = null
    if (was && !props.locked) d.enable()
  }
}

function createMarker() {
  if (marker) target().removeLayer(marker)

  marker = L.marker([props.pin.lat, props.pin.lng], {
    icon: buildIcon(),
    draggable: true
  })

  patchDragging(marker)

  if (!props.hidden) marker.addTo(target())

  marker.on('click', (e: L.LeafletMouseEvent) => {
    e.originalEvent.stopPropagation()
    if (props.drawing) {
      onDrawingClick()
    } else if (!props.pending) {
      emit('select', props.pin, isAdditiveEvent(e.originalEvent))
    }
  })

  marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
    if (props.drawing || props.pending) return
    e.originalEvent.stopPropagation()
    e.originalEvent.preventDefault()
    if (props.locked) {
      emit('context-locked', props.pin)
    } else {
      openContextPopup()
    }
  })

  const SNAP_PX = 28
  let snapTarget: L.LatLng | null = null
  let dragStartLatLng: L.LatLng | null = null
  let wasSnapped = false

  marker.on('dragstart', () => {
    snapTarget = null
    wasSnapped = false
    dragStartLatLng = marker!.getLatLng()
    props.map.dragging.disable()
    if (props.locked) emit('drag-start', props.pin.id)
  })

  marker.on('drag', (e: L.LeafletEvent) => {
    const oe = (e as LeafletDragEvent).originalEvent
    if (!props.findSnap || !marker || !dragStartLatLng || !oe) return

    // Use raw pointer position for all distance checks — marker.getLatLng() returns
    // the snapped position while snapped, which would make escape distance wrong
    const pointer = 'touches' in oe ? oe.touches[0] : oe
    if (!pointer) return
    const clientX = pointer.clientX
    const clientY = pointer.clientY
    const mapRect = props.map.getContainer().getBoundingClientRect()
    const pointerPt = L.point(clientX - mapRect.left, clientY - mapRect.top)

    // Don't snap until the pointer has escaped the drag start position
    const startPx = props.map.latLngToContainerPoint(dragStartLatLng)
    if (Math.hypot(pointerPt.x - startPx.x, pointerPt.y - startPx.y) < SNAP_PX) {
      wasSnapped = false
      return
    }

    const pointerLatLng = props.map.containerPointToLatLng(pointerPt)
    const snapped = props.findSnap(pointerLatLng.lat, pointerLatLng.lng)

    if (snapped) {
      snapTarget = L.latLng(snapped.lat, snapped.lng)
      marker.setLatLng(snapTarget)
      if (!wasSnapped) {
        // Re-anchor Leaflet's draggable once on snap entry — not on every frame.
        // Anchoring every frame resets the escape threshold to the current pointer
        // each tick, making it impossible to drag away (need 28px in a single frame).
        wasSnapped = true
        const draggable = (marker.dragging as unknown as MarkerDragHandler | undefined)?._draggable
        if (draggable) {
          draggable._startPos = L.DomUtil.getPosition(draggable._element)
          draggable._startPoint = L.point(clientX, clientY)
        }
      }
    } else {
      if (wasSnapped) {
        // Re-anchor at pointer on snap exit so the marker returns to the cursor
        // instead of drifting with the offset from where the snap happened.
        const draggable = (marker.dragging as unknown as MarkerDragHandler | undefined)?._draggable
        if (draggable) {
          marker.setLatLng(props.map.containerPointToLatLng(pointerPt))
          draggable._startPos = L.DomUtil.getPosition(draggable._element)
          draggable._startPoint = L.point(clientX, clientY)
        }
      }
      wasSnapped = false
      snapTarget = null
    }

    if (props.locked) {
      const pos = marker.getLatLng()
      emit('drag-move', props.pin.id, pos.lat, pos.lng)
    }
  })

  marker.on('dragend', () => {
    const pos = snapTarget ?? marker!.getLatLng()
    snapTarget = null
    wasSnapped = false
    dragStartLatLng = null
    props.map.dragging.enable()
    emit('move', props.pin.id, pos.lat, pos.lng)
  })
}

onMounted(() => {
  createMarker()
})

// Array-of-getters form: Vue compares each primitive value individually, so the callback only
// fires when a watched value actually changes — not whenever props.pin gets a new object
// reference (e.g. an async address update replacing the pin object in pins.value).
// A single getter returning an array would compare the array by reference (always "changed").
watch([() => props.pin.emoji, () => props.pin.color, () => props.pin.dotSize, () => props.pin.dotShape, () => props.pin.showNumber, () => props.dotSize, () => props.locked, () => props.pinIndex], () => {
  if (!marker) return
  marker.setIcon(buildIcon())
})

// Selection state is toggled via direct class manipulation instead of setIcon() — setIcon()
// removes and re-appends the icon element, shifting its DOM order within the marker pane.
// Markers later in DOM order sit on top; that stacking changes on every select/deselect and
// causes clicks on overlapping icons to resolve to different pins across interactions.
watch([() => props.selected, () => props.linkedToSelectedRoute], ([sel, linked]) => {
  const icon = marker?.getElement()
  if (!icon) return
  const inner = icon.querySelector<HTMLElement>('.pin-marker')
  if (!inner) return
  inner.classList.toggle('pin-marker--selected', !!sel)
  inner.classList.toggle('pin-marker--route-linked', !!linked)
})

watch(
  () => props.pin.address,
  () => {
    if (!marker || props.pending || !popup?.isOpen()) return
    popup.setContent(buildPopupContent())
    nextTick(bindPopupButtons)
  }
)

watch([() => props.pin.lat, () => props.pin.lng], ([lat, lng]) => {
  if (!marker) return
  const cur = marker.getLatLng()
  if (cur.lat === lat && cur.lng === lng) return
  marker.setLatLng([lat, lng])
})

watch(
  () => props.hidden,
  (hide) => {
    if (!marker) return
    if (hide) {
      target().removeLayer(marker)
    } else {
      // Rebuild stored icon without animation (hasAnimated is already true → no animStyle),
      // then manually apply a fresh staggered animation. nextShowIndex() returns 0, 1, 2, ...
      // across all pins shown in the same Vue flush, so 4 selected pins shown together always
      // animate as 0→1→2→3 regardless of their position in the global pins array.
      marker.setIcon(buildIcon())
      marker.addTo(target())
      const showIndex = nextShowIndex()
      const icon = marker.getElement()
      if (icon) {
        const inner = icon.querySelector<HTMLElement>('.pin-marker')
        if (inner) {
          inner.style.animation = `pin-in 200ms ease-out ${Math.min(showIndex * 25, 600)}ms both`
          inner.classList.toggle('pin-marker--selected', !!props.selected)
          inner.classList.toggle('pin-marker--route-linked', !!props.linkedToSelectedRoute)
        }
      }
    }
  }
)

function onDrawingClick() {
  emit('place-waypoint', props.pin.lat, props.pin.lng, props.pin.id)
}

watch(
  () => props.drawing,
  (isDrawing) => {
    if (!marker || props.pending) return
    if (isDrawing && popup?.isOpen()) popup.close()
  }
)

watch(
  () => props.layer,
  (newLayer, oldLayer) => {
    if (!marker || props.hidden) return
    const oldTarget = oldLayer ?? props.map
    const newTarget = newLayer ?? props.map
    // removeLayer can hit cross-Leaflet-instance DomEvent.off (obj[eventsKey] undefined)
    // when the cluster group uses window.L internally. Same pattern as onUnmounted.
    try {
      oldTarget.removeLayer(marker)
    } catch {
      /* cross-instance cleanup */
    }
    marker.addTo(newTarget)
  }
)

onUnmounted(() => {
  // Remove defensively: a throw here (cross-Leaflet-instance cleanup can hit
  // `obj[eventsKey]` undefined) must not abort the hook and orphan the marker on
  // the map — that left "deleted" pins visible. Remove from both the layer and
  // the map (removeLayer is a no-op if the marker isn't on that target), and
  // disable dragging first so no stale Draggable keeps a handle to the icon.
  if (marker) {
    try {
      marker.dragging?.disable()
    } catch {
      /* ignore */
    }
    try {
      target().removeLayer(marker)
    } catch {
      /* ignore */
    }
    try {
      props.map.removeLayer(marker)
    } catch {
      /* ignore */
    }
  }
  try {
    popup?.remove()
  } catch {
    /* ignore */
  }
  marker = null
})

// PinMarker manages Leaflet marker instances outside Vue's VDOM. HMR patching
// a renderless component can orphan markers (onUnmounted doesn't fire for the
// stub), leaving duplicate markers that open the wrong popup. Force a full-page
// reload on change to keep Leaflet state consistent during development.
// (import.meta.hot.decline() was the old way, but it's a removed no-op in Vite 8.)
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
</script>

<template></template>
