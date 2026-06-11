export interface Pin {
  id: number
  name: string
  description: string
  emoji: string
  color: string
  lat: number
  lng: number
}

export type MapStyle = 'clean' | 'minimal' | 'standard' | 'satellite' | 'terrain' | 'dark'

export interface MapStyleConfig {
  name: string
  description: string
  url: string
  attribution: string
  subdomains?: string
}

export const MAP_STYLE_CONFIGS: Record<MapStyle, MapStyleConfig> = {
  clean: {
    name: 'Clean',
    description: 'No labels — perfect for activity maps',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CartoDB</a>',
    subdomains: 'abcd'
  },
  minimal: {
    name: 'Minimal',
    description: 'Light with place names only',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CartoDB</a>',
    subdomains: 'abcd'
  },
  standard: {
    name: 'Standard',
    description: 'Full street map with labels',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  },
  satellite: {
    name: 'Satellite',
    description: 'Aerial imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  },
  terrain: {
    name: 'Terrain',
    description: 'Topographic with elevation',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  },
  dark: {
    name: 'Dark',
    description: 'Dark theme',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CartoDB</a>',
    subdomains: 'abcd'
  }
}

export const DEFAULT_EMOJIS = ['📍', '⭐', '🏠', '🌳', '🏔', '💧', '🎯', '🚩', '🏕', '🌺', '🦁', '🐟', '⚠️', '❤️', '🔵', '🟢']
