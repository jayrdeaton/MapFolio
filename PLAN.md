# MapFolio — Future Plans

## Import / Export formats

### KML (.kml)
Google Earth's native format. Large install base with outdoor / travel users.
- Import: parse `<Placemark>` elements for name, description, `<Point>` coordinates; map `<styleUrl>` color to pin color
- Export: wrap pins as `<Placemark>` elements inside a `<Document>`

### GPX (.gpx)
Standard for GPS devices and apps (Garmin, Strava, AllTrails, etc.).
- Import: read `<wpt>` (waypoints) as pins — name, desc, lat/lon
- Export: write pins as `<wpt>` elements
- Future: optionally import `<trk>` track segments as a polyline overlay

### CSV
Simplest format for spreadsheet users.
- Import: detect lat/lng/name/description columns (flexible header matching)
- Export: `name,description,emoji,color,lat,lng` header + one row per pin

## Known Issues

- **Ghost dot missing for waypoints linked to hidden pins**: when a route waypoint has a `pinId` and that pin is hidden, selecting the waypoint shows the SelectionPill but no dotted-circle selection indicator. Fix: pass `hiddenPinIds` into `RouteLayer` and update the ghost dot condition in `RouteLayer.vue:625` to show when `route.points[i].pinId` is in `hiddenPinIds`.

## Other ideas

- **Drag-to-reorder pins** in the list panel
- **Pin categories / tags** for filtering large collections
- **OSM Overpass import** — query POIs by type within the print area
- **PNG icon assets** for better PWA icon support on iOS (currently SVG only)
