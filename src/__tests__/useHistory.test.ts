import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useHistory } from '@/composables/useHistory'
import type { Caption, Pin, PrintArea, Route } from '@/types'

function makePin(id: number): Pin {
  return { id, name: `Pin ${id}`, description: '', emoji: '📍', color: '#0d9488', lat: id, lng: id }
}

function makeRoute(id: number): Route {
  return { id, name: `Route ${id}`, color: '#000', points: [{ lat: id, lng: id }] }
}

function makeCaption(id: number): Caption {
  return { id, text: `Caption ${id}`, lat: id, lng: id, color: '#000', size: 'm' }
}

function makePrintArea(n: number): PrintArea {
  const d = n * 0.1
  return {
    id: `area-${n}`,
    corners: [
      [d, d],
      [d, d + 1],
      [d + 1, d + 1],
      [d + 1, d]
    ],
    angle: 0,
    paper: 'letter',
    orientation: 'landscape',
    grid: '1x1'
  }
}

function setup() {
  const pins = ref<Pin[]>([makePin(1)])
  const routes = ref<Route[]>([makeRoute(1)])
  const captions = ref<Caption[]>([makeCaption(1)])
  const printAreas = ref<PrintArea[]>([makePrintArea(1)])
  const updatePrintAreas = vi.fn((areas: PrintArea[]) => {
    printAreas.value = areas
  })
  const notify = vi.fn()
  const history = useHistory({ pins, routes, captions, showNotification: notify, printAreas, updatePrintAreas })
  return { pins, routes, captions, printAreas, updatePrintAreas, notify, ...history }
}

