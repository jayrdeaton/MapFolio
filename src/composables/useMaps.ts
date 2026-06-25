import type { MapData, MapStyle, PinDotSize } from '@/types'
import type { ShareState } from '@/utils'
import { parseGeoJsonImport, parseGeoJsonRouteImport, pinsToGeoJson, routesToGeoJson } from '@/utils'

const STORAGE_KEY = 'mapfolio_v1'
const LEGACY_KEY = 'custommap_v1'

// Which layers to include in an export. Captions can only ride along in MapFolio
// JSON — standard GeoJSON has no caption/label concept, so they're dropped there.
export interface MapExportLayers {
  pins: boolean
  routes: boolean
  captions: boolean
}

export interface MapExportOptions {
  scope: string // a map id, or 'all'
  layers: MapExportLayers
  format: 'json' | 'geojson'
}

// Repairs a map's pins/routes on load:
//   • gives every pin/route a unique id (re-id collisions or invalid ids),
//   • relinks route waypoints whose pinId pointed at a re-id'd or missing pin.
// Idempotent — a no-op on already-clean data — so it can run on every load and
// self-heals any duplicate-id state left by the old Date.now() id bug.
// Returns the (possibly identical) map plus whether anything changed.
const VALID_MAP_STYLES = new Set<string>(['clean', 'minimal', 'standard', 'satellite', 'terrain'])

export function sanitizeMap(m: MapData): { map: MapData; changed: boolean } {
  // Normalize fields that may be absent or invalid in old/imported maps before id repair.
  let changed = false
  if (!Array.isArray(m.pins) || !Array.isArray(m.routes) || !VALID_MAP_STYLES.has(m.mapStyle as string) || typeof m.showLabels !== 'boolean' || typeof m.showClusters !== 'boolean') {
    m = {
      ...m,
      pins: Array.isArray(m.pins) ? m.pins : [],
      routes: Array.isArray(m.routes) ? m.routes : [],
      mapStyle: (VALID_MAP_STYLES.has(m.mapStyle as string) ? m.mapStyle : (m.mapStyle as string) === 'dark' ? 'minimal' : 'clean') as MapData['mapStyle'],
      showLabels: typeof m.showLabels === 'boolean' ? m.showLabels : false,
      showClusters: typeof m.showClusters === 'boolean' ? m.showClusters : true
    }
    changed = true
  }

  const usedPinIds = new Set<number>()
  const idRemap = new Map<number, number>() // old pin id -> resolved pin id
  const pins: MapData['pins'] = []

  const VALID_DOT_SIZES = new Set<string>(['xs', 's', 'm', 'l', 'xl'])
  for (const p of m.pins ?? []) {
    let id = p.id
    if (typeof id !== 'number' || usedPinIds.has(id)) id = uid()
    // An id-collision survivor is re-id'd but we do NOT record a remap — the
    // earlier holder keeps the original id, so existing route refs stay valid.
    usedPinIds.add(id)
    const dotSize = p.dotSize && VALID_DOT_SIZES.has(p.dotSize) ? p.dotSize : undefined
    if (id !== p.id || dotSize !== p.dotSize) {
      changed = true
      pins.push({ ...p, id, dotSize })
    } else {
      pins.push(p)
    }
  }

  // A reference to an id that still belongs to a surviving pin must not be remapped.
  for (const oldId of [...idRemap.keys()]) {
    if (usedPinIds.has(oldId)) idRemap.delete(oldId)
  }

  const usedCaptionIds = new Set<number>()
  let captions: MapData['captions']
  if (m.captions && m.captions.length > 0) {
    captions = m.captions.map((c) => {
      if (typeof c.id !== 'number' || usedCaptionIds.has(c.id)) {
        changed = true
        const next = { ...c, id: uid() }
        usedCaptionIds.add(next.id)
        return next
      }
      usedCaptionIds.add(c.id)
      return c
    })
  }

  const usedRouteIds = new Set<number>()
  // Resolve a waypoint's pinId to a surviving pin: follow any remap, then drop the
  // link entirely (undefined) if it points at a pin that no longer exists — e.g. a
  // route-linked pin was deleted, leaving a dangling reference.
  const resolvePinId = (pinId: number): number | undefined => {
    const resolved = idRemap.get(pinId) ?? pinId
    return usedPinIds.has(resolved) ? resolved : undefined
  }
  const routes = (m.routes ?? []).map((r) => {
    let next = r
    // Relink waypoints whose pinId was dropped or re-id'd, and strip dangling links.
    if (r.points.some((pt) => pt.pinId !== undefined && resolvePinId(pt.pinId) !== pt.pinId)) {
      changed = true
      next = { ...r, points: r.points.map((pt) => (pt.pinId !== undefined && resolvePinId(pt.pinId) !== pt.pinId ? { ...pt, pinId: resolvePinId(pt.pinId) } : pt)) }
    }
    // Ensure unique route id (same Date.now() collision class).
    if (typeof next.id !== 'number' || usedRouteIds.has(next.id)) {
      changed = true
      next = { ...next, id: uid() }
    }
    usedRouteIds.add(next.id)
    return next
  })

  // Validate printAreas — strip any entries missing required fields.
  let printAreas: MapData['printAreas']
  if (Array.isArray(m.printAreas) && m.printAreas.length > 0) {
    const valid = m.printAreas.filter((a) => a && typeof a.id === 'string' && Array.isArray(a.corners) && typeof a.angle === 'number' && typeof a.paper === 'string' && typeof a.orientation === 'string')
    if (valid.length !== m.printAreas.length) changed = true
    printAreas = valid.length > 0 ? valid : undefined
  }

  return changed ? { map: { ...m, pins, routes, ...(captions ? { captions } : {}), ...(printAreas !== undefined ? { printAreas } : {}) }, changed } : { map: m, changed }
}

