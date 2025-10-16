import React from 'react';
import { TileLayer } from 'react-leaflet';

const TILE_PROVIDERS = {
  esri: {
    name: 'Esri World Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
  },
  cartodb: {
    name: 'CartoDB Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd'
  },
  stamen: {
    name: 'Stamen Toner Lite',
    url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}{r}.png',
    attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abcd'
  },
  osm: {
    name: 'OpenStreetMap Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
};

function TileLayerSelector({ provider = 'esri' }) {
  const tileConfig = TILE_PROVIDERS[provider] || TILE_PROVIDERS.esri;

  // Build props object conditionally to avoid passing undefined subdomains
  const tileProps = {
    attribution: tileConfig.attribution,
    url: tileConfig.url
  };

  // Only add subdomains if it exists in the config
  if (tileConfig.subdomains) {
    tileProps.subdomains = tileConfig.subdomains;
  }

  return <TileLayer {...tileProps} />;
}

export { TILE_PROVIDERS, TileLayerSelector };
export default TileLayerSelector;