import { describe, expect, it } from 'vitest'

import { sanitizeMap } from '@/composables/useMaps'
import type { MapData, Pin, Route } from '@/types'

function makePin(over: Partial<Pin> & Pick<Pin, 'id' | 'lat' | 'lng'>): Pin {
  return { name: '', description: '', emoji: '📍', color: '#0d9488', ...over }
}

function makeMap(over: Partial<MapData> = {}): MapData {
  return { id: 'm1', name: 'Map', area: '', pins: [], routes: [], mapStyle: 'clean', showLabels: false, showClusters: true, ...over }
}

describe('sanitizeMap', () => {
  it('is a no-op on clean data', () => {
    const m = makeMap({ pins: [makePin({ id: 1, lat: 10, lng: 20 }), makePin({ id: 2, lat: 11, lng: 21 })] })
    const { map, changed } = sanitizeMap(m)
    expect(changed).toBe(false)
    expect(map).toBe(m) // same reference when nothing changed
  })

  it('keeps both pins at the same coordinates (intentional duplicates are allowed)', () => {
    const m = makeMap({ pins: [makePin({ id: 1, lat: 10, lng: 20, name: 'first' }), makePin({ id: 2, lat: 10, lng: 20, name: 'second' })] })
    const { map, changed } = sanitizeMap(m)
    expect(changed).toBe(false)
    expect(map.pins).toHaveLength(2)
  })

  it('preserves route waypoint links when two pins share the same location', () => {
    const route: Route = { id: 100, name: 'r', color: '#000', points: [{ lat: 10, lng: 20, pinId: 2 }] }
    const m = makeMap({
      pins: [makePin({ id: 1, lat: 10, lng: 20 }), makePin({ id: 2, lat: 10, lng: 20 })],
      routes: [route]
    })
    const { map, changed } = sanitizeMap(m)
    expect(changed).toBe(false)
    expect(map.pins).toHaveLength(2)
    expect(map.routes[0]!.points[0]!.pinId).toBe(2) // link preserved as-is
  })

  it('re-ids pins that share an id but sit at different locations (both kept)', () => {
    const m = makeMap({ pins: [makePin({ id: 5, lat: 10, lng: 20 }), makePin({ id: 5, lat: 11, lng: 21 })] })
    const { map, changed } = sanitizeMap(m)
    expect(changed).toBe(true)
    expect(map.pins).toHaveLength(2)
    expect(new Set(map.pins.map((p) => p.id)).size).toBe(2) // unique ids
  })

  it("relinks waypoints when a same-id different-location pin is re-id'd", () => {
    // Two pins share id 5; the second (id 5) is re-id'd. A route point referencing id 5
    // resolves to the first pin (the canonical holder of id 5).
    const m = makeMap({
      pins: [makePin({ id: 5, lat: 10, lng: 20 }), makePin({ id: 5, lat: 11, lng: 21 })],
      routes: [{ id: 1, name: 'r', color: '#000', points: [{ lat: 10, lng: 20, pinId: 5 }] }]
    })
    const { map } = sanitizeMap(m)
    const keptIds = map.pins.map((p) => p.id)
    expect(map.routes[0]!.points[0]!.pinId).toBe(keptIds[0])
  })

  it('strips a route waypoint link to a pin that no longer exists, keeping the waypoint', () => {
    const m = makeMap({
      pins: [makePin({ id: 1, lat: 10, lng: 20 })],
      routes: [{ id: 100, name: 'r', color: '#000', points: [{ lat: 30, lng: 40, pinId: 99 }] }]
    })
    const { map, changed } = sanitizeMap(m)
    expect(changed).toBe(true)
    expect(map.routes[0]!.points[0]!.pinId).toBeUndefined() // dangling link dropped
    expect(map.routes[0]!.points[0]!.lat).toBe(30) // waypoint stays put
    expect(map.routes[0]!.points[0]!.lng).toBe(40)
  })

  it('leaves a valid route waypoint link untouched', () => {
    const m = makeMap({
      pins: [makePin({ id: 1, lat: 10, lng: 20 })],
      routes: [{ id: 100, name: 'r', color: '#000', points: [{ lat: 10, lng: 20, pinId: 1 }] }]
    })
    const { map, changed } = sanitizeMap(m)
    expect(changed).toBe(false)
    expect(map).toBe(m) // same reference — nothing to fix
    expect(map.routes[0]!.points[0]!.pinId).toBe(1)
  })

  it('gives routes unique ids when they collide', () => {
    const m = makeMap({
      routes: [
        { id: 7, name: 'a', color: '#000', points: [] },
        { id: 7, name: 'b', color: '#000', points: [] }
      ]
    })
    const { map, changed } = sanitizeMap(m)
    expect(changed).toBe(true)
    expect(new Set(map.routes.map((r) => r.id)).size).toBe(2)
  })
})
