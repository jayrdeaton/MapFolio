import type L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { Pin } from '@/types'

export function usePins(options: { initialPins: Pin[]; leafletMap: ShallowRef<L.Map | null>; showNotification: (message: string, type?: 'success' | 'error' | 'info') => void; pushHistory: (label?: string) => void }) {
  const { initialPins, leafletMap, showNotification } = options

  const pins = ref<Pin[]>(initialPins)
  const hiddenPinIds = computed(() => new Set(pins.value.filter((p) => p.hidden).map((p) => p.id)))
  const resolvingPinId = ref<number | null>(null)
  const addressResolveProg = ref<{ done: number; total: number } | null>(null)
  const pinSearch = ref('')

  const filteredPins = computed(() => {
    const q = pinSearch.value.trim().toLowerCase()
    if (!q) return pins.value
    return pins.value.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.emoji.includes(pinSearch.value.trim()) || (p.address?.toLowerCase().includes(q) ?? false))
  })

  const allPinsHidden = computed(() => pins.value.length > 0 && pins.value.every((p) => p.hidden))

  async function fetchPinAddress(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`, { headers: { 'Accept-Language': 'en' } })
      const data = await res.json()
      const a = data.address ?? {}
      const street = [a.house_number, a.road].filter(Boolean).join(' ')
      const locality = a.city || a.town || a.village || a.suburb || a.municipality || a.county || ''
      const region = a.state || a.country || ''
      return [street, locality, region].filter(Boolean).join(', ') || data.display_name || ''
    } catch {
      return ''
    }
  }

  // recordHistory=false lets a caller push its own snapshot first (e.g. to capture
  // route-link cleanup in the same undo step) without a redundant second push.
  function handleDeletePin(id: number, recordHistory = true) {
    if (recordHistory) options.pushHistory('delete pin')
    pins.value = pins.value.filter((p) => p.id !== id)
    showNotification('Pin removed')
  }

  function handleUpdatePin(updated: Pin) {
    options.pushHistory('edit pin')
    pins.value = pins.value.map((p) => (p.id === updated.id ? updated : p))
  }

  function handlePinMove(id: number, lat: number, lng: number) {
    pins.value = pins.value.map((p) => (p.id === id ? { ...p, lat, lng } : p))
    fetchPinAddress(lat, lng).then((address) => {
      pins.value = pins.value.map((p) => (p.id === id ? { ...p, address } : p))
    })
  }

  function togglePinVisibility(id: number) {
    const isHidden = pins.value.find((p) => p.id === id)?.hidden ?? false
    options.pushHistory(isHidden ? 'show pin' : 'hide pin')
    pins.value = pins.value.map((p) => (p.id === id ? { ...p, hidden: !p.hidden } : p))
  }

  function toggleAllPinVisibility() {
    const hide = !allPinsHidden.value
    options.pushHistory(hide ? 'hide all pins' : 'show all pins')
    pins.value = pins.value.map((p) => ({ ...p, hidden: hide }))
  }

  function clearAllPins(): boolean {
    const n = pins.value.length
    if (n === 0) return false
    if (!window.confirm(`Delete all ${n} pin${n === 1 ? '' : 's'}?\n\nThis is permanent and cannot be undone.`)) return false
    options.pushHistory('clear pins')
    pins.value = []
    showNotification('All pins cleared')
    return true
  }

  function fitToPins() {
    if (!leafletMap.value) return
    const visible = pins.value.filter((p) => !hiddenPinIds.value.has(p.id))
    if (visible.length === 0) {
      showNotification('No visible pins to fit', 'error')
      return
    }
    leafletMap.value.fitBounds(
      visible.map((p) => [p.lat, p.lng] as L.LatLngTuple),
      { padding: [60, 60], animate: true }
    )
  }

  function zoomToPin(pin: Pin) {
    if (!leafletMap.value) return
    leafletMap.value.setView([pin.lat, pin.lng], Math.max(leafletMap.value.getZoom(), 15), { animate: true, duration: 0.8 })
  }

  async function resolveAddressesFromUrl(missing: Pin[]) {
    if (missing.length === 0) return
    addressResolveProg.value = { done: 0, total: missing.length }
    for (let i = 0; i < missing.length; i++) {
      const pin = missing[i]!
      resolvingPinId.value = pin.id
      const address = await fetchPinAddress(pin.lat, pin.lng)
      if (address) pins.value = pins.value.map((p) => (p.id === pin.id ? { ...p, address } : p))
      resolvingPinId.value = null
      addressResolveProg.value = { done: i + 1, total: missing.length }
      if (i < missing.length - 1) await new Promise((r) => setTimeout(r, 1100))
    }
    await new Promise((r) => setTimeout(r, 1200))
    addressResolveProg.value = null
  }

  function resetPins(newPins: Pin[]) {
    pins.value = newPins
  }

  return {
    pins,
    hiddenPinIds,
    resolvingPinId,
    addressResolveProg,
    pinSearch,
    filteredPins,
    allPinsHidden,
    fetchPinAddress,
    handleDeletePin,
    handleUpdatePin,
    handlePinMove,
    togglePinVisibility,
    toggleAllPinVisibility,
    clearAllPins,
    fitToPins,
    zoomToPin,
    resolveAddressesFromUrl,
    resetPins
  }
}
