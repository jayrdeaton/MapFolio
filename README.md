# MapFolio

An interactive mapping app for creating, annotating, and printing custom maps.

## Features

- **6 map styles** — Clean, Minimal, Standard, Satellite, Terrain, Dark (CartoDB & Esri)
- **Custom pins** — emoji icons, custom colors, names, descriptions
- **Pin editing** — edit any placed pin inline; drag to reposition on the map
- **Pin visibility** — hide/show individual pins without deleting them
- **Marker clustering** — nearby pins group at low zoom levels; auto-expands at zoom 17+
- **Location search** — worldwide geocoding with keyboard navigation
- **Go to my location** — one-click geolocation via browser GPS
- **Fit to pins** — zoom map to frame all pins at once
- **Undo** — 20-level undo stack for all pin actions (⌘Z / Ctrl+Z)
- **Print** — browser print dialog with optional area selection and map title
- **Download PNG** — export the current map view as an image
- **Share link** — map state encodes into the URL hash for easy sharing
- **Export pins** — save as JSON (custom format) or GeoJSON (standard, works in Google Maps / QGIS)
- **Import pins** — load from a previously exported JSON or any `.geojson` file
- **Right-click map** — copies coordinates to clipboard
- **Persistence** — pins, style, title, and viewport survive page refresh

## Getting Started

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # production build → dist/
npm run typecheck
npm run lint
npm test
```

## Usage

### Map styles
Pick from the six style buttons in the sidebar. Changes apply instantly.

### Adding pins
1. Enter a name (required) and optional description
2. Choose an emoji icon and color
3. Click **Place on Map**, then click anywhere on the map
4. Pins can be **dragged** to reposition after placement

### Managing pins
- **Click** a pin's name or emoji in the sidebar to zoom the map to it
- **Eye icon** — hide or show a pin on the map without deleting it
- **Pencil icon** — edit name, description, emoji, or color inline
- **X icon** — delete a pin (undoable)
- **⊞ icon** — fit map to show all pins
- **↓ icon** — export as custom JSON
- **🌐 icon** — export as GeoJSON (importable in Google Maps, QGIS, etc.)
- **↑ icon** — import from JSON or GeoJSON file

### Sharing
Click **Share** in the header to copy a URL that encodes the current pins and map style. Anyone who opens that URL sees the same map. The URL updates automatically as you work.

### Print & export
- **Print** — optionally select an area by dragging a rectangle, add a title, then print. Works with mouse and touch.
- **PNG** — downloads the current map view as a PNG. If tiles appear blank, use Print → Save as PDF instead (CORS limitation with some tile providers).

### Keyboard shortcuts
| Shortcut | Action |
|----------|--------|
| ⌘Z / Ctrl+Z | Undo last pin action |
| Right-click map | Copy coordinates to clipboard |
| Enter (in pin name field) | Start placing pin |
| Escape (in edit form) | Cancel edit |

## Tech stack

- [Vue 3](https://vuejs.org/) + TypeScript
- [Leaflet](https://leafletjs.com/) via [@vue-leaflet/vue-leaflet](https://github.com/vue-leaflet/vue-leaflet)
- [leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) for pin clustering
- [leaflet-geosearch](https://smeijer.github.io/leaflet-geosearch/) for geocoding
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Lucide Vue](https://lucide.dev/)
- [html2canvas](https://html2canvas.hertzen.com/) for PNG export
- [Vite](https://vitejs.dev/) + [Vitest](https://vitest.dev/)

## File structure

```
src/
├── components/
│   ├── App.vue               # Root component — state, persistence, clustering
│   ├── MapOptions.vue        # Style selector
│   ├── MapSearch.vue         # Geocoding search bar
│   ├── PinListItem.vue       # Sidebar pin row + inline edit form
│   ├── PinMarker.vue         # Leaflet marker (draggable, cluster-aware, renderless)
│   ├── PrintAreaDrawer.vue   # Drag/touch-to-select print area (renderless)
│   ├── PrintLegend.vue       # On-map legend overlay
│   └── TileLayerSelector.vue
├── __tests__/
│   └── utils.test.ts         # Unit tests for pure utility functions
├── types.ts                  # Pin, MapStyle, MAP_STYLE_CONFIGS
├── utils.ts                  # GeoJSON, URL encoding, import parsing
└── index.css
```
