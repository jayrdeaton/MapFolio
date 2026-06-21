<script setup lang="ts">
import L from 'leaflet'

import type { Pin, Route, RouteWaypointSize, RouteWaypointStyle } from '@/types'

const WP_SIZE: Record<RouteWaypointSize, { r: number; sqHalf: number; fontSize: number; hitR: number }> = {
  xs: { r: 4, sqHalf: 4, fontSize: 5, hitR: 8 },
  s: { r: 6, sqHalf: 6, fontSize: 7, hitR: 10 },
  m: { r: 9, sqHalf: 9, fontSize: 10, hitR: 13 },
  l: { r: 13, sqHalf: 13, fontSize: 13, hitR: 17 },
  xl: { r: 17, sqHalf: 17, fontSize: 16, hitR: 21 }
}

const props = defineProps<{
  routes: Route[]
  hiddenRouteIds: Set<number>
  map: L.Map
  drawingRouteId: number | null
  drawingAnchorIndex: number | null
  pins: Pin[]
  snapEnabled?: boolean
  hiddenPinIds?: Set<number>
  angleSnapEnabled?: boolean
  selectedRouteIds?: Set<number>
  selectedWaypointKey?: { routeId: number; pointIndex: number } | null
}>()

const emit = defineEmits<{
  'remove-point': [routeId: number, pointIndex: number]
  'move-point': [routeId: number, pointIndex: number, lat: number, lng: number, pinId?: number]
  'move-route': [routeId: number, points: Array<{ lat: number; lng: number }>]
  'select-route': [routeId: number, additive: boolean]
  'select-waypoint': [routeId: number, pointIndex: number]
  'context-route': [routeId: number, lat: number, lng: number]
  'context-waypoint': [routeId: number, pointIndex: number]
}>()

type PixelPos = [number, number]

const pinById = computed(() => new Map(props.pins.map((p) => [p.id, p])))

function waypointColor(route: Route, pointIndex: number): string {
  const pinId = route.points[pointIndex]?.pinId
  return pinId !== undefined ? (pinById.value.get(pinId)?.color ?? route.color) : route.color
}

// Pin-drag preview: overrides a single linked waypoint's pixel position during a locked-pin drag.
// Stored as a shallowRef of a plain object so Vue re-renders cheaply on each pointermove without
// invalidating the expensive `positions` computed (which would re-run latLngToLayerPoint for all points).
const pinDragPreview = shallowRef<{ routeId: number; ptIdx: number; pixel: PixelPos } | null>(null)
let _pinDragRouteId: number | null = null
let _pinDragPtIdx: number | null = null

function setPinDragPreview(pinId: number, lat: number, lng: number) {
  if (_pinDragRouteId === null) {
    outer: for (const route of props.routes) {
      for (let i = 0; i < route.points.length; i++) {
        if (route.points[i]?.pinId === pinId) {
          _pinDragRouteId = route.id
          _pinDragPtIdx = i
          break outer
        }
      }
    }
  }
  if (_pinDragRouteId === null || _pinDragPtIdx === null) return
  const pt = props.map.latLngToLayerPoint([lat, lng])
  pinDragPreview.value = { routeId: _pinDragRouteId, ptIdx: _pinDragPtIdx, pixel: [pt.x, pt.y] }
}

function clearPinDragPreview() {
  pinDragPreview.value = null
  _pinDragRouteId = null
  _pinDragPtIdx = null
}

defineExpose({ setPinDragPreview, clearPinDragPreview })

// Increment to force positions recomputation after any map state change (zoom, resize, etc.)
const positionsKey = ref(0)

// Computed positions: auto-recomputes when routes change (deep-tracked) or positionsKey bumps.
// Using computed instead of manual ref assignment ensures Vue's dependency tracking sees
// both the trigger (positionsKey) and the route data in the same reactive graph.
const positions = computed<Map<number, PixelPos[]>>(() => {
  void positionsKey.value
  const result = new Map<number, PixelPos[]>()
  for (const route of props.routes) {
    result.set(
      route.id,
      route.points
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => {
          const pt = props.map.latLngToLayerPoint([p.lat, p.lng])
          return [pt.x, pt.y] as PixelPos
        })
    )
  }
  return result
})

