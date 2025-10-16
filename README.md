# Custom Map Application

A React-based interactive map application that allows users to view maps, add custom labels, and print selected areas.

## Features

### 🗺️ Interactive Map
- Built with React Leaflet and OpenStreetMap
- Zoom and pan functionality
- **NEW: Location Search** - Search for places, cities, and addresses worldwide
- Dynamic map navigation with search results
- Default location set to New York City
- Responsive design for desktop and mobile

### 🏷️ Custom Labels
- Add custom text labels anywhere on the map
- Customizable label colors
- Click-to-place interface
- Delete labels individually or clear all
- Labels show coordinates and can be managed from the sidebar

### 🖨️ Print & Export Functionality
- **NEW: Browser Print Dialog** - Uses native print functionality for best quality
- Print the current map view with all labels and markers
- Download as PNG images with high resolution
- Print-optimized styling for clean output

### 📱 User Interface
- Clean, modern design
- Sidebar for label management
- Real-time notifications
- Mobile-responsive layout
- Intuitive controls with icons

## Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn package manager

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Usage Guide

### Searching for Locations

1. **Global Search**: Use the search bar in the header to find any location worldwide
2. **Auto-Complete**: Start typing and see suggestions appear as you type
3. **Navigate Results**: Use arrow keys to navigate through search results
4. **Select Location**: Click on a result or press Enter to navigate to that location
5. **Visual Marker**: A pin marker will appear at the searched location
6. **Clear Search**: Click the X button to clear the search and remove the marker

**Example Searches:**
- Cities: "Tokyo", "Chiang Mai", "Paris", "New York"
- Countries: "Thailand", "Japan", "France"
- Addresses: "Times Square, New York"
- Landmarks: "Eiffel Tower", "Big Ben"

### Adding Labels

1. **Enter Label Text**: Type your desired label text in the sidebar input field
2. **Choose Color**: Select a color using the color picker
3. **Place Label**: Click "Add Label to Map" button, then click anywhere on the map
4. **Manage Labels**: View all labels in the sidebar list, delete individual labels, or clear all

### Printing & Exporting

1. **Print Map**: 
   - Click "Print Map" button to open your browser's print dialog
   - The map will be optimized for printing (UI elements hidden)
   - Choose your printer settings (paper size, orientation, etc.)
   - Print directly or save as PDF using browser options

2. **Download Image**: 
   - Click "Download Image" to save the current map view as a high-quality PNG
   - Includes all visible labels and markers
   - Downloads automatically to your default folder

### Navigation

- **Search**: Type in the search bar to find locations worldwide (cities, addresses, landmarks)
- **Keyboard Navigation**: Use arrow keys to navigate search results, Enter to select
- **Zoom**: Use the zoom controls or mouse wheel
- **Pan**: Click and drag to move around the map
- **Auto-Navigation**: Click on search results to automatically navigate to locations
- **Reset**: Refresh the page to return to the default view

## Technical Details

### Built With
- **React 19** - Latest UI framework with improved performance
- **React Leaflet 5** - Latest map components for React
- **Leaflet** - Interactive map library
- **Leaflet GeoSearch** - Location search and geocoding
- **Vite 7** - Latest build tool and development server
- **html2canvas** - Screenshot generation
- **jsPDF 3** - Latest PDF generation library
- **Lucide React** - Modern icon library

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires JavaScript enabled

## Customization

### Changing Default Location
Edit the `center` prop in `MapContainer` component in `src/App.jsx`:

```jsx
<MapContainer
  center={[40.7128, -74.0060]} // [latitude, longitude]
  zoom={13}
  // ...
>
```

### Adding Different Map Tiles
Replace the `TileLayer` component with different tile providers:

```jsx
// Example: Satellite imagery
<TileLayer
  url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
  attribution='Map data: &copy; OpenStreetMap contributors'
/>
```

### Styling
- Main styles: `src/index.css`
- Component styles: `src/App.css`
- Responsive breakpoints: 768px and 480px

## File Structure

```
CustomMap/
├── public/
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Component-specific styles
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
└── README.md           # This file
```

## Troubleshooting

### Common Issues

1. **Map not loading**: Check internet connection for tile downloads
2. **Labels not appearing**: Ensure label text is entered before placing
3. **Print/export not working**: Try refreshing and selecting a smaller area
4. **Mobile display issues**: Rotate device or zoom out for better visibility
5. **Location not found in search**: 
   - Try different search terms (e.g., "Chiang Mai" vs "Chiang Mai, Thailand")
   - Use English names for locations
   - Check spelling and try common alternative names
   - For small locations, try searching for nearby major cities first

### Performance Tips

- Limit the number of labels (recommended: under 50)
- Select smaller print areas for faster processing
- Close other browser tabs for better performance during export

## Recent Updates

### Version 1.2.0 (October 2024)
- 🖨️ **Simplified Printing** - Now uses browser's built-in print dialog for better quality
- ✨ **Enhanced Print Styles** - Optimized layout for printing with clean, full-page output
- 🚫 **Removed Area Selection** - No more complex area selection; just print the current view
- ⚡ **Faster Workflow** - One-click printing without PDF generation delays

### Version 1.1.1 (October 2024)
- 🐛 **Fixed Global Search** - Removed country code restrictions for true worldwide search
- ✅ **Thailand Support** - Chiang Mai, Bangkok, and all international locations now searchable
- ⚡ **Improved Search** - Faster response time and better result formatting
- 📈 **More Results** - Increased search results from 5 to 8 for better coverage

### Version 1.1.0 (October 2024)
- 🆕 **Location Search** - Global search for cities, addresses, and landmarks
- 🆕 **Auto-Navigation** - Click search results to navigate to locations
- 🆕 **Search Markers** - Visual markers for searched locations
- 🆕 **Keyboard Navigation** - Arrow keys and Enter support in search
- 🆕 **Responsive Search** - Mobile-optimized search interface

### Version 1.0.1 (October 2024)
- ✅ **Updated to React 19** - Latest features and performance improvements
- ✅ **Upgraded to Vite 7** - Faster build times and better HMR
- ✅ **Updated React Leaflet to v5** - Better TypeScript support and performance
- ✅ **Upgraded jsPDF to v3** - Enhanced PDF generation capabilities
- ✅ **Updated Lucide React** - Latest icon set with more options
- ✅ **Security fixes** - All vulnerabilities resolved
- ✅ **Better compatibility** - Updated for modern browsers

### Breaking Changes Handled
- Updated React DOM API usage for React 19
- Ensured compatibility with react-leaflet 5.0
- Updated build configuration for Vite 7

## License

ISC License - Feel free to use and modify as needed.

## Support

For issues or feature requests, please check the console for error messages and ensure all dependencies are properly installed.