function makeDefaultMap(overrides: Partial<MapData> = {}): MapData {
  return {
    id: Date.now().toString(),
    name: 'My Map',
    area: '',
    pins: [],
    routes: [],
    captions: [],
    mapStyle: 'clean' as MapStyle,
    showLabels: false,
    showClusters: true,
    pinDotSize: 'm' as PinDotSize,
    ...overrides
  }
}

function sanitizeAll(maps: MapData[]): { maps: MapData[]; changed: boolean } {
  let changed = false
  const cleaned = maps.map((m) => {
    const r = sanitizeMap(m)
    if (r.changed) changed = true
    return r.map
  })
  return { maps: cleaned, changed }
}

function loadStorage(): { maps: MapData[]; activeId: string; needsPersist: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) {
      const m = makeDefaultMap()
      return { maps: [m], activeId: m.id, needsPersist: false }
    }
    const parsed = JSON.parse(raw)
    if (parsed.version === 2 && Array.isArray(parsed.maps)) {
      const { maps, changed } = sanitizeAll(parsed.maps)
      return { maps, activeId: parsed.activeId ?? maps[0]?.id, needsPersist: changed }
    }
    // Migrate v1 single-map storage
    const m = makeDefaultMap({
      id: 'migrated',
      name: parsed.name || parsed.mapTitle || 'My Map',
      area: parsed.area ?? '',
      pins: parsed.pins ?? [],
      routes: parsed.routes ?? [],
      captions: parsed.captions ?? [],
      mapStyle: parsed.mapStyle === 'dark' ? 'minimal' : (parsed.mapStyle ?? 'clean'),
      showLabels: parsed.showLabels ?? false,
      showClusters: parsed.showClusters ?? true,
      pinDotSize: parsed.pinDotSize ?? 'm',
      center: parsed.center,
      zoom: parsed.zoom
    })
    const { map } = sanitizeMap(m)
    // v1→v2 migration always rewrites storage, so persist regardless.
    return { maps: [map], activeId: map.id, needsPersist: true }
  } catch {
    const m = makeDefaultMap()
    return { maps: [m], activeId: m.id, needsPersist: false }
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Hands the file to the OS share sheet when available (lovely on mobile — send
// straight to Messages/Mail/etc.), otherwise downloads it. Must stay synchronous
// up to the navigator.share() call so it runs inside the click's user activation.
function outputFile(filename: string, content: string, mime: string) {
  const file = new File([content], filename, { type: mime })
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: filename }).catch((err: unknown) => {
      // User dismissed the sheet → nothing to do. Anything else → fall back to a download.
      if (err instanceof DOMException && err.name === 'AbortError') return
      downloadBlob(file, filename)
    })
    return
  }
  downloadBlob(file, filename)
}

function slugify(name: string): string {
  return name.trim() || 'mapfolio'
}

