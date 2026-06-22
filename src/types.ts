export interface RoutePoint {
  lat: number
  lng: number
  pinId?: number
}

export type RouteLineStyle = 'solid' | 'dashed' | 'dotted' | 'long-dash' | 'dash-dot' | 'arrow' | 'double' | 'none'
export type RouteWaypointStyle = 'circle' | 'square' | 'diamond' | 'none'
export type RouteWaypointSize = 'xs' | 's' | 'm' | 'l' | 'xl'

export interface Route {
  id: number
  name: string
  color: string
  lineStyle?: RouteLineStyle
  waypointStyle?: RouteWaypointStyle
  waypointShowNumber?: boolean
  waypointSize?: RouteWaypointSize
  points: RoutePoint[]
  hidden?: boolean
}

export interface Pin {
  id: number
  name: string
  description: string
  emoji: string
  color: string
  lat: number
  lng: number
  address?: string
  hidden?: boolean
  dotSize?: PinDotSize
  dotShape?: PinDotShape
  showNumber?: boolean
}

export type CaptionSize = 'xs' | 's' | 'm' | 'l' | 'xl'

export interface Caption {
  id: number
  text: string
  lat: number
  lng: number
  color: string
  size: CaptionSize
  background?: boolean // white pill behind the text for legibility on busy/satellite tiles
  rotation?: number // degrees, clockwise; set via the on-map rotate handle
  hidden?: boolean
}

export interface MapData {
  id: string
  name: string
  area: string
  pins: Pin[]
  routes: Route[]
  captions?: Caption[] // optional: older stored maps predate captions
  mapStyle: MapStyle
  showLabels: boolean
  showClusters: boolean
  pinDotSize?: PinDotSize
  center?: [number, number]
  zoom?: number
}

// Font size in PDF points (reference page width 612pt), scaled by S = paperW/612 in the
// export. Keep roughly proportional to CAPTION_PX (the on-screen sizes).
export const CAPTION_PT: Record<CaptionSize, number> = { xs: 9, s: 11, m: 14, l: 18, xl: 24 }

// On-screen font sizes (px) for the live map — shared by CaptionMarker (label) and
// CaptionRotateHandle (to offset the handle clear of the text).
export const CAPTION_PX: Record<CaptionSize, number> = { xs: 11, s: 13, m: 16, l: 20, xl: 26 }

export type MapStyle = 'clean' | 'minimal' | 'standard' | 'satellite' | 'terrain'
export type PinDotSize = 'xs' | 's' | 'm' | 'l' | 'xl'
export type PinDotShape = 'circle' | 'square' | 'diamond'

export interface MapStyleConfig {
  name: string
  description: string
  url: string
  darkUrl?: string
  attribution: string
  subdomains?: string
  maxNativeZoom?: number
  crossOrigin?: boolean
  retina?: boolean // true when the URL has {r} and the provider supports @2x tiles (512px)
  // Input black point for print export levels adjustment (0–255).
  // Values at or below this → black; stretches the tonal range upward so
  // light-style tiles (which use a tiny slice of the upper range) have
  // visible contrast on paper. ~150 works well for CartoDB light styles.
  printBlackPoint?: number
}

export const MAP_STYLE_CONFIGS: Record<MapStyle, MapStyleConfig> = {
  clean: {
    name: 'Clean',
    description: 'No labels, perfect for activity maps',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    darkUrl: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CartoDB</a>',
    subdomains: 'abcd',
    maxNativeZoom: 19,
    crossOrigin: true,
    retina: true,
    printBlackPoint: 150
  },
  minimal: {
    name: 'Minimal',
    description: 'Light with place names only',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    darkUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CartoDB</a>',
    subdomains: 'abcd',
    maxNativeZoom: 19,
    crossOrigin: true,
    retina: true,
    printBlackPoint: 150
  },
  standard: {
    name: 'Standard',
    description: 'Full street map with labels',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxNativeZoom: 17
  },
  satellite: {
    name: 'Satellite',
    description: 'Aerial imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxNativeZoom: 17
  },
  terrain: {
    name: 'Terrain',
    description: 'Topographic with elevation',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxNativeZoom: 17
  }
}

export const DEFAULT_EMOJIS = [
  // Markers
  '📍',
  '🚩',
  '🎯',
  '⭐',
  '❤️',
  '⚠️',
  '📷',
  // Structures
  '🏠',
  '🏥',
  '🏨',
  '🏪',
  '🏫',
  '🏛',
  '🏟',
  '🏰',
  '🎭',
  '⛪',
  '⛩️',
  '🛕',
  '🅿️',
  '⛽',
  // Activities
  '🎣',
  '🥾',
  '🎒',
  '⛳',
  '🚴',
  '⛷',
  '🏊',
  '🏄',
  '🛶',
  '🧗',
  '🤿',
  '⛺',
  '⛱️',
  // Parks & play
  '🎈',
  '🛝',
  '🎠',
  '🎡',
  '🎢',
  '🎪',
  '⛲',
  // Food & drink
  '☕',
  '🍺',
  '🧋',
  '🍕',
  '🌮',
  '🍜',
  '🍚',
  '🍗',
  '🍛',
  '🍲',
  '🌶️',
  '🥭',
  '🍌',
  '🥥',
  '🍦',
  '🍧',
  '🍩',
  '🍰',
  '🍭',
  // Transport
  '🚗',
  '✈️',
  '⛵',
  '🚂',
  // Nature & outdoors
  '🌋',
  '🗻',
  '🌳',
  '🌲',
  '🌺',
  '🌸',
  '🌵',
  '🌊',
  '💧',
  // Wildlife
  '🦌',
  '🦁',
  '🐅',
  '🐻',
  '🐺',
  '🦅',
  '🐟',
  // Birds
  '🐦',
  '🕊️',
  '🦆',
  '🦉',
  '🐧',
  '🦜',
  '🦢',
  '🦩',
  '🦚',
  '🐤',
  // Cute animals
  '🐘',
  '🐵',
  '🐼',
  '🐨',
  '🐰',
  '🦊',
  '🐶',
  '🐱',
  '🐸',
  '🐢',
  '🦋',
  '🐝',
  '🦎',
  '🐬',
  '🐠',
  '🦖'
]
