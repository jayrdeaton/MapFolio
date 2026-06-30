import { describe, expect, it } from 'vitest'

import type { Caption, Pin, PrintArea, Route } from '@/types'
import { isDarkColor } from '@/utils/color'
import { isAdditiveEvent } from '@/utils/events'
import { parseGeoJsonImport, parseGeoJsonRouteImport, parsePinImport, parseRouteImport, pinsToGeoJson, routesToGeoJson } from '@/utils/geojson'
import { uid } from '@/utils/id'
import { captionPlaceholder, pinPlaceholder, printAreaPlaceholder, routePlaceholder } from '@/utils/placeholder'
import { cornerOffsets, localToScreen, screenToLocal } from '@/utils/printAreaMath'
import { routePreviewSvgString, waypointPreviewSvgString } from '@/utils/routePreview'
import { decodeShareState, encodeShareState } from '@/utils/share'

const pin: Pin = {
  id: 1,
  name: 'Test Pin',
  description: 'A test location',
  emoji: '📍',
  color: '#3b82f6',
  lat: 40.7128,
  lng: -74.006
}

describe('pinsToGeoJson', () => {
  it('produces a valid FeatureCollection', () => {
    const gj = pinsToGeoJson([pin])
    expect(gj.type).toBe('FeatureCollection')
    expect(gj.features).toHaveLength(1)
    expect(gj.features[0]!.type).toBe('Feature')
    expect(gj.features[0]!.geometry.type).toBe('Point')
  })

  it('puts longitude before latitude per GeoJSON spec', () => {
    const [lng, lat] = pinsToGeoJson([pin]).features[0]!.geometry.coordinates
    expect(lng).toBe(pin.lng)
    expect(lat).toBe(pin.lat)
  })

  it('includes all properties', () => {
    const props = pinsToGeoJson([pin]).features[0]!.properties
    expect(props.name).toBe('Test Pin')
    expect(props.description).toBe('A test location')
    expect(props.emoji).toBe('📍')
    expect(props.color).toBe('#3b82f6')
  })

  it('returns empty FeatureCollection for no pins', () => {
    expect(pinsToGeoJson([]).features).toHaveLength(0)
  })
})

describe('encodeShareState / decodeShareState', () => {
  it('roundtrips basic state accurately', () => {
    const state = { pins: [pin], mapStyle: 'clean' as const, mapTitle: 'My Map' }
    const decoded = decodeShareState(encodeShareState(state))
    expect(decoded?.pins[0]!.name).toBe('Test Pin')
    expect(decoded?.pins[0]!.lat).toBeCloseTo(40.7128, 4)
    expect(decoded?.pins[0]!.lng).toBeCloseTo(-74.006, 4)
    expect(decoded?.mapStyle).toBe('clean')
    expect(decoded?.mapTitle).toBe('My Map')
  })

  it('handles emoji in pin name and icon field', () => {
    const emojiPin = { ...pin, name: 'Swimming 🏊 Hole', emoji: '💧' }
    const decoded = decodeShareState(encodeShareState({ pins: [emojiPin], mapStyle: 'clean' as const, mapTitle: '' }))
    expect(decoded?.pins[0]!.name).toBe('Swimming 🏊 Hole')
    expect(decoded?.pins[0]!.emoji).toBe('💧')
  })

  it('roundtrips an empty pin list', () => {
    const decoded = decodeShareState(encodeShareState({ pins: [], mapStyle: 'minimal' as const, mapTitle: 'Empty' }))
    expect(decoded?.pins).toHaveLength(0)
    expect(decoded?.mapTitle).toBe('Empty')
  })

  it('preserves all map styles', () => {
    const styles = ['clean', 'minimal', 'standard', 'satellite', 'terrain'] as const
    for (const s of styles) {
      const decoded = decodeShareState(encodeShareState({ pins: [], mapStyle: s, mapTitle: '' }))
      expect(decoded?.mapStyle).toBe(s)
    }
  })

  it('returns null for invalid input', () => {
    expect(decodeShareState('!!!notvalid')).toBeNull()
    expect(decodeShareState('')).toBeNull()
    expect(decodeShareState('validbase64butnotjson')).toBeNull()
  })
})

