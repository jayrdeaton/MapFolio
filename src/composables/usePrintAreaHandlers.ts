import type L from 'leaflet'
import type { ComputedRef, Ref, ShallowRef } from 'vue'

import type { useSelection } from '@/composables/useSelection'
import type { PrintArea, PrintOrientation, PrintPaperSize } from '@/types'
import { printAreaPlaceholder } from '@/utils'

interface UsePrintAreaHandlersOptions {
  printAreas: ComputedRef<PrintArea[]>
  updatePrintAreas: (areas: PrintArea[]) => void
  mapName: ComputedRef<string>
  selection: ReturnType<typeof useSelection>
  history: { push: (label: string) => void }
  activePrintAreaId: Ref<string | null>
  activePrintArea: ComputedRef<PrintArea | null>
  printBounds: ComputedRef<L.LatLngBounds | null>
  hasNonPrintSelection: ComputedRef<boolean>
  addPrintArea: (opts: { paper: PrintPaperSize; orientation: PrintOrientation }) => void
  deletePrintArea: (id: string) => void
  selectPrintArea: (id: string) => void
  deselectPrintArea: () => void
  patchPrintArea: (id: string, patch: Partial<PrintArea>) => void
  fitPrintAreaToElements: () => void
  openPreview: () => void
  printSettings: { stickyPaper: Ref<PrintPaperSize>; stickyOrientation: Ref<PrintOrientation> }
  activeFab: Ref<string | null>
  leafletMap: ShallowRef<L.Map | null>
}

export function usePrintAreaHandlers({ printAreas, updatePrintAreas, mapName, selection, history, activePrintAreaId, activePrintArea: _activePrintArea, printBounds, hasNonPrintSelection, addPrintArea, deletePrintArea, selectPrintArea, deselectPrintArea, patchPrintArea, fitPrintAreaToElements, openPreview, printSettings, activeFab, leafletMap }: UsePrintAreaHandlersOptions) {
  const showPrintAreaForm = ref(false)
  const editingPrintArea = ref<PrintArea | null>(null)

  const editingPrintAreaPlaceholder = computed(() => (editingPrintArea.value && !editingPrintArea.value.title ? printAreaPlaceholder(editingPrintArea.value.id, printAreas.value, mapName.value) : undefined))

  function handleAddPrintArea() {
    selection.clearSelection()
    history.push('add print')
    addPrintArea({ paper: printSettings.stickyPaper.value, orientation: printSettings.stickyOrientation.value })
    activeFab.value = null
  }

  function handlePrintAreaSave(area: PrintArea) {
    history.push('edit print')
    patchPrintArea(area.id, area)
    printSettings.stickyPaper.value = area.paper
    printSettings.stickyOrientation.value = area.orientation
    showPrintAreaForm.value = false
    editingPrintArea.value = null
  }

  function handlePrintAreaDelete() {
    if (!editingPrintArea.value) return
    history.push('delete print')
    deletePrintArea(editingPrintArea.value.id)
    showPrintAreaForm.value = false
    editingPrintArea.value = null
  }

  function handlePrintAreaEdit(id: string) {
    const area = printAreas.value.find((a) => a.id === id)
    if (!area) return
    editingPrintArea.value = area
    showPrintAreaForm.value = true
  }

  function handleSelectPrintArea(id: string, additive: boolean) {
    leafletMap.value?.closePopup()
    const hasOtherSelection = hasNonPrintSelection.value || selection.selectedPrintAreaIds.value.size > 0 || activePrintAreaId.value !== null
    if (additive && hasOtherSelection) {
      const next = new Set(selection.selectedPrintAreaIds.value)
      if (activePrintAreaId.value) next.add(activePrintAreaId.value)
      deselectPrintArea()
      if (next.has(id)) next.delete(id)
      else next.add(id)
      selection.selectedPrintAreaIds.value = next
    } else {
      selection.clearSelection()
      selectPrintArea(id)
    }
  }

  function handlePrintAreaDownload() {
    const id = activePrintAreaId.value ?? [...selection.selectedPrintAreaIds.value][0]
    if (!id) return
    if (!activePrintAreaId.value) selectPrintArea(id)
    openPreview()
  }

  function handleFitPrintAreaToElements() {
    if (printBounds.value) history.push('fit print to pins')
    fitPrintAreaToElements()
  }

  function handlePrintAreaClose() {
    showPrintAreaForm.value = false
    editingPrintArea.value = null
  }

  function reorderPrintAreas(newAreas: PrintArea[]) {
    history.push('reorder prints')
    updatePrintAreas(newAreas)
  }

  return {
    showPrintAreaForm,
    editingPrintArea,
    editingPrintAreaPlaceholder,
    handleAddPrintArea,
    handlePrintAreaSave,
    handlePrintAreaDelete,
    handlePrintAreaEdit,
    handlePrintAreaClose,
    handleSelectPrintArea,
    handlePrintAreaDownload,
    handleFitPrintAreaToElements,
    reorderPrintAreas
  }
}
