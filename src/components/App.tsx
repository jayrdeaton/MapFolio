import L from 'leaflet'
import { Map, MapPin, Plus, Printer, Scan, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet'

import MapOptions from './MapOptions'
import MapSearch, { SearchLocation } from './MapSearch'
import PinMarker from './PinMarker'
import PrintAreaDrawer from './PrintAreaDrawer'
import PrintLegend from './PrintLegend'
import TileLayerSelector from './TileLayerSelector'
import { DEFAULT_EMOJIS, MapStyle, Pin } from '../types'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
})

interface Notification {
  message: string
  type: 'success' | 'error' | 'info'
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
      map.setView([searchLocation.lat, searchLocation.lng], 14, { animate: true, duration: 1 })
    }
  }, [searchLocation, map])

  return null
}

interface PinPlacerProps {
  active: boolean
  onPlace: (latlng: L.LatLng) => void
}

function PinPlacer({ active, onPlace }: PinPlacerProps) {
  const map = useMap()

  useEffect(() => {
    map.getContainer().style.cursor = active ? 'crosshair' : ''
    return () => {
      map.getContainer().style.cursor = ''
    }
  }, [active, map])

  useMapEvents({
    click: (e) => {
      if (active) onPlace(e.latlng)
    }
  })

  return null
}

const btnBase = 'px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer'
const inputClass = 'w-full py-1.5 px-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
const sectionLabelClass = 'block mb-1 text-gray-500 font-semibold text-xs uppercase tracking-wide'