function triggerUpdate() {
  positionsKey.value++
}

const isZooming = ref(false)
const routePane = ref<HTMLElement | null>(null)

const dragState = ref<{
  routeId: number
  mode: 'waypoint' | 'route'
  pointIndex: number
  offsets: PixelPos[]
  hasMoved: boolean
  pixel: PixelPos
  startPixel: PixelPos
  longPressTimer: ReturnType<typeof setTimeout> | null
  snappedPinId?: number
} | null>(null)

function getSegmentsTrimmed(routeId: number, trimEnd: number): Array<[PixelPos, PixelPos]> {
  const pts = getRouteDisplayPoints(routeId)
  const segs: Array<[PixelPos, PixelPos]> = []
  for (let i = 0; i + 1 < pts.length; i++) {
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    let endPt: PixelPos = p2
    if (trimEnd > 0) {
      const dx = p2[0] - p1[0]
      const dy = p2[1] - p1[1]
      const len = Math.hypot(dx, dy)
      if (len > trimEnd) {
        const t = (len - trimEnd) / len
        endPt = [p1[0] + dx * t, p1[1] + dy * t]
      }
    }
    segs.push([p1, endPt])
  }
  return segs
}

// Legacy compat: stored 'number' style → circle + showNumber
function wpStyle(route: Route): RouteWaypointStyle {
  const s = route.waypointStyle as string | undefined
  return (s === 'number' ? 'circle' : (s ?? 'circle')) as RouteWaypointStyle
}
function wpShowNumber(route: Route): boolean {
  return (route.waypointStyle as string) === 'number' ? true : (route.waypointShowNumber ?? false)
}

function arrowWpR(route: Route): number {
  return wpStyle(route) !== 'none' ? WP_SIZE[route.waypointSize ?? 'm'].r : 0
}

// Invisible polylines carrying marker-end: tip overshoots endpoint by 4px (tip=24, refX=20).
// Trim by wpR-2 so the tip lands 6px inside the waypoint circle (hidden), ending flush at circle edge.
function getRouteSegments(route: Route): Array<[PixelPos, PixelPos]> {
  return getSegmentsTrimmed(route.id, arrowWpR(route) - 2)
}

// Main line polylines for arrow style: end 6px before the tip so the polygon body fully covers it
function getArrowMainSegments(route: Route): Array<[PixelPos, PixelPos]> {
  return getSegmentsTrimmed(route.id, arrowWpR(route) + 6)
}

function pointerToLayerPoint(e: PointerEvent): PixelPos {
  const containerPt = props.map.mouseEventToContainerPoint({ clientX: e.clientX, clientY: e.clientY } as MouseEvent)
  const layerPt = props.map.containerPointToLayerPoint(containerPt)
  return [layerPt.x, layerPt.y]
}

function getRouteDisplayPoints(routeId: number): PixelPos[] {
  const pts = positions.value.get(routeId) ?? []
  if (pinDragPreview.value?.routeId === routeId) {
    const { ptIdx, pixel } = pinDragPreview.value
    return pts.map((p, i) => (i === ptIdx ? pixel : p))
  }
  if (!dragState.value || dragState.value.routeId !== routeId) return pts
  if (dragState.value.mode === 'route') {
    if (!dragState.value.hasMoved) return pts
    const [mx, my] = dragState.value.pixel
    return dragState.value.offsets.map(([ox, oy]) => [mx + ox, my + oy] as PixelPos)
  }
  if (!dragState.value.hasMoved) return pts
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

  dragState.value = { routeId, mode: 'waypoint', pointIndex, offsets: [], hasMoved: false, pixel, startPixel: pixel, longPressTimer: timer }
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
  if (props.drawingRouteId !== null) return
  emit('select-waypoint', routeId, pointIndex)
}

function onWaypointContextMenu(e: MouseEvent, routeId: number, pointIndex: number) {
  if (props.drawingRouteId !== null) return
  emit('context-waypoint', routeId, pointIndex)
}

