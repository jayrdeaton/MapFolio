import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import './index.css'

import { createApp } from 'vue'

import App from './components/App.vue'

createApp(App).mount('#root')

const splash = document.getElementById('splash')
if (splash) {
  splash.style.opacity = '0'
  setTimeout(() => splash.remove(), 250)
}
