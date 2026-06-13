<script setup lang="ts">
import L from 'leaflet'
import { onMounted, onUnmounted, watch } from 'vue'

import { Pin, PinDotSize } from '../types'

const PENCIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`
const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`
const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

const DOT_GEO: Record<PinDotSize, { iconH: number; anchorY: number }> = {
  none: { iconH: 28, anchorY: 14 },
  s:    { iconH: 43, anchorY: 37 },
  m:    { iconH: 47, anchorY: 39 },
  l:    { iconH: 51, anchorY: 41 },
}

const props = defineProps<{
  pin: Pin
  map: L.Map
  layer?: L.LayerGroup   // MarkerClusterGroup or any LayerGroup; falls back to map
  hidden?: boolean
  pending?: boolean
  dotSize?: PinDotSize
}>()

const emit = defineEmits<{
  delete: [id: number]
  move: [id: number, lat: number, lng: number]
  edit: [pin: Pin]
  copy: [coords: string]
}>()

let marker: L.Marker | null = null

function target(): L.Map | L.LayerGroup {
  return props.layer ?? props.map
}

function buildIcon() {
  const size = props.dotSize ?? 'm'
  const { iconH, anchorY } = DOT_GEO[size]
  const dot = size === 'none' ? '' : `<div class="pin-dot pin-dot--${size}" style="background:${props.pin.color}"></div>`
  return L.divIcon({
    html: `<div class="pin-marker${props.pending ? ' pin-marker--pending' : ''}">
      <span class="pin-emoji">${props.pin.emoji}</span>
      ${dot}
    </div>`,
    className: '',
    iconSize: [40, iconH],
    iconAnchor: [20, anchorY]
  })
}

function buildPopupContent() {
  const coords = `${props.pin.lat.toFixed(5)}, ${props.pin.lng.toFixed(5)}`
  return `<div class="pin-popup">
    <div class="pin-popup-header">
      <span class="pin-popup-name">${props.pin.emoji} ${props.pin.name || 'Unnamed pin'}</span>
      <div class="pin-popup-actions">
        <button class="pin-popup-btn pin-popup-edit" data-pin-id="${props.pin.id}" title="Edit">${PENCIL_SVG}</button>
        <button class="pin-popup-btn pin-popup-delete" data-pin-id="${props.pin.id}" title="Remove">${TRASH_SVG}</button>
      </div>
    </div>
    ${props.pin.description ? `<div class="pin-popup-desc">${props.pin.description}</div>` : ''}
    <div class="pin-popup-footer">
      ${props.pin.address ? `
      <div class="pin-popup-row">
        <div class="pin-popup-address">${props.pin.address}</div>
        <button class="pin-popup-btn pin-popup-copy-addr" data-pin-id="${props.pin.id}" data-copy="${props.pin.address}" title="Copy address">${COPY_SVG}</button>
      </div>` : ''}
      <div class="pin-popup-row">
        <span class="pin-popup-coords">${coords}</span>
        <button class="pin-popup-btn pin-popup-copy" data-pin-id="${props.pin.id}" data-coords="${coords}" title="Copy coordinates">${COPY_SVG}</button>
      </div>
    </div>
  </div>`
}

function setupCopyBtn(selector: string, getValue: (btn: HTMLButtonElement) => string) {
  const btn = document.querySelector<HTMLButtonElement>(selector)
  if (!btn || btn.dataset.listenerBound) return
  btn.dataset.listenerBound = 'true'
  btn.addEventListener('click', () => {
    const value = getValue(btn)
    const confirm = () => {
      emit('copy', value)
      btn.innerHTML = CHECK_SVG
      btn.classList.add('copied')
      setTimeout(() => { btn.innerHTML = COPY_SVG; btn.classList.remove('copied') }, 1500)
    }
    navigator.clipboard.writeText(value).then(confirm).catch(() => {
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

function bindPopupEvents() {
  marker?.on('popupopen', () => {
    const editBtn = document.querySelector<HTMLButtonElement>(`.pin-popup-edit[data-pin-id="${props.pin.id}"]`)
    editBtn?.addEventListener('click', () => {
      emit('edit', props.pin)
      marker?.closePopup()
    }, { once: true })

    const deleteBtn = document.querySelector<HTMLButtonElement>(`.pin-popup-delete[data-pin-id="${props.pin.id}"]`)
    deleteBtn?.addEventListener('click', () => {
      emit('delete', props.pin.id)
      marker?.closePopup()
    }, { once: true })

    setupCopyBtn(`.pin-popup-copy[data-pin-id="${props.pin.id}"]`, btn => btn.dataset.coords ?? '')
    setupCopyBtn(`.pin-popup-copy-addr[data-pin-id="${props.pin.id}"]`, btn => btn.dataset.copy ?? '')
  })
}

function createMarker() {
  if (marker) target().removeLayer(marker)

  marker = L.marker([props.pin.lat, props.pin.lng], {
    icon: buildIcon(),
    draggable: true
  })

  if (!props.hidden) marker.addTo(target())

  if (!props.pending) {
    marker.bindPopup(buildPopupContent())
    bindPopupEvents()
  }

  marker.on('dragstart', () => props.map.dragging.disable())

  marker.on('dragend', () => {
    props.map.dragging.enable()
    const { lat, lng } = marker!.getLatLng()
    emit('move', props.pin.id, lat, lng)
  })
}

onMounted(createMarker)

watch(
  () => [props.pin.emoji, props.pin.color, props.pin.name, props.pin.description, props.dotSize, props.pin.address] as const,
  () => {
    if (!marker) return
    marker.setIcon(buildIcon())
    if (!props.pending) {
      marker.setPopupContent(buildPopupContent())
      marker.off('popupopen')
      bindPopupEvents()
    }
  }
)

watch(
  () => [props.pin.lat, props.pin.lng] as const,
  ([lat, lng]) => marker?.setLatLng([lat, lng])
)

watch(
  () => props.hidden,
  (hide) => {
    if (!marker) return
    if (hide) target().removeLayer(marker)
    else marker.addTo(target())
  }
)

watch(
  () => props.layer,
  (newLayer, oldLayer) => {
    if (!marker || props.hidden) return
    const oldTarget = oldLayer ?? props.map
    const newTarget = newLayer ?? props.map
    oldTarget.removeLayer(marker)
    marker.addTo(newTarget)
  }
)

onUnmounted(() => {
  if (marker) target().removeLayer(marker)
})
</script>

<template></template>