function onLinePointerDown(e: PointerEvent, routeId: number) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  props.map.dragging.disable()

  const pixel = pointerToLayerPoint(e)
  const pts = positions.value.get(routeId) ?? []
  const offsets: PixelPos[] = pts.map(([x, y]) => [x - pixel[0], y - pixel[1]])

  dragState.value = { routeId, mode: 'route', pointIndex: -1, offsets, hasMoved: false, pixel, startPixel: pixel, longPressTimer: null }
  startDocumentDrag()
}

function onLineClick(e: MouseEvent, routeId: number) {
  if (pendingTapLine === routeId) {
    pendingTapLine = null
    e.stopPropagation()
    return
  }
  pendingTapLine = null
  if (props.drawingRouteId !== null) return
  emit('select-route', routeId, e.metaKey || e.ctrlKey)
}

function onLineContextMenu(e: MouseEvent, routeId: number) {
  if (props.drawingRouteId !== null) return
  const rect = props.map.getContainer().getBoundingClientRect()
  const latlng = props.map.containerPointToLatLng(L.point(e.clientX - rect.left, e.clientY - rect.top))
  emit('context-route', routeId, latlng.lat, latlng.lng)
}

const ANGLE_SNAP_DEG = 15

function applyAngleSnap(pixel: PixelPos, routeId: number, pointIndex: number): PixelPos {
  const route = props.routes.find((r) => r.id === routeId)
  if (!route) return pixel

  // Anchor on the previous waypoint, or the next one if this is the first point
  const anchorIndex = pointIndex === 0 ? 1 : pointIndex - 1
  const anchor = route.points[anchorIndex]
  if (!anchor || !Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lng)) return pixel

  const apt = props.map.latLngToLayerPoint([anchor.lat, anchor.lng])
  const dx = pixel[0] - apt.x
  const dy = pixel[1] - apt.y
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return pixel

  const snapRad = (ANGLE_SNAP_DEG * Math.PI) / 180
  const snapped = Math.round(Math.atan2(dy, dx) / snapRad) * snapRad
  return [apt.x + dist * Math.cos(snapped), apt.y + dist * Math.sin(snapped)]
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
  let finalPixel = pixel
  let snappedPinId: number | undefined

  const SNAP_PX = 28
  // Only apply position-based snaps once the pointer has escaped the snap radius from where the
  // drag started — prevents a snapped waypoint from immediately re-snapping when you begin to drag
  const escaped = Math.hypot(pixel[0] - dragState.value.startPixel[0], pixel[1] - dragState.value.startPixel[1]) > SNAP_PX

  if (escaped && props.snapEnabled && dragState.value.mode === 'waypoint') {
    for (const pin of props.pins) {
      if (props.hiddenPinIds?.has(pin.id)) continue
      const pinPt = props.map.latLngToLayerPoint([pin.lat, pin.lng])
      if (Math.hypot(pixel[0] - pinPt.x, pixel[1] - pinPt.y) < SNAP_PX) {
        finalPixel = [pinPt.x, pinPt.y]
        snappedPinId = pin.id
        break
      }
    }
  }

  if (!snappedPinId && escaped && props.snapEnabled && dragState.value.mode === 'waypoint') {
    const { routeId: ownRouteId, pointIndex: ownIdx } = dragState.value
    outer: for (const route of props.routes) {
      if (props.hiddenRouteIds.has(route.id)) continue
      for (let i = 0; i < route.points.length; i++) {
        if (route.id === ownRouteId && i === ownIdx) continue
        const pt = route.points[i]!
        const ptPt = props.map.latLngToLayerPoint([pt.lat, pt.lng])
        if (Math.hypot(pixel[0] - ptPt.x, pixel[1] - ptPt.y) < SNAP_PX) {
          finalPixel = [ptPt.x, ptPt.y]
          break outer
        }
      }
    }
  }

  if (!snappedPinId && dragState.value.mode === 'waypoint' && props.angleSnapEnabled !== e.shiftKey) {
    finalPixel = applyAngleSnap(pixel, dragState.value.routeId, dragState.value.pointIndex)
  }

  dragState.value.pixel = finalPixel
  dragState.value.snappedPinId = snappedPinId
}

