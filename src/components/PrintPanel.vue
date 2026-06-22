<script setup lang="ts">
import { Captions, Circle, Compass, Contrast, Eye, EyeOff, FileText, Heading, List, Lock, Maximize2, PenLine, Plus, Printer, RectangleHorizontal, RectangleVertical, RotateCcw, Ruler, Snail, Trash2, Zap } from '@lucide/vue'
import type L from 'leaflet'

import type { ExportQuality } from '@/composables/useMapExport'
import type { PrintHistoryEntry } from '@/composables/usePrintExport'
import { GRID_PRESETS, type Orientation, PAPER_LABELS, PAPERS, type PaperSize } from '@/composables/usePrintExport'
import type { MapStyle } from '@/types'
import { MAP_STYLE_CONFIGS } from '@/types'

const props = defineProps<{
  printBounds: L.LatLngBounds | null
  printAspectRatio: number | null
  isDownloadingPdf: boolean
  mapStyle: MapStyle
  printHistory: PrintHistoryEntry[]
}>()

const emit = defineEmits<{
  'select-preset': [paper: PaperSize, orientation: Orientation]
  'start-adjusting': []
  'resnap-print-area': []
  'fit-to-print-area': []
  'clear-print-bounds': []
  'download-pdf': []
  'restore-from-history': [entry: PrintHistoryEntry]
}>()

const printPaper = defineModel<PaperSize | null>('printPaper', { required: true })
const printOrientation = defineModel<Orientation | null>('printOrientation', { required: true })
const printGrid = defineModel<string>('printGrid', { required: true })
const printAreaVisibility = defineModel<'visible' | 'opaque' | 'hidden'>('printAreaVisibility', { required: true })
const includeLegend = defineModel<boolean>('includeLegend', { required: true })
const legendSeparatePage = defineModel<boolean>('legendSeparatePage', { required: true })
const legendTitle = defineModel<boolean>('legendTitle', { required: true })
const legendArea = defineModel<boolean>('legendArea', { required: true })
const legendBlankLabels = defineModel<boolean>('legendBlankLabels', { required: true })
const includeCompass = defineModel<boolean>('includeCompass', { required: true })
const includeScale = defineModel<boolean>('includeScale', { required: true })
const enhanceContrast = defineModel<boolean>('enhanceContrast', { required: true })
const exportQuality = defineModel<ExportQuality>('exportQuality', { required: true })

function setArea() {
  emit('select-preset', printPaper.value ?? 'letter', printOrientation.value ?? 'portrait')
  emit('start-adjusting')
}

function selectOrientation(value: Orientation) {
  printOrientation.value = value
  // Only reshape an existing print area — the + button is what creates one (and shows the pill).
  if (props.printBounds && printPaper.value) emit('select-preset', printPaper.value, value)
}

function selectGrid(preset: string) {
  printGrid.value = preset
  if (props.printBounds) emit('resnap-print-area')
}

function onPaperChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  printPaper.value = (v || null) as PaperSize | null
  // Only reshape an existing print area — the + button is what creates one (and shows the pill).
  if (props.printBounds && printPaper.value && printOrientation.value) {
    emit('select-preset', printPaper.value, printOrientation.value)
  }
}

function cycleVisibility() {
  if (printAreaVisibility.value === 'visible') printAreaVisibility.value = 'opaque'
  else if (printAreaVisibility.value === 'opaque') printAreaVisibility.value = 'hidden'
  else printAreaVisibility.value = 'visible'
}

function formatHistoryDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const sectionLabelClass = 'block text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
</script>

