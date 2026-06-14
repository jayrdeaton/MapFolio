<script setup lang="ts">
import L from 'leaflet'

import type { Pin, Route, RouteWaypointSize } from '../types'

const WP_SIZE: Record<RouteWaypointSize, { r: number; sqHalf: number; fontSize: number; hitR: number }> = {
  s: { r: 6, sqHalf: 6, fontSize: 7, hitR: 10 },
  m: { r: 9, sqHalf: 9, fontSize: 10, hitR: 13 },
  l: { r: 13, sqHalf: 13, fontSize: 13, hitR: 17 }
}

const props = defineProps<{
  routes: Route[]
  hiddenRouteIds: Set<number>
  map: L.Map
  drawingRouteId: number | null
  drawingAnchorIndex: number | null
  pins: Pin[]
}>()

const emit = defineEmits<{
  'remove-point': [routeId: number, pointIndex: number]
  'move-point': [routeId: number, pointIndex: number, lat: number, lng: number, pinId?: number]
  'move-route': [routeId: number, points: Array<{ lat: number; lng: number }>]
  'click-route': [routeId: number, lat: number, lng: number]
  'tap-waypoint': [routeId: number, pointIndex: number]
}>()

type PixelPos = [number, number]
const positions = ref<Map<number, PixelPos[]>>(new Map())
const isZooming = ref(false)
const routePane = ref<HTMLElement | null>(null)

const dragState = ref<{
  routeId: number
  mode: 'waypoint' | 'route'
  pointIndex: number
  offsets: PixelPos[]
  hasMoved: boolean
  pixel: PixelPos
  longPressTimer: ReturnType<typeof setTimeout> | null
} | null>(null)

function pointerToLayerPoint(e: PointerEvent): PixelPos {
  const containerPt = props.map.mouseEventToContainerPoint({ clientX: e.clientX, clientY: e.clientY } as MouseEvent)
  const layerPt = props.map.containerPointToLayerPoint(containerPt)
  return [layerPt.x, layerPt.y]
}

function getRouteDisplayPoints(routeId: number): PixelPos[] {
  const pts = positions.value.get(routeId) ?? []
  if (!dragState.value || dragState.value.routeId !== routeId) return pts
  if (dragState.value.mode === 'route') {
    const [mx, my] = dragState.value.pixel
    return dragState.value.offsets.map(([ox, oy]) => [mx + ox, my + oy] as PixelPos)
  }
  const { pointIndex, pixel } = dragState.value
  return pts.map((p, i) => (i === pointIndex ? pixel : p))
}

function cleanupDrag() {
  if (dragState.value?.longPressTimer) clearTimeout(dragState.value.longPressTimer)
  dragState.value = null
  props.map.dragging.enable()
  stopDocumentDrag()
}

function onWaypointPointerDown(e: PointerEvent, routeId: number, pointIndex: number) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  props.map.dragging.disable()

  const pixel = pointerToLayerPoint(e)
  let timer: ReturnType<typeof setTimeout> | null = null
  if (props.drawingRouteId === routeId) {
    timer = setTimeout(() => {
      if (dragState.value && !dragState.value.hasMoved) {
        emit('remove-point', routeId, pointIndex)
        cleanupDrag()
      }
    }, 500)
  }

  dragState.value = { routeId, mode: 'waypoint', pointIndex, offsets: [], hasMoved: false, pixel, longPressTimer: timer }
  startDocumentDrag()
}

let pendingTapWaypoint: { routeId: number; pointIndex: number } | null = null
let pendingTapLine: number | null = null // routeId of last pointer-up tap on a line

function onWaypointClick(e: MouseEvent, routeId: number, pointIndex: number) {
  // Suppress native click if we already emitted tap from onPointerUp
  if (pendingTapWaypoint && pendingTapWaypoint.routeId === routeId && pendingTapWaypoint.pointIndex === pointIndex) {
    pendingTapWaypoint = null
    e.stopPropagation()
    return
  }
  pendingTapWaypoint = null
  if (props.drawingRouteId === routeId) return
  emit('tap-waypoint', routeId, pointIndex)
}

