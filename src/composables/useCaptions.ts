import type L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { Caption } from '@/types'

export function useCaptions(options: { initialCaptions: Caption[]; leafletMap: ShallowRef<L.Map | null>; showNotification: (message: string, type?: 'success' | 'error' | 'info') => void; pushHistory: (label?: string) => void }) {
  const { initialCaptions, leafletMap, showNotification } = options

  const captions = ref<Caption[]>(initialCaptions)
  const hiddenCaptionIds = computed(() => new Set(captions.value.filter((c) => c.hidden).map((c) => c.id)))
  const captionSearch = ref('')

  const filteredCaptions = computed(() => {
    const q = captionSearch.value.trim().toLowerCase()
    if (!q) return captions.value
    return captions.value.filter((c) => c.text.toLowerCase().includes(q))
  })

  const allCaptionsHidden = computed(() => captions.value.length > 0 && captions.value.every((c) => c.hidden))

  function handleDeleteCaption(id: number) {
    options.pushHistory('delete caption')
    captions.value = captions.value.filter((c) => c.id !== id)
    showNotification('Caption removed')
  }

  function handleUpdateCaption(updated: Caption) {
    options.pushHistory('edit caption')
    captions.value = captions.value.map((c) => (c.id === updated.id ? updated : c))
  }

  function handleCaptionMove(id: number, lat: number, lng: number) {
    captions.value = captions.value.map((c) => (c.id === id ? { ...c, lat, lng } : c))
  }

  function toggleCaptionVisibility(id: number) {
    const isHidden = captions.value.find((c) => c.id === id)?.hidden ?? false
    options.pushHistory(isHidden ? 'show caption' : 'hide caption')
    captions.value = captions.value.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c))
  }

  function toggleAllCaptionVisibility() {
    const hide = !allCaptionsHidden.value
    options.pushHistory(hide ? 'hide all captions' : 'show all captions')
    captions.value = captions.value.map((c) => ({ ...c, hidden: hide }))
  }

  function clearAllCaptions() {
    const n = captions.value.length
    if (n === 0) return
    if (!window.confirm(`Delete all ${n} caption${n === 1 ? '' : 's'}?\n\nThis is permanent and cannot be undone.`)) return
    options.pushHistory('clear captions')
    captions.value = []
    showNotification('All captions cleared')
  }

  function fitToCaptions() {
    if (!leafletMap.value) return
    const visible = captions.value.filter((c) => !hiddenCaptionIds.value.has(c.id))
    if (visible.length === 0) {
      showNotification('No visible captions to fit', 'error')
      return
    }
    leafletMap.value.fitBounds(
      visible.map((c) => [c.lat, c.lng] as L.LatLngTuple),
      { padding: [60, 60], animate: true }
    )
  }

  function zoomToCaption(caption: Caption) {
    if (!leafletMap.value) return
    leafletMap.value.setView([caption.lat, caption.lng], Math.max(leafletMap.value.getZoom(), 15), { animate: true, duration: 0.8 })
  }

  function resetCaptions(newCaptions: Caption[]) {
    captions.value = newCaptions
  }

  return {
    captions,
    hiddenCaptionIds,
    captionSearch,
    filteredCaptions,
    allCaptionsHidden,
    handleDeleteCaption,
    handleUpdateCaption,
    handleCaptionMove,
    toggleCaptionVisibility,
    toggleAllCaptionVisibility,
    clearAllCaptions,
    fitToCaptions,
    zoomToCaption,
    resetCaptions
  }
}
