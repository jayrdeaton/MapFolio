import type { Route } from '../types'

export function useKeyboardShortcuts(options: { showInfo: Ref<boolean>; closeInfo: () => void; editingRoute: Ref<Route | null>; closeEditRoute: () => void; bottomSheet: Ref<boolean>; closeSheet: () => void; showMapsPanel: Ref<boolean>; activeFab: Ref<string | null>; showSearch: Ref<boolean>; isPlacingPin: Ref<boolean>; isDrawingRoute: Ref<boolean>; stopDrawing: () => void; undoLastPoint: () => void; undo: () => void }) {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (options.showInfo.value) {
        options.closeInfo()
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
      if (options.isDrawingRoute.value) {
        options.stopDrawing()
        return
      }
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && options.isDrawingRoute.value) {
      const target = e.target as HTMLElement
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
        e.preventDefault()
        options.undoLastPoint()
        return
      }
    }
    if (!((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey)) return
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
    e.preventDefault()
    options.undo()
  }

  onMounted(() => document.addEventListener('keydown', handleKeyDown))
  onUnmounted(() => document.removeEventListener('keydown', handleKeyDown))
}
