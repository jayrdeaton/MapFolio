import type { MapStyle, Pin, Route, RoutePoint } from './types'

const EMOJI_NAMES: Record<string, string> = {
  '📍': 'Pin',
  '🚩': 'Flag',
  '🎯': 'Target',
  '⭐': 'Star',
  '❤️': 'Heart',
  '⚠️': 'Warning',
  '🔵': 'Blue',
  '🟢': 'Green',
  '🔴': 'Red',
  '🟡': 'Yellow',
  '🟠': 'Orange',
  '🟣': 'Purple',
  '⚫': 'Black',
  '⬛': 'Black',
  '🏠': 'Home',
  '🏕': 'Camp',
  '🏖': 'Beach',
  '🏔': 'Mountain',
  '🏥': 'Hospital',
  '🏨': 'Hotel',
  '🏪': 'Shop',
  '🏫': 'School',
  '⛪': 'Church',
  '🏛': 'Monument',
  '🏟': 'Stadium',
  '🅿️': 'Parking',
  '⛽': 'Gas Station',
  '🌳': 'Tree',
  '🌲': 'Tree',
  '🌺': 'Flower',
  '🌊': 'Water',
  '💧': 'Water',
  '🌸': 'Blossom',
  '🌵': 'Cactus',
  '🏜': 'Desert',
  '🦁': 'Lion',
  '🐟': 'Fish',
  '🦅': 'Eagle',
  '🐻': 'Bear',
  '🦌': 'Deer',
  '🐺': 'Wolf',
  '🎣': 'Fishing',
  '🥾': 'Hiking',
  '🚴': 'Cycling',
  '⛷': 'Skiing',
  '🏊': 'Swimming',
  '🧗': 'Climbing',
  '🤿': 'Diving',
  '🏄': 'Surfing',
  '☕': 'Café',
  '🍺': 'Bar',
  '🍕': 'Pizza',
  '🌮': 'Tacos',
  '🚗': 'Parking',
  '✈️': 'Airport',
  '⛵': 'Marina',
  '🚂': 'Train Station'
}

export function emojiToName(emoji: string): string {
  return EMOJI_NAMES[emoji] ?? ''
}

export interface ShareState {
  pins: Pin[]
  mapStyle: MapStyle
  mapTitle: string
  center?: [number, number]
  zoom?: number
}

interface CompactPin {
  id: number
  n: string // name
  d: string // description
  e: string // emoji
  c: string // color
  la: number // lat
  ln: number // lng
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  const binStr = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64Url(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binStr = atob(padded)
  const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function pinsToGeoJson(pins: Pin[]) {
  return {
    type: 'FeatureCollection' as const,
    features: pins.map((p) => ({
      type: 'Feature' as const,
      properties: { name: p.name, description: p.description, emoji: p.emoji, color: p.color },
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] }
    }))
  }
}

export function encodeShareState(state: ShareState): string {
  const compact: Record<string, unknown> = {
    p: state.pins.map(
      (p): CompactPin => ({
        id: p.id,
        n: p.name,
        d: p.description,
        e: p.emoji,
        c: p.color,
        la: +p.lat.toFixed(6),
        ln: +p.lng.toFixed(6)
      })
    ),
    s: state.mapStyle,
    t: state.mapTitle
  }
  if (state.center) compact.v = [+state.center[0].toFixed(5), +state.center[1].toFixed(5)]
  if (state.zoom !== undefined) compact.z = Math.round(state.zoom)
  return toBase64Url(JSON.stringify(compact))
}

export function decodeShareState(encoded: string): ShareState | null {
  try {
    if (!encoded) return null
    const raw = JSON.parse(fromBase64Url(encoded))
    if (!Array.isArray(raw.p)) return null
    return {
      pins: (raw.p as CompactPin[]).map((p) => ({
        id: p.id,
        name: p.n,
        description: p.d ?? '',
        emoji: p.e,
        color: p.c,
        lat: p.la,
        lng: p.ln
      })),
      mapStyle: raw.s as MapStyle,
      mapTitle: raw.t ?? '',
      center: Array.isArray(raw.v) ? (raw.v as [number, number]) : undefined,
      zoom: typeof raw.z === 'number' ? raw.z : undefined
    }
  } catch {
    return null
  }
}

export function parseGeoJsonImport(json: string): { pins: Pin[] } | null {
  try {
    const data = JSON.parse(json)
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) return null
    const pins: Pin[] = data.features
      .filter((f: Record<string, unknown>) => {
        const geo = f.geometry as Record<string, unknown> | null
        return f.type === 'Feature' && geo?.type === 'Point'
      })
      .map((f: Record<string, unknown>, i: number) => {
        const props = (f.properties ?? {}) as Record<string, unknown>
        const geo = f.geometry as { coordinates: [number, number] }
        return {
          id: Date.now() + i,
          name: (props.name ?? props.title ?? `Pin ${i + 1}`) as string,
          description: (props.description ?? props.desc ?? '') as string,
          emoji: (props.emoji ?? '📍') as string,
          color: (props.color ?? '#3b82f6') as string,
          lat: geo.coordinates[1],
          lng: geo.coordinates[0]
        }
      })
    return pins.length > 0 ? { pins } : null
  } catch {
    return null
  }
}

export function routesToGeoJson(routes: Route[]) {
  return {
    type: 'FeatureCollection' as const,
    features: routes.map((r) => ({
      type: 'Feature' as const,
      properties: { name: r.name, color: r.color, lineStyle: r.lineStyle ?? 'solid' },
      geometry: {
        type: 'LineString' as const,
        coordinates: r.points.map((p: RoutePoint) => [p.lng, p.lat])
      }
    }))
  }
}

export function parseRouteImport(json: string): { routes: Route[]; mapTitle?: string } | null {
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data.routes)) return null
    return { routes: data.routes as Route[], mapTitle: data.mapTitle as string | undefined }
  } catch {
    return null
  }
}

export function parseGeoJsonRouteImport(json: string): { routes: Route[] } | null {
  try {
    const data = JSON.parse(json)
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) return null
    const routes: Route[] = data.features
      .filter((f: Record<string, unknown>) => {
        const geo = f.geometry as Record<string, unknown> | null
        return f.type === 'Feature' && geo?.type === 'LineString'
      })
      .map((f: Record<string, unknown>, i: number) => {
        const props = (f.properties ?? {}) as Record<string, unknown>
        const geo = f.geometry as { coordinates: [number, number][] }
        return {
          id: Date.now() + i,
          name: (props.name ?? `Route ${i + 1}`) as string,
          color: (props.color ?? '#06b6d4') as string,
          lineStyle: (props.lineStyle ?? 'solid') as Route['lineStyle'],
          points: geo.coordinates.map(([lng, lat]) => ({ lat, lng }))
        }
      })
    return routes.length > 0 ? { routes } : null
  } catch {
    return null
  }
}

export function parsePinImport(json: string): { pins: Pin[]; mapTitle?: string } | null {
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data.pins)) return null
    return { pins: data.pins as Pin[], mapTitle: data.mapTitle as string | undefined }
  } catch {
    return null
  }
}
