import L from 'leaflet'

import type { Pin, PinDotShape, PinDotSize } from '@/types'

interface UsePinPlacementOptions {
  pins: Ref<Pin[]>
  isPlacingPin: Ref<boolean>
  placingPinCount: Ref<number>
  stickyEmoji: Ref<string>
  stickyColor: Ref<string>
  stickyDotSize: Ref<PinDotSize>
  stickyDotShape: Ref<PinDotShape>
  stickyShowNumber: Ref<boolean>
  history: { push: (label?: string) => void }
  fetchPinAddress: (lat: number, lng: number) => Promise<string | undefined>
  openEditPin: (pin: Pin) => void
  searchLocation: Ref<{ lat: number; lng: number; label: string } | null>
  stopDrawing: () => void
  activeFab: Ref<string | null>
}

export function usePinPlacement({ pins, isPlacingPin, placingPinCount, stickyEmoji, stickyColor, stickyDotSize, stickyDotShape, stickyShowNumber, history, fetchPinAddress, openEditPin, searchLocation, stopDrawing, activeFab }: UsePinPlacementOptions) {
  function handlePinPlace(latlng: L.LatLng) {
    const pin: Pin = {
      id: uid(),
      name: '',
      description: '',
      emoji: stickyEmoji.value,
      color: stickyColor.value,
      dotSize: stickyDotSize.value,
      dotShape: stickyDotShape.value,
      showNumber: stickyShowNumber.value || undefined,
      lat: latlng.lat,
      lng: latlng.lng
    }
    history.push('add pin')
    pins.value = [...pins.value, pin]
    isPlacingPin.value = true
    placingPinCount.value++
    fetchPinAddress(latlng.lat, latlng.lng).then((address) => {
      pins.value = pins.value.map((p) => (p.id === pin.id ? { ...p, address } : p))
    })
  }

  function handlePinPlaceSingle(latlng: L.LatLng) {
    const pin: Pin = {
      id: uid(),
      name: '',
      description: '',
      emoji: stickyEmoji.value,
      color: stickyColor.value,
      dotSize: stickyDotSize.value,
      dotShape: stickyDotShape.value,
      showNumber: stickyShowNumber.value || undefined,
      lat: latlng.lat,
      lng: latlng.lng
    }
    history.push('add pin')
    pins.value = [...pins.value, pin]
    fetchPinAddress(latlng.lat, latlng.lng).then((address) => {
      pins.value = pins.value.map((p) => (p.id === pin.id ? { ...p, address } : p))
    })
    openEditPin(pin)
  }

  function handleSearchMarkerPin(lat: number, lng: number) {
    searchLocation.value = null
    stopDrawing()
    handlePinPlace(L.latLng(lat, lng))
  }

  function placeAtCenter() {
    activeFab.value = null
    stopDrawing()
    isPlacingPin.value = true
  }

  return { handlePinPlace, handlePinPlaceSingle, handleSearchMarkerPin, placeAtCenter }
}