<template>
  <div>
    <!-- ── Sticky header ────────────────────────────────────────────────── -->
    <div class="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800 px-4 pt-4 pb-2">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide"> <Printer :size="12" /> Print </span>
        <div class="flex gap-1">
          <!-- Set print area -->
          <button class="mf-ibtn mf-ibtn--primary w-7 h-7" title="Set print area" @click="setArea">
            <Plus :size="13" />
          </button>
          <!-- Fit map to print area -->
          <button class="mf-ibtn w-7 h-7" title="Fit map to print area" :disabled="!printBounds" @click="emit('fit-to-print-area')">
            <Maximize2 :size="13" />
          </button>
          <!-- Visibility -->
          <button :class="['mf-ibtn w-7 h-7', printAreaVisibility !== 'hidden' && 'mf-ibtn--active']" :title="printAreaVisibility === 'visible' ? 'Print area visible' : printAreaVisibility === 'opaque' ? 'Print area locked' : 'Print area hidden'" :disabled="!printBounds" @click="cycleVisibility">
            <Eye v-if="printAreaVisibility === 'visible'" :size="13" />
            <Lock v-else-if="printAreaVisibility === 'opaque'" :size="13" />
            <EyeOff v-else :size="13" />
          </button>
          <!-- Clear -->
          <button class="mf-ibtn mf-ibtn--danger w-7 h-7" title="Clear print area" :disabled="!printBounds" @click="emit('clear-print-bounds')">
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Scrollable body ─────────────────────────────────────────────── -->
    <div class="px-4 py-3 space-y-4">
      <!-- Print area settings -->
      <div>
        <div v-if="!printBounds" class="text-xs text-gray-400 dark:text-zinc-600 text-center py-1 mb-2">Click + to place a print area on the map</div>
        <div class="flex gap-2">
          <select :value="printPaper ?? ''" class="flex-1 py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer" @change="onPaperChange">
            <option v-for="p in PAPERS" :key="p" :value="p">{{ PAPER_LABELS[p] }}</option>
          </select>
          <div class="flex gap-1">
            <button
              v-for="{ value, icon, label } in [
                { value: 'portrait', icon: RectangleVertical, label: 'Portrait' },
                { value: 'landscape', icon: RectangleHorizontal, label: 'Landscape' }
              ] as const"
              :key="value"
              :title="label"
              :class="['mf-ibtn w-9 h-9', printOrientation === value && 'mf-ibtn--active']"
              @click="selectOrientation(value)"
            >
              <component :is="icon" :size="15" />
            </button>
          </div>
        </div>

        <!-- Poster grid -->
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs text-gray-600 dark:text-zinc-400">Poster grid</span>
          <div class="flex gap-1">
            <button v-for="preset in GRID_PRESETS" :key="preset" :title="preset" :class="`w-7 h-9 p-0.5 rounded border cursor-pointer transition-colors ${printGrid === preset ? 'border-cyan-400' : 'border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500'}`" @click="selectGrid(preset)">
              <div class="w-full h-full grid rounded-sm overflow-hidden" :style="`grid-template-columns: repeat(${preset.split('x')[0]}, 1fr); grid-template-rows: repeat(${preset.split('x')[1]}, 1fr); gap: 1px;`" :class="printGrid === preset ? 'bg-cyan-400' : 'bg-gray-200 dark:bg-zinc-600'">
                <div v-for="i in Number(preset.split('x')[0]) * Number(preset.split('x')[1])" :key="i" :class="printGrid === preset ? 'bg-cyan-50 dark:bg-cyan-950/50' : 'bg-white dark:bg-zinc-800'" />
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Recent prints -->
      <div v-if="printHistory.length > 0" class="pt-3 border-t border-gray-100 dark:border-zinc-800">
        <span :class="[sectionLabelClass, 'mb-1.5 block']">Recent</span>
        <div class="space-y-0.5">
          <button v-for="entry in printHistory" :key="entry.timestamp" class="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700/60 cursor-pointer transition-colors group" :title="`Restore: ${PAPER_LABELS[entry.paper]} ${entry.orientation}`" @click="emit('restore-from-history', entry)">
            <span class="text-xs text-gray-600 dark:text-zinc-400 truncate"> {{ PAPER_LABELS[entry.paper] }} · {{ entry.orientation === 'portrait' ? 'Portrait' : 'Landscape' }} · {{ formatHistoryDate(entry.timestamp) }} </span>
            <RotateCcw :size="11" class="shrink-0 text-gray-400 dark:text-zinc-500 group-hover:text-cyan-500 transition-colors" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Sticky footer: display + download ───────────────────────────── -->
    <div class="sticky bottom-0 bg-gray-50 dark:bg-zinc-800 border-t border-gray-100 dark:border-zinc-800 px-4 pt-3 pb-4 space-y-3">
      <!-- Legend + its dependent sub-options -->
      <div class="flex items-center justify-between gap-2">
        <span :class="sectionLabelClass" class="shrink-0" style="margin-bottom: 0">Legend</span>
        <div class="flex gap-1">
          <button :class="['mf-ibtn w-7 h-7', includeLegend && 'mf-ibtn--active']" :title="includeLegend ? 'Hide legend' : 'Show legend'" @click="includeLegend = !includeLegend"><List :size="13" /></button>
          <button :class="['mf-ibtn w-7 h-7', legendSeparatePage && 'mf-ibtn--active']" :disabled="!includeLegend" :title="!includeLegend ? 'Enable the legend first' : legendSeparatePage ? 'Legend on its own page' : 'Legend on the map'" @click="legendSeparatePage = !legendSeparatePage"><FileText :size="13" /></button>
          <button :class="['mf-ibtn w-7 h-7', legendTitle && 'mf-ibtn--active']" :disabled="!includeLegend" :title="!includeLegend ? 'Enable the legend first' : legendTitle ? 'Hide title' : 'Show title'" @click="legendTitle = !legendTitle"><Heading :size="13" /></button>
          <button :class="['mf-ibtn w-7 h-7', legendArea && 'mf-ibtn--active']" :disabled="!includeLegend" :title="!includeLegend ? 'Enable the legend first' : legendArea ? 'Hide subtitle' : 'Show subtitle'" @click="legendArea = !legendArea"><Captions :size="13" /></button>
          <button :class="['mf-ibtn w-7 h-7', legendBlankLabels && 'mf-ibtn--active']" :disabled="!includeLegend" :title="!includeLegend ? 'Enable the legend first' : legendBlankLabels ? 'Exploration mode on' : 'Exploration mode: hide labels so explorers can fill them in'" @click="legendBlankLabels = !legendBlankLabels"><PenLine :size="13" /></button>
        </div>
      </div>

      <!-- Map overlays -->
      <div class="flex items-center justify-between gap-2">
        <span :class="sectionLabelClass" class="shrink-0" style="margin-bottom: 0">Overlays</span>
        <div class="flex gap-1">
          <button :class="['mf-ibtn w-7 h-7', includeCompass && 'mf-ibtn--active']" :title="includeCompass ? 'Hide compass' : 'Show compass'" @click="includeCompass = !includeCompass"><Compass :size="13" /></button>
          <button :class="['mf-ibtn w-7 h-7', includeScale && 'mf-ibtn--active']" :title="includeScale ? 'Hide scale bar' : 'Show scale bar'" @click="includeScale = !includeScale"><Ruler :size="13" /></button>
        </div>
      </div>

      <!-- Render quality -->
      <div class="flex items-center justify-between gap-2">
        <span :class="sectionLabelClass" class="shrink-0" style="margin-bottom: 0">Quality</span>
        <div class="flex gap-1 items-center">
          <button v-if="MAP_STYLE_CONFIGS[mapStyle].printBlackPoint !== undefined" :class="['mf-ibtn w-7 h-7', enhanceContrast && 'mf-ibtn--active']" title="Enhance contrast (stretches tonal range for cleaner prints on light map styles)" @click="enhanceContrast = !enhanceContrast"><Contrast :size="13" /></button>
          <div v-if="!isIOS" class="mf-seg">
            <button :class="['mf-seg-btn w-7', exportQuality === 'draft' && 'mf-seg-btn--active']" title="Draft: fewer tiles, faster export, lower detail" @click="exportQuality = 'draft'"><Zap :size="13" /></button>
            <button :class="['mf-seg-btn w-7', exportQuality === 'standard' && 'mf-seg-btn--active']" title="Normal: standard quality" @click="exportQuality = 'standard'"><Circle :size="13" /></button>
            <button :class="['mf-seg-btn w-7', exportQuality === 'hires' && 'mf-seg-btn--active']" title="Hi-res: more tiles, highest detail — best for A0 and large-format printing. Takes longer." @click="exportQuality = 'hires'"><Snail :size="13" /></button>
          </div>
        </div>
      </div>
      <div>
        <button class="w-full px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1.5 cursor-pointer bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" :disabled="isDownloadingPdf || !printBounds" @click="emit('download-pdf')"><Printer :size="14" /> {{ isDownloadingPdf ? 'Building…' : 'PDF' }}</button>
        <p v-if="!printBounds" class="text-xs text-center text-gray-400 dark:text-zinc-500 mt-1.5">Add a print area above to export</p>
      </div>
    </div>
  </div>
</template>
