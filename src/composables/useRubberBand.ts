import L from 'leaflet'
import { type Ref, ref, watch } from 'vue'

export interface RubberBandRect {
  x: number
  y: number
  w: number
  h: number
}

export function useRubberBand(leafletMap: Ref<L.Map | null>, isInteracting: Ref<boolean>, onSelect: (bounds: L.LatLngBounds) => void) {
  const band = ref<RubberBandRect | null>(null)

  let startX = 0
  let startY = 0
  let active = false

  function onMapMouseDown(e: L.LeafletMouseEvent) {
    if (!e.originalEvent.shiftKey) return
    if (isInteracting.value) return

    const target = e.originalEvent.target as Element
    if (target.closest('.leaflet-marker-icon') || target.closest('[data-caption-id]') || target.closest('[data-route-id]')) return

    const map = leafletMap.value!
    const rect = map.getContainer().getBoundingClientRect()
    startX = e.originalEvent.clientX - rect.left
    startY = e.originalEvent.clientY - rect.top
    active = true
    band.value = { x: startX, y: startY, w: 0, h: 0 }

    map.dragging.disable()
    e.originalEvent.preventDefault()

    document.addEventListener('pointermove', onPointerMove, { capture: true })
    document.addEventListener('pointerup', onPointerUp, { capture: true })
    document.addEventListener('pointercancel', cancel, { capture: true })
  }

  function onPointerMove(e: PointerEvent) {
    if (!active || !leafletMap.value) return
    const rect = leafletMap.value.getContainer().getBoundingClientRect()
    const curX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const curY = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
    band.value = {
      x: Math.min(startX, curX),
      y: Math.min(startY, curY),
      w: Math.abs(curX - startX),
      h: Math.abs(curY - startY)
    }
  }

  function onPointerUp(e: PointerEvent) {
    cleanup()
    if (!leafletMap.value) return
    const map = leafletMap.value
    map.dragging.enable()

    // Use the final pointer position from the pointerup event directly — pointermove
    // events are coalesced by the browser, so band.value may lag behind the actual
    // release point, causing items near the drawn edge to be missed.
    const rect = map.getContainer().getBoundingClientRect()
    const curX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const curY = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
    band.value = null
    const w = Math.abs(curX - startX)
    const h = Math.abs(curY - startY)
    if (w < 8 || h < 8) return

    const x = Math.min(startX, curX)
    const y = Math.min(startY, curY)
    const sw = map.containerPointToLatLng([x, y + h])
    const ne = map.containerPointToLatLng([x + w, y])
    // Leaflet fires a `click` event after pointerup because dragging was disabled (so
    // _moved() is false). Suppress it so handleMapClick can't call clearSelection().
    document.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true })
    onSelect(L.latLngBounds(sw, ne))
  }

  function cancel() {
    cleanup()
    leafletMap.value?.dragging.enable()
    band.value = null
  }

  function cleanup() {
    active = false
    document.removeEventListener('pointermove', onPointerMove, { capture: true })
    document.removeEventListener('pointerup', onPointerUp, { capture: true })
    document.removeEventListener('pointercancel', cancel, { capture: true })
  }

  watch(
    leafletMap,
    (map, old) => {
      if (old) old.off('mousedown', onMapMouseDown as unknown as L.LeafletEventHandlerFn)
      if (map) map.on('mousedown', onMapMouseDown as unknown as L.LeafletEventHandlerFn)
    },
    { immediate: true }
  )

  return { band }
}
