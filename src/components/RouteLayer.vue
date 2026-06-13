<script setup lang="ts">
import L from 'leaflet'
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { Route } from '../types'

const props = defineProps<{
  routes: Route[]
  map: L.Map
  drawingRouteId: number | null
}>()

const emit = defineEmits<{
  'remove-point': [routeId: number, pointIndex: number]
}>()

type PixelPos = [number, number]
const positions = ref<Map<number, PixelPos[]>>(new Map())

function updatePositions() {
  const map = props.map
  const next = new Map<number, PixelPos[]>()
  for (const route of props.routes) {
    next.set(
      route.id,
      route.points.map(p => {
        const pt = map.latLngToContainerPoint([p.lat, p.lng])
        return [pt.x, pt.y] as PixelPos
      })
    )
  }
  positions.value = next
}

onMounted(() => {
  updatePositions()
  props.map.on('move', updatePositions)
  props.map.on('zoomend', updatePositions)
  props.map.on('resize', updatePositions)
})

onUnmounted(() => {
  props.map.off('move', updatePositions)
  props.map.off('zoomend', updatePositions)
  props.map.off('resize', updatePositions)
})

watch(() => props.routes, () => nextTick(updatePositions), { deep: true })
</script>

<template>
  <div class="absolute inset-0 pointer-events-none" style="z-index: 400">
    <svg class="w-full h-full overflow-visible">
      <g v-for="route in routes" :key="route.id">
        <template v-if="(positions.get(route.id)?.length ?? 0) >= 2">
          <!-- Halo for contrast on any basemap -->
          <polyline
            :points="positions.get(route.id)!.map(([x, y]) => `${x},${y}`).join(' ')"
            :stroke="route.color"
            stroke-width="8"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-opacity="0.2"
          />
          <!-- Main line; dashed while actively drawing -->
          <polyline
            :points="positions.get(route.id)!.map(([x, y]) => `${x},${y}`).join(' ')"
            :stroke="route.color"
            stroke-width="3.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="drawingRouteId === route.id ? '10 6' : undefined"
          />
        </template>

        <!-- Waypoint circles (clickable only while drawing this route) -->
        <g
          v-for="([x, y], i) in (positions.get(route.id) ?? [])"
          :key="i"
          :class="drawingRouteId === route.id ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'"
          @click="drawingRouteId === route.id && emit('remove-point', route.id, i)"
        >
          <!-- Invisible larger hit area -->
          <circle :cx="x" :cy="y" r="12" fill="transparent" />
          <circle :cx="x" :cy="y" r="7" :fill="route.color" stroke="white" stroke-width="2.5" />
          <text
            :x="x"
            :y="y + 4"
            text-anchor="middle"
            font-size="8"
            fill="white"
            font-weight="bold"
            class="select-none pointer-events-none"
          >{{ i + 1 }}</text>
        </g>
      </g>
    </svg>
  </div>
</template>