describe('parseGeoJsonImport', () => {
  const geojson = (features: unknown[]) => JSON.stringify({ type: 'FeatureCollection', features })

  const pointFeature = (coords: [number, number], props: Record<string, unknown> = {}) => ({
    type: 'Feature',
    properties: props,
    geometry: { type: 'Point', coordinates: coords }
  })

  it('parses a valid FeatureCollection with all properties', () => {
    const result = parseGeoJsonImport(geojson([pointFeature([-74.006, 40.7128], { name: 'A', description: 'Desc', emoji: '⭐', color: '#ff0000' })]))
    expect(result?.pins).toHaveLength(1)
    expect(result?.pins[0]!.name).toBe('A')
    expect(result?.pins[0]!.lat).toBeCloseTo(40.7128, 4)
    expect(result?.pins[0]!.lng).toBeCloseTo(-74.006, 4)
    expect(result?.pins[0]!.emoji).toBe('⭐')
    expect(result?.pins[0]!.color).toBe('#ff0000')
  })

  it('uses "title" as fallback name and "desc" as fallback description', () => {
    const result = parseGeoJsonImport(geojson([pointFeature([0, 0], { title: 'Fallback', desc: 'Alt desc' })]))
    expect(result?.pins[0]!.name).toBe('Fallback')
    expect(result?.pins[0]!.description).toBe('Alt desc')
  })

  it('falls back to "Pin N" when no name property exists', () => {
    const result = parseGeoJsonImport(geojson([pointFeature([0, 0])]))
    expect(result?.pins[0]!.name).toBe('Pin 1')
  })

  it('ignores non-Point geometry types', () => {
    const result = parseGeoJsonImport(
      geojson([
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 1]
            ]
          }
        },
        pointFeature([0, 0], { name: 'Keep me' })
      ])
    )
    expect(result?.pins).toHaveLength(1)
    expect(result?.pins[0]!.name).toBe('Keep me')
  })

  it('returns null for a non-FeatureCollection input', () => {
    expect(parseGeoJsonImport(JSON.stringify({ type: 'Feature' }))).toBeNull()
    expect(parseGeoJsonImport('invalid json')).toBeNull()
  })

  it('returns null when there are no Point features', () => {
    expect(parseGeoJsonImport(geojson([{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }]))).toBeNull()
  })
})

describe('parsePinImport', () => {
  it('parses valid export format', () => {
    const result = parsePinImport(JSON.stringify({ pins: [pin], mapTitle: 'Imported' }))
    expect(result?.pins).toHaveLength(1)
    expect(result?.pins[0]!.name).toBe('Test Pin')
    expect(result?.mapTitle).toBe('Imported')
  })

  it('accepts missing mapTitle', () => {
    const result = parsePinImport(JSON.stringify({ pins: [pin] }))
    expect(result?.pins).toHaveLength(1)
    expect(result?.mapTitle).toBeUndefined()
  })

  it('returns null when pins array is missing', () => {
    expect(parsePinImport(JSON.stringify({ data: [] }))).toBeNull()
    expect(parsePinImport(JSON.stringify({}))).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parsePinImport('not json')).toBeNull()
    expect(parsePinImport('')).toBeNull()
  })
})

describe('routesToGeoJson', () => {
  const route: Route = {
    id: 1,
    name: 'Trail',
    color: '#ff0000',
    lineStyle: 'dashed',
    points: [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 }
    ]
  }

  it('produces a valid FeatureCollection of LineStrings', () => {
    const gj = routesToGeoJson([route])
    expect(gj.type).toBe('FeatureCollection')
    expect(gj.features).toHaveLength(1)
    expect(gj.features[0]!.geometry.type).toBe('LineString')
  })

  it('puts longitude before latitude per GeoJSON spec', () => {
    const coords = routesToGeoJson([route]).features[0]!.geometry.coordinates
    expect(coords[0]).toEqual([20, 10])
    expect(coords[1]).toEqual([21, 11])
  })

  it('includes name, color, and lineStyle in properties', () => {
    const props = routesToGeoJson([route]).features[0]!.properties
    expect(props.name).toBe('Trail')
    expect(props.color).toBe('#ff0000')
    expect(props.lineStyle).toBe('dashed')
  })

  it('defaults lineStyle to "solid" when omitted', () => {
    const r: Route = { id: 2, name: '', color: '#000', points: [] }
    expect(routesToGeoJson([r]).features[0]!.properties.lineStyle).toBe('solid')
  })

  it('returns empty FeatureCollection for no routes', () => {
    expect(routesToGeoJson([]).features).toHaveLength(0)
  })
})

describe('parseGeoJsonRouteImport', () => {
  const geojson = (features: unknown[]) => JSON.stringify({ type: 'FeatureCollection', features })

  const lineFeature = (coords: [number, number][], props: Record<string, unknown> = {}) => ({
    type: 'Feature',
    properties: props,
    geometry: { type: 'LineString', coordinates: coords }
  })

  it('parses a valid LineString feature', () => {
    const result = parseGeoJsonRouteImport(
      geojson([
        lineFeature(
          [
            [20, 10],
            [21, 11]
          ],
          { name: 'Road', color: '#ff0000', lineStyle: 'dotted' }
        )
      ])
    )
    expect(result?.routes).toHaveLength(1)
    expect(result?.routes[0]!.name).toBe('Road')
    expect(result?.routes[0]!.color).toBe('#ff0000')
    expect(result?.routes[0]!.lineStyle).toBe('dotted')
    expect(result?.routes[0]!.points[0]).toEqual({ lat: 10, lng: 20 })
    expect(result?.routes[0]!.points[1]).toEqual({ lat: 11, lng: 21 })
  })

  it('falls back to "Route N" when name is missing', () => {
    const result = parseGeoJsonRouteImport(
      geojson([
        lineFeature([
          [0, 0],
          [1, 1]
        ])
      ])
    )
    expect(result?.routes[0]!.name).toBe('Route 1')
  })

  it('falls back to default color when color is missing', () => {
    const result = parseGeoJsonRouteImport(
      geojson([
        lineFeature([
          [0, 0],
          [1, 1]
        ])
      ])
    )
    expect(result?.routes[0]!.color).toBe('#0d9488')
  })

  it('defaults lineStyle to "solid" when missing', () => {
    const result = parseGeoJsonRouteImport(
      geojson([
        lineFeature([
          [0, 0],
          [1, 1]
        ])
      ])
    )
    expect(result?.routes[0]!.lineStyle).toBe('solid')
  })

  it('ignores non-LineString features', () => {
    const result = parseGeoJsonRouteImport(
      geojson([
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
        lineFeature(
          [
            [0, 0],
            [1, 1]
          ],
          { name: 'Keep' }
        )
      ])
    )
    expect(result?.routes).toHaveLength(1)
    expect(result?.routes[0]!.name).toBe('Keep')
  })

  it('returns null for non-FeatureCollection input', () => {
    expect(parseGeoJsonRouteImport(JSON.stringify({ type: 'Feature' }))).toBeNull()
    expect(parseGeoJsonRouteImport('bad json')).toBeNull()
  })

  it('returns null when there are no LineString features', () => {
    expect(parseGeoJsonRouteImport(geojson([{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }]))).toBeNull()
  })
})

describe('parseRouteImport', () => {
  const route: Route = { id: 1, name: 'Trail', color: '#000', points: [{ lat: 10, lng: 20 }] }

  it('parses valid export format with mapTitle', () => {
    const result = parseRouteImport(JSON.stringify({ routes: [route], mapTitle: 'My Map' }))
    expect(result?.routes).toHaveLength(1)
    expect(result?.mapTitle).toBe('My Map')
  })

  it('accepts missing mapTitle', () => {
    const result = parseRouteImport(JSON.stringify({ routes: [route] }))
    expect(result?.routes).toHaveLength(1)
    expect(result?.mapTitle).toBeUndefined()
  })

  it('returns null when routes array is missing', () => {
    expect(parseRouteImport(JSON.stringify({ data: [] }))).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseRouteImport('not json')).toBeNull()
    expect(parseRouteImport('')).toBeNull()
  })
})

describe('pinPlaceholder', () => {
  const makePin = (id: number, name = '', emoji = '📍'): Pin => ({ id, name, description: '', emoji, color: '#000', lat: 0, lng: 0 })

  it('returns "Unnamed" for an emoji with no known name', () => {
    const p = makePin(1, '', '🦄')
    expect(pinPlaceholder(p, [p])).toBe('Unnamed')
  })

  it('numbers unnamed pins with the same emoji sequentially', () => {
    const p1 = makePin(1, '', '📍')
    const p2 = makePin(2, '', '📍')
    expect(pinPlaceholder(p1, [p1, p2])).toBe('Pin 1')
    expect(pinPlaceholder(p2, [p1, p2])).toBe('Pin 2')
  })

  it('named pins do not affect the numbering of unnamed pins', () => {
    const named = makePin(1, 'Named Pin', '📍')
    const unnamed = makePin(2, '', '📍')
    expect(pinPlaceholder(unnamed, [named, unnamed])).toBe('Pin 1')
  })
})

describe('routePlaceholder', () => {
  const makeRoute = (id: number, name = ''): Route => ({ id, name, color: '#000', points: [] })

  it('numbers unnamed routes sequentially by position among unnamed routes', () => {
    const r1 = makeRoute(1)
    const r2 = makeRoute(2)
    expect(routePlaceholder(r1, [r1, r2])).toBe('Route 1')
    expect(routePlaceholder(r2, [r1, r2])).toBe('Route 2')
  })

  it('named routes do not count toward the sequence', () => {
    const named = makeRoute(1, 'Named')
    const unnamed = makeRoute(2)
    expect(routePlaceholder(unnamed, [named, unnamed])).toBe('Route 1')
  })
})

describe('captionPlaceholder', () => {
  const makeCaption = (id: number, text = ''): Caption => ({ id, text, lat: 0, lng: 0, color: '#000', size: 'm' })

  it('numbers unnamed captions sequentially', () => {
    const c1 = makeCaption(1)
    const c2 = makeCaption(2)
    expect(captionPlaceholder(c1, [c1, c2])).toBe('Caption 1')
    expect(captionPlaceholder(c2, [c1, c2])).toBe('Caption 2')
  })

  it('captions with text do not count toward the sequence', () => {
    const withText = makeCaption(1, 'Hello')
    const empty = makeCaption(2)
    expect(captionPlaceholder(empty, [withText, empty])).toBe('Caption 1')
  })
})

describe('pinPlaceholder (dot-shape branch)', () => {
  const makeDotPin = (id: number, name = '', dotShape?: 'circle' | 'square' | 'diamond'): Pin => ({
    id,
    name,
    description: '',
    emoji: '',
    color: '#000',
    lat: 0,
    lng: 0,
    dotShape
  })

  it('defaults to "Circle N" for emoji-less circle pins', () => {
    const p1 = makeDotPin(1)
    const p2 = makeDotPin(2)
    expect(pinPlaceholder(p1, [p1, p2])).toBe('Circle 1')
    expect(pinPlaceholder(p2, [p1, p2])).toBe('Circle 2')
  })

  it('uses shape-specific base name for square and diamond', () => {
    const sq = makeDotPin(1, '', 'square')
    const di = makeDotPin(2, '', 'diamond')
    expect(pinPlaceholder(sq, [sq])).toBe('Square 1')
    expect(pinPlaceholder(di, [di])).toBe('Diamond 1')
  })

  it('different shapes are counted independently', () => {
    const circle = makeDotPin(1)
    const square = makeDotPin(2, '', 'square')
    expect(pinPlaceholder(circle, [circle, square])).toBe('Circle 1')
    expect(pinPlaceholder(square, [circle, square])).toBe('Square 1')
  })

  it('named dot pins do not count toward the sequence', () => {
    const named = makeDotPin(1, 'Camp')
    const unnamed = makeDotPin(2)
    expect(pinPlaceholder(unnamed, [named, unnamed])).toBe('Circle 1')
  })
})