function onLinePointerDown(e: PointerEvent, routeId: number) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  props.map.dragging.disable()

  const pixel = pointerToLayerPoint(e)
  const pts = positions.value.get(routeId) ?? []
  const offsets: PixelPos[] = pts.map(([x, y]) => [x - pixel[0], y - pixel[1]])

  dragState.value = { routeId, mode: 'route', pointIndex: -1, offsets, hasMoved: false, pixel, longPressTimer: null }
  startDocumentDrag()
}

function onLineClick(e: MouseEvent, routeId: number) {
  if (pendingTapLine === routeId) {
    pendingTapLine = null
    e.stopPropagation()
    return
  }
  pendingTapLine = null
  const rect = props.map.getContainer().getBoundingClientRect()
  const pt = L.point(e.clientX - rect.left, e.clientY - rect.top)
  const latlng = props.map.containerPointToLatLng(pt)
  emit('click-route', routeId, latlng.lat, latlng.lng)
}

function onPointerMove(e: PointerEvent) {
  if (!dragState.value) return
  const pixel = pointerToLayerPoint(e)
  if (!dragState.value.hasMoved) {
    const [ox, oy] = dragState.value.pixel
    if (Math.hypot(pixel[0] - ox, pixel[1] - oy) < 4) return
    if (dragState.value.longPressTimer) {
      clearTimeout(dragState.value.longPressTimer)
      dragState.value.longPressTimer = null
    }
    dragState.value.hasMoved = true
  }
  dragState.value.pixel = pixel
}

function onPointerUp(e: PointerEvent) {
  if (!dragState.value) return
  if (dragState.value.mode === 'waypoint') {
    if (dragState.value.hasMoved) {
      const latlng = props.map.layerPointToLatLng(L.point(dragState.value.pixel[0], dragState.value.pixel[1]))
      emit('move-point', dragState.value.routeId, dragState.value.pointIndex, latlng.lat, latlng.lng)
    } else {
      // Tap — emit directly and suppress the subsequent native click
      const { routeId, pointIndex } = dragState.value
      if (props.drawingRouteId !== routeId) {
        pendingTapWaypoint = { routeId, pointIndex }
        emit('tap-waypoint', routeId, pointIndex)
      }
    }
  } else {
    if (dragState.value.hasMoved) {
      const [mx, my] = dragState.value.pixel
      const points = dragState.value.offsets.map(([ox, oy]) => {
        const latlng = props.map.layerPointToLatLng(L.point(mx + ox, my + oy))
        return { lat: latlng.lat, lng: latlng.lng }
      })
      emit('move-route', dragState.value.routeId, points)
    } else {
      // Tap on line — emit and suppress native click
      pendingTapLine = dragState.value.routeId
      const rect = props.map.getContainer().getBoundingClientRect()
      const pt = L.point(e.clientX - rect.left, e.clientY - rect.top)
      const latlng = props.map.containerPointToLatLng(pt)
      emit('click-route', dragState.value.routeId, latlng.lat, latlng.lng)
    }
  }
  cleanupDrag()
}

function startDocumentDrag() {
  document.addEventListener('pointermove', onPointerMove, { capture: true })
  document.addEventListener('pointerup', onPointerUp, { capture: true })
  document.addEventListener('pointercancel', cleanupDrag, { capture: true })
}

function stopDocumentDrag() {
  document.removeEventListener('pointermove', onPointerMove, { capture: true })
  document.removeEventListener('pointerup', onPointerUp, { capture: true })
  document.removeEventListener('pointercancel', cleanupDrag, { capture: true })
}

function updatePositions() {
  const map = props.map
  const next = new Map<number, PixelPos[]>()
  for (const route of props.routes) {
    next.set(
      route.id,
      route.points.map((p) => {
        const pt = map.latLngToLayerPoint([p.lat, p.lng])
        return [pt.x, pt.y] as PixelPos
      })
    )
  }
  positions.value = next
}

let panesObserver: MutationObserver | null = null

