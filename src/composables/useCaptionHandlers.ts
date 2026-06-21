import type { Caption, CaptionSize, Route } from '@/types'

interface Selection {
  clearSelection: () => void
  hasSelection: Ref<boolean>
  selectedCaptionIds: Ref<Set<number>>
  selectedPinIds: Ref<Set<number>>
  selectedRouteIds: Ref<Set<number>>
}

interface UseCaptionHandlersOptions {
  captions: Ref<Caption[]>
  editingCaption: Ref<Caption | null>
  editingRouteRef: Ref<Route | null>
  isPlacingCaption: Ref<boolean>
  placingCaptionCount: Ref<number>
  lastPlacedCaptionId: Ref<number | null>
  stickyCaptionColor: Ref<string>
  stickyCaptionSize: Ref<CaptionSize>
  stickyCaptionBackground: Ref<boolean>
  history: { push: (label?: string) => void }
  selection: Selection
  activeFab: Ref<string | null>
  closeSheet: () => void
  closeEditRoute: () => void
  stopPlacing: () => void
  stopDrawing: () => void
  handleDeleteCaption: (id: number) => void
  handleUpdateCaption: (caption: Caption) => void
  handleCaptionMove: (id: number, lat: number, lng: number) => void
}

export function useCaptionHandlers({ captions, editingCaption, editingRouteRef, isPlacingCaption, placingCaptionCount, lastPlacedCaptionId, stickyCaptionColor, stickyCaptionSize, stickyCaptionBackground, history, selection, activeFab, closeSheet, closeEditRoute, stopPlacing, stopDrawing, handleDeleteCaption, handleUpdateCaption, handleCaptionMove }: UseCaptionHandlersOptions) {
  function openEditCaption(caption: Caption) {
    closeSheet()
    closeEditRoute()
    selection.clearSelection()
    activeFab.value = null
    editingCaption.value = { ...caption }
  }

  function closeCaptionSheet() {
    editingCaption.value = null
  }

  // The caption the on-map rotate handle tracks: the one just dropped in placing mode, the one
  // being edited, or — so single-selection gives full control without opening the sheet — the lone
  // selected caption (no other selection).
  const activeCaptionId = computed<number | null>(() => {
    if (isPlacingCaption.value) return lastPlacedCaptionId.value
    if (editingCaption.value) return editingCaption.value.id
    if (selection.selectedCaptionIds.value.size === 1 && selection.selectedPinIds.value.size === 0 && selection.selectedRouteIds.value.size === 0) {
      return [...selection.selectedCaptionIds.value][0] ?? null
    }
    return null
  })
  // editingCaption is a detached copy for the form; the map shows the real caption from captions.value.
  const activeCaption = computed(() => (activeCaptionId.value !== null ? (captions.value.find((c) => c.id === activeCaptionId.value) ?? null) : null))

  function handleCaptionSave(updated: Caption, stickyColorVal: string, stickySize: CaptionSize, stickyBackground: boolean) {
    stickyCaptionColor.value = stickyColorVal
    stickyCaptionSize.value = stickySize
    stickyCaptionBackground.value = stickyBackground
    // Preserve rotation set live via the on-map handle (the form doesn't carry it).
    const live = captions.value.find((c) => c.id === updated.id)
    handleUpdateCaption({ ...updated, rotation: live?.rotation })
    closeCaptionSheet()
  }

  function onCaptionRotateStart() {
    history.push('rotate caption')
  }

  function onCaptionRotate(deg: number) {
    const id = activeCaptionId.value
    if (id === null) return
    captions.value = captions.value.map((c) => (c.id === id ? { ...c, rotation: deg || undefined } : c))
  }

  // The route editor opens from many call sites; closing the caption sheet here keeps the two mutually exclusive.
  watch(editingRouteRef, (r) => {
    if (r) closeCaptionSheet()
  })

  // Making any selection dismisses an open caption editor (the sheet has no backdrop, so the
  // map stays clickable while editing). openEditCaption clears the selection first, so opening
  // the editor from the pill never trips this.
  watch(
    () => selection.hasSelection.value,
    (has) => {
      if (has) closeCaptionSheet()
    }
  )

  function handleCaptionDelete() {
    if (!editingCaption.value) return
    handleDeleteCaption(editingCaption.value.id)
    closeCaptionSheet()
  }

  function onCaptionMoveStart() {
    history.push('move caption')
  }

  function onCaptionMove(id: number, lat: number, lng: number) {
    handleCaptionMove(id, lat, lng)
  }

  function placeCaptionAt(lat: number, lng: number) {
    const caption: Caption = {
      id: uid(),
      text: '',
      lat,
      lng,
      color: stickyCaptionColor.value,
      size: stickyCaptionSize.value,
      background: stickyCaptionBackground.value || undefined
    }
    history.push('add caption')
    captions.value = [...captions.value, caption]
    openEditCaption(caption)
  }

  // Drops a caption at the click point during placing mode — like pin placement, it stays in the
  // mode for the next drop and does NOT open the editor. Each drop gets empty text (shown on the
  // map as 'Caption' placeholder); rotate/retitle afterwards via the on-map handle or the edit sheet.
  function placeCaptionDrop(lat: number, lng: number) {
    const caption: Caption = {
      id: uid(),
      text: '',
      lat,
      lng,
      color: stickyCaptionColor.value,
      size: stickyCaptionSize.value,
      background: stickyCaptionBackground.value || undefined
    }
    history.push('add caption')
    captions.value = [...captions.value, caption]
    placingCaptionCount.value++
    // Make it the active caption so its rotate handle appears immediately — no selection needed,
    // which would otherwise close placing mode and drop the angle-snap toggle.
    lastPlacedCaptionId.value = caption.id
  }

  function startPlacingCaption() {
    activeFab.value = null
    closeCaptionSheet()
    stopPlacing()
    stopDrawing()
    isPlacingCaption.value = true
  }

  // The pill's size stepper sets the sticky default (for the next drop) AND live-resizes the
  // active just-placed caption, so the change is visible immediately — mirrors live rotation.
  function onPlacingSizeChange(size: CaptionSize) {
    stickyCaptionSize.value = size
    const id = lastPlacedCaptionId.value
    if (id === null) return
    history.push('resize caption')
    captions.value = captions.value.map((c) => (c.id === id ? { ...c, size } : c))
  }

  return {
    openEditCaption,
    closeCaptionSheet,
    activeCaptionId,
    activeCaption,
    handleCaptionSave,
    onCaptionRotateStart,
    onCaptionRotate,
    handleCaptionDelete,
    onCaptionMoveStart,
    onCaptionMove,
    placeCaptionAt,
    placeCaptionDrop,
    startPlacingCaption,
    onPlacingSizeChange
  }
}
