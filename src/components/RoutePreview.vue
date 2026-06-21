<script setup lang="ts">
import type { RouteLineStyle, RouteWaypointSize, RouteWaypointStyle } from '@/types'

const props = defineProps<{
  color: string
  lineStyle: RouteLineStyle
  waypointStyle: RouteWaypointStyle
  waypointSize: RouteWaypointSize
  waypointShowNumber?: boolean
  // List previews: render uniform medium waypoints regardless of the route's real size.
  preview?: boolean
}>()

const LINE_DASH: Partial<Record<RouteLineStyle, { dasharray?: string; strokeWidth?: number }>> = {
  dashed: { dasharray: '12 8' },
  dotted: { dasharray: '1 9', strokeWidth: 4 },
  'long-dash': { dasharray: '22 10' },
  'dash-dot': { dasharray: '14 5 2 5' }
}

const PREVIEW_WP = {
  xs: { r: 3, sqHalf: 3, fontSize: 4 },
  s: { r: 5, sqHalf: 4, fontSize: 5.5 },
  m: { r: 7, sqHalf: 5, fontSize: 7 },
  l: { r: 9, sqHalf: 7, fontSize: 9 },
  xl: { r: 11, sqHalf: 9, fontSize: 11 }
} as const

// List/pill preview: a uniform node matching PinPreview's 's' dot (16px circle) so pin dots and
// route waypoints read at the same size. sqHalf 7 keeps a rotated diamond inside the 20px box.
const PREVIEW_NODE = { r: 8, sqHalf: 7, fontSize: 8 } as const

const wp = computed(() => (props.preview ? PREVIEW_NODE : PREVIEW_WP[props.waypointSize]))
const nodeR = computed(() => (props.waypointStyle === 'circle' ? wp.value.r : props.waypointStyle === 'none' ? 0 : wp.value.sqHalf))
const hasNodes = computed(() => props.waypointStyle !== 'none')
const lineX1 = computed(() => (hasNodes.value ? 8 + nodeR.value : 2))
const lineX2 = computed(() => (hasNodes.value ? 44 - nodeR.value : 50))
const arrowX2 = computed(() => (hasNodes.value ? 44 - nodeR.value : 44))
const lineMeta = computed(() => LINE_DASH[props.lineStyle] ?? {})
</script>

<template>
  <svg width="52" height="20" viewBox="0 0 52 20" class="shrink-0 overflow-visible">
    <defs v-if="lineStyle === 'arrow'">
      <marker id="rp-arrow" markerWidth="13" markerHeight="9" refX="10" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
        <polygon points="0,0.5 12,4.5 0,8.5" :fill="color" stroke="white" stroke-width="1.5" stroke-linejoin="round" />
      </marker>
    </defs>

    <!-- Line -->
    <template v-if="lineStyle === 'double'">
      <line :x1="lineX1" y1="8" :x2="lineX2" y2="8" :stroke="color" stroke-width="2" stroke-linecap="round" />
      <line :x1="lineX1" y1="12" :x2="lineX2" y2="12" :stroke="color" stroke-width="2" stroke-linecap="round" />
    </template>
    <template v-else-if="lineStyle === 'arrow'">
      <line :x1="lineX1" y1="10" :x2="arrowX2" y2="10" :stroke="color" stroke-width="2.5" stroke-linecap="round" marker-end="url(#rp-arrow)" />
    </template>
    <template v-else-if="lineStyle === 'none'">
      <line x1="2" y1="10" x2="50" y2="10" stroke="#d1d5db" stroke-width="1.5" stroke-dasharray="3 3" />
    </template>
    <template v-else>
      <line :x1="lineX1" y1="10" :x2="lineX2" y2="10" :stroke="color" :stroke-width="lineMeta.strokeWidth ?? 2.5" stroke-linecap="round" :stroke-dasharray="lineMeta.dasharray" />
    </template>

    <!-- Left waypoint (white outline mirrors the map waypoint in RouteLayer) -->
    <template v-if="waypointStyle !== 'none'">
      <circle v-if="waypointStyle === 'circle'" cx="8" cy="10" :r="wp.r" :fill="color" stroke="white" stroke-width="2" />
      <rect v-else-if="waypointStyle === 'square'" :x="8 - wp.sqHalf" :y="10 - wp.sqHalf" :width="wp.sqHalf * 2" :height="wp.sqHalf * 2" rx="1.5" :fill="color" stroke="white" stroke-width="2" />
      <rect v-else-if="waypointStyle === 'diamond'" :x="8 - wp.sqHalf" :y="10 - wp.sqHalf" :width="wp.sqHalf * 2" :height="wp.sqHalf * 2" rx="1.5" :fill="color" stroke="white" stroke-width="2" transform="rotate(45 8 10)" />
      <text v-if="waypointShowNumber" x="8" y="10" text-anchor="middle" dominant-baseline="central" :font-size="wp.fontSize" fill="white" font-weight="bold" style="user-select: none">1</text>
    </template>

    <!-- Right waypoint (white outline mirrors the map waypoint in RouteLayer) -->
    <template v-if="waypointStyle !== 'none'">
      <circle v-if="waypointStyle === 'circle'" cx="44" cy="10" :r="wp.r" :fill="color" stroke="white" stroke-width="2" />
      <rect v-else-if="waypointStyle === 'square'" :x="44 - wp.sqHalf" :y="10 - wp.sqHalf" :width="wp.sqHalf * 2" :height="wp.sqHalf * 2" rx="1.5" :fill="color" stroke="white" stroke-width="2" />
      <rect v-else-if="waypointStyle === 'diamond'" :x="44 - wp.sqHalf" :y="10 - wp.sqHalf" :width="wp.sqHalf * 2" :height="wp.sqHalf * 2" rx="1.5" :fill="color" stroke="white" stroke-width="2" transform="rotate(45 44 10)" />
      <text v-if="waypointShowNumber" x="44" y="10" text-anchor="middle" dominant-baseline="central" :font-size="wp.fontSize" fill="white" font-weight="bold" style="user-select: none">2</text>
    </template>
  </svg>
</template>
