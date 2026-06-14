import type { MapData, MapStyle, PinDotSize } from '../types'

const STORAGE_KEY = 'mapfolio_v1'
const LEGACY_KEY = 'custommap_v1'

function makeDefaultMap(overrides: Partial<MapData> = {}): MapData {
  return {
    id: Date.now().toString(),
    name: 'My Map',
    area: '',
    pins: [],
    routes: [],
    mapStyle: 'clean' as MapStyle,
    showLabels: false,
    showClusters: true,
    pinDotSize: 'm' as PinDotSize,
    ...overrides
  }
}

function loadStorage(): { maps: MapData[]; activeId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) {
      const m = makeDefaultMap()
      return { maps: [m], activeId: m.id }
    }
    const parsed = JSON.parse(raw)
    if (parsed.version === 2 && Array.isArray(parsed.maps)) {
      return { maps: parsed.maps, activeId: parsed.activeId ?? parsed.maps[0]?.id }
    }
    // Migrate v1 single-map storage
    const m = makeDefaultMap({
      id: 'migrated',
      name: parsed.name || parsed.mapTitle || 'My Map',
      area: parsed.area ?? '',
      pins: parsed.pins ?? [],
      routes: parsed.routes ?? [],
      mapStyle: parsed.mapStyle === 'dark' ? 'minimal' : (parsed.mapStyle ?? 'clean'),
      showLabels: parsed.showLabels ?? false,
      showClusters: parsed.showClusters ?? true,
      pinDotSize: parsed.pinDotSize ?? 'm',
      center: parsed.center,
      zoom: parsed.zoom
    })
    return { maps: [m], activeId: m.id }
  } catch {
    const m = makeDefaultMap()
    return { maps: [m], activeId: m.id }
  }
}

export function useMaps() {
  const { maps: initialMaps, activeId: initialActiveId } = loadStorage()

  const maps = ref<MapData[]>(initialMaps)
  const activeId = ref<string>(initialActiveId)

  const activeMap = computed(() => maps.value.find((m) => m.id === activeId.value) ?? maps.value[0]!)

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, activeId: activeId.value, maps: maps.value }))
  }

  function updateActiveMap(patch: Partial<MapData>) {
    maps.value = maps.value.map((m) => (m.id === activeId.value ? { ...m, ...patch } : m))
    persist()
  }

  function createMap(name: string): MapData {
    const m = makeDefaultMap({ name })
    maps.value = [...maps.value, m]
    persist()
    return m
  }

  function switchMap(id: string) {
    activeId.value = id
    persist()
  }

  function deleteMap(id: string) {
    if (maps.value.length <= 1) return
    const remaining = maps.value.filter((m) => m.id !== id)
    maps.value = remaining
    if (activeId.value === id) activeId.value = remaining[0]!.id
    persist()
  }

  function renameMap(id: string, name: string) {
    maps.value = maps.value.map((m) => (m.id === id ? { ...m, name } : m))
    persist()
  }

  function duplicateMap(id: string): MapData {
    const source = maps.value.find((m) => m.id === id)!
    const copy: MapData = { ...JSON.parse(JSON.stringify(source)), id: Date.now().toString(), name: `${source.name} (copy)` }
    maps.value = [...maps.value, copy]
    persist()
    return copy
  }

  function exportMap(id: string) {
    const m = maps.value.find((map) => map.id === id)!
    const blob = new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${m.name || 'map'}.mapfolio.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportMapAsGeoJson(id: string) {
    const m = maps.value.find((map) => map.id === id)!
    const features: unknown[] = [
      ...m.pins.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { name: p.name || null, description: p.description || null, emoji: p.emoji, color: p.color, address: p.address || null }
      })),
      ...m.routes.map((r) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: r.points.map((pt) => [pt.lng, pt.lat]) },
        properties: { name: r.name || null, color: r.color }
      }))
    ]
    const geojson = { type: 'FeatureCollection', features }
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${m.name || 'map'}.geojson`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportAllMaps() {
    const blob = new Blob([JSON.stringify(maps.value, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mapfolio-all-maps.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importMapFromData(data: unknown): MapData | null {
    try {
      const source = data as MapData
      if (!Array.isArray(source.pins) || !Array.isArray(source.routes)) return null
      const m = makeDefaultMap({
        ...source,
        id: Date.now().toString(),
        name: source.name || 'Imported Map'
      })
      maps.value = [...maps.value, m]
      persist()
      return m
    } catch {
      return null
    }
  }

  return {
    maps,
    activeId,
    activeMap,
    updateActiveMap,
    createMap,
    switchMap,
    deleteMap,
    renameMap,
    duplicateMap,
    exportMap,
    exportMapAsGeoJson,
    exportAllMaps,
    importMapFromData
  }
}
