<script setup lang="ts">
import { LMap, LMarker } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'
import { Map, MapPin, Plus, Printer, Scan, Trash2, X } from '@lucide/vue'
import { computed, onUnmounted, ref, watch } from 'vue'

import MapOptions from './MapOptions.vue'
import MapSearch from './MapSearch.vue'
import type { SearchLocation } from './MapSearch.vue'
import PinMarker from './PinMarker.vue'
import PrintAreaDrawer from './PrintAreaDrawer.vue'
import PrintLegend from './PrintLegend.vue'
import TileLayerSelector from './TileLayerSelector.vue'
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

const pins = ref<Pin[]>([])
const mapStyle = ref<MapStyle>('clean')
const printBounds = ref<L.LatLngBounds | null>(null)
const isSelectingArea = ref(false)
const mapTitle = ref('')
const searchLocation = ref<SearchLocation | null>(null)
const notification = ref<Notification | null>(null)
const leafletMap = ref<L.Map | null>(null)
const isPlacingPin = ref(false)
const newPinName = ref('')
const newPinDescription = ref('')
const newPinEmoji = ref('📍')
const newPinColor = ref('#3b82f6')
const customEmoji = ref('')

const activeEmoji = computed(() => customEmoji.value.trim() || newPinEmoji.value)

const searchMarkerIcon = L.divIcon({
  html: `<div class="search-marker"><span class="search-marker-icon">📍</span></div>`,
  className: 'search-marker-container',
  iconSize: [30, 30],
  iconAnchor: [15, 30]
})

let notificationTimer: ReturnType<typeof setTimeout> | null = null

function showNotification(message: string, type: Notification['type'] = 'success') {
  if (notificationTimer) clearTimeout(notificationTimer)
  notification.value = { message, type }
  notificationTimer = setTimeout(() => { notification.value = null }, 3000)
}

function onMapReady(map: L.Map) {
  leafletMap.value = map
}

function handleMapClick(e: L.LeafletMouseEvent) {
  if (isPlacingPin.value) handlePinPlace(e.latlng)
}

function handlePinPlace(latlng: L.LatLng) {
  if (!newPinName.value.trim()) return
  const pin: Pin = {
    id: Date.now(),
    name: newPinName.value.trim(),
    description: newPinDescription.value.trim(),
    emoji: customEmoji.value.trim() || newPinEmoji.value,
    color: newPinColor.value,
    lat: latlng.lat,
    lng: latlng.lng
  }
  pins.value = [...pins.value, pin]
  isPlacingPin.value = false
  newPinName.value = ''
  newPinDescription.value = ''
  customEmoji.value = ''
  showNotification(`"${pin.name}" placed!`)
}

function handleDeletePin(id: number) {
  pins.value = pins.value.filter((p) => p.id !== id)
  showNotification('Pin removed')
}

function startPlacingPin() {
  if (!newPinName.value.trim()) {
    showNotification('Enter a name for the pin first', 'error')
    return
  }
  isSelectingArea.value = false
  isPlacingPin.value = true
  showNotification('Click the map to place the pin', 'info')
}

function startSelectingArea() {
  isPlacingPin.value = false
  isSelectingArea.value = true
  showNotification('Click and drag to select the print area', 'info')
}

function handleBoundsSet(bounds: L.LatLngBounds) {
  printBounds.value = bounds
  isSelectingArea.value = false
  showNotification('Print area set!')
}

function handlePrint() {
  if (!leafletMap.value) {
    window.print()
    return
  }
  showNotification('Preparing print…', 'info')
  const prevCenter = leafletMap.value.getCenter()
  const prevZoom = leafletMap.value.getZoom()
  if (printBounds.value) {
    leafletMap.value.fitBounds(printBounds.value, { animate: false, padding: [8, 8] })
  }
  setTimeout(() => {
    window.print()
    if (printBounds.value) {
      setTimeout(() => {
        leafletMap.value!.setView(prevCenter, prevZoom, { animate: false })
      }, 500)
    }
  }, 700)
}

watch(searchLocation, (loc) => {
  if (loc && leafletMap.value) {
    leafletMap.value.setView([loc.lat, loc.lng], 14, { animate: true, duration: 1 })
  }
})

