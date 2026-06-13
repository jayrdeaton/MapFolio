export interface RoutePoint {
  lat: number
  lng: number
}

export interface Route {
  id: number
  name: string
  color: string
  points: RoutePoint[]
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
}

export type MapStyle = 'clean' | 'minimal' | 'standard' | 'satellite' | 'terrain'

export type PinDotSize = 'none' | 's' | 'm' | 'l'

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
    description: 'No labels — perfect for activity maps',
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
  '🅿️',
  '⛽',
  // Nature & outdoors
  '🏕',
  '🏔',
  '🏖',
  '🏜',
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
  '🐻',
  '🐺',
  '🦅',
  '🐟',
  // Activities
  '🎣',
  '🥾',
  '⛳',
  '🚴',
  '⛷',
  '🏊',
  '🏄',
  '🧗',
  '🤿',
  // Food & drink
  '☕',
  '🍺',
  '🍕',
  '🌮',
  // Transport
  '🚗',
  '✈️',
  '⛵',
  '🚂',
  // Colors
  '🔴',
  '🟠',
  '🟡',
  '🟢',
  '🔵',
  '🟣',
  '⚫'
]
