interface UseMapModeStateOptions {
  isPlacingPin: Ref<boolean>
  placingPinCount: Ref<number>
  isPlacingCaption: Ref<boolean>
  placingCaptionCount: Ref<number>
  lastPlacedCaptionId: Ref<number | null>
  isAdjustingPrintArea: Ref<boolean>
  isDrawingRoute: Ref<boolean>
  stopDrawing: () => void
  stopPlacing: () => void
  stopPlacingCaption: () => void
  hasSelection: Ref<boolean>
  clearSelection: () => void
  printAreaVisibility: Ref<'visible' | 'opaque' | 'hidden'>
  printBounds: Ref<unknown>
}

// Sets up mutual-exclusivity watchers for the five map interaction modes.
// All refs are owned by the caller; this composable only wires the watchers.
export function useMapModeState({ isPlacingPin, isPlacingCaption, isAdjustingPrintArea, isDrawingRoute, stopDrawing, stopPlacing, stopPlacingCaption, hasSelection, clearSelection, printAreaVisibility, printBounds }: UseMapModeStateOptions) {
  watch(isPlacingPin, (v) => {
    if (!v) return
    stopPlacingCaption()
    if (isDrawingRoute.value) stopDrawing()
    isAdjustingPrintArea.value = false
    clearSelection()
  })

  watch(isPlacingCaption, (v) => {
    if (!v) return
    stopPlacing()
    if (isDrawingRoute.value) stopDrawing()
    isAdjustingPrintArea.value = false
    clearSelection()
  })

  watch(isDrawingRoute, (v) => {
    if (!v) return
    stopPlacing()
    stopPlacingCaption()
    isAdjustingPrintArea.value = false
    clearSelection()
  })

  watch(isAdjustingPrintArea, (v) => {
    if (v) {
      stopPlacing()
      stopPlacingCaption()
      if (isDrawingRoute.value) stopDrawing()
      printAreaVisibility.value = 'visible'
    } else if (printBounds.value) {
      printAreaVisibility.value = 'opaque'
    }
  })

  watch(hasSelection, (has) => {
    if (!has) return
    stopPlacing()
    stopPlacingCaption()
    if (isDrawingRoute.value) stopDrawing()
    isAdjustingPrintArea.value = false
  })
}