watch([isPlacingPin, leafletMap], ([placing, map]) => {
  if (map) map.getContainer().style.cursor = placing ? 'crosshair' : ''
})

onUnmounted(() => {
  if (notificationTimer) clearTimeout(notificationTimer)
})

const btnBase = 'px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer'
const inputClass = 'w-full py-1.5 px-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
const sectionLabelClass = 'block mb-1 text-gray-500 font-semibold text-xs uppercase tracking-wide'
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 font-sans">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-4 py-3 flex flex-col md:flex-row justify-between items-center z-1000 gap-3 shrink-0 no-print">
      <div class="shrink-0">
        <h1 class="text-gray-800 text-lg font-bold flex items-center gap-2">
          <Map :size="20" /> Custom Map
        </h1>
      </div>
      <div class="flex-1 flex justify-center w-full md:w-auto max-w-xl">
        <MapSearch
          @location-select="(loc) => { searchLocation = loc; showNotification(`Navigated to ${loc.label}`) }"
          @clear="searchLocation = null"
        />
      </div>
      <button :class="`${btnBase} bg-blue-600 text-white hover:bg-blue-700 shrink-0`" @click="handlePrint">
        <Printer :size="15" /> Print Map
      </button>
    </header>

    <div class="flex-1 flex flex-col md:flex-row relative overflow-hidden">
      <!-- Sidebar -->
      <aside class="w-full max-h-[45vh] md:max-h-none md:w-68 bg-white border-b md:border-b-0 md:border-r border-gray-200 p-4 overflow-y-auto z-500 shrink-0 no-print">

        <MapOptions :map-style="mapStyle" @style-change="mapStyle = $event" />

        <!-- Print Settings -->
        <div class="mb-5 pt-4 border-t border-gray-100">
          <h3 class="mb-3 text-gray-800 text-sm font-semibold flex items-center gap-1.5 uppercase tracking-wide">
            <Printer :size="14" /> Print
          </h3>

          <div class="mb-3">
            <label for="mapTitle" :class="sectionLabelClass">Map Title</label>
            <input
              id="mapTitle"
              type="text"
              v-model="mapTitle"
              placeholder='e.g. "Our Adventure Map"'
              :class="inputClass"
            />
          </div>

          <div>
            <label :class="sectionLabelClass">Print Area</label>
            <div v-if="printBounds" class="flex gap-2 items-center">
              <div class="flex-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1.5 font-medium">
                Area selected ✓
              </div>
              <button
                class="text-xs px-2.5 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
                @click="printBounds = null"
              >
                Clear
              </button>
            </div>
            <button
              v-else
              :class="`${btnBase} w-full justify-center ${isSelectingArea ? 'bg-amber-400 text-gray-900 hover:bg-amber-500' : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'}`"
              @click="isSelectingArea ? (isSelectingArea = false) : startSelectingArea()"
            >
              <Scan :size="14" />
              {{ isSelectingArea ? 'Cancel — Draw on Map' : 'Select Print Area' }}
            </button>
            <p class="text-xs text-gray-400 mt-1.5 leading-tight">
              {{ printBounds ? 'Map zooms to selection before printing.' : 'Drag a rectangle on the map, or leave blank to print the current view.' }}
            </p>
          </div>
        </div>

        <!-- Custom Pins -->
        <div class="pt-4 border-t border-gray-100">
          <h3 class="mb-3 text-gray-800 text-sm font-semibold flex items-center gap-1.5 uppercase tracking-wide">
            <MapPin :size="14" /> Custom Pins
          </h3>

          <div class="mb-2.5">
            <label :class="sectionLabelClass">Pin Name</label>
            <input
              type="text"
              v-model="newPinName"
              placeholder='e.g. "Swimming Hole"'
              @keydown.enter="startPlacingPin"
              :class="inputClass"
            />
          </div>

          <div class="mb-2.5">
            <label :class="sectionLabelClass">Description (shows in legend)</label>
            <input
              type="text"
              v-model="newPinDescription"
              placeholder='e.g. "Great for swimming in summer"'
              :class="inputClass"
            />
          </div>

          <div class="mb-2.5">
            <label :class="sectionLabelClass">Icon</label>
            <div class="flex flex-wrap gap-1 mb-1.5">
              <button
                v-for="emoji in DEFAULT_EMOJIS"
                :key="emoji"
                @click="() => { newPinEmoji = emoji; customEmoji = '' }"
                :class="[
                  'w-8 h-8 text-base rounded cursor-pointer transition-all flex items-center justify-center',
                  newPinEmoji === emoji && !customEmoji.trim() ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-100'
                ]"
                :title="emoji"
              >
                {{ emoji }}
              </button>
            </div>
            <input
              type="text"
              v-model="customEmoji"
              placeholder="Or type any emoji…"
              :class="inputClass"
              :maxlength="4"
            />
          </div>

          <div class="mb-3">
            <label :class="sectionLabelClass">Color</label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                v-model="newPinColor"
                class="w-10 h-8 p-0.5 cursor-pointer rounded border border-gray-300"
              />
              <span class="text-2xl leading-none">{{ activeEmoji }}</span>
              <div class="w-3 h-3 rounded-full border-2 border-white shadow" :style="{ background: newPinColor }" />
            </div>
          </div>

          <button
            :class="`${btnBase} w-full justify-center mb-4 ${isPlacingPin ? 'bg-amber-400 text-gray-900 hover:bg-amber-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`"
            @click="isPlacingPin ? (isPlacingPin = false) : startPlacingPin()"
          >
            <Plus :size="15" />
            {{ isPlacingPin ? 'Cancel — Click Map to Place' : 'Place on Map' }}
          </button>

          <!-- Pin list -->
          <div v-if="pins.length > 0">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pins ({{ pins.length }})</span>
              <button
                class="text-xs text-gray-400 hover:text-red-500 cursor-pointer flex items-center gap-1"
                @click="() => { if (window.confirm('Remove all pins?')) { pins = []; showNotification('All pins cleared') } }"
              >
                <Trash2 :size="11" /> Clear all
              </button>
            </div>
            <div class="space-y-1.5">
              <div
                v-for="pin in pins"
                :key="pin.id"
                class="bg-gray-50 border border-gray-200 rounded px-2.5 py-2 flex items-center gap-2"
              >
                <span class="text-lg leading-none shrink-0">{{ pin.emoji }}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800 truncate">{{ pin.name }}</div>
                  <div v-if="pin.description" class="text-xs text-gray-400 truncate">{{ pin.description }}</div>
                </div>
                <button
                  class="shrink-0 p-1 rounded hover:bg-gray-200 text-gray-300 hover:text-red-500 cursor-pointer transition-colors"
                  @click="handleDeletePin(pin.id)"
                  title="Remove pin"
                >
                  <X :size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Map -->
      <div class="flex-1 relative map-print-container">
        <div v-if="mapTitle" class="print-map-title">{{ mapTitle }}</div>

        <LMap
          :zoom="13"
          :center="[40.7128, -74.006]"
          :use-global-leaflet="false"
          style="height: 100%; width: 100%;"
          @ready="onMapReady"
          @click="handleMapClick"
        >
          <TileLayerSelector :style="mapStyle" />
          <LMarker
            v-if="searchLocation"
            :lat-lng="[searchLocation.lat, searchLocation.lng]"
            :icon="searchMarkerIcon"
          />
        </LMap>

        <!-- Renderless components that manage Leaflet layers directly -->
        <template v-if="leafletMap">
          <PrintAreaDrawer
            :map="leafletMap"
            :is-drawing="isSelectingArea"
            :print-bounds="printBounds"
            @bounds-set="handleBoundsSet"
          />
          <PinMarker
            v-for="pin in pins"
            :key="pin.id"
            :pin="pin"
            :map="leafletMap"
            @delete="handleDeletePin"
          />
        </template>

        <PrintLegend :title="mapTitle" :pins="pins" />
      </div>
    </div>

    <div
      v-if="notification"
      :class="[
        'fixed top-16 right-4 text-white text-sm px-4 py-2.5 rounded shadow-lg z-2000 animate-[slideIn_0.25s_ease] no-print',
        notification.type === 'error' ? 'bg-red-600' : notification.type === 'info' ? 'bg-blue-600' : 'bg-green-600'
      ]"
    >
      {{ notification.message }}
    </div>
  </div>
</template>
