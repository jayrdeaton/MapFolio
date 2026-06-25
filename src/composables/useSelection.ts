export function useSelection() {
  const selectedPinIds = ref<Set<number>>(new Set())
  const selectedRouteIds = ref<Set<number>>(new Set())
  const selectedCaptionIds = ref<Set<number>>(new Set())
  const selectedPrintAreaIds = ref<Set<string>>(new Set())
  const selectedWaypointKey = ref<{ routeId: number; pointIndex: number } | null>(null)

  const hasSelection = computed(() => selectedPinIds.value.size > 0 || selectedRouteIds.value.size > 0 || selectedCaptionIds.value.size > 0 || selectedPrintAreaIds.value.size > 0 || selectedWaypointKey.value !== null)

  function selectPin(id: number, additive: boolean) {
    selectedWaypointKey.value = null
    if (additive) {
      const next = new Set(selectedPinIds.value)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      selectedPinIds.value = next
    } else {
      selectedPinIds.value = new Set([id])
      selectedRouteIds.value = new Set()
      selectedCaptionIds.value = new Set()
    }
  }

  function selectRoute(id: number, additive: boolean) {
    selectedWaypointKey.value = null
    if (additive) {
      const next = new Set(selectedRouteIds.value)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      selectedRouteIds.value = next
    } else {
      selectedRouteIds.value = new Set([id])
      selectedPinIds.value = new Set()
      selectedCaptionIds.value = new Set()
    }
  }

  function selectCaption(id: number, additive: boolean) {
    selectedWaypointKey.value = null
    if (additive) {
      const next = new Set(selectedCaptionIds.value)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      selectedCaptionIds.value = next
    } else {
      selectedCaptionIds.value = new Set([id])
      selectedPinIds.value = new Set()
      selectedRouteIds.value = new Set()
    }
  }

  function selectPrintArea(id: string, additive: boolean) {
    selectedWaypointKey.value = null
    if (additive) {
      const next = new Set(selectedPrintAreaIds.value)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      selectedPrintAreaIds.value = next
    } else {
      selectedPrintAreaIds.value = new Set([id])
    }
  }

  function selectWaypoint(routeId: number, pointIndex: number) {
    selectedWaypointKey.value = { routeId, pointIndex }
    selectedPinIds.value = new Set()
    selectedRouteIds.value = new Set()
    selectedCaptionIds.value = new Set()
    selectedPrintAreaIds.value = new Set()
  }

  function clearSelection() {
    selectedPinIds.value = new Set()
    selectedRouteIds.value = new Set()
    selectedCaptionIds.value = new Set()
    selectedPrintAreaIds.value = new Set()
    selectedWaypointKey.value = null
  }

  return { selectedPinIds, selectedRouteIds, selectedCaptionIds, selectedPrintAreaIds, selectedWaypointKey, hasSelection, selectPin, selectRoute, selectCaption, selectPrintArea, selectWaypoint, clearSelection }
}
