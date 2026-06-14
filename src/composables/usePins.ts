import type L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { Pin } from '../types'
import { parseGeoJsonImport, parsePinImport, pinsToGeoJson } from '../utils'

export function usePins(options: { initialPins: Pin[]; mapTitle: Ref<string>; leafletMap: ShallowRef<L.Map | null>; importFileRef: Ref<HTMLInputElement | null>; showNotification: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const { initialPins, mapTitle, leafletMap, importFileRef, showNotification } = options

  const pins = ref<Pin[]>(initialPins)
  const hiddenPinIds = ref<Set<number>>(new Set())
  const undoStack = ref<Pin[][]>([])
  const resolvingPinId = ref<number | null>(null)
  const addressResolveProg = ref<{ done: number; total: number } | null>(null)
  const pinSearch = ref('')

  const filteredPins = computed(() => {
    const q = pinSearch.value.trim().toLowerCase()
    if (!q) return pins.value
    return pins.value.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.emoji.includes(pinSearch.value.trim()) || (p.address?.toLowerCase().includes(q) ?? false))
  })

  const canUndo = computed(() => undoStack.value.length > 0)
  const allPinsHidden = computed(() => pins.value.length > 0 && pins.value.every((p) => hiddenPinIds.value.has(p.id)))

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

  function pushUndo() {
    undoStack.value = [...undoStack.value.slice(-19), [...pins.value]]
  }

  function undo() {
    if (undoStack.value.length === 0) return
    pins.value = undoStack.value[undoStack.value.length - 1]!
    undoStack.value = undoStack.value.slice(0, -1)
    showNotification('Undone')
  }

  function handleDeletePin(id: number) {
    pushUndo()
    hiddenPinIds.value.delete(id)
    pins.value = pins.value.filter((p) => p.id !== id)
    showNotification('Pin removed')
  }

  function handleUpdatePin(updated: Pin) {
    pushUndo()
    pins.value = pins.value.map((p) => (p.id === updated.id ? updated : p))
  }

  function handlePinMove(id: number, lat: number, lng: number) {
    pushUndo()
    pins.value = pins.value.map((p) => (p.id === id ? { ...p, lat, lng } : p))
    fetchPinAddress(lat, lng).then((address) => {
      pins.value = pins.value.map((p) => (p.id === id ? { ...p, address } : p))
    })
  }

  function togglePinVisibility(id: number) {
    const next = new Set(hiddenPinIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    hiddenPinIds.value = next
  }

  function toggleAllPinVisibility() {
    hiddenPinIds.value = allPinsHidden.value ? new Set() : new Set(pins.value.map((p) => p.id))
  }

  function clearAllPins() {
    if (!window.confirm('Remove all pins?')) return
    pushUndo()
    hiddenPinIds.value = new Set()
    pins.value = []
    showNotification('All pins cleared')
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

  function exportPinsJson() {
    if (pins.value.length === 0) {
      showNotification('No pins to export', 'error')
      return
    }
    const data = JSON.stringify({ pins: pins.value, mapTitle: mapTitle.value }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mapTitle.value || 'mapfolio'}-pins.json`
    a.click()
    URL.revokeObjectURL(url)
    showNotification(`Exported ${pins.value.length} pin${pins.value.length !== 1 ? 's' : ''}`)
  }

  function exportGeoJson() {
    if (pins.value.length === 0) {
      showNotification('No pins to export', 'error')
      return
    }
    const blob = new Blob([JSON.stringify(pinsToGeoJson(pins.value), null, 2)], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mapTitle.value || 'mapfolio'}.geojson`
    a.click()
    URL.revokeObjectURL(url)
    showNotification('GeoJSON exported!')
  }

  function triggerImport() {
    importFileRef.value?.click()
  }

  function handleImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = parsePinImport(text) ?? parseGeoJsonImport(text)
      if (result) {
        pushUndo()
        pins.value = [...pins.value, ...result.pins]
        if ('mapTitle' in result && result.mapTitle && !mapTitle.value) {
          mapTitle.value = result.mapTitle as string
        }
        showNotification(`Imported ${result.pins.length} pin${result.pins.length !== 1 ? 's' : ''}!`)
        if (leafletMap.value && result.pins.length > 0) {
          const bounds = result.pins.map((p) => [p.lat, p.lng] as [number, number])
          requestAnimationFrame(() => leafletMap.value?.fitBounds(bounds, { padding: [60, 60], animate: true }))
        }
      } else {
        showNotification('Invalid or unreadable pin file', 'error')
      }
      if (importFileRef.value) importFileRef.value.value = ''
    }
    reader.readAsText(file)
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
    hiddenPinIds.value = new Set()
    undoStack.value = []
  }

  return {
    pins,
    hiddenPinIds,
    undoStack,
    resolvingPinId,
    addressResolveProg,
    pinSearch,
    filteredPins,
    canUndo,
    allPinsHidden,
    fetchPinAddress,
    pushUndo,
    undo,
    handleDeletePin,
    handleUpdatePin,
    handlePinMove,
    togglePinVisibility,
    toggleAllPinVisibility,
    clearAllPins,
    fitToPins,
    zoomToPin,
    exportPinsJson,
    exportGeoJson,
    triggerImport,
    handleImportFile,
    resolveAddressesFromUrl,
    resetPins
  }
}