describe('useHistory', () => {
  describe('initial state', () => {
    it('starts with empty stacks', () => {
      const { canUndo, canRedo } = setup()
      expect(canUndo.value).toBe(false)
      expect(canRedo.value).toBe(false)
    })
  })

  describe('push', () => {
    it('enables undo after a push', () => {
      const { canUndo, push } = setup()
      push('add pin')
      expect(canUndo.value).toBe(true)
    })

    it('clears the redo stack on push', () => {
      const { pins, canRedo, push, undo } = setup()
      push()
      pins.value = [...pins.value, makePin(2)]
      push()
      undo()
      expect(canRedo.value).toBe(true)
      push('new action clears redo')
      expect(canRedo.value).toBe(false)
    })

    it('snapshots all three collections independently', () => {
      const { pins, routes, captions, push, undo } = setup()
      push()
      pins.value = [makePin(99)]
      routes.value = [makeRoute(99)]
      captions.value = [makeCaption(99)]
      undo()
      expect(pins.value[0]!.id).toBe(1)
      expect(routes.value[0]!.id).toBe(1)
      expect(captions.value[0]!.id).toBe(1)
    })
  })

  describe('undo', () => {
    it('restores previous pins state', () => {
      const { pins, push, undo } = setup()
      push()
      pins.value = [makePin(2), makePin(3)]
      undo()
      expect(pins.value).toHaveLength(1)
      expect(pins.value[0]!.id).toBe(1)
    })

    it('enables redo after undo', () => {
      const { canRedo, push, undo } = setup()
      push()
      undo()
      expect(canRedo.value).toBe(true)
    })

    it('disables undo when stack is exhausted', () => {
      const { canUndo, push, undo } = setup()
      push()
      undo()
      expect(canUndo.value).toBe(false)
    })

    it('notifies with the label', () => {
      const { push, undo, notify } = setup()
      push('add pin')
      undo()
      expect(notify).toHaveBeenCalledWith('Undo add pin')
    })

    it('does nothing when stack is empty', () => {
      const { pins, undo } = setup()
      undo()
      expect(pins.value[0]!.id).toBe(1)
    })
  })

  describe('redo', () => {
    it('reapplies undone state', () => {
      const { pins, push, undo, redo } = setup()
      push()
      pins.value = [makePin(2)]
      undo()
      redo()
      expect(pins.value[0]!.id).toBe(2)
    })

    it('disables redo after redo exhausts the stack', () => {
      const { canRedo, push, undo, redo } = setup()
      push()
      undo()
      redo()
      expect(canRedo.value).toBe(false)
    })

    it('notifies with the label', () => {
      const { push, undo, redo, notify } = setup()
      push('delete route')
      undo()
      notify.mockClear()
      redo()
      expect(notify).toHaveBeenCalledWith('Redo delete route')
    })

    it('does nothing when redo stack is empty', () => {
      const { pins, redo } = setup()
      redo()
      expect(pins.value[0]!.id).toBe(1)
    })
  })

  describe('multi-step sequences', () => {
    it('supports multiple undo steps', () => {
      const { pins, push, undo } = setup()
      push()
      pins.value = [makePin(2)]
      push()
      pins.value = [makePin(3)]
      undo()
      expect(pins.value[0]!.id).toBe(2)
      undo()
      expect(pins.value[0]!.id).toBe(1)
    })

    it('supports undo → undo → redo → redo roundtrip', () => {
      const { pins, push, undo, redo } = setup()
      push()
      pins.value = [makePin(2)]
      push()
      pins.value = [makePin(3)]
      undo()
      undo()
      redo()
      expect(pins.value[0]!.id).toBe(2)
      redo()
      expect(pins.value[0]!.id).toBe(3)
    })

    it('snapshots are deep copies (mutations after push do not corrupt the snapshot)', () => {
      const { pins, push, undo } = setup()
      // push a checkpoint, then add a pin and push again
      push()
      const p = makePin(2)
      pins.value = [...pins.value, p]
      push()
      // mutate the object that was spread into the snapshot
      p.name = 'mutated after snapshot'
      // undo restores the snapshot — should see the original name, not the mutation
      undo()
      expect(pins.value[1]!.name).toBe('Pin 2')
    })
  })

  describe('clear', () => {
    it('resets both stacks', () => {
      const { canUndo, canRedo, push, undo, clear } = setup()
      push()
      undo()
      expect(canUndo.value).toBe(false)
      expect(canRedo.value).toBe(true)
      clear()
      expect(canUndo.value).toBe(false)
      expect(canRedo.value).toBe(false)
    })
  })

  describe('print areas', () => {
    it('restores deleted print area on undo', () => {
      const { printAreas, updatePrintAreas, push, undo } = setup()
      push('delete print area')
      updatePrintAreas([])
      expect(printAreas.value).toHaveLength(0)
      undo()
      expect(printAreas.value).toHaveLength(1)
      expect(printAreas.value[0]!.id).toBe('area-1')
    })

    it('re-deletes print area on redo', () => {
      const { printAreas, updatePrintAreas, push, undo, redo } = setup()
      push('delete print area')
      updatePrintAreas([])
      undo()
      redo()
      expect(printAreas.value).toHaveLength(0)
    })

    it('restores added print area on undo (removes it)', () => {
      const { printAreas, updatePrintAreas, push, undo } = setup()
      push('add print area')
      updatePrintAreas([...printAreas.value, makePrintArea(2)])
      expect(printAreas.value).toHaveLength(2)
      undo()
      expect(printAreas.value).toHaveLength(1)
    })

    it('snapshots are deep copies (corner mutations do not corrupt snapshot)', () => {
      const { printAreas, updatePrintAreas, push, undo } = setup()
      push()
      const originalCorner = printAreas.value[0]!.corners[0]!
      updatePrintAreas([
        {
          ...printAreas.value[0]!,
          corners: [
            [99, 99],
            [99, 100],
            [100, 100],
            [100, 99]
          ]
        }
      ])
      // mutate the corner that was in the snapshot
      originalCorner[0] = 999
      undo()
      expect(printAreas.value[0]!.corners[0]![0]).toBe(0.1)
    })
  })
})
