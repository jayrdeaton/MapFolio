import html2canvas from 'html2canvas'
import L from 'leaflet'
import { Download, Map, MapPin, Plus, Printer, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet'

import MapOptions, { MAP_OVERLAY_OPTIONS, MapOptionsState, TileProvider, TileVariant } from './MapOptions'
import MapSearch, { SearchLocation } from './MapSearch'
import MapStyleManager from './MapStyleManager'
import TileLayerSelector from './TileLayerSelector'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
})

interface Label {
  id: number
  text: string
  color: string
  lat: number
  lng: number
}

interface Notification {
  message: string
  type: 'success' | 'error'
}

interface MapClickHandlerProps {
  onMapClick: (latlng: L.LatLng) => void
  isAddingLabel: boolean
}

function MapClickHandler({ onMapClick, isAddingLabel }: MapClickHandlerProps) {
  useMapEvents({
    click: (e) => {
      if (isAddingLabel) onMapClick(e.latlng)
    }
  })
  return null
}

interface MapNavigatorProps {
  searchLocation: SearchLocation | null
  onMapReady: (map: L.Map) => void
}

function MapNavigator({ searchLocation, onMapReady }: MapNavigatorProps) {
  const map = useMap()

  useEffect(() => {
    onMapReady(map)
  }, [map, onMapReady])

  useEffect(() => {
    if (searchLocation) {
      map.setView([searchLocation.lat, searchLocation.lng], 15, { animate: true, duration: 1 })
    }
  }, [searchLocation, map])

  return null
}

interface CustomLabelProps {
  label: Label
  onDelete: (id: number) => void
}

function CustomLabel({ label, onDelete }: CustomLabelProps) {
  const map = useMap()

  useEffect(() => {
    const customIcon = L.divIcon({
      html: `<div class="custom-label" style="border-color: ${label.color}; color: ${label.color};">${label.text}</div>`,
      className: 'custom-label-icon',
      iconSize: [100, 30],
      iconAnchor: [50, 15]
    })

    const marker = L.marker([label.lat, label.lng], { icon: customIcon }).addTo(map)

    marker.on('click', () => {
      if (window.confirm('Delete this label?')) onDelete(label.id)
    })

    return () => {
      map.removeLayer(marker)
    }
  }, [label, map, onDelete])

  return null
}

const btnBase = 'px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer'