onMounted(() => {
  // Render inside a custom Leaflet pane (z-index 450) so routes sit below popup-pane (700).
  // The external-div approach used latLngToContainerPoint + move listener, but the map pane's
  // CSS transform creates a stacking context that trapped popups below any external z-index.
  const pane = props.map.getPane('mfRoutePane') ?? props.map.createPane('mfRoutePane')
  pane.style.zIndex = '450'
  routePane.value = pane

  updatePositions()
  props.map.on('resize', updatePositions)
  // zoomend fires after Leaflet updates _pixelOrigin (inside _move), so layer-point
  // positions are correct. The MutationObserver handles isZooming separately using the
  // leaflet-zoom-anim class on mapPane, which brackets the CSS transition precisely.
  props.map.on('zoomend', updatePositions)

  const mapPane = props.map.getPane('mapPane') as HTMLElement | undefined
  if (mapPane) {
    panesObserver = new MutationObserver(() => {
      isZooming.value = mapPane.classList.contains('leaflet-zoom-anim')
    })
    panesObserver.observe(mapPane, { attributes: true, attributeFilter: ['class'] })
  }
})

onUnmounted(() => {
  props.map.off('resize', updatePositions)
  props.map.off('zoomend', updatePositions)
  panesObserver?.disconnect()
  props.map.getPane('mfRoutePane')?.remove()
  stopDocumentDrag()
})

watch(
  () => props.routes,
  () => nextTick(updatePositions),
  { deep: true }
)
</script>