// A copy of the map with unchecked layers emptied — used for both single-map and
// all-maps JSON export so the file still round-trips as a valid MapData.
function filterMapLayers(m: MapData, layers: MapExportLayers): MapData {
  return {
    ...m,
    pins: layers.pins ? m.pins : [],
    routes: layers.routes ? m.routes : [],
    captions: layers.captions ? (m.captions ?? []) : []
  }
}

// Pins → Point features, routes → LineString features. Captions are omitted
// (no GeoJSON equivalent); the caller disables the captions toggle for GeoJSON.
function mapToGeoJson(m: MapData, layers: MapExportLayers) {
  return {
    type: 'FeatureCollection' as const,
    features: [...(layers.pins ? pinsToGeoJson(m.pins).features : []), ...(layers.routes ? routesToGeoJson(m.routes).features : [])]
  }
}

export function useMaps() {
  const { maps: initialMaps, activeId: initialActiveId, needsPersist } = loadStorage()

  const maps = ref<MapData[]>(initialMaps)
  const activeId = ref<string>(initialActiveId)

  const activeMap = computed(() => maps.value.find((m) => m.id === activeId.value) ?? maps.value[0]!)

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, activeId: activeId.value, maps: maps.value }))
  }

  // Write back immediately if load-time repair (re-id / dedupe / v1 migration) changed anything,
  // so the cleanup sticks even if the user makes no further edits this session.
  if (needsPersist) persist()

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

  function patchMap(id: string, patch: Partial<MapData>) {
    maps.value = maps.value.map((m) => (m.id === id ? { ...m, ...patch } : m))
    persist()
  }

  function duplicateMap(id: string): MapData {
    const source = maps.value.find((m) => m.id === id)!
    const copy: MapData = { ...JSON.parse(JSON.stringify(source)), id: Date.now().toString(), name: `${source.name} (copy)` }
    maps.value = [...maps.value, copy]
    persist()
    return copy
  }

  function exportMapData(opts: MapExportOptions) {
    const { scope, layers, format } = opts

    // All-maps is JSON-only (a single GeoJSON FeatureCollection has no sensible
    // home for multiple distinct maps).
    if (scope === 'all') {
      const filtered = maps.value.map((m) => filterMapLayers(m, layers))
      outputFile('mapfolio-all-maps.json', JSON.stringify(filtered, null, 2), 'application/json')
      return
    }

    const m = maps.value.find((map) => map.id === scope)
    if (!m) return
    const base = slugify(m.name)

    if (format === 'geojson') {
      outputFile(`${base}.geojson`, JSON.stringify(mapToGeoJson(m, layers), null, 2), 'application/geo+json')
    } else {
      outputFile(`${base}.mapfolio.json`, JSON.stringify(filterMapLayers(m, layers), null, 2), 'application/json')
    }
  }

  function importFromShare(state: ShareState): MapData {
    const m = makeDefaultMap({
      id: Date.now().toString(),
      name: state.mapTitle || 'Shared Map',
      area: state.area ?? '',
      pins: state.pins,
      routes: state.routes ?? [],
      captions: state.captions ?? [],
      mapStyle: state.mapStyle,
      center: state.center,
      zoom: state.zoom
    })
    maps.value = [...maps.value, m]
    activeId.value = m.id
    persist()
    return m
  }

  function reorderMaps(newMaps: MapData[]) {
    maps.value = newMaps
    persist()
  }

  function importMapFromData(data: unknown): MapData | null {
    try {
      const source = data as Record<string, unknown>
      // GeoJSON FeatureCollection → new map built from Point pins + LineString routes.
      if (source?.type === 'FeatureCollection' && Array.isArray(source.features)) {
        const text = JSON.stringify(source)
        const pins = parseGeoJsonImport(text)?.pins ?? []
        const routes = parseGeoJsonRouteImport(text)?.routes ?? []
        if (pins.length === 0 && routes.length === 0) return null
        const m = makeDefaultMap({ id: Date.now().toString(), name: 'Imported Map', pins, routes })
        maps.value = [...maps.value, m]
        persist()
        return m
      }
      // MapFolio map JSON.
      const map = data as MapData
      if (!Array.isArray(map.pins) || !Array.isArray(map.routes)) return null
      const raw = makeDefaultMap({
        ...map,
        id: Date.now().toString(),
        name: map.name || 'Imported Map'
      })
      const { map: m } = sanitizeMap(raw)
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
    patchMap,
    createMap,
    switchMap,
    deleteMap,
    renameMap,
    duplicateMap,
    exportMapData,
    importFromShare,
    importMapFromData,
    reorderMaps
  }
}
