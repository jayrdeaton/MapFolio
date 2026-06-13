<script setup lang="ts">
import { computed } from 'vue'
import { Magnet, Maximize2, Printer, ScanSearch, Wand2, RectangleHorizontal, RectangleVertical } from '@lucide/vue'
import type L from 'leaflet'
import { MAP_STYLE_CONFIGS } from '../types'
import type { MapStyle } from '../types'
import {
  PAPERS, PAPER_LABELS, GRID_PRESETS,
  type PaperSize, type Orientation,
} from '../composables/usePrintExport'

const props = defineProps<{
  isAutoTitling: boolean
  printBounds: L.LatLngBounds | null
  printAspectRatio: number | null
  isDownloadingPdf: boolean
  mapStyle: MapStyle
}>()

const emit = defineEmits<{
  'select-preset': [paper: PaperSize, orientation: Orientation]
  'resnap-print-area': []
  'fit-to-print-area': []
  'fit-to-pins': []
  'clear-print-bounds': []
  'download-pdf': []
}>()

const mapTitle = defineModel<string>('mapTitle', { required: true })
const autoTitle = defineModel<boolean>('autoTitle', { required: true })
const printPaper = defineModel<PaperSize | null>('printPaper', { required: true })
const printOrientation = defineModel<Orientation | null>('printOrientation', { required: true })
const printGrid = defineModel<string>('printGrid', { required: true })
const printSnapEnabled = defineModel<boolean>('printSnapEnabled', { required: true })
const includeLegend = defineModel<boolean>('includeLegend', { required: true })
const includeCompass = defineModel<boolean>('includeCompass', { required: true })
const scaleUnit = defineModel<'off' | 'km' | 'mi'>('scaleUnit', { required: true })
const enhanceContrast = defineModel<boolean>('enhanceContrast', { required: true })

const parsedGridCols = computed(() => Number(printGrid.value.split('x')[0]) || 1)
const parsedGridRows = computed(() => Number(printGrid.value.split('x')[1]) || 1)

function onPaperChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  printPaper.value = (v || null) as PaperSize | null
  if (printPaper.value && printOrientation.value) {
    emit('select-preset', printPaper.value, printOrientation.value)
  }
}

const sectionLabelClass = 'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const btnBase = 'px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer'
const inputClass = 'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
</script>

