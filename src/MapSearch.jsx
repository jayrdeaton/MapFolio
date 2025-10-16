import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Loader, X } from 'lucide-react';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import './MapSearch.css';

const provider = new OpenStreetMapProvider({
  params: {
    'accept-language': 'en',
    // Removed countrycodes restriction to enable global search
    addressdetails: 1,
    limit: 5,
  },
});

function MapSearch({ onLocationSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const searchLocations = async (searchQuery) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Searching for:', searchQuery);
      const searchResults = await provider.search({ query: searchQuery });
      console.log('Search results:', searchResults);
      
      setResults(searchResults.slice(0, 8)); // Increased to 8 results for better coverage
      setShowResults(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    // Debounce search with faster response for better UX
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      searchLocations(value);
    }, 200);
  };

  const handleKeyDown = (e) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleLocationSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleLocationSelect = (location) => {
    setQuery(location.label);
    setShowResults(false);
    setResults([]);
    setSelectedIndex(-1);
    onLocationSelect({
      lat: location.y,
      lng: location.x,
      label: location.label
    });
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
    onClear();
  };

  const formatLabel = (label) => {
    // Clean up the label by removing redundant parts while preserving important location info
    const parts = label.split(', ');
    if (parts.length <= 2) return label;
    
    // For longer addresses, show: [Place], [State/Province], [Country]
    if (parts.length > 4) {
      return `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
    }
    
    return label;
  };

  return (
    <div className="map-search" ref={searchRef}>
      <div className="search-input-container">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Search for places, cities, addresses..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="search-input"
        />
        {isSearching && (
          <Loader className="search-loading" size={18} />
        )}
        {query && (
          <button 
            onClick={handleClear}
            className="search-clear"
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="search-results" ref={resultsRef}>
          {results.map((result, index) => (
            <div
              key={`${result.x}-${result.y}-${index}`}
              className={`search-result-item ${
                index === selectedIndex ? 'selected' : ''
              }`}
              onClick={() => handleLocationSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <MapPin className="result-icon" size={14} />
              <div className="result-content">
                <div className="result-label">
                  {formatLabel(result.label)}
                </div>
                <div className="result-coords">
                  {result.y.toFixed(4)}, {result.x.toFixed(4)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && !isSearching && query.length >= 3 && (
        <div className="search-results">
          <div className="search-no-results">
            <MapPin size={14} />
            No locations found
          </div>
        </div>
      )}
    </div>
  );
}

export default MapSearch;