describe('printAreaPlaceholder', () => {
  const makeArea = (id: string, title?: string): PrintArea => ({
    id,
    corners: [],
    angle: 0,
    paper: 'letter',
    orientation: 'portrait',
    grid: '',
    title
  })

  it('returns mapName for the first unnamed area', () => {
    const a = makeArea('a1')
    expect(printAreaPlaceholder('a1', [a], 'My Map')).toBe('My Map')
  })

  it('returns "Print" when mapName is omitted', () => {
    const a = makeArea('a1')
    expect(printAreaPlaceholder('a1', [a])).toBe('Print')
  })

  it('appends index (1-based, minus one) for subsequent unnamed areas', () => {
    const a1 = makeArea('a1')
    const a2 = makeArea('a2')
    const a3 = makeArea('a3')
    expect(printAreaPlaceholder('a1', [a1, a2, a3], 'Trip')).toBe('Trip')
    expect(printAreaPlaceholder('a2', [a1, a2, a3], 'Trip')).toBe('Trip 1')
    expect(printAreaPlaceholder('a3', [a1, a2, a3], 'Trip')).toBe('Trip 2')
  })

  it('titled areas do not count toward the sequence', () => {
    const titled = makeArea('a0', 'Cover')
    const u1 = makeArea('a1')
    const u2 = makeArea('a2')
    expect(printAreaPlaceholder('a1', [titled, u1, u2], 'Map')).toBe('Map')
    expect(printAreaPlaceholder('a2', [titled, u1, u2], 'Map')).toBe('Map 1')
  })
})

describe('isDarkColor', () => {
  it('returns true for dark colors', () => {
    expect(isDarkColor('#000000')).toBe(true)
    expect(isDarkColor('#1e293b')).toBe(true)
    expect(isDarkColor('#0d9488')).toBe(true) // app teal accent
  })

  it('returns false for light colors', () => {
    expect(isDarkColor('#ffffff')).toBe(false)
    expect(isDarkColor('#d1d5db')).toBe(false)
    expect(isDarkColor('#bbf7d0')).toBe(false)
  })

  it('returns false for transparent and empty', () => {
    expect(isDarkColor('transparent')).toBe(false)
    expect(isDarkColor('')).toBe(false)
  })

  it('returns false for non-6-digit hex', () => {
    expect(isDarkColor('#fff')).toBe(false)
    expect(isDarkColor('#12345')).toBe(false)
  })
})

describe('isAdditiveEvent', () => {
  const makeEvent = (meta: boolean, ctrl: boolean) => ({ metaKey: meta, ctrlKey: ctrl }) as unknown as MouseEvent

  it('returns true when metaKey is set', () => {
    expect(isAdditiveEvent(makeEvent(true, false))).toBe(true)
  })

  it('returns true when ctrlKey is set', () => {
    expect(isAdditiveEvent(makeEvent(false, true))).toBe(true)
  })

  it('returns true when both are set', () => {
    expect(isAdditiveEvent(makeEvent(true, true))).toBe(true)
  })

  it('returns false when neither modifier is set', () => {
    expect(isAdditiveEvent(makeEvent(false, false))).toBe(false)
  })
})

describe('uid', () => {
  it('returns a number', () => {
    expect(typeof uid()).toBe('number')
  })

  it('returns strictly increasing values', () => {
    const a = uid()
    const b = uid()
    const c = uid()
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })

  it('returns unique values even in rapid succession', () => {
    const ids = Array.from({ length: 20 }, () => uid())
    expect(new Set(ids).size).toBe(20)
  })
})

describe('cornerOffsets', () => {
  it('returns four corners in NW/NE/SE/SW order', () => {
    expect(cornerOffsets(5, 3)).toEqual([
      [-5, -3],
      [5, -3],
      [5, 3],
      [-5, 3]
    ])
  })

  it('handles asymmetric half-dimensions', () => {
    const co = cornerOffsets(10, 4)
    expect(co[0]).toEqual([-10, -4]) // NW
    expect(co[1]).toEqual([10, -4]) // NE
    expect(co[2]).toEqual([10, 4]) // SE
    expect(co[3]).toEqual([-10, 4]) // SW
  })

  it('NW and SE are diagonal opposites', () => {
    const co = cornerOffsets(6, 8)
    expect(co[0]![0]).toBe(-co[2]![0])
    expect(co[0]![1]).toBe(-co[2]![1])
  })
})

