<script setup lang="ts">
import L from 'leaflet'
import { onMounted, onUnmounted, watch } from 'vue'

import { Pin } from '../types'

const props = defineProps<{ pin: Pin; map: L.Map }>()
const emit = defineEmits<{ delete: [id: number] }>()

let marker: L.Marker | null = null

function createMarker() {
  if (marker) {
    props.map.removeLayer(marker)
  }

  const icon = L.divIcon({
    html: `<div class="pin-marker">
      <span class="pin-emoji">${props.pin.emoji}</span>
      <div class="pin-dot" style="background:${props.pin.color}"></div>
    </div>`,
    className: '',
    iconSize: [40, 52],
    iconAnchor: [20, 52]
  })

  marker = L.marker([props.pin.lat, props.pin.lng], { icon }).addTo(props.map)

  marker.bindPopup(`
    <div class="pin-popup">
      <div class="pin-popup-name">${props.pin.emoji} ${props.pin.name}</div>
      ${props.pin.description ? `<div class="pin-popup-desc">${props.pin.description}</div>` : ''}
      <button class="pin-popup-delete" data-pin-id="${props.pin.id}">Remove pin</button>
    </div>
  `)

  marker.on('popupopen', () => {
    const btn = document.querySelector<HTMLButtonElement>(`.pin-popup-delete[data-pin-id="${props.pin.id}"]`)
    btn?.addEventListener('click', () => {
      emit('delete', props.pin.id)
      marker?.closePopup()
    })
  })
}

onMounted(createMarker)
watch(() => props.pin, createMarker, { deep: true })
onUnmounted(() => {
  if (marker) props.map.removeLayer(marker)
})
</script>

<template></template>
