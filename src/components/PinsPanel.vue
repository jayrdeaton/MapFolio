<script setup lang="ts">
import { Eye, EyeOff, FileDown, FileUp, Globe, Maximize2, Plus, Trash2, Undo2 } from '@lucide/vue'
import PinListItem from './PinListItem.vue'
import type { Pin } from '../types'

const props = defineProps<{
  pins: Pin[]
  filteredPins: Pin[]
  hiddenPinIds: Set<number>
  canUndo: boolean
  allPinsHidden: boolean
  resolvingPinId: number | null
}>()

const emit = defineEmits<{
  'place-at-center': []
  'fit-to-pins': []
  undo: []
  'toggle-all-visibility': []
  'clear-all': []
  'delete-pin': [id: number]
  'edit-pin': [pin: Pin]
  'zoom-to-pin': [pin: Pin]
  'toggle-visibility': [id: number]
  'export-json': []
  'export-geojson': []
  import: []
}>()

const pinSearch = defineModel<string>('pinSearch', { required: true })

const sectionLabelClass = 'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const inputClass = 'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
</script>

<template>
  <div class="p-4 overflow-y-auto space-y-4">
    <div>
      <div class="flex items-center justify-between mb-2">
        <span :class="sectionLabelClass" style="margin-bottom:0">Pins ({{ pins.length }})</span>
        <div class="flex gap-1">
          <button
            class="w-7 h-7 flex items-center justify-center rounded border border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer transition-colors"
            title="New pin"
            @click="emit('place-at-center')"
          >
            <Plus :size="13" />
          </button>
          <button
            v-if="pins.length > 0"
            class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            title="Fit map to all pins"
            @click="emit('fit-to-pins')"
          >
            <Maximize2 :size="13" />
          </button>
          <button
            v-if="canUndo"
            class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            title="Undo (⌘Z)"
            @click="emit('undo')"
          >
            <Undo2 :size="13" />
          </button>
          <button
            v-if="pins.length > 0"
            :class="`w-7 h-7 flex items-center justify-center rounded border cursor-pointer transition-colors ${!allPinsHidden ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`"
            :title="allPinsHidden ? 'Show all pins on map' : 'Hide all pins from map'"
            @click="emit('toggle-all-visibility')"
          >
            <Eye v-if="!allPinsHidden" :size="13" />
            <EyeOff v-else :size="13" />
          </button>
          <button
            v-if="pins.length > 0"
            class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-red-300 dark:hover:border-red-800 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors"
            title="Clear all pins"
            @click="emit('clear-all')"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>

      <input
        v-if="pins.length > 5"
        v-model="pinSearch"
        type="search"
        placeholder="Search pins…"
        :class="inputClass + ' mb-2'"
      />

      <div v-if="pins.length > 0" class="space-y-1.5">
        <p v-if="pinSearch && filteredPins.length === 0" class="text-xs text-gray-400 dark:text-zinc-600 text-center py-2">No pins match</p>
        <PinListItem
          v-for="pin in filteredPins"
          :key="pin.id"
          :pin="pin"
          :hidden="hiddenPinIds.has(pin.id)"
          :resolving="resolvingPinId === pin.id"
          @delete="emit('delete-pin', $event)"
          @edit="emit('edit-pin', $event)"
          @zoom="emit('zoom-to-pin', $event)"
          @toggle-visibility="emit('toggle-visibility', $event)"
        />
      </div>
    </div>

    <p class="text-xs text-gray-400 dark:text-zinc-600 text-center">Right-click the map (or long press) to place a pin</p>

    <div class="pt-3 border-t border-gray-100 dark:border-zinc-800">
      <div class="flex items-center justify-between">
        <span :class="sectionLabelClass" style="margin-bottom:0">Import / Export</span>
        <div class="flex gap-1">
          <button
            class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export as JSON"
            :disabled="pins.length === 0"
            @click="emit('export-json')"
          >
            <FileDown :size="13" />
          </button>
          <button
            class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export as GeoJSON"
            :disabled="pins.length === 0"
            @click="emit('export-geojson')"
          >
            <Globe :size="13" />
          </button>
          <button
            class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            title="Import from JSON or GeoJSON"
            @click="emit('import')"
          >
            <FileUp :size="13" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
