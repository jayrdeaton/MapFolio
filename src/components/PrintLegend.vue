<script setup lang="ts">
import { formatDistance, routeDistanceM } from '@/composables/useRoutes'
import type { Pin, Route } from '@/types'
import { dedupeLegendPins } from '@/utils/exportLegend'

import RoutePreview from './RoutePreview.vue'

const props = defineProps<{ title: string; area?: string; pins: Pin[]; routes?: Route[]; blankLabels?: boolean }>()

const namedPins = computed(() => {
  let seq = 0
  return dedupeLegendPins(props.pins.map((p) => ({ pin: p, index: p.showNumber ? ++seq : undefined })).filter(({ pin }) => pin.name))
})
const namedRoutes = computed(() => (props.routes ?? []).filter((r) => r.name))
</script>

<template>
  <div v-if="title || namedPins.length > 0 || namedRoutes.length > 0" class="print-legend">
    <div v-if="title" class="print-legend-title">{{ title }}</div>
    <div v-if="area" class="print-legend-area">{{ area }}</div>

    <template v-if="namedPins.length > 0">
      <div class="print-legend-header">{{ namedRoutes.length > 0 ? 'Pins' : 'Legend' }}</div>
      <div class="print-legend-items">
        <div v-for="item in namedPins" :key="item.pin.id" class="print-legend-item">
          <svg v-if="item.index !== undefined" width="16" height="16" viewBox="0 0 16 16" style="flex-shrink: 0">
            <circle cx="8" cy="8" r="7" :fill="item.pin.color" />
            <text x="8" y="8" text-anchor="middle" dominant-baseline="central" :font-size="item.index >= 10 ? '5' : '7'" fill="white" font-weight="bold">{{ item.index }}</text>
          </svg>
          <span v-else class="print-legend-emoji">{{ item.pin.emoji }}</span>
          <div class="print-legend-text">
            <div v-if="blankLabels" class="print-legend-blank" />
            <div v-else class="print-legend-name">{{ item.pin.name }}</div>
            <div v-if="!blankLabels && item.pin.description" class="print-legend-desc">{{ item.pin.description }}</div>
          </div>
        </div>
      </div>
    </template>

    <template v-if="namedRoutes.length > 0">
      <div class="print-legend-header" :style="namedPins.length > 0 ? 'margin-top: 6px' : ''">
        {{ namedPins.length > 0 ? 'Routes' : 'Legend' }}
      </div>
      <div class="print-legend-items">
        <div v-for="route in namedRoutes" :key="route.id" class="print-legend-item">
          <RoutePreview :color="route.color" :line-style="route.lineStyle ?? 'solid'" :waypoint-style="((route.waypointStyle as any) === 'number' ? 'circle' : route.waypointStyle) ?? 'circle'" :waypoint-size="route.waypointSize ?? 'm'" :waypoint-show-number="(route.waypointStyle as any) === 'number' ? true : (route.waypointShowNumber ?? false)" />
          <div class="print-legend-text">
            <div v-if="blankLabels" class="print-legend-blank" />
            <div v-else class="print-legend-name">{{ route.name }}</div>
            <div v-if="!blankLabels" class="print-legend-desc">
              {{ formatDistance(routeDistanceM(route.points)) }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
