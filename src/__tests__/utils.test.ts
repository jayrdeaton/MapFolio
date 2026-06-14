import { describe, expect, it } from 'vitest'

import type { Pin } from '@/types'
import { decodeShareState, encodeShareState, parseGeoJsonImport, parsePinImport, pinsToGeoJson } from '@/utils'

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