function App() {
  const [labels, setLabels] = useState<Label[]>([])
  const [isAddingLabel, setIsAddingLabel] = useState(false)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null)
  const [tileProvider, setTileProvider] = useState<TileProvider>('esri')
  const [tileVariant, setTileVariant] = useState<TileVariant>('standard')
  const [labelText, setLabelText] = useState('')
  const [labelColor, setLabelColor] = useState('#007bff')

  const [mapOptions, setMapOptions] = useState<MapOptionsState>(() => Object.fromEntries(Object.entries(MAP_OVERLAY_OPTIONS).map(([key, opt]) => [key, opt.default])) as unknown as MapOptionsState)

  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<L.Map | null>(null)

  const showNotification = (message: string, type: Notification['type'] = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleMapClick = useCallback(
    (latlng: L.LatLng) => {
      if (isAddingLabel && labelText.trim()) {
        const newLabel: Label = { id: Date.now(), text: labelText.trim(), color: labelColor, lat: latlng.lat, lng: latlng.lng }
        setLabels((prev) => [...prev, newLabel])
        setLabelText('')
        setIsAddingLabel(false)
        showNotification('Label added successfully!')
      }
    },
    [isAddingLabel, labelText, labelColor]
  )

  const handleDeleteLabel = useCallback((labelId: number) => {
    setLabels((prev) => prev.filter((label) => label.id !== labelId))
    showNotification('Label deleted!')
  }, [])

  const startAddingLabel = () => {
    if (!labelText.trim()) {
      showNotification('Please enter label text first!', 'error')
      return
    }
    setIsAddingLabel(true)
    showNotification('Click on the map to place the label')
  }

  const printMap = () => {
    try {
      showNotification('Opening print dialog...')
      document.body.classList.add('print-mode')
      setTimeout(() => {
        window.print()
        document.body.classList.remove('print-mode')
      }, 500)
    } catch {
      showNotification('Error opening print dialog', 'error')
      document.body.classList.remove('print-mode')
    }
  }

  const downloadImage = async () => {
    try {
      showNotification('Generating image...')
      const mapElement = mapRef.current
      if (!mapElement) return

      const elementsToHide = document.querySelectorAll<HTMLElement>('.sidebar, header, .print-controls')
      elementsToHide.forEach((el) => (el.style.display = 'none'))

      const canvas = await html2canvas(mapElement, { useCORS: true, allowTaint: true, scale: 2 })

      elementsToHide.forEach((el) => (el.style.display = ''))

      const link = document.createElement('a')
      link.download = `custom-map-${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL()
      link.click()

      showNotification('Image downloaded successfully!')
    } catch {
      showNotification('Error generating image', 'error')
    }
  }

  const clearAllLabels = () => {
    if (window.confirm('Are you sure you want to clear all labels?')) {
      setLabels([])
      showNotification('All labels cleared!')
    }
  }

  const handleLocationSelect = (location: SearchLocation) => {
    setSearchLocation(location)
    showNotification(`Navigated to ${location.label}`)
  }

  const handleSearchClear = () => setSearchLocation(null)

  const handleMapReady = useCallback((mapInstance: L.Map) => {
    leafletMapRef.current = mapInstance
  }, [])

  const toggleMapOption = (optionKey: keyof MapOptionsState) => {
    setMapOptions((prev) => ({ ...prev, [optionKey]: !prev[optionKey] }))
  }

  const inputClass = 'w-full py-2 px-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'
  const formLabelClass = 'block mb-2 text-gray-600 font-medium text-sm'

  return (
    <div className='h-screen flex flex-col bg-gray-100 font-sans'>
      <header className='bg-white shadow-sm px-4 py-4 md:px-8 flex flex-col md:flex-row justify-between items-center z-1000 gap-4 shrink-0'>
        <div className='shrink-0 w-full md:w-auto text-center md:text-left'>
          <h1 className='text-gray-800 text-xl md:text-2xl font-semibold flex items-center justify-center md:justify-start gap-2'>
            <Map size={24} /> Custom Map
          </h1>
        </div>
        <div className='flex-1 flex justify-center w-full md:w-auto max-w-125'>
          <MapSearch onLocationSelect={handleLocationSelect} onClear={handleSearchClear} />
        </div>
        <div className='flex gap-4 items-center w-full md:w-auto justify-center md:justify-end'>
          <button className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`} onClick={printMap}>
            <Printer size={16} />
            Print Map
          </button>
          <button className={`${btnBase} bg-green-600 text-white hover:bg-green-700`} onClick={downloadImage}>
            <Download size={16} />
            Download Image
          </button>
        </div>
      </header>

      <div className='flex-1 flex flex-col md:flex-row relative overflow-hidden'>
        <aside className='w-full max-h-[40vh] md:max-h-none md:w-75 bg-white border-b md:border-b-0 md:border-r border-gray-200 p-4 md:p-6 overflow-y-auto z-500 shrink-0'>
          <MapOptions
            tileProvider={tileProvider}
            setTileProvider={setTileProvider}
            tileVariant={tileVariant}
            setTileVariant={setTileVariant}
            mapOptions={mapOptions}
            setMapOptions={setMapOptions}
            onToggleOption={toggleMapOption}
          />

          <h3 className='mb-4 text-gray-800 text-lg font-semibold flex items-center gap-2'>
            <MapPin size={18} /> Add Custom Labels
          </h3>

          <div className='mb-4'>
            <label htmlFor='labelText' className={formLabelClass}>
              Label Text
            </label>
            <input id='labelText' type='text' value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder='Enter label text' onKeyDown={(e) => e.key === 'Enter' && startAddingLabel()} className={inputClass} />
          </div>

          <div className='mb-4'>
            <label htmlFor='labelColor' className={formLabelClass}>
              Label Color
            </label>
            <input id='labelColor' type='color' value={labelColor} onChange={(e) => setLabelColor(e.target.value)} className='w-12 h-9 p-0.5 cursor-pointer rounded border border-gray-300' />
          </div>

          <button
            className={`${btnBase} w-full justify-center mb-4 ${isAddingLabel ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            onClick={isAddingLabel ? () => setIsAddingLabel(false) : startAddingLabel}
          >
            <Plus size={16} />
            {isAddingLabel ? 'Cancel Adding' : 'Add Label to Map'}
          </button>

          {labels.length > 0 && (
            <button className={`${btnBase} w-full justify-center mb-4 bg-gray-500 text-white hover:bg-gray-600`} onClick={clearAllLabels}>
              <Trash2 size={16} />
              Clear All Labels
            </button>
          )}

          <div className='mt-6'>
            <h3 className='mb-4 text-gray-800 text-lg font-semibold'>Labels ({labels.length})</h3>
            {labels.map((label) => (
              <div key={label.id} className='bg-gray-50 border border-gray-200 rounded-md p-3 mb-2 flex justify-between items-start'>
                <div className='flex-1'>
                  <div className='font-medium mb-1' style={{ color: label.color }}>
                    {label.text}
                  </div>
                  <div className='text-xs text-gray-500'>
                    {label.lat.toFixed(4)}, {label.lng.toFixed(4)}
                  </div>
                </div>
                <button className='ml-2 px-2 py-1 rounded text-xs bg-gray-500 text-white hover:bg-gray-600 flex items-center cursor-pointer' onClick={() => handleDeleteLabel(label.id)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className='flex-1 relative' ref={mapRef}>
          <MapContainer center={[40.7128, -74.006]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayerSelector provider={tileProvider} variant={tileVariant} />
            <MapNavigator searchLocation={searchLocation} onMapReady={handleMapReady} />
            <MapStyleManager mapOptions={mapOptions} />
            <MapClickHandler onMapClick={handleMapClick} isAddingLabel={isAddingLabel} />

            {searchLocation && (
              <Marker
                position={[searchLocation.lat, searchLocation.lng]}
                icon={L.divIcon({
                  html: `<div class="search-marker"><div class="search-marker-icon">📍</div></div>`,
                  className: 'search-marker-container',
                  iconSize: [30, 30],
                  iconAnchor: [15, 30]
                })}
              />
            )}

            {labels.map((label) => (
              <CustomLabel key={label.id} label={label} onDelete={handleDeleteLabel} />
            ))}
          </MapContainer>
        </div>
      </div>

      {notification && (
        <div className={`fixed top-20 right-5 text-white px-6 py-4 rounded-md shadow-lg z-2000 animate-[slideIn_0.3s_ease] ${notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {notification.message}
        </div>
      )}
    </div>
  )
}

export default App
