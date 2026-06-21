import { describe, expect, it } from 'vitest'

import type { Caption, Pin, Route } from '@/types'
import { captionPlaceholder, decodeShareState, encodeShareState, parseGeoJsonImport, parseGeoJsonRouteImport, parsePinImport, parseRouteImport, pinPlaceholder, pinsToGeoJson, routePlaceholder, routesToGeoJson } from '@/utils'

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
    expect(result?.routes[0]!.color).toBe('#06b6d4')
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
