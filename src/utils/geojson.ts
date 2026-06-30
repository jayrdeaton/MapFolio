import type { Pin, Route, RoutePoint } from '@/types'

import { uid } from './id'

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
          id: uid(),
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
          id: uid(),
          name: (props.name ?? `Route ${i + 1}`) as string,
          color: (props.color ?? '#0d9488') as string,
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
    // Re-id imported pins so they can never collide with existing pins (e.g.
    // importing the same export twice), which would create duplicate Vue keys.
    const pins = (data.pins as Pin[]).map((p) => ({ ...p, id: uid() }))
    return { pins, mapTitle: data.mapTitle as string | undefined }
  } catch {
    return null
  }
}