<template>
  <div class="p-4 overflow-y-auto space-y-4">
    <!-- Map title -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <label for="mapTitle" :class="sectionLabelClass" style="margin-bottom:0">Map Title</label>
        <button
          :class="`w-7 h-7 flex items-center justify-center rounded border cursor-pointer transition-colors ${autoTitle ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`"
          title="Auto-title from print area location"
          @click="autoTitle = !autoTitle"
        >
          <Wand2 :size="13" :class="isAutoTitling ? 'animate-pulse' : ''" />
        </button>
      </div>
      <input
        id="mapTitle"
        type="text"
        v-model="mapTitle"
        placeholder='"Our Adventure Map"'
        :class="inputClass"
        @input="autoTitle = false"
      />
    </div>

    <!-- Print area -->
    <div class="pt-3 border-t border-gray-100 dark:border-zinc-800">
      <div class="flex items-center justify-between mb-2">
        <label :class="sectionLabelClass" style="margin-bottom:0">Print Area</label>
        <div class="flex gap-1">
          <button
            class="w-7 h-7 flex items-center justify-center rounded border border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer text-base leading-none"
            title="Set print area"
            @click="printPaper && printOrientation && emit('select-preset', printPaper, printOrientation)"
          >+</button>
          <button
            class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            title="Fit print area to visible pins"
            @click="emit('fit-to-pins')"
          ><ScanSearch :size="13" /></button>
          <button
            class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer text-base leading-none disabled:opacity-40 disabled:cursor-not-allowed"
            title="Clear print area"
            :disabled="!printBounds"
            @click="emit('clear-print-bounds')"
          >−</button>
          <button
            :class="`w-7 h-7 flex items-center justify-center rounded border cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${printSnapEnabled ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`"
            title="Toggle rotation snap"
            :disabled="!printBounds"
            @click="printSnapEnabled = !printSnapEnabled"
          ><Magnet :size="13" /></button>
          <button
            class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Fit map to print area"
            :disabled="!printBounds"
            @click="emit('fit-to-print-area')"
          ><Maximize2 :size="13" /></button>
        </div>
      </div>

      <div class="flex gap-2">
        <select
          :value="printPaper ?? ''"
          class="flex-1 py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
          @change="onPaperChange"
        >
          <option v-for="p in PAPERS" :key="p" :value="p">{{ PAPER_LABELS[p] }}</option>
        </select>
        <div class="flex gap-1">
          <button
            v-for="{ value, icon, label } in ([{ value: 'portrait', icon: RectangleVertical, label: 'Portrait' }, { value: 'landscape', icon: RectangleHorizontal, label: 'Landscape' }] as const)"
            :key="value"
            :title="label"
            :class="`w-9 h-9 flex items-center justify-center rounded border cursor-pointer transition-colors ${printOrientation === value ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`"
            @click="printOrientation = value; printPaper && emit('select-preset', printPaper, value)"
          >
            <component :is="icon" :size="15" />
          </button>
        </div>
      </div>

      <!-- Poster grid -->
      <div class="flex items-center justify-between mt-2">
        <span class="text-xs text-gray-600 dark:text-zinc-400">Poster grid</span>
        <div class="flex gap-1">
          <button
            v-for="preset in GRID_PRESETS"
            :key="preset"
            :title="preset"
            :class="`w-7 h-9 p-0.5 rounded border cursor-pointer transition-colors ${printGrid === preset ? 'border-cyan-400' : 'border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500'}`"
            @click="printGrid = preset; printBounds && emit('resnap-print-area')"
          >
            <div
              class="w-full h-full grid rounded-sm overflow-hidden"
              :style="`grid-template-columns: repeat(${preset.split('x')[0]}, 1fr); grid-template-rows: repeat(${preset.split('x')[1]}, 1fr); gap: 1px;`"
              :class="printGrid === preset ? 'bg-cyan-400' : 'bg-gray-200 dark:bg-zinc-600'"
            >
              <div
                v-for="i in parsedGridCols * parsedGridRows"
                :key="i"
                :class="printGrid === preset ? 'bg-cyan-50 dark:bg-cyan-950/50' : 'bg-white dark:bg-zinc-800'"
              />
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- PDF overlays -->
    <div class="pt-3 border-t border-gray-100 dark:border-zinc-800">
      <label :class="sectionLabelClass">PDF Overlays</label>
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-600 dark:text-zinc-400">Legend</span>
          <button
            :class="`h-6 px-2.5 rounded text-xs font-medium border cursor-pointer transition-colors ${includeLegend ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`"
            @click="includeLegend = !includeLegend"
          >{{ includeLegend ? 'On' : 'Off' }}</button>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-600 dark:text-zinc-400">Compass</span>
          <button
            :class="`h-6 px-2.5 rounded text-xs font-medium border cursor-pointer transition-colors ${includeCompass ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`"
            @click="includeCompass = !includeCompass"
          >{{ includeCompass ? 'On' : 'Off' }}</button>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-600 dark:text-zinc-400">Scale</span>
          <div class="flex gap-1">
            <button
              v-for="opt in (['off', 'km', 'mi'] as const)"
              :key="opt"
              :class="`h-6 px-2.5 rounded text-xs font-medium border cursor-pointer transition-colors ${scaleUnit === opt ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`"
              @click="scaleUnit = opt"
            >{{ opt === 'off' ? 'Off' : opt }}</button>
          </div>
        </div>
        <div v-if="MAP_STYLE_CONFIGS[mapStyle].printBlackPoint !== undefined" class="flex items-center justify-between">
          <span class="text-xs text-gray-600 dark:text-zinc-400" title="Stretches the tonal range of map tiles so light-colored styles print with full contrast instead of washed-out grays">Enhance contrast</span>
          <button
            :class="`h-6 px-2.5 rounded text-xs font-medium border cursor-pointer transition-colors ${enhanceContrast ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`"
            @click="enhanceContrast = !enhanceContrast"
          >{{ enhanceContrast ? 'On' : 'Off' }}</button>
        </div>
      </div>
    </div>

    <!-- Download -->
    <div class="pt-3 border-t border-gray-100 dark:border-zinc-800">
      <button
        :class="`${btnBase} w-full justify-center bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed`"
        :disabled="isDownloadingPdf || !printBounds"
        @click="emit('download-pdf')"
      >
        <Printer :size="14" /> {{ isDownloadingPdf ? 'Building…' : 'PDF' }}
      </button>
      <p v-if="!printBounds" class="text-xs text-center text-gray-400 dark:text-zinc-500 mt-1.5">Add a print area above to export</p>
    </div>
  </div>
</template>
