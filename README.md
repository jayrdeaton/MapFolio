# MapFolio

An interactive mapping app for creating, annotating, and printing custom maps.

## Features

- **Pins** — right-click or long-press to drop emoji-labeled markers; drag to reposition; edit name, description, emoji, and color
- **Routes** — draw paths by clicking waypoints; shows distance; custom color per route
- **Captions** — geo-anchored text labels; drag to reposition, rotate, or resize from the panel
- **6 map styles** — Clean, Minimal, Standard, Satellite, Terrain, Dark (CartoDB & Esri)
- **Marker clustering** — nearby pins group at low zoom; auto-expands at zoom 17+
- **Location search** — worldwide geocoding with keyboard navigation
- **Go to my location** — one-click geolocation via browser GPS
- **Fit to view** — zoom map to frame all visible pins, routes, and captions
- **Focus mode** — hide the toolbar for a full-screen map view
- **Undo / Redo** — 20-level history stack (⌘Z / ⌘⇧Z)
- **Selection** — tap any pin, route, or caption to select it; supports copy / cut / paste
- **Print to PDF** — set a print area rectangle, choose paper size and orientation, add a legend, compass, and scale bar
- **Share link** — copy a URL that encodes the entire map; no account needed
- **Export / Import** — save as JSON or GeoJSON; import to merge with an existing map
- **Persistence** — all data and settings survive page refresh

## Getting Started

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # production build → dist/
npm run typecheck
npm run lint
npm test
```

## Keyboard shortcuts

### General

| Shortcut | Action |
|----------|--------|
| Right-click / Long-press | Drop a pin |
| `?` | Open this help screen |
| `Escape` | Close panel or cancel placement |
| `Enter` | Save form / confirm action |
| `⌘Z` / `⌘⇧Z` | Undo / Redo |

### Quick actions

| Key | Action |
|-----|--------|
| `P` | Start placing pins |
| `R` | Draw a new route |
| `C` | Place a caption |
| `A` | Activate print area |

### Selection

| Key | Action |
|-----|--------|
| `H` | Toggle hide / show |
| `E` | Edit |
| `F` | Fit view to selection |
| `Del` / `⌫` | Delete |
| `⌘C` / `⌘X` / `⌘V` | Copy / Cut / Paste |

### Navigation

| Key | Action |
|-----|--------|
| Scroll | Zoom in / out |
| `+` / `−` | Zoom in / out |
| Arrow keys | Pan the map |
| Shift+drag | Box-zoom to a drawn rectangle |

### Print area

| Key | Action |
|-----|--------|
| `Shift` (hold while rotating) | Toggle 15° angle snap |
| `Option` / `Alt` | Pan and zoom through handles without moving the area |

## Tech stack

- [Vue 3](https://vuejs.org/) + TypeScript
- [Nuxt 4](https://nuxt.com/) (SSR disabled, `srcDir: 'src'`)
- [Leaflet](https://leafletjs.com/) via [@vue-leaflet/vue-leaflet](https://github.com/vue-leaflet/vue-leaflet)
- [leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) for pin clustering
- [leaflet-geosearch](https://smeijer.github.io/leaflet-geosearch/) for geocoding
- [pdf-lib](https://pdf-lib.js.org/) for PDF export
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Lucide Vue](https://lucide.dev/)
- [Vitest](https://vitest.dev/)
