import type { Caption, Pin, Route } from '@/types'

type PrintAreaSnapshot = { corners: [number, number][]; angle: number; legendX: number | null; legendY: number | null; legendScale: number } | null
type Snapshot = { pins: Pin[]; routes: Route[]; captions: Caption[]; printArea: PrintAreaSnapshot }
type HistoryEntry = { snapshot: Snapshot; label: string }

export function useHistory(options: {
  pins: Ref<Pin[]>
  routes: Ref<Route[]>
  captions: Ref<Caption[]>
  showNotification: (message: string) => void
  printCorners?: Ref<[number, number][]>
  printAngle?: Ref<number>
  legendX?: Ref<number | null>
  legendY?: Ref<number | null>
  legendScale?: Ref<number>
  restorePrintArea?: (corners: [number, number][], angle: number) => void
  clearPrintArea?: () => void
}) {
  const MAX = 50
  const past = ref<HistoryEntry[]>([])
  const future = ref<HistoryEntry[]>([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function snapshot(): Snapshot {
    const corners = options.printCorners?.value
    const printArea: PrintAreaSnapshot =
      corners && corners.length === 4
        ? {
            corners: corners.map(([lat, lng]) => [lat, lng] as [number, number]),
            angle: options.printAngle?.value ?? 0,
            legendX: options.legendX?.value ?? null,
            legendY: options.legendY?.value ?? null,
            legendScale: options.legendScale?.value ?? 1
          }
        : null
    return {
      pins: options.pins.value.map((p) => ({ ...p })),
      routes: options.routes.value.map((r) => ({ ...r, points: r.points.map((pt) => ({ ...pt })) })),
      captions: options.captions.value.map((c) => ({ ...c })),
      printArea
    }
  }

  function push(label = 'action') {
    past.value = [...past.value.slice(-(MAX - 1)), { snapshot: snapshot(), label }]
    future.value = []
  }

  function applySnapshot(s: Snapshot) {
    options.pins.value = s.pins
    options.routes.value = s.routes
    options.captions.value = s.captions
    if (s.printArea) {
      if (options.legendX) options.legendX.value = s.printArea.legendX
      if (options.legendY) options.legendY.value = s.printArea.legendY
      if (options.legendScale) options.legendScale.value = s.printArea.legendScale
      options.restorePrintArea?.(s.printArea.corners, s.printArea.angle)
    } else {
      options.clearPrintArea?.()
    }
  }

  function undo() {
    if (past.value.length === 0) return
    const entry = past.value[past.value.length - 1]!
    future.value = [{ snapshot: snapshot(), label: entry.label }, ...future.value.slice(0, MAX - 1)]
    past.value = past.value.slice(0, -1)
    applySnapshot(entry.snapshot)
    options.showNotification(`Undo ${entry.label}`)
  }

  function redo() {
    if (future.value.length === 0) return
    const entry = future.value[0]!
    past.value = [...past.value.slice(-(MAX - 1)), { snapshot: snapshot(), label: entry.label }]
    future.value = future.value.slice(1)
    applySnapshot(entry.snapshot)
    options.showNotification(`Redo ${entry.label}`)
  }

  function clear() {
    past.value = []
    future.value = []
  }

  return { canUndo, canRedo, push, undo, redo, clear }
}
