import type { Caption, Pin, PrintArea, Route } from '@/types'

type Snapshot = { pins: Pin[]; routes: Route[]; captions: Caption[]; printAreas: PrintArea[] }
type HistoryEntry = { snapshot: Snapshot; label: string }

export function useHistory(options: { pins: Ref<Pin[]>; routes: Ref<Route[]>; captions: Ref<Caption[]>; showNotification: (message: string) => void; printAreas?: Ref<PrintArea[]>; updatePrintAreas?: (areas: PrintArea[]) => void }) {
  const MAX = 50
  const past = ref<HistoryEntry[]>([])
  const future = ref<HistoryEntry[]>([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function snapshot(): Snapshot {
    const areas = options.printAreas?.value ?? []
    return {
      pins: options.pins.value.map((p) => ({ ...p })),
      routes: options.routes.value.map((r) => ({ ...r, points: r.points.map((pt) => ({ ...pt })) })),
      captions: options.captions.value.map((c) => ({ ...c })),
      printAreas: areas.map((a) => ({ ...a, corners: a.corners.map((c) => [c[0], c[1]] as [number, number]) }))
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
    options.updatePrintAreas?.(s.printAreas)
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