<template>
  <Teleport v-if="routePane" :to="routePane">
    <svg
      viewBox="-1000 -1000 4000 4000"
      :style="{
        position: 'absolute',
        left: '-1000px',
        top: '-1000px',
        width: '4000px',
        height: '4000px',
        overflow: 'visible',
        pointerEvents: 'none',
        touchAction: 'none',
        opacity: isZooming ? 0 : 1,
        transition: isZooming ? 'none' : 'opacity 0.2s ease'
      }"
    >
      <defs>
        <marker v-for="route in routes" :id="`mf-arrow-${route.id}`" :key="`arrow-${route.id}`" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
          <polygon points="0,0 10,3.5 0,7" :fill="route.color" />
        </marker>
      </defs>

      <g v-for="route in routes" v-show="!hiddenRouteIds.has(route.id)" :key="route.id">
        <template v-if="(positions.get(route.id)?.length ?? 0) >= 2 && (route.lineStyle ?? 'solid') !== 'none'">
          <!-- Double line: thick outer + thin white gap, no halo needed -->
          <template v-if="(route.lineStyle ?? 'solid') === 'double' || (drawingRouteId === route.id && (route.lineStyle ?? 'solid') === 'double')">
            <polyline
              :points="
                getRouteDisplayPoints(route.id)
                  .map(([x, y]) => `${x},${y}`)
                  .join(' ')
              "
              :stroke="route.color"
              stroke-width="8"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              :stroke-dasharray="drawingRouteId === route.id ? '10 6' : undefined"
            />
            <polyline
              :points="
                getRouteDisplayPoints(route.id)
                  .map(([x, y]) => `${x},${y}`)
                  .join(' ')
              "
              stroke="white"
              stroke-width="3"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              :stroke-dasharray="drawingRouteId === route.id ? '10 6' : undefined"
            />
          </template>
          <template v-else>
            <!-- Halo for contrast on any basemap (skip for arrow — marker bleeds through) -->
            <polyline
              v-if="(route.lineStyle ?? 'solid') !== 'arrow' || drawingRouteId === route.id"
              :points="
                getRouteDisplayPoints(route.id)
                  .map(([x, y]) => `${x},${y}`)
                  .join(' ')
              "
              :stroke="route.color"
              stroke-width="8"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-opacity="0.2"
            />
            <!-- Main line -->
            <polyline
              :points="
                getRouteDisplayPoints(route.id)
                  .map(([x, y]) => `${x},${y}`)
                  .join(' ')
              "
              :stroke="route.color"
              :stroke-width="(route.lineStyle ?? 'solid') === 'dotted' ? 4 : 3.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              :stroke-dasharray="drawingRouteId === route.id ? '10 6' : (route.lineStyle ?? 'solid') === 'dashed' ? '12 8' : (route.lineStyle ?? 'solid') === 'dotted' ? '1 9' : (route.lineStyle ?? 'solid') === 'long-dash' ? '22 10' : (route.lineStyle ?? 'solid') === 'dash-dot' ? '14 5 2 5' : undefined"
              :marker-mid="(route.lineStyle ?? 'solid') === 'arrow' && drawingRouteId !== route.id ? `url(#mf-arrow-${route.id})` : undefined"
              :marker-end="(route.lineStyle ?? 'solid') === 'arrow' && drawingRouteId !== route.id ? `url(#mf-arrow-${route.id})` : undefined"
            />
          </template>
        </template>

        <!-- Transparent hit area for tapping/dragging the route line -->
        <polyline
          v-if="drawingRouteId !== route.id && (positions.get(route.id)?.length ?? 0) >= 2"
          :points="
            positions
              .get(route.id)!
              .map(([x, y]) => `${x},${y}`)
              .join(' ')
          "
          stroke="transparent"
          stroke-width="20"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          :style="{
            pointerEvents: 'stroke',
            touchAction: 'none',
            cursor: dragState?.routeId === route.id && dragState?.mode === 'route' && dragState.hasMoved ? 'grabbing' : 'grab'
          }"
          @pointerdown.stop="onLinePointerDown($event, route.id)"
          @click.stop="onLineClick($event, route.id)"
        />

        <!-- Waypoints -->
        <g
          v-for="([x, y], i) in getRouteDisplayPoints(route.id)"
          :key="i"
          :style="
            drawingRouteId === route.id || (route.waypointStyle ?? 'number') !== 'none'
              ? {
                  pointerEvents: 'auto',
                  touchAction: 'none',
                  cursor: dragState?.routeId === route.id && dragState?.mode === 'waypoint' && dragState.pointIndex === i && dragState.hasMoved ? 'grabbing' : 'grab'
                }
              : { pointerEvents: 'none' }
          "
          @pointerdown="onWaypointPointerDown($event, route.id, i)"
          @click.stop="onWaypointClick($event, route.id, i)"
        >
          <template v-if="drawingRouteId === route.id || (route.waypointStyle ?? 'number') !== 'none'">
            <!-- Hit area -->
            <circle :cx="x" :cy="y" :r="WP_SIZE[route.waypointSize ?? 'm'].hitR" fill="transparent" />

            <!-- Active drawing anchor ring -->
            <circle v-if="drawingRouteId === route.id && drawingAnchorIndex === i" :cx="x" :cy="y" :r="WP_SIZE[route.waypointSize ?? 'm'].r + 5" fill="none" :stroke="route.color" stroke-width="2" stroke-dasharray="4 2" style="pointer-events: none" />

            <!-- Linked-pin ring: shows when waypoint is anchored to a pin -->
            <circle v-if="route.points[i]?.pinId !== undefined && drawingRouteId !== route.id" :cx="x" :cy="y" :r="WP_SIZE[route.waypointSize ?? 'm'].r + 4" fill="none" stroke="white" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.9" style="pointer-events: none" />

            <!-- Drawing mode or 'number': numbered circle -->
            <template v-if="drawingRouteId === route.id || (route.waypointStyle ?? 'number') === 'number'">
              <circle :cx="x" :cy="y" :r="WP_SIZE[route.waypointSize ?? 'm'].r" :fill="route.color" stroke="white" stroke-width="2.5" />
              <text :x="x" :y="y" text-anchor="middle" dominant-baseline="central" :font-size="WP_SIZE[route.waypointSize ?? 'm'].fontSize" fill="white" font-weight="bold" style="user-select: none; pointer-events: none">{{ i + 1 }}</text>
            </template>

            <!-- Circle: plain dot -->
            <circle v-else-if="(route.waypointStyle ?? 'number') === 'circle'" :cx="x" :cy="y" :r="WP_SIZE[route.waypointSize ?? 'm'].r * 0.65" :fill="route.color" stroke="white" stroke-width="2" />

            <!-- Square -->
            <rect v-else-if="(route.waypointStyle ?? 'number') === 'square'" :x="x - WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 0.75" :y="y - WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 0.75" :width="WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 1.5" :height="WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 1.5" rx="1.5" :fill="route.color" stroke="white" stroke-width="2" />
          </template>
        </g>
      </g>
    </svg>
  </Teleport>
</template>