function App() {
  const [pins, setPins] = useState<Pin[]>([])
  const [mapStyle, setMapStyle] = useState<MapStyle>('clean')
  const [printBounds, setPrintBounds] = useState<L.LatLngBounds | null>(null)
  const [isSelectingArea, setIsSelectingArea] = useState(false)
  const [mapTitle, setMapTitle] = useState('')
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null)

  // New pin form
  const [isPlacingPin, setIsPlacingPin] = useState(false)
  const [newPinName, setNewPinName] = useState('')
  const [newPinDescription, setNewPinDescription] = useState('')
  const [newPinEmoji, setNewPinEmoji] = useState('📍')
  const [newPinColor, setNewPinColor] = useState('#3b82f6')
  const [customEmoji, setCustomEmoji] = useState('')

  const mapContainerRef = useRef<HTMLDivElement>(null)

  const showNotification = useCallback((message: string, type: Notification['type'] = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }, [])

  const handleMapReady = useCallback((map: L.Map) => {
    setLeafletMap(map)
  }, [])

  const handlePinPlace = useCallback(
    (latlng: L.LatLng) => {
      if (!newPinName.trim()) return
      const pin: Pin = {
        id: Date.now(),
        name: newPinName.trim(),
        description: newPinDescription.trim(),
        emoji: customEmoji.trim() || newPinEmoji,
        color: newPinColor,
        lat: latlng.lat,
        lng: latlng.lng
      }
      setPins((prev) => [...prev, pin])
      setIsPlacingPin(false)
      setNewPinName('')
      setNewPinDescription('')
      setCustomEmoji('')
      showNotification(`"${pin.name}" placed!`)
    },
    [newPinName, newPinDescription, newPinEmoji, newPinColor, customEmoji, showNotification]
  )

  const handleDeletePin = useCallback(
    (id: number) => {
      setPins((prev) => prev.filter((p) => p.id !== id))
      showNotification('Pin removed')
    },
    [showNotification]
  )

  const startPlacingPin = () => {
    if (!newPinName.trim()) {
      showNotification('Enter a name for the pin first', 'error')
      return
    }
    setIsSelectingArea(false)
    setIsPlacingPin(true)
    showNotification('Click the map to place the pin', 'info')
  }

  const startSelectingArea = () => {
    setIsPlacingPin(false)
    setIsSelectingArea(true)
    showNotification('Click and drag to select the print area', 'info')
  }

  const handleBoundsSet = useCallback(
    (bounds: L.LatLngBounds) => {
      setPrintBounds(bounds)
      setIsSelectingArea(false)
      showNotification('Print area set!')
    },
    [showNotification]
  )

  const handlePrint = () => {
    if (!leafletMap) {
      window.print()
      return
    }

    showNotification('Preparing print…', 'info')

    const prevCenter = leafletMap.getCenter()
    const prevZoom = leafletMap.getZoom()

    if (printBounds) {
      leafletMap.fitBounds(printBounds, { animate: false, padding: [8, 8] })
    }

    setTimeout(() => {
      window.print()
      if (printBounds) {
        setTimeout(() => {
          leafletMap.setView(prevCenter, prevZoom, { animate: false })
        }, 500)
      }
    }, 700)
  }

  const activeEmoji = customEmoji.trim() || newPinEmoji

  return (
    <div className='h-screen flex flex-col bg-gray-50 font-sans'>
      {/* Header */}
      <header className='bg-white border-b border-gray-200 px-4 py-3 flex flex-col md:flex-row justify-between items-center z-[1000] gap-3 shrink-0 no-print'>
        <div className='shrink-0'>
          <h1 className='text-gray-800 text-lg font-bold flex items-center gap-2'>
            <Map size={20} /> Custom Map
          </h1>
        </div>
        <div className='flex-1 flex justify-center w-full md:w-auto max-w-xl'>
          <MapSearch onLocationSelect={(loc) => { setSearchLocation(loc); showNotification(`Navigated to ${loc.label}`) }} onClear={() => setSearchLocation(null)} />
        </div>
        <button className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700 shrink-0`} onClick={handlePrint}>
          <Printer size={15} /> Print Map
        </button>
      </header>

      <div className='flex-1 flex flex-col md:flex-row relative overflow-hidden'>
        {/* Sidebar */}
        <aside className='w-full max-h-[45vh] md:max-h-none md:w-68 bg-white border-b md:border-b-0 md:border-r border-gray-200 p-4 overflow-y-auto z-[500] shrink-0 no-print'>

          {/* Map Style */}
          <MapOptions mapStyle={mapStyle} onStyleChange={setMapStyle} />

          {/* Print Settings */}
          <div className='mb-5 pt-4 border-t border-gray-100'>
            <h3 className='mb-3 text-gray-800 text-sm font-semibold flex items-center gap-1.5 uppercase tracking-wide'>
              <Printer size={14} /> Print
            </h3>

            <div className='mb-3'>
              <label htmlFor='mapTitle' className={sectionLabelClass}>Map Title</label>
              <input
                id='mapTitle'
                type='text'
                value={mapTitle}
                onChange={(e) => setMapTitle(e.target.value)}
                placeholder='e.g. "Our Adventure Map"'
                className={inputClass}
              />
            </div>

            <div>
              <label className={sectionLabelClass}>Print Area</label>
              {printBounds ? (
                <div className='flex gap-2 items-center'>
                  <div className='flex-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1.5 font-medium'>
                    Area selected ✓
                  </div>
                  <button
                    className='text-xs px-2.5 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer'
                    onClick={() => setPrintBounds(null)}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button
                  className={`${btnBase} w-full justify-center ${isSelectingArea ? 'bg-amber-400 text-gray-900 hover:bg-amber-500' : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'}`}
                  onClick={isSelectingArea ? () => setIsSelectingArea(false) : startSelectingArea}
                >
                  <Scan size={14} />
                  {isSelectingArea ? 'Cancel — Draw on Map' : 'Select Print Area'}
                </button>
              )}
              <p className='text-xs text-gray-400 mt-1.5 leading-tight'>
                {printBounds ? 'Map zooms to selection before printing.' : 'Drag a rectangle on the map, or leave blank to print the current view.'}
              </p>
            </div>
          </div>

          {/* Custom Pins */}
          <div className='pt-4 border-t border-gray-100'>
            <h3 className='mb-3 text-gray-800 text-sm font-semibold flex items-center gap-1.5 uppercase tracking-wide'>
              <MapPin size={14} /> Custom Pins
            </h3>

            <div className='mb-2.5'>
              <label className={sectionLabelClass}>Pin Name</label>
              <input
                type='text'
                value={newPinName}
                onChange={(e) => setNewPinName(e.target.value)}
                placeholder='e.g. "Swimming Hole"'
                onKeyDown={(e) => e.key === 'Enter' && startPlacingPin()}
                className={inputClass}
              />
            </div>

            <div className='mb-2.5'>
              <label className={sectionLabelClass}>Description (shows in legend)</label>
              <input
                type='text'
                value={newPinDescription}
                onChange={(e) => setNewPinDescription(e.target.value)}
                placeholder='e.g. "Great for swimming in summer"'
                className={inputClass}
              />
            </div>

            <div className='mb-2.5'>
              <label className={sectionLabelClass}>Icon</label>
              <div className='flex flex-wrap gap-1 mb-1.5'>
                {DEFAULT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { setNewPinEmoji(emoji); setCustomEmoji('') }}
                    className={`w-8 h-8 text-base rounded cursor-pointer transition-all flex items-center justify-center ${newPinEmoji === emoji && !customEmoji.trim() ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-100'}`}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                type='text'
                value={customEmoji}
                onChange={(e) => setCustomEmoji(e.target.value)}
                placeholder='Or type any emoji…'
                className={inputClass}
                maxLength={4}
              />
            </div>

            <div className='mb-3'>
              <label className={sectionLabelClass}>Color</label>
              <div className='flex items-center gap-2'>
                <input
                  type='color'
                  value={newPinColor}
                  onChange={(e) => setNewPinColor(e.target.value)}
                  className='w-10 h-8 p-0.5 cursor-pointer rounded border border-gray-300'
                />
                <span className='text-2xl leading-none'>{activeEmoji}</span>
                <div className='w-3 h-3 rounded-full border-2 border-white shadow' style={{ background: newPinColor }} />
              </div>
            </div>

            <button
              className={`${btnBase} w-full justify-center mb-4 ${isPlacingPin ? 'bg-amber-400 text-gray-900 hover:bg-amber-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              onClick={isPlacingPin ? () => setIsPlacingPin(false) : startPlacingPin}
            >
              <Plus size={15} />
              {isPlacingPin ? 'Cancel — Click Map to Place' : 'Place on Map'}
            </button>

            {/* Pin list */}
            {pins.length > 0 && (
              <div>
                <div className='flex justify-between items-center mb-2'>
                  <span className='text-xs font-semibold text-gray-400 uppercase tracking-wide'>Pins ({pins.length})</span>
                  <button
                    className='text-xs text-gray-400 hover:text-red-500 cursor-pointer flex items-center gap-1'
                    onClick={() => { if (window.confirm('Remove all pins?')) { setPins([]); showNotification('All pins cleared') } }}
                  >
                    <Trash2 size={11} /> Clear all
                  </button>
                </div>
                <div className='space-y-1.5'>
                  {pins.map((pin) => (
                    <div key={pin.id} className='bg-gray-50 border border-gray-200 rounded px-2.5 py-2 flex items-center gap-2'>
                      <span className='text-lg leading-none shrink-0'>{pin.emoji}</span>
                      <div className='flex-1 min-w-0'>
                        <div className='text-sm font-medium text-gray-800 truncate'>{pin.name}</div>
                        {pin.description && <div className='text-xs text-gray-400 truncate'>{pin.description}</div>}
                      </div>
                      <button
                        className='shrink-0 p-1 rounded hover:bg-gray-200 text-gray-300 hover:text-red-500 cursor-pointer transition-colors'
                        onClick={() => handleDeletePin(pin.id)}
                        title='Remove pin'
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Map */}
        <div className='flex-1 relative map-print-container' ref={mapContainerRef}>
          {mapTitle && <div className='print-map-title'>{mapTitle}</div>}

          <MapContainer center={[40.7128, -74.006]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayerSelector style={mapStyle} />
            <MapNavigator searchLocation={searchLocation} onMapReady={handleMapReady} />
            <PrintAreaDrawer isDrawing={isSelectingArea} printBounds={printBounds} onBoundsSet={handleBoundsSet} />
            <PinPlacer active={isPlacingPin} onPlace={handlePinPlace} />

            {searchLocation && (
              <Marker
                position={[searchLocation.lat, searchLocation.lng]}
                icon={L.divIcon({
                  html: `<div class="search-marker"><span class="search-marker-icon">📍</span></div>`,
                  className: 'search-marker-container',
                  iconSize: [30, 30],
                  iconAnchor: [15, 30]
                })}
              />
            )}

            {pins.map((pin) => (
              <PinMarker key={pin.id} pin={pin} onDelete={handleDeletePin} />
            ))}
          </MapContainer>

          <PrintLegend title={mapTitle} pins={pins} />
        </div>
      </div>

      {notification && (
        <div
          className={`fixed top-16 right-4 text-white text-sm px-4 py-2.5 rounded shadow-lg z-[2000] animate-[slideIn_0.25s_ease] no-print ${
            notification.type === 'error' ? 'bg-red-600' : notification.type === 'info' ? 'bg-blue-600' : 'bg-green-600'
          }`}
        >
          {notification.message}
        </div>
      )}
    </div>
  )
}

export default App
