import { OpenStreetMapProvider } from 'leaflet-geosearch'
import { Loader, MapPin, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const provider = new OpenStreetMapProvider({
  params: {
    'accept-language': 'en',
    addressdetails: 1,
    limit: 5
  }
})

export interface SearchLocation {
  lat: number
  lng: number
  label: string
}

interface MapSearchProps {
  onLocationSelect: (location: SearchLocation) => void
  onClear: () => void
}

function MapSearch({ onLocationSelect, onClear }: MapSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Awaited<ReturnType<typeof provider.search>>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchLocations = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    try {
      const searchResults = await provider.search({ query: searchQuery })
      setResults(searchResults.slice(0, 8))
      setShowResults(true)
      setSelectedIndex(-1)
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchLocations(value), 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) handleSelectResult(results[selectedIndex])
        break
      case 'Escape':
        setShowResults(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleSelectResult = (result: (typeof results)[number]) => {
    setQuery(result.label)
    setShowResults(false)
    setResults([])
    setSelectedIndex(-1)
    onLocationSelect({ lat: result.y, lng: result.x, label: result.label })
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
    setSelectedIndex(-1)
    onClear()
  }

  const formatLabel = (label: string) => {
    const parts = label.split(', ')
    if (parts.length <= 2) return label
    if (parts.length > 4) return `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`
    return label
  }

  return (
    <div className='relative w-full max-w-100' ref={searchRef}>
      <div className='relative flex items-center'>
        <Search className='absolute left-3 text-gray-500 pointer-events-none z-2' size={18} />
        <input
          type='text'
          placeholder='Search for places, cities, addresses...'
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className='w-full py-3 pl-10 pr-10 border-2 border-gray-200 rounded-lg text-sm bg-white transition-all placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
        />
        {isSearching && <Loader className='absolute right-10 text-blue-500 animate-spin' size={18} />}
        {query && (
          <button onClick={handleClear} className='absolute right-3 bg-transparent border-0 text-gray-500 cursor-pointer flex items-center justify-center p-1 rounded hover:text-red-500 hover:bg-red-50' type='button'>
            <X size={16} />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className='absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-1000 max-h-100 overflow-y-auto mt-1'>
          {results.map((result, index) => (
            <div
              key={`${result.x}-${result.y}-${index}`}
              className={`flex items-start p-3 cursor-pointer border-b border-gray-100 transition-colors last:border-b-0 ${index === selectedIndex ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
              onClick={() => handleSelectResult(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <MapPin className='text-blue-500 mr-3 mt-0.5 shrink-0' size={14} />
              <div className='flex-1 min-w-0'>
                <div className='font-medium text-gray-800 mb-1 wrap-break-word leading-tight'>{formatLabel(result.label)}</div>
                <div className='text-xs text-gray-500 font-mono'>
                  {result.y.toFixed(4)}, {result.x.toFixed(4)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && !isSearching && query.length >= 3 && (
        <div className='absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-1000 mt-1'>
          <div className='flex items-center gap-2 p-4 text-gray-500 italic'>
            <MapPin size={14} />
            No locations found
          </div>
        </div>
      )}
    </div>
  )
}

export default MapSearch