describe('localToScreen / screenToLocal', () => {
  it('at zero angle, localToScreen adds the local offset to the center', () => {
    const pt = localToScreen(5, 3, 100, 200, 0)
    expect(pt.x).toBeCloseTo(105, 10)
    expect(pt.y).toBeCloseTo(203, 10)
  })

  it('at zero angle, screenToLocal subtracts the center', () => {
    const pt = localToScreen(5, 3, 100, 200, 0) // use a real L.Point
    const local = screenToLocal(pt, 100, 200, 0)
    expect(local.x).toBeCloseTo(5, 10)
    expect(local.y).toBeCloseTo(3, 10)
  })

  it('localToScreen and screenToLocal are inverses at 45°', () => {
    const angle = Math.PI / 4
    const pt = localToScreen(10, -5, 50, 80, angle)
    const back = screenToLocal(pt, 50, 80, angle)
    expect(back.x).toBeCloseTo(10, 10)
    expect(back.y).toBeCloseTo(-5, 10)
  })

  it('localToScreen and screenToLocal are inverses at 90°', () => {
    const angle = Math.PI / 2
    const pt = localToScreen(7, 3, 0, 0, angle)
    const back = screenToLocal(pt, 0, 0, angle)
    expect(back.x).toBeCloseTo(7, 10)
    expect(back.y).toBeCloseTo(3, 10)
  })
})

describe('routePreviewSvgString', () => {
  const baseRoute: Route = { id: 1, name: 'Test', color: '#ff0000', points: [] }

  it('returns an SVG string', () => {
    expect(routePreviewSvgString(baseRoute)).toMatch(/^<svg/)
  })

  it('includes the route color', () => {
    expect(routePreviewSvgString(baseRoute)).toContain('#ff0000')
  })

  it('dashed line style includes stroke-dasharray', () => {
    expect(routePreviewSvgString({ ...baseRoute, lineStyle: 'dashed' })).toContain('stroke-dasharray')
  })

  it('arrow line style includes a marker element', () => {
    expect(routePreviewSvgString({ ...baseRoute, lineStyle: 'arrow' })).toContain('<marker')
  })

  it('double line style renders two line elements', () => {
    const svg = routePreviewSvgString({ ...baseRoute, lineStyle: 'double' })
    expect((svg.match(/<line/g) ?? []).length).toBe(2)
  })

  it('none line style renders a gray placeholder', () => {
    expect(routePreviewSvgString({ ...baseRoute, lineStyle: 'none' })).toContain('#d1d5db')
  })
})

describe('waypointPreviewSvgString', () => {
  const baseRoute: Route = { id: 1, name: 'Test', color: '#0000ff', points: [] }

  it('returns an SVG string', () => {
    expect(waypointPreviewSvgString(baseRoute, 0)).toMatch(/^<svg/)
  })

  it('uses the route color by default', () => {
    expect(waypointPreviewSvgString(baseRoute, 0)).toContain('#0000ff')
  })

  it('uses colorOverride when provided', () => {
    const svg = waypointPreviewSvgString(baseRoute, 0, '#aabbcc')
    expect(svg).toContain('#aabbcc')
    expect(svg).not.toContain('#0000ff')
  })

  it('includes the 1-based label when waypointShowNumber is true', () => {
    const route: Route = { ...baseRoute, waypointShowNumber: true }
    expect(waypointPreviewSvgString(route, 2)).toContain('>3<') // index 2 → label "3"
  })

  it('square waypoint style renders a rect', () => {
    const route: Route = { ...baseRoute, waypointStyle: 'square' }
    expect(waypointPreviewSvgString(route, 0)).toContain('<rect')
  })
})
