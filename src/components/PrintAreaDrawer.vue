<script setup lang="ts">
import L from 'leaflet'
import { onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  map: L.Map
  isDrawing: boolean
  printBounds: L.LatLngBounds | null
}>()

const emit = defineEmits<{ 'bounds-set': [bounds: L.LatLngBounds] }>()

let drawingActive = false
let startLatLng: L.LatLng | null = null
let activeRect: L.Rectangle | null = null
let displayRect: L.Rectangle | null = null

watch(
  () => props.isDrawing,
  (drawing) => {
    props.map.getContainer().style.cursor = drawing ? 'crosshair' : ''
    if (!drawing) {
      if (drawingActive) {
        props.map.dragging.enable()
        drawingActive = false
        startLatLng = null
      }
      if (activeRect) {
        props.map.removeLayer(activeRect)
        activeRect = null
      }
    }
  }
)

watch(
  () => [props.printBounds, props.isDrawing] as const,
  ([bounds, drawing]) => {
    if (displayRect) {
      props.map.removeLayer(displayRect)
      displayRect = null
    }
    if (bounds && !drawing) {
      displayRect = L.rectangle(bounds, {
        color: '#3b82f6',
        weight: 2,
        fillOpacity: 0.06,
        dashArray: '6,4'
      }).addTo(props.map)
    }
  }
)

function handleMouseDown(e: L.LeafletMouseEvent) {
  if (!props.isDrawing) return
  props.map.dragging.disable()
  drawingActive = true
  startLatLng = e.latlng
  if (activeRect) props.map.removeLayer(activeRect)
  activeRect = L.rectangle(L.latLngBounds(e.latlng, e.latlng), {
    color: '#3b82f6',
    weight: 2,
    fillOpacity: 0.12,
    dashArray: '6,4'
  }).addTo(props.map)
}

function handleMouseMove(e: L.LeafletMouseEvent) {
  if (!drawingActive || !startLatLng || !activeRect) return
  activeRect.setBounds(L.latLngBounds(startLatLng, e.latlng))
}

function handleMouseUp() {
  if (!drawingActive || !startLatLng) return
  props.map.dragging.enable()
  drawingActive = false
  const bounds = activeRect?.getBounds()
  startLatLng = null
  if (activeRect) {
    props.map.removeLayer(activeRect)
    activeRect = null
  }
  if (bounds?.isValid()) {
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    if (Math.abs(sw.lat - ne.lat) > 0.0001 || Math.abs(sw.lng - ne.lng) > 0.0001) {
      emit('bounds-set', bounds)
    }
  }
}

onMounted(() => {
  props.map.on('mousedown', handleMouseDown as L.LeafletEventHandlerFn)
  props.map.on('mousemove', handleMouseMove as L.LeafletEventHandlerFn)
  window.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  props.map.off('mousedown', handleMouseDown as L.LeafletEventHandlerFn)
  props.map.off('mousemove', handleMouseMove as L.LeafletEventHandlerFn)
  window.removeEventListener('mouseup', handleMouseUp)
  if (displayRect) props.map.removeLayer(displayRect)
  if (activeRect) props.map.removeLayer(activeRect)
})
</script>

<template></template>
