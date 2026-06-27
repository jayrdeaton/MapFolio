import type { Caption, CaptionSize, MapStyle, Pin, PinDotShape, PinDotSize, PrintArea, PrintOrientation, PrintPaperSize, Route, RouteLineStyle, RoutePoint, RouteWaypointSize, RouteWaypointStyle } from './types'
import { uid } from './utils/id'

// Single source of truth for the multi-select modifier: Cmd on Mac, Ctrl on Windows/Linux.
export const isAdditiveEvent = (e: MouseEvent | PointerEvent): boolean => e.metaKey || e.ctrlKey

// Practical ceiling for a share-link URL. Modern browsers tolerate far more, but
// many chat apps / proxies / link crawlers silently truncate well below this; this
// keeps a shared link reliable everywhere. Past it, the export dialog steers the
// user to a file download instead. Single knob — tune freely.
export const MAX_SHARE_URL_LENGTH = 8000

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
  '⛺': 'Camp',
  '⛱️': 'Beach',
  '🗻': 'Mountain',
  '🏥': 'Hospital',
  '🏨': 'Hotel',
  '🏪': 'Shop',
  '🏫': 'School',
  '⛪': 'Church',
  '🛕': 'Temple',
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
  '🦁': 'Lion',
  '🐅': 'Tiger',
  '🐟': 'Fish',
  '🦅': 'Eagle',
  '🐻': 'Bear',
  '🦌': 'Deer',
  '🐺': 'Wolf',
  '🐘': 'Elephant',
  '🐵': 'Monkey',
  '🐼': 'Panda',
  '🐨': 'Koala',
  '🐰': 'Rabbit',
  '🦊': 'Fox',
  '🐶': 'Dog',
  '🐱': 'Cat',
  '🐸': 'Frog',
  '🐢': 'Turtle',
  '🦋': 'Butterfly',
  '🐝': 'Bee',
  '🦎': 'Gecko',
  '🐬': 'Dolphin',
  '🐠': 'Tropical Fish',
  '🦖': 'Dinosaur',
  '🐦': 'Bird',
  '🕊️': 'Dove',
  '🦆': 'Duck',
  '🦉': 'Owl',
  '🐧': 'Penguin',
  '🦜': 'Parrot',
  '🦢': 'Swan',
  '🦩': 'Flamingo',
  '🦚': 'Peacock',
  '🐤': 'Chick',
  '🎈': 'Balloon',
  '🛝': 'Playground',
  '🎠': 'Carousel',
  '🎡': 'Ferris Wheel',
  '🎢': 'Roller Coaster',
  '🎪': 'Circus',
  '⛲': 'Fountain',
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
  '🧋': 'Bubble Tea',
  '🍕': 'Pizza',
  '🌮': 'Tacos',
  '🍜': 'Noodles',
  '🍚': 'Rice',
  '🍗': 'Chicken',
  '🍛': 'Curry',
  '🍲': 'Hotpot',
  '🌶️': 'Spicy',
  '🥭': 'Mango',
  '🍌': 'Banana',
  '🥥': 'Coconut',
  '🍦': 'Ice Cream',
  '🍧': 'Shaved Ice',
  '🍩': 'Donut',
  '🍰': 'Cake',
  '🍭': 'Lollipop',
  '🚗': 'Parking',
  '✈️': 'Airport',
  '⛵': 'Marina',
  '🚂': 'Train Station'
}

export function emojiToName(emoji: string): string {
  return EMOJI_NAMES[emoji] ?? ''
}

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

export function printAreaPlaceholder(areaId: string, allAreas: import('@/types').PrintArea[], mapName?: string): string {
  const unnamed = allAreas.filter((a) => !a.title)
  const idx = unnamed.findIndex((a) => a.id === areaId)
  const base = mapName || 'Print'
  return idx === 0 ? base : `${base} ${idx}`
}

export interface ShareState {
  pins: Pin[]
  routes?: Route[] // undefined = not present (old links); [] = intentionally empty
  captions?: Caption[] // undefined = pre-captions link; [] = intentionally empty
  printAreas?: PrintArea[] // undefined = pre-printArea link; [] = intentionally empty
  mapStyle: MapStyle
  mapTitle: string
  area?: string
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
  sz?: string // dotSize (omitted when 'm', the default)
  sh?: string // dotShape (omitted when 'circle', the default)
  sn?: true // showNumber
  hd?: true // hidden
}

