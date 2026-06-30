import type { Caption, Pin, PrintArea, Route } from '@/types'

import { emojiToName } from './emoji'

export function pinPlaceholder(pin: Pin, allPins: Pin[]): string {
  if (pin.emoji) {
    const base = emojiToName(pin.emoji)
    if (!base) return 'Unnamed'
    const unnamed = allPins.filter((p) => !p.name && p.emoji && emojiToName(p.emoji) === base)
    const idx = unnamed.findIndex((p) => p.id === pin.id)
    return idx >= 0 ? `${base} ${idx + 1}` : base
  }
  const shape = pin.dotShape ?? 'circle'
  const base = shape === 'circle' ? 'Circle' : shape === 'square' ? 'Square' : 'Diamond'
  const unnamed = allPins.filter((p) => !p.name && !p.emoji && (p.dotShape ?? 'circle') === shape)
  const idx = unnamed.findIndex((p) => p.id === pin.id)
  return idx >= 0 ? `${base} ${idx + 1}` : base
}

export function routePlaceholder(route: Route, allRoutes: Route[]): string {
  const unnamed = allRoutes.filter((r) => !r.name)
  const idx = unnamed.findIndex((r) => r.id === route.id)
  return idx >= 0 ? `Route ${idx + 1}` : 'Route'
}

export function captionPlaceholder(caption: Caption, allCaptions: Caption[]): string {
  const unnamed = allCaptions.filter((c) => !c.text)
  const idx = unnamed.findIndex((c) => c.id === caption.id)
  return idx >= 0 ? `Caption ${idx + 1}` : 'Caption'
}

export function printAreaPlaceholder(areaId: string, allAreas: PrintArea[], mapName?: string): string {
  const unnamed = allAreas.filter((a) => !a.title)
  const idx = unnamed.findIndex((a) => a.id === areaId)
  const base = mapName || 'Print'
  return idx === 0 ? base : `${base} ${idx}`
}
