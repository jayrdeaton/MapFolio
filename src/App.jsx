import React, { useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import { 
  Map, 
  Plus, 
  Printer, 
  Download, 
  Trash2, 
  MapPin,
  Square,
  X,
  Navigation 
} from 'lucide-react';
import MapSearch from './MapSearch.jsx';
import { TILE_PROVIDERS, TileLayerSelector } from './TileLayerSelector.jsx';
import './App.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom component for handling map clicks
function MapClickHandler({ onMapClick, isAddingLabel }) {
  useMapEvents({
    click: (e) => {
      if (isAddingLabel) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

// Component to handle map navigation from search
function MapNavigator({ searchLocation, onMapReady }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  React.useEffect(() => {
    if (searchLocation && map) {
      map.setView([searchLocation.lat, searchLocation.lng], 15, {
        animate: true,
        duration: 1
      });
    }
  }, [searchLocation, map]);

  return null;
}

// Custom label component
function CustomLabel({ label, onDelete }) {
  const map = useMap();
  
  React.useEffect(() => {
    const customIcon = L.divIcon({
      html: `<div class="custom-label" style="border-color: ${label.color}; color: ${label.color};">
               ${label.text}
             </div>`,
      className: 'custom-label-icon',
      iconSize: [100, 30],
      iconAnchor: [50, 15]
    });

    const marker = L.marker([label.lat, label.lng], { icon: customIcon })
      .addTo(map);

    // Add click handler for deletion
    marker.on('click', () => {
      if (window.confirm('Delete this label?')) {
        onDelete(label.id);
      }
    });

    return () => {
      map.removeLayer(marker);
    };
  }, [label, map, onDelete]);

  return null;
}



function App() {
  const [labels, setLabels] = useState([]);
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchLocation, setSearchLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // New York City
  const [mapZoom, setMapZoom] = useState(13);
  const [tileProvider, setTileProvider] = useState('esri');
  
  // Form state
  const [labelText, setLabelText] = useState('');
  const [labelColor, setLabelColor] = useState('#007bff');
  
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const printAreaRef = useRef(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleMapClick = useCallback((latlng) => {
    if (isAddingLabel && labelText.trim()) {
      const newLabel = {
        id: Date.now(),
        text: labelText.trim(),
        color: labelColor,
        lat: latlng.lat,
        lng: latlng.lng,
      };
      
      setLabels(prev => [...prev, newLabel]);
      setLabelText('');
      setIsAddingLabel(false);
      showNotification('Label added successfully!');
    }
  }, [isAddingLabel, labelText, labelColor]);

  const handleDeleteLabel = useCallback((labelId) => {
    setLabels(prev => prev.filter(label => label.id !== labelId));
    showNotification('Label deleted!');
  }, []);

  const startAddingLabel = () => {
    if (!labelText.trim()) {
      showNotification('Please enter label text first!', 'error');
      return;
    }
    setIsAddingLabel(true);
    showNotification('Click on the map to place the label');
  };

  const printMap = () => {
    try {
      showNotification('Opening print dialog...', 'success');
      
      // Add print-mode class to body for print-specific styling
      document.body.classList.add('print-mode');
      
      // Small delay to ensure notification is visible before print dialog
      setTimeout(() => {
        window.print();
        // Remove print-mode class after print dialog closes
        document.body.classList.remove('print-mode');
      }, 500);
      
    } catch (error) {
      console.error('Error opening print dialog:', error);
      showNotification('Error opening print dialog', 'error');
      document.body.classList.remove('print-mode');
    }
  };

  const downloadImage = async () => {
    try {
      showNotification('Generating image...', 'success');
      
      const mapElement = mapRef.current;
      if (!mapElement) return;

      // Temporarily hide UI elements
      const elementsToHide = document.querySelectorAll('.sidebar, .header, .print-controls');
      elementsToHide.forEach(el => el.style.display = 'none');

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
      });

      // Restore UI elements
      elementsToHide.forEach(el => el.style.display = '');

      // Download image
      const link = document.createElement('a');
      link.download = `custom-map-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      showNotification('Image downloaded successfully!');
    } catch (error) {
      console.error('Error generating image:', error);
      showNotification('Error generating image', 'error');
    }
  };

  const clearAllLabels = () => {
    if (window.confirm('Are you sure you want to clear all labels?')) {
      setLabels([]);
      showNotification('All labels cleared!');
    }
  };

  const handleLocationSelect = (location) => {
    setSearchLocation(location);
    setMapCenter([location.lat, location.lng]);
    setMapZoom(15);
    showNotification(`Navigated to ${location.label}`);
  };

  const handleSearchClear = () => {
    setSearchLocation(null);
  };

  const handleMapReady = (mapInstance) => {
    leafletMapRef.current = mapInstance;
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1><Map size={24} /> Custom Map</h1>
        </div>
        <div className="header-center">
          <MapSearch 
            onLocationSelect={handleLocationSelect}
            onClear={handleSearchClear}
          />
        </div>
        <div className="controls">
          <button 
            className="btn btn-primary"
            onClick={printMap}
          >
            <Printer size={16} />
            Print Map
          </button>
          <button 
            className="btn btn-success"
            onClick={downloadImage}
          >
            <Download size={16} />
            Download Image
          </button>
        </div>
      </header>

      <div className="main-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <h3>🗺️ Map Style</h3>
          <div className="form-group">
            <label htmlFor="tileProvider">Tile Provider (for English labels)</label>
            <select
              id="tileProvider"
              value={tileProvider}
              onChange={(e) => setTileProvider(e.target.value)}
            >
              {Object.entries(TILE_PROVIDERS).map(([key, provider]) => (
                <option key={key} value={key}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          <h3><MapPin size={18} /> Add Custom Labels</h3>
          
          <div className="form-group">
            <label htmlFor="labelText">Label Text</label>
            <input
              id="labelText"
              type="text"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="Enter label text"
              onKeyPress={(e) => e.key === 'Enter' && startAddingLabel()}
            />
          </div>

          <div className="form-group">
            <label htmlFor="labelColor">Label Color</label>
            <input
              id="labelColor"
              type="color"
              value={labelColor}
              onChange={(e) => setLabelColor(e.target.value)}
              className="color-input"
            />
          </div>

          <button 
            className={`btn ${isAddingLabel ? 'btn-warning' : 'btn-primary'}`}
            onClick={isAddingLabel ? () => setIsAddingLabel(false) : startAddingLabel}
            style={{ width: '100%', marginBottom: '1rem' }}
          >
            <Plus size={16} />
            {isAddingLabel ? 'Cancel Adding' : 'Add Label to Map'}
          </button>

          {labels.length > 0 && (
            <button 
              className="btn btn-secondary"
              onClick={clearAllLabels}
              style={{ width: '100%', marginBottom: '1rem' }}
            >
              <Trash2 size={16} />
              Clear All Labels
            </button>
          )}

          {/* Labels List */}
          <div className="labels-list">
            <h3>Labels ({labels.length})</h3>
            {labels.map((label) => (
              <div key={label.id} className="label-item">
                <div className="label-content">
                  <div 
                    className="label-text"
                    style={{ color: label.color }}
                  >
                    {label.text}
                  </div>
                  <div className="label-position">
                    {label.lat.toFixed(4)}, {label.lng.toFixed(4)}
                  </div>
                </div>
                <div className="label-actions">
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handleDeleteLabel(label.id)}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Map */}
        <div className="map-container" ref={mapRef}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayerSelector provider={tileProvider} />
            
            <MapNavigator 
              searchLocation={searchLocation}
              onMapReady={handleMapReady}
            />
            
            <MapClickHandler 
              onMapClick={handleMapClick} 
              isAddingLabel={isAddingLabel}
            />

            {/* Search location marker */}
            {searchLocation && (
              <Marker 
                position={[searchLocation.lat, searchLocation.lng]}
                icon={L.divIcon({
                  html: `<div class="search-marker">
                           <div class="search-marker-icon">📍</div>
                         </div>`,
                  className: 'search-marker-container',
                  iconSize: [30, 30],
                  iconAnchor: [15, 30]
                })}
              />
            )}

            {labels.map((label) => (
              <CustomLabel
                key={label.id}
                label={label}
                onDelete={handleDeleteLabel}
              />
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}

export default App;