interface CompactRoute {
  id: number
  n: string // name
  c: string // color
  pts: Array<[number, number] | [number, number, number]> // [lat, lng] or [lat, lng, pinId]
  ls?: string // lineStyle (omitted when 'solid')
  ws?: string // waypointStyle (omitted when 'circle')
  wn?: true // waypointShowNumber
  wz?: string // waypointSize (omitted when 'm')
  hd?: true // hidden
}

interface CompactCaption {
  id: number
  t: string // text
  c: string // color
  la: number // lat
  ln: number // lng
  sz?: string // size (omitted when 'm', the default)
  bg?: true // background pill
  ro?: number // rotation degrees (omitted when 0)
  hd?: true // hidden
}

interface CompactPrintArea {
  id: number
  co: Array<[number, number]> // corners [[lat,lng]×4]
  an: number // angle
  pa: string // paper size
  or: string // orientation
  gr: string // grid
  ti?: string // title
  su?: string // subtitle
  hd?: true // hidden
  lg?: true // legend
  lgp?: true // legendPins
  lgr?: true // legendRoutes
  lgsp?: true // legendSeparatePage
  lgt?: true // legendTitle
  lga?: true // legendArea
  lgb?: true // legendBlankLabels
  lgsc?: number // legendScale
  lgx?: number | null // legendX
  lgy?: number | null // legendY
  lgc?: 0 | 1 | 2 | 3 | null // legendCorner
  cp?: true // compass
  sc?: true // scale
  ms?: number // markerScale
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
        ln: +p.lng.toFixed(6),
        ...(p.dotSize && p.dotSize !== 'm' ? { sz: p.dotSize } : {}),
        ...(p.dotShape && p.dotShape !== 'circle' ? { sh: p.dotShape } : {}),
        ...(p.showNumber ? { sn: true as const } : {}),
        ...(p.hidden ? { hd: true as const } : {})
      })
    ),
    r: (state.routes ?? []).map(
      (r): CompactRoute => ({
        id: r.id,
        n: r.name,
        c: r.color,
        pts: r.points.map((pt) => (pt.pinId !== undefined ? [+pt.lat.toFixed(6), +pt.lng.toFixed(6), pt.pinId] : [+pt.lat.toFixed(6), +pt.lng.toFixed(6)])),
        ...(r.lineStyle && r.lineStyle !== 'solid' ? { ls: r.lineStyle } : {}),
        ...(r.waypointStyle && r.waypointStyle !== 'circle' ? { ws: r.waypointStyle } : {}),
        ...(r.waypointShowNumber ? { wn: true as const } : {}),
        ...(r.waypointSize && r.waypointSize !== 'm' ? { wz: r.waypointSize } : {}),
        ...(r.hidden ? { hd: true as const } : {})
      })
    ),
    cp: (state.captions ?? []).map(
      (c): CompactCaption => ({
        id: c.id,
        t: c.text,
        c: c.color,
        la: +c.lat.toFixed(6),
        ln: +c.lng.toFixed(6),
        ...(c.size && c.size !== 'm' ? { sz: c.size } : {}),
        ...(c.background ? { bg: true as const } : {}),
        ...(c.rotation ? { ro: Math.round(c.rotation) } : {}),
        ...(c.hidden ? { hd: true as const } : {})
      })
    ),
    s: state.mapStyle,
    t: state.mapTitle
  }
  if (state.area) compact.a = state.area
  if (state.center) compact.v = [+state.center[0].toFixed(5), +state.center[1].toFixed(5)]
  if (state.zoom !== undefined) compact.z = Math.round(state.zoom)
  if (state.printAreas && state.printAreas.length > 0) {
    compact.pa = state.printAreas.map(
      (a, i): CompactPrintArea => ({
        id: i,
        co: a.corners.map(([lat, lng]) => [+lat.toFixed(6), +lng.toFixed(6)] as [number, number]),
        an: +a.angle.toFixed(4),
        pa: a.paper,
        or: a.orientation,
        gr: a.grid,
        ...(a.title ? { ti: a.title } : {}),
        ...(a.subtitle ? { su: a.subtitle } : {}),
        ...(a.hidden ? { hd: true as const } : {}),
        ...(a.legend ? { lg: true as const } : {}),
        ...(a.legendPins ? { lgp: true as const } : {}),
        ...(a.legendRoutes ? { lgr: true as const } : {}),
        ...(a.legendSeparatePage ? { lgsp: true as const } : {}),
        ...(a.legendTitle ? { lgt: true as const } : {}),
        ...(a.legendArea ? { lga: true as const } : {}),
        ...(a.legendBlankLabels ? { lgb: true as const } : {}),
        ...(a.legendScale !== undefined ? { lgsc: a.legendScale } : {}),
        ...(a.legendX !== undefined ? { lgx: a.legendX } : {}),
        ...(a.legendY !== undefined ? { lgy: a.legendY } : {}),
        ...(a.legendCorner !== undefined ? { lgc: a.legendCorner } : {}),
        ...(a.compass ? { cp: true as const } : {}),
        ...(a.scale ? { sc: true as const } : {}),
        ...(a.markerScale !== undefined ? { ms: a.markerScale } : {})
      })
    )
  }
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
        lng: p.ln,
        ...(p.sz ? { dotSize: p.sz as PinDotSize } : {}),
        ...(p.sh ? { dotShape: p.sh as PinDotShape } : {}),
        ...(p.sn ? { showNumber: true } : {}),
        ...(p.hd ? { hidden: true } : {})
      })),
      // raw.r absent = old link (undefined signals "fall back to localStorage")
      routes: Array.isArray(raw.r)
        ? (raw.r as CompactRoute[]).map((r) => ({
            id: r.id,
            name: r.n,
            color: r.c,
            lineStyle: (r.ls ?? 'solid') as RouteLineStyle,
            waypointStyle: (r.ws ?? 'circle') as RouteWaypointStyle,
            waypointSize: (r.wz ?? 'm') as RouteWaypointSize,
            ...(r.wn ? { waypointShowNumber: true } : {}),
            ...(r.hd ? { hidden: true } : {}),
            points: r.pts.map((pt) => ({
              lat: pt[0],
              lng: pt[1],
              ...(pt[2] !== undefined ? { pinId: pt[2] } : {})
            }))
          }))
        : undefined,
      // raw.cp absent = pre-captions link (undefined signals "fall back to localStorage")
      captions: Array.isArray(raw.cp)
        ? (raw.cp as CompactCaption[]).map((c) => ({
            id: c.id,
            text: c.t,
            color: c.c,
            lat: c.la,
            lng: c.ln,
            size: (c.sz ?? 'm') as CaptionSize,
            ...(c.bg ? { background: true } : {}),
            ...(c.ro ? { rotation: c.ro } : {}),
            ...(c.hd ? { hidden: true } : {})
          }))
        : undefined,
      printAreas: Array.isArray(raw.pa)
        ? (raw.pa as CompactPrintArea[]).map((a) => ({
            id: String(uid()),
            corners: a.co as [number, number][],
            angle: a.an,
            paper: a.pa as PrintPaperSize,
            orientation: a.or as PrintOrientation,
            grid: a.gr,
            ...(a.ti ? { title: a.ti } : {}),
            ...(a.su ? { subtitle: a.su } : {}),
            ...(a.hd ? { hidden: true } : {}),
            ...(a.lg ? { legend: true } : {}),
            ...(a.lgp ? { legendPins: true } : {}),
            ...(a.lgr ? { legendRoutes: true } : {}),
            ...(a.lgsp ? { legendSeparatePage: true } : {}),
            ...(a.lgt ? { legendTitle: true } : {}),
            ...(a.lga ? { legendArea: true } : {}),
            ...(a.lgb ? { legendBlankLabels: true } : {}),
            ...(a.lgsc !== undefined ? { legendScale: a.lgsc } : {}),
            ...(a.lgx !== undefined ? { legendX: a.lgx } : {}),
            ...(a.lgy !== undefined ? { legendY: a.lgy } : {}),
            ...(a.lgc !== undefined ? { legendCorner: a.lgc } : {}),
            ...(a.cp ? { compass: true } : {}),
            ...(a.sc ? { scale: true } : {}),
            ...(a.ms !== undefined ? { markerScale: a.ms } : {})
          }))
        : undefined,
      mapStyle: raw.s as MapStyle,
      mapTitle: raw.t ?? '',
      area: typeof raw.a === 'string' ? raw.a : undefined,
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

// WCAG relative luminance — returns true when the color is perceptually dark
// (i.e. light text reads better on it). Returns false for transparent/unknown.
export function isDarkColor(color: string): boolean {
  if (!color || color === 'transparent') return false
  const hex = color.replace('#', '')
  if (hex.length !== 6) return false
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.5
}
