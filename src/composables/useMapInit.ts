import L from 'leaflet'
import type { Ref, ShallowRef } from 'vue'

import { useLongPress } from '@/composables/useLongPress'
import type { Pin } from '@/types'

interface UseMapInitOptions {
  leafletMap: ShallowRef<L.Map | null>
  mapCenterCoords: Ref<{ lat: number; lng: number } | null>
  previewView: Ref<{ lat: number; lng: number; zoom: number }>
  hasExplicitLocation: boolean
  loadedFromUrl: boolean
  pins: Ref<Pin[]>
  resolveAddressesFromUrl: (pins: Pin[]) => void
  initClusterGroup: (map: L.Map) => void
  refreshClusterPositions: () => void
  applyTileLayer: (map: L.Map) => void
  applyLabelsLayer: (map: L.Map) => void
  flyToIpLocation: (map: L.Map) => void
  saveState: () => void
  closeMapContextPopup: () => void
  openMapContextPopup: (latlng: L.LatLng, map: L.Map) => void
  bottomSheet: Ref<boolean>
  activeFab: Ref<string | null>
  showMapsPanel: Ref<boolean>
  isPlacingPin: Ref<boolean>
  isPlacingCaption: Ref<boolean>
  isDrawingRoute: Ref<boolean>
  handlePinPlace: (latlng: L.LatLng) => void
  placeCaptionDrop: (lat: number, lng: number) => void
}

export function useMapInit({ leafletMap, mapCenterCoords, previewView, hasExplicitLocation, loadedFromUrl, pins, resolveAddressesFromUrl, initClusterGroup, refreshClusterPositions, applyTileLayer, applyLabelsLayer, flyToIpLocation, saveState, closeMapContextPopup, openMapContextPopup, bottomSheet, activeFab, showMapsPanel, isPlacingPin, isPlacingCaption, isDrawingRoute, handlePinPlace, placeCaptionDrop }: UseMapInitOptions) {
  let cleanupLongPress: (() => void) | null = null

  onUnmounted(() => {
    cleanupLongPress?.()
  })

  function onMapReady(map: L.Map) {
    initClusterGroup(map)
    leafletMap.value = map
    // Give the browser time to finish layout before correcting marker positions.
    setTimeout(refreshClusterPositions, 300)
    applyTileLayer(map)
    applyLabelsLayer(map)
    map.on('moveend', saveState)
    map.on('click', closeMapContextPopup)
    map.boxZoom.disable()
    map.zoomControl.remove()

    if (!hasExplicitLocation) flyToIpLocation(map)

    const missing = pins.value.filter((p) => !p.address)
    if (missing.length > 0) resolveAddressesFromUrl(missing)

    const updateCenter = () => {
      const c = map.getCenter()
      mapCenterCoords.value = { lat: c.lat, lng: c.lng }
    }
    updateCenter()
    map.on('move', updateCenter)

    const updatePreviewView = () => {
      const c = map.getCenter()
      previewView.value = { lat: c.lat, lng: c.lng, zoom: map.getZoom() }
    }
    updatePreviewView()
    map.on('moveend', updatePreviewView)
    map.on('zoomend', updatePreviewView)

    cleanupLongPress = useLongPress(map, {
      isBlocked: () => !!(bottomSheet.value || activeFab.value || showMapsPanel.value),
      onPlace: (latlng) => {
        if (isPlacingPin.value) {
          handlePinPlace(latlng)
          return
        }
        if (isPlacingCaption.value) {
          placeCaptionDrop(latlng.lat, latlng.lng)
          return
        }
        if (isDrawingRoute.value) return
        activeFab.value = null
        showMapsPanel.value = false
        openMapContextPopup(latlng, map)
      }
    })

    if (loadedFromUrl && pins.value.length > 0) {
      requestAnimationFrame(() => {
        map.fitBounds(
          pins.value.map((p) => [p.lat, p.lng] as [number, number]),
          { padding: [60, 60], animate: false }
        )
      })
    }
  }

  return { onMapReady }
}
