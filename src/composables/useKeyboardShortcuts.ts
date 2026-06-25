import type { Route } from '@/types'

export function useKeyboardShortcuts(options: {
  showInfo: Ref<boolean>
  closeInfo: () => void
  openInfo: () => void
  editingRoute: Ref<Route | null>
  closeEditRoute: () => void
  editingCaption: Ref<unknown>
  closeCaptionSheet: () => void
  bottomSheet: Ref<boolean>
  closeSheet: () => void
  showMapsPanel: Ref<boolean>
  activeFab: Ref<string | null>
  showSearch: Ref<boolean>
  isPlacingPin: Ref<boolean>
  isPlacingCaption: Ref<boolean>
  stopPlacingCaption: () => void
  isDrawingRoute: Ref<boolean>
  stopDrawing: () => void
  isAdjustingPrintArea: Ref<boolean>
  hasSelection: Ref<boolean>
  deleteSelection: () => void
  copySelection: () => void
  cutSelection: () => void
  toggleSelectionVisibility: () => void
  editSelection: () => void
  fitSelection: () => void
  activatePrintArea: () => void
  clearPrintBounds: () => void
  deleteActivePrintArea: () => void
  toggleActivePrintAreaVisibility: () => void
  editActivePrintArea: () => void
  fitActivePrintArea: () => void
  startPlacingPin: () => void
  startNewRoute: () => void
  startPlacingCaption: () => void
  closeAllPills: () => void
  undoLastPoint: () => void
  undo: () => void
  redo: () => void
  pasteAtCenter: () => void
  saveActiveForm: () => void
}) {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (options.showInfo.value) {
        options.closeInfo()
        return
      }
      if (options.editingCaption.value) {
        options.closeCaptionSheet()
        return
      }
      if (options.editingRoute.value) {
        options.closeEditRoute()
        return
      }
      if (options.bottomSheet.value) {
        options.closeSheet()
        return
      }
      if (options.showMapsPanel.value) {
        options.showMapsPanel.value = false
        return
      }
      if (options.activeFab.value) {
        options.activeFab.value = null
        return
      }
      if (options.showSearch.value) {
        options.showSearch.value = false
        return
      }
      if (options.isPlacingPin.value) {
        options.isPlacingPin.value = false
        return
      }
      if (options.isPlacingCaption.value) {
        options.stopPlacingCaption()
        return
      }
      if (options.isDrawingRoute.value) {
        options.stopDrawing()
        return
      }
      if (options.isAdjustingPrintArea.value) {
        options.clearPrintBounds()
        return
      }
      return
    }
    const target = e.target as HTMLElement
    const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
    // Delete / Backspace removes the current selection or the active print area.
    if (!inInput && (e.key === 'Delete' || e.key === 'Backspace')) {
      if (options.hasSelection.value) {
        e.preventDefault()
        options.deleteSelection()
        return
      }
      if (options.isAdjustingPrintArea.value) {
        e.preventDefault()
        options.deleteActivePrintArea()
        return
      }
    }
    if (!inInput && !e.metaKey && !e.ctrlKey && e.key === 'h') {
      if (options.hasSelection.value) {
        e.preventDefault()
        options.toggleSelectionVisibility()
        return
      }
      if (options.isAdjustingPrintArea.value) {
        e.preventDefault()
        options.toggleActivePrintAreaVisibility()
        return
      }
    }
    if (!inInput && !e.metaKey && !e.ctrlKey && e.key === 'e') {
      if (options.hasSelection.value) {
        e.preventDefault()
        options.editSelection()
        return
      }
      if (options.isAdjustingPrintArea.value) {
        e.preventDefault()
        options.editActivePrintArea()
        return
      }
    }
    if (!inInput && !e.metaKey && !e.ctrlKey && e.key === 'f') {
      if (options.hasSelection.value) {
        e.preventDefault()
        options.fitSelection()
        return
      }
      if (options.isAdjustingPrintArea.value) {
        e.preventDefault()
        options.fitActivePrintArea()
        return
      }
    }
    if (!inInput && !e.metaKey && !e.ctrlKey && e.key === 'a') {
      e.preventDefault()
      options.activatePrintArea()
      return
    }
    const anyFormOpen = options.bottomSheet.value || !!options.editingRoute.value || !!options.editingCaption.value
    if (!inInput && !anyFormOpen && !e.metaKey && !e.ctrlKey && e.key === 'p') {
      e.preventDefault()
      options.startPlacingPin()
      return
    }
    if (!inInput && !anyFormOpen && !e.metaKey && !e.ctrlKey && e.key === 'r') {
      e.preventDefault()
      options.startNewRoute()
      return
    }
    if (!inInput && !anyFormOpen && !e.metaKey && !e.ctrlKey && e.key === 'c') {
      e.preventDefault()
      options.startPlacingCaption()
      return
    }
    if (!inInput && e.key === '?') {
      e.preventDefault()
      options.openInfo()
      return
    }
    // Enter saves the open form, or closes whichever pill is open.
    if (e.key === 'Enter') {
      const anyFormOpen = options.bottomSheet.value || !!options.editingRoute.value || !!options.editingCaption.value
      if (anyFormOpen && !inInput) {
        e.preventDefault()
        options.saveActiveForm()
        return
      }
      const anyPillOpen = options.isPlacingPin.value || options.isPlacingCaption.value || options.isDrawingRoute.value || options.isAdjustingPrintArea.value || options.hasSelection.value
      if (!inInput && anyPillOpen) {
        e.preventDefault()
        options.closeAllPills()
        return
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && options.isDrawingRoute.value && !inInput) {
      e.preventDefault()
      options.undoLastPoint()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey && !inInput) {
      e.preventDefault()
      options.redo()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'y' && !inInput) {
      e.preventDefault()
      options.redo()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !inInput && options.hasSelection.value) {
      e.preventDefault()
      options.copySelection()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'x' && !inInput && options.hasSelection.value) {
      e.preventDefault()
      options.cutSelection()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !inInput) {
      e.preventDefault()
      options.pasteAtCenter()
      return
    }
    if (!((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey)) return
    if (inInput) return
    e.preventDefault()
    options.undo()
  }

  onMounted(() => document.addEventListener('keydown', handleKeyDown))
  onUnmounted(() => document.removeEventListener('keydown', handleKeyDown))
}