function onPointerUp(e: PointerEvent) {
  if (!dragState.value) return
  if (dragState.value.mode === 'waypoint') {
    if (dragState.value.hasMoved) {
      const { routeId, pointIndex } = dragState.value
      const latlng = props.map.layerPointToLatLng(L.point(dragState.value.pixel[0], dragState.value.pixel[1]))
      // Suppress the synthetic click that fires after a drag ends
      pendingTapWaypoint = { routeId, pointIndex }
      emit('move-point', routeId, pointIndex, latlng.lat, latlng.lng, dragState.value.snappedPinId)
    } else {
      // Tap — emit directly and suppress the subsequent native click
      const { routeId, pointIndex } = dragState.value
      if (props.drawingRouteId !== routeId) {
        pendingTapWaypoint = { routeId, pointIndex }
        emit('select-waypoint', routeId, pointIndex)
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
      // Tap on line — select route and suppress native click
      pendingTapLine = dragState.value.routeId
      emit('select-route', dragState.value.routeId, e.metaKey || e.ctrlKey)
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

let panesObserver: MutationObserver | null = null

onMounted(() => {
  // Render inside a custom Leaflet pane (z-index 450) so routes sit below popup-pane (700).
  // The external-div approach used latLngToContainerPoint + move listener, but the map pane's
  // CSS transform creates a stacking context that trapped popups below any external z-index.
  const pane = props.map.getPane('mfRoutePane') ?? props.map.createPane('mfRoutePane')
  pane.style.zIndex = '450'
  routePane.value = pane

  // 'zoom' fires once after each animated zoom (including after _onZoomTransitionEnd).
  // 'viewreset' fires from _resetView (non-animated setView/fitBounds).
  // 'zoomend' and 'moveend' are belt-and-suspenders fallbacks.
  // All just bump positionsKey so the computed recomputes on next render.
  props.map.on('zoom', triggerUpdate)
  props.map.on('zoomend', triggerUpdate)
  props.map.on('viewreset', triggerUpdate)
  props.map.on('moveend', triggerUpdate)
  props.map.on('resize', triggerUpdate)

  const mapPane = props.map.getPane('mapPane') as HTMLElement | undefined
  if (mapPane) {
    panesObserver = new MutationObserver(() => {
      isZooming.value = mapPane.classList.contains('leaflet-zoom-anim')
    })
    panesObserver.observe(mapPane, { attributes: true, attributeFilter: ['class'] })
  }
})

onUnmounted(() => {
  props.map.off('zoom', triggerUpdate)
  props.map.off('zoomend', triggerUpdate)
  props.map.off('viewreset', triggerUpdate)
  props.map.off('moveend', triggerUpdate)
  props.map.off('resize', triggerUpdate)
  panesObserver?.disconnect()
  props.map.getPane('mfRoutePane')?.remove()
  stopDocumentDrag()
})
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
        <marker v-for="route in routes" :id="`mf-arrow-${route.id}`" :key="`arrow-${route.id}`" markerWidth="26" markerHeight="18" refX="20" refY="9" orient="auto" markerUnits="userSpaceOnUse">
          <polygon points="0,1 24,9 0,17" :fill="route.color" stroke="white" stroke-width="2" stroke-linejoin="round" />
        </marker>
      </defs>

      <!-- Selection ring filters: dilate outer, dilate inner, subtract to get a true ring band
           (no filled blob), then flood cyan. Gap between shape and ring matches CSS outline-offset.
           mf-wp-sel: route-level (dim, 60% opacity) — all waypoints of a selected route.
           mf-wp-sel-active: per-waypoint (full opacity) — the specifically selected waypoint. -->
      <defs>
        <filter id="mf-wp-sel" x="-60%" y="-60%" width="220%" height="220%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="outer" />
          <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="inner" />
          <feComposite in="outer" in2="inner" operator="out" result="ring" />
          <feFlood flood-color="#06b6d4" flood-opacity="0.6" result="color" />
          <feComposite in="color" in2="ring" operator="in" result="coloredRing" />
          <feMerge>
            <feMergeNode in="coloredRing" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="mf-wp-sel-active" x="-80%" y="-80%" width="260%" height="260%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="5" result="outer" />
          <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="inner" />
          <feComposite in="outer" in2="inner" operator="out" result="ring" />
          <feFlood flood-color="#06b6d4" result="color" />
          <feComposite in="color" in2="ring" operator="in" result="coloredRing" />
          <feMerge>
            <feMergeNode in="coloredRing" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
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
            <!-- Main line: per-segment for arrow style so each end terminates at the waypoint edge -->
            <template v-if="(route.lineStyle ?? 'solid') === 'arrow' && drawingRouteId !== route.id">
              <polyline v-for="([p1, p2], si) in getArrowMainSegments(route)" :key="`ml-${si}`" :points="`${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`" :stroke="route.color" stroke-width="3.5" fill="none" stroke-linecap="butt" stroke-linejoin="round" />
            </template>
            <polyline
              v-else
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
            />
            <!-- Per-segment arrows: one marker-end per segment avoids the bisector angle at corners -->
            <template v-if="(route.lineStyle ?? 'solid') === 'arrow' && drawingRouteId !== route.id">
              <polyline v-for="([p1, p2], si) in getRouteSegments(route)" :key="`arrow-seg-${si}`" :points="`${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`" stroke="none" fill="none" :marker-end="`url(#mf-arrow-${route.id})`" />
            </template>
          </template>
        </template>

        <!-- Selection highlight -->
        <polyline
          v-if="selectedRouteIds?.has(route.id) && drawingRouteId !== route.id && (positions.get(route.id)?.length ?? 0) >= 2"
          :points="
            positions
              .get(route.id)!
              .map(([x, y]) => `${x},${y}`)
              .join(' ')
          "
          stroke="#06b6d4"
          stroke-width="10"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-opacity="0.55"
          style="pointer-events: none"
        />

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
          :data-route-id="route.id"
          :style="{
            pointerEvents: 'stroke',
            touchAction: 'none',
            cursor: dragState?.routeId === route.id && dragState?.mode === 'route' && dragState.hasMoved ? 'grabbing' : 'pointer'
          }"
          @pointerdown.stop="onLinePointerDown($event, route.id)"
          @click.stop="onLineClick($event, route.id)"
          @contextmenu.prevent.stop="onLineContextMenu($event, route.id)"
        />

        <!-- Waypoints -->
        <g
          v-for="([x, y], i) in getRouteDisplayPoints(route.id)"
          :key="i"
          :data-route-id="route.id"
          :data-wp-idx="i"
          :style="
            drawingRouteId === route.id || wpStyle(route) !== 'none' || selectedRouteIds?.has(route.id) || selectedWaypointKey?.routeId === route.id || route.points[i]?.pinId !== undefined
              ? {
                  pointerEvents: 'auto',
                  touchAction: 'none',
                  cursor: dragState?.routeId === route.id && dragState?.mode === 'waypoint' && dragState.pointIndex === i && dragState.hasMoved ? 'grabbing' : 'pointer'
                }
              : { pointerEvents: 'none' }
          "
          @pointerdown="onWaypointPointerDown($event, route.id, i)"
          @click.stop="onWaypointClick($event, route.id, i)"
          @contextmenu.prevent.stop="onWaypointContextMenu($event, route.id, i)"
        >
          <template v-if="drawingRouteId === route.id || wpStyle(route) !== 'none' || selectedRouteIds?.has(route.id) || selectedWaypointKey?.routeId === route.id || route.points[i]?.pinId !== undefined">
            <!-- Hit area — for locked waypoints (pinId set), extend to cover the full pin marker
                 width (iconSize [40,*] = ±20 px from center). The default hitR for smaller sizes
                 can fall short of that, leaving a gap where caption or map background captures
                 the click instead of the route. 28 px clears the 20 px half-width with margin. -->
            <circle :cx="x" :cy="y" :r="route.points[i]?.pinId !== undefined ? Math.max(WP_SIZE[route.waypointSize ?? 'm'].hitR, 28) : WP_SIZE[route.waypointSize ?? 'm'].hitR" fill="transparent" />

            <!-- Active drawing anchor ring -->
            <circle v-if="drawingRouteId === route.id && drawingAnchorIndex === i" :cx="x" :cy="y" :r="WP_SIZE[route.waypointSize ?? 'm'].r + 5" fill="none" :stroke="route.color" stroke-width="2" stroke-dasharray="4 2" style="pointer-events: none" />

            <!-- Circle — hidden when a pin is linked (pin replaces it visually) -->
            <circle v-if="(drawingRouteId === route.id || wpStyle(route) === 'circle') && route.points[i]?.pinId === undefined" :cx="x" :cy="y" :r="WP_SIZE[route.waypointSize ?? 'm'].r" :fill="waypointColor(route, i)" stroke="white" stroke-width="2" :filter="selectedWaypointKey?.routeId === route.id && selectedWaypointKey?.pointIndex === i ? 'url(#mf-wp-sel-active)' : selectedRouteIds?.has(route.id) && drawingRouteId !== route.id ? 'url(#mf-wp-sel)' : undefined" />

            <!-- Square -->
            <rect v-else-if="wpStyle(route) === 'square' && route.points[i]?.pinId === undefined" :x="x - WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 0.75" :y="y - WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 0.75" :width="WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 1.5" :height="WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 1.5" rx="1.5" :fill="waypointColor(route, i)" stroke="white" stroke-width="2" :filter="selectedWaypointKey?.routeId === route.id && selectedWaypointKey?.pointIndex === i ? 'url(#mf-wp-sel-active)' : selectedRouteIds?.has(route.id) ? 'url(#mf-wp-sel)' : undefined" />

            <!-- Diamond -->
            <rect v-else-if="wpStyle(route) === 'diamond' && route.points[i]?.pinId === undefined" :x="x - WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 0.75" :y="y - WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 0.75" :width="WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 1.5" :height="WP_SIZE[route.waypointSize ?? 'm'].sqHalf * 1.5" rx="1.5" :fill="waypointColor(route, i)" stroke="white" stroke-width="2" :transform="`rotate(45 ${x} ${y})`" :filter="selectedWaypointKey?.routeId === route.id && selectedWaypointKey?.pointIndex === i ? 'url(#mf-wp-sel-active)' : selectedRouteIds?.has(route.id) ? 'url(#mf-wp-sel)' : undefined" />

            <!-- Ghost dot: none-style unlinked waypoint when route or any waypoint in it is selected -->
            <circle v-else-if="(selectedRouteIds?.has(route.id) || selectedWaypointKey?.routeId === route.id) && wpStyle(route) === 'none' && route.points[i]?.pinId === undefined && drawingRouteId !== route.id" :cx="x" :cy="y" :r="selectedWaypointKey?.routeId === route.id && selectedWaypointKey?.pointIndex === i ? 7 : 5" fill="none" :stroke="route.color" :stroke-width="selectedWaypointKey?.routeId === route.id && selectedWaypointKey?.pointIndex === i ? 2 : 1.5" :stroke-dasharray="selectedWaypointKey?.routeId === route.id && selectedWaypointKey?.pointIndex === i ? undefined : '3 2'" stroke-opacity="0.85" style="pointer-events: none" />

            <!-- Number overlay — hidden when a pin is linked -->
            <text v-if="(drawingRouteId === route.id || wpShowNumber(route)) && route.points[i]?.pinId === undefined" :x="x" :y="y" text-anchor="middle" dominant-baseline="central" :font-size="WP_SIZE[route.waypointSize ?? 'm'].fontSize" fill="white" font-weight="bold" style="user-select: none; pointer-events: none">{{ i + 1 }}</text>
          </template>
        </g>
      </g>
    </svg>
  </Teleport>
</template>
