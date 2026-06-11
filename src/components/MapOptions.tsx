export interface MapOptionsState {
  showLabels: boolean
  showStreetNames: boolean
  showPOI: boolean
  showTransit: boolean
  showWater: boolean
  showParks: boolean
  showBuildings: boolean
  showHighways: boolean
  showLocalRoads: boolean
  showBorders: boolean
}

interface OverlayOption {
  name: string
  description: string
  default: boolean
}

export const MAP_OVERLAY_OPTIONS: Record<keyof MapOptionsState, OverlayOption> = {
  showLabels: { name: 'Show All Labels', description: 'Display place names and labels', default: true },
  showStreetNames: { name: 'Show Street Names', description: 'Display road and street names', default: true },
  showPOI: { name: 'Show Points of Interest', description: 'Display restaurants, shops, landmarks', default: false },
  showTransit: { name: 'Show Transit', description: 'Display bus stops, train stations', default: false },
  showWater: { name: 'Show Water Bodies', description: 'Display rivers, lakes, oceans', default: true },
  showParks: { name: 'Show Parks & Green Spaces', description: 'Display parks and natural areas', default: true },
  showBuildings: { name: 'Show Buildings', description: 'Display building footprints', default: false },
  showHighways: { name: 'Show Highways', description: 'Display major highways and motorways', default: true },
  showLocalRoads: { name: 'Show Local Roads', description: 'Display local streets and roads', default: true },
  showBorders: { name: 'Show Boundaries', description: 'Display country and administrative borders', default: true }
}

interface TileVariantConfig {
  name: string
  url: string
  attribution?: string
  subdomains?: string
}

type EsriVariant = 'standard' | 'noLabels' | 'satellite' | 'terrain'
type CartodbVariant = 'standard' | 'noLabels' | 'onlyLabels' | 'dark'
type OsmVariant = 'standard' | 'humanitarian'

export type TileProvider = 'esri' | 'cartodb' | 'osm'
export type TileVariant = EsriVariant | CartodbVariant | OsmVariant

export const TILE_LAYER_VARIANTS: {
  esri: Record<EsriVariant, TileVariantConfig>
  cartodb: Record<CartodbVariant, TileVariantConfig>
  osm: Record<OsmVariant, TileVariantConfig>
} = {
  esri: {
    standard: { name: 'Standard', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' },
    noLabels: { name: 'No Labels', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' },
    satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' },
    terrain: { name: 'Terrain', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' }
  },
  cartodb: {
    standard: { name: 'Standard', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd' },
    noLabels: { name: 'No Labels', url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', subdomains: 'abcd' },
    onlyLabels: { name: 'Only Labels', url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', subdomains: 'abcd' },
    dark: { name: 'Dark Theme', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd' }
  },
  osm: {
    standard: { name: 'Standard', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
    humanitarian: { name: 'Humanitarian', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', subdomains: 'abc' }
  }
}

interface MapOptionsProps {
  tileProvider: TileProvider
  setTileProvider: (provider: TileProvider) => void
  tileVariant: TileVariant
  setTileVariant: (variant: TileVariant) => void
  mapOptions: MapOptionsState
  setMapOptions: (options: MapOptionsState) => void
  onToggleOption: (key: keyof MapOptionsState) => void
}

const selectClass = 'w-full py-2 px-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'
const labelClass = 'block mb-2 text-gray-600 font-medium text-sm'

function MapOptions({ tileProvider, setTileProvider, tileVariant, setTileVariant, mapOptions, onToggleOption, setMapOptions }: MapOptionsProps) {
  const availableVariants = TILE_LAYER_VARIANTS[tileProvider]

  return (
    <div className='mb-8'>
      <h3 className='mb-4 text-gray-800 text-lg font-semibold'>🗺️ Map Style</h3>

      <div className='mb-4'>
        <label htmlFor='tileProvider' className={labelClass}>
          Map Provider
        </label>
        <select
          id='tileProvider'
          value={tileProvider}
          className={selectClass}
          onChange={(e) => {
            setTileProvider(e.target.value as TileProvider)
            setTileVariant('standard')
          }}
        >
          <option value='esri'>Esri (Best for Thailand)</option>
          <option value='cartodb'>CartoDB</option>
          <option value='osm'>OpenStreetMap</option>
        </select>
      </div>

      {Object.keys(availableVariants).length > 1 && (
        <div className='mb-4'>
          <label htmlFor='tileVariant' className={labelClass}>
            Map Style
          </label>
          <select id='tileVariant' value={tileVariant} className={selectClass} onChange={(e) => setTileVariant(e.target.value as TileVariant)}>
            {Object.entries(availableVariants).map(([key, variant]) => (
              <option key={key} value={key}>
                {variant.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <h3 className='mb-4 text-gray-800 text-lg font-semibold'>🎚️ Display Options</h3>

      <div className='grid gap-3 mb-6'>
        {(Object.entries(MAP_OVERLAY_OPTIONS) as [keyof MapOptionsState, OverlayOption][]).map(([key, option]) => (
          <div key={key} className='bg-gray-50 border border-gray-200 rounded-md p-3 transition-all hover:bg-gray-100 hover:border-blue-400'>
            <label className='flex items-center cursor-pointer font-medium text-gray-800'>
              <input type='checkbox' className='mr-2 scale-110 cursor-pointer' checked={mapOptions[key]} onChange={() => onToggleOption(key)} />
              <span className='text-sm leading-tight'>{option.name}</span>
            </label>
            <div className='text-xs text-gray-500 mt-1 pl-6 leading-tight'>{option.description}</div>
          </div>
        ))}
      </div>

      <div className='mb-4'>
        <button
          type='button'
          className='w-full py-2 bg-gray-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-gray-600 transition-colors'
          onClick={() => {
            const defaultOptions = Object.fromEntries(Object.entries(MAP_OVERLAY_OPTIONS).map(([key, opt]) => [key, opt.default])) as unknown as MapOptionsState
            setMapOptions(defaultOptions)
          }}
        >
          Reset to Defaults
        </button>
      </div>

      <div className='bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700'>
        <p>
          <strong className='text-blue-900'>Note:</strong> Some options may vary depending on the selected map provider. Esri maps generally provide the most granular control over display elements.
        </p>
      </div>
    </div>
  )
}

export default MapOptions
