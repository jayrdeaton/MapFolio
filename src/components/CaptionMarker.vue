<script setup lang="ts">
import L from 'leaflet'

import type { Caption } from '@/types'
import { CAPTION_PX } from '@/types'
import { isAdditiveEvent, isDarkColor } from '@/utils'

const PENCIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`
const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
const EYE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const SCISSORS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

const props = defineProps<{
  caption: Caption
  map: L.Map
  hidden?: boolean
  selected?: boolean
  isDark?: boolean
  placeholder?: string
  renderIndex?: number
}>()

const emit = defineEmits<{
  delete: [id: number]
  hide: [id: number]
  'move-start': [id: number]
  move: [id: number, lat: number, lng: number]
  edit: [caption: Caption]
  'clip-copy': [caption: Caption]
  'clip-cut': [caption: Caption]
  select: [caption: Caption, additive: boolean]
}>()

let marker: L.Marker | null = null
let popup: L.Popup | null = null
let hasAnimated = false
// True while a Leaflet drag is in flight. Live `move` emits round-trip through reactive
// state, so the lat/lng watcher must not fight the drag by calling setLatLng mid-drag.
let dragging = false

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildIcon() {
  const c = props.caption
  const fontSize = CAPTION_PX[c.size] ?? CAPTION_PX.m
  const rot = c.rotation ? ` rotate(${c.rotation}deg)` : ''
  const safe = escapeHtml(c.text || props.placeholder || 'Caption').replace(/\n/g, '<br>')

  // background on: color = pill background, text auto-contrasts. background off: color = text color.
  const textColor = c.background ? (isDarkColor(c.color) ? '#ffffff' : '#111827') : c.color
  const base = `font-size:${fontSize}px;font-weight:600;line-height:1.15;color:${textColor};white-space:pre;text-align:center;border-radius:4px;`
  const pillShadow = props.isDark ? '0 2px 6px rgba(0,0,0,0.6)' : '0 1px 4px rgba(0,0,0,0.2)'
  const pillBorder = props.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
  const skin = c.background ? `background:${c.color};padding:${Math.round(fontSize * 0.18)}px ${Math.round(fontSize * 0.45)}px;border-radius:${Math.round(fontSize * 0.35)}px;box-shadow:${pillShadow};border:1px solid ${pillBorder};` : `text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;`
  const ring = props.selected ? 'outline:2.5px solid #0d9488;outline-offset:2px;' : ''
  const animDelay = Math.min((props.renderIndex ?? 0) * 25, 600)
  const animStyle = hasAnimated ? '' : `animation:caption-in 250ms ease-out both;animation-delay:${animDelay}ms;`
  hasAnimated = true

  // Safari doesn't hit-test CSS-transformed children that extend outside their
  // parent's layout area. With iconSize:undefined the outer div is 0×0, so the
  // inner pill (translated -50%,-50%) is entirely outside its parent — only the
  // anchor pixel is clickable. Fix: size the outer div to contain the rotated pill,
  // center it with iconAnchor, and nullify its pointer-events via CSS so the large
  // transparent container doesn't block map panning outside the visible pill.
  const rawText = c.text || props.placeholder || 'Caption'
  const lines = rawText.split('\n')
  const maxLen = Math.max(...lines.map((l) => l.length), 1)
  const nLines = lines.length
  const pxH = Math.round(fontSize * 0.18)
  const pxW = Math.round(fontSize * 0.45)
  const pillW = maxLen * fontSize * 0.65 + pxW * 2 + 2
  const pillH = nLines * fontSize * 1.15 + pxH * 2 + 2
  const ang = ((c.rotation ?? 0) * Math.PI) / 180
  const cosA = Math.abs(Math.cos(ang))
  const sinA = Math.abs(Math.sin(ang))
  const span = Math.ceil(Math.max(pillW * cosA + pillH * sinA, pillW * sinA + pillH * cosA) + 40)
  const half = Math.ceil(span / 2)
  const dim = half * 2

  return L.divIcon({
    className: 'mf-caption-icon',
    html: `<div class="mf-caption-inner" data-caption-id="${c.id}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)${rot};transform-origin:center;cursor:pointer;user-select:none;pointer-events:auto;${base}${skin}${ring}${animStyle}">${safe}</div>`,
    iconSize: [dim, dim] as unknown as L.PointExpression,
    iconAnchor: [half, half] as unknown as L.PointExpression
  })
}

function ensurePopup(): L.Popup {
  if (popup) return popup
  popup = L.popup({ offset: L.point(0, -8) })
  return popup
}

function buildPopupContent() {
  const id = props.caption.id
  return `<div class="pin-popup">
    <button class="pin-popup-action-row caption-popup-edit" data-caption-id="${id}">${PENCIL_SVG} Edit Caption</button>
    <button class="pin-popup-action-row caption-popup-copy-coords">${COPY_SVG}<span class="pin-popup-action-label">${props.caption.lat.toFixed(5)}, ${props.caption.lng.toFixed(5)}</span></button>
    <button class="pin-popup-action-row caption-popup-clip-copy" data-caption-id="${id}">${COPY_SVG} Copy Caption</button>
    <button class="pin-popup-action-row caption-popup-clip-cut" data-caption-id="${id}">${SCISSORS_SVG} Cut Caption</button>
    <button class="pin-popup-action-row caption-popup-hide" data-caption-id="${id}">${EYE_SVG} Hide Caption</button>
    <button class="pin-popup-action-row pin-popup-delete caption-popup-delete" data-caption-id="${id}">${TRASH_SVG} Delete Caption</button>
  </div>`
}

function bindPopupButtons() {
  const id = props.caption.id
  document.querySelector<HTMLButtonElement>(`.caption-popup-edit[data-caption-id="${id}"]`)?.addEventListener(
    'click',
    () => {
      emit('edit', props.caption)
      marker?.closePopup()
    },
    { once: true }
  )
  const coordsBtn = document.querySelector<HTMLButtonElement>('.caption-popup-copy-coords')
  if (coordsBtn) {
    const coordStr = `${props.caption.lat.toFixed(5)}, ${props.caption.lng.toFixed(5)}`
    coordsBtn.addEventListener(
      'click',
      () => {
        navigator.clipboard.writeText(coordStr).then(() => {
          coordsBtn.innerHTML = `${CHECK_SVG} Copied!`
          setTimeout(() => {
            coordsBtn.innerHTML = `${COPY_SVG}<span class="pin-popup-action-label">${coordStr}</span>`
          }, 1500)
        })
      },
      { once: true }
    )
  }
  document.querySelector<HTMLButtonElement>(`.caption-popup-clip-copy[data-caption-id="${id}"]`)?.addEventListener(
    'click',
    () => {
      emit('clip-copy', props.caption)
      marker?.closePopup()
    },
    { once: true }
  )
  document.querySelector<HTMLButtonElement>(`.caption-popup-clip-cut[data-caption-id="${id}"]`)?.addEventListener(
    'click',
    () => {
      emit('clip-cut', props.caption)
      marker?.closePopup()
    },
    { once: true }
  )
  document.querySelector<HTMLButtonElement>(`.caption-popup-hide[data-caption-id="${id}"]`)?.addEventListener(
    'click',
    () => {
      emit('hide', props.caption.id)
      marker?.closePopup()
    },
    { once: true }
  )
  document.querySelector<HTMLButtonElement>(`.caption-popup-delete[data-caption-id="${id}"]`)?.addEventListener(
    'click',
    () => {
      emit('delete', props.caption.id)
      marker?.closePopup()
    },
    { once: true }
  )
}

function openContextPopup() {
  const p = ensurePopup()
  p.setLatLng([props.caption.lat, props.caption.lng])
  p.setContent(buildPopupContent())
  p.openOn(props.map)
  nextTick(bindPopupButtons)
}

function ensureCaptionPane() {
  const pane = props.map.getPane('mfCaptionPane') ?? props.map.createPane('mfCaptionPane')
  pane.style.zIndex = '430'
}

function createMarker() {
  ensureCaptionPane()
  marker = L.marker([props.caption.lat, props.caption.lng], { icon: buildIcon(), draggable: true, pane: 'mfCaptionPane' })
  if (!props.hidden) marker.addTo(props.map)

  marker.on('click', (e: L.LeafletMouseEvent) => {
    e.originalEvent.stopPropagation()
    emit('select', props.caption, isAdditiveEvent(e.originalEvent))
  })

  marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
    e.originalEvent.stopPropagation()
    e.originalEvent.preventDefault()
    openContextPopup()
  })

  marker.on('dragstart', () => {
    dragging = true
    props.map.dragging.disable()
    // Snapshot once at the start so the whole drag is a single undo step.
    emit('move-start', props.caption.id)
  })
  // Emit live so the rotate handle (which tracks the caption's lat/lng) follows the drag.
  marker.on('drag', () => {
    const pos = marker!.getLatLng()
    emit('move', props.caption.id, pos.lat, pos.lng)
  })
  marker.on('dragend', () => {
    dragging = false
    props.map.dragging.enable()
    const pos = marker!.getLatLng()
    emit('move', props.caption.id, pos.lat, pos.lng)
  })
}

onMounted(createMarker)

watch(
  () => [props.caption.text, props.caption.color, props.caption.size, props.caption.background, props.caption.rotation, props.selected, props.isDark, props.placeholder] as const,
  () => {
    // Skip during a drag: the live `move` emits give props.caption a new identity every frame,
    // so this getter returns a fresh array (compared by reference) and fires even though nothing
    // icon-relevant changed. setIcon() swaps the marker's DOM element and kills Leaflet's drag.
    if (dragging) return
    marker?.setIcon(buildIcon())
  }
)

watch(
  () => [props.caption.lat, props.caption.lng] as const,
  ([lat, lng]) => {
    if (!marker || dragging) return
    const cur = marker.getLatLng()
    if (cur.lat === lat && cur.lng === lng) return
    marker.setLatLng([lat, lng])
  }
)

watch(
  () => props.hidden,
  (hide) => {
    if (!marker) return
    if (hide) props.map.removeLayer(marker)
    else marker.addTo(props.map)
  }
)

onUnmounted(() => {
  // Defensive removal mirrors PinMarker: a throw during cross-instance cleanup must not
  // orphan the marker on the map.
  if (marker) {
    try {
      marker.dragging?.disable()
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

// See PinMarker: HMR patching a renderless Leaflet-managing component orphans markers.
// `.decline()` was removed in Vite 8 — use `.accept()` + reload instead, same as PinMarker.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
</script>

<template></template>
