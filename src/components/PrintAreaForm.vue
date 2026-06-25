<script setup lang="ts">
import { Captions, Compass, FileText, Heading, MapPin, PenLine, Printer, RectangleHorizontal, RectangleVertical, Route, Ruler, Trash2, X } from '@lucide/vue'

import { GRID_PRESETS, type Orientation, PAPER_LABELS, PAPERS, type PaperSize } from '@/composables/usePrintExport'
import type { PrintArea } from '@/types'

const props = defineProps<{
  show: boolean
  editingArea: PrintArea | null
  namePlaceholder?: string
  mapTitle?: string
  mapSubtitle?: string
}>()

const emit = defineEmits<{
  save: [area: PrintArea]
  delete: []
  close: []
}>()

const paper = ref<PaperSize>('letter')
const orientation = ref<Orientation>('portrait')
const grid = ref('1x1')
const title = ref('')
const subtitle = ref('')
const legend = ref(true)
const legendPins = ref(true)
const legendRoutes = ref(true)
const legendSeparatePage = ref(false)
const legendTitle = ref(true)
const legendArea = ref(true)
const legendBlankLabels = ref(false)
const compass = ref(true)
const scale = ref(true)
const markerScale = ref(1)

watch(
  () => props.editingArea,
  (area) => {
    if (!area) return
    paper.value = area.paper
    orientation.value = area.orientation
    grid.value = area.grid
    title.value = area.title ?? ''
    subtitle.value = area.subtitle ?? ''
    legend.value = area.legend ?? true
    legendPins.value = area.legendPins ?? true
    legendRoutes.value = area.legendRoutes ?? true
    legendSeparatePage.value = area.legendSeparatePage ?? false
    legendTitle.value = area.legendTitle ?? true
    legendArea.value = area.legendArea ?? true
    legendBlankLabels.value = area.legendBlankLabels ?? false
    compass.value = area.compass ?? true
    scale.value = area.scale ?? true
    markerScale.value = area.markerScale ?? 1
  },
  { immediate: true }
)


function save() {
  if (!props.editingArea) return
  emit('save', {
    ...props.editingArea,
    paper: paper.value,
    orientation: orientation.value,
    grid: grid.value,
    title: title.value.trim() || undefined,
    subtitle: subtitle.value.trim() || undefined,
    legend: legend.value,
    legendPins: legendPins.value,
    legendRoutes: legendRoutes.value,
    legendSeparatePage: legendSeparatePage.value,
    legendTitle: legendTitle.value,
    legendArea: legendArea.value,
    legendBlankLabels: legendBlankLabels.value,
    compass: compass.value,
    scale: scale.value,
    markerScale: markerScale.value
  })
}

const inputClass = 'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20'
const sectionLabelClass = 'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const btnBase = 'px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer'
const pillClass = 'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer'
const pillActive = 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
const pillInactive = 'bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500'
</script>

<template>
  <div v-if="show && editingArea" class="fixed bottom-0 left-0 right-0 z-1800 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl no-print max-h-[90vh] overflow-y-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-110 sm:rounded-2xl">
    <div class="p-4 pb-8">
      <div class="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full mx-auto mb-4" />

      <div class="flex items-center gap-3 mb-4">
        <div class="shrink-0 w-11 h-11 flex items-center justify-center text-gray-400 dark:text-zinc-500">
          <Printer :size="22" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-gray-900 dark:text-zinc-100 text-lg font-bold leading-tight">Edit Print</h2>
        </div>
        <button class="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="space-y-3">
        <!-- Title -->
        <div>
          <label :class="sectionLabelClass">Title</label>
          <input v-model="title" :class="inputClass" type="text" :placeholder="namePlaceholder || mapTitle || 'Print Area'" />
        </div>

        <!-- Subtitle -->
        <div>
          <label :class="sectionLabelClass">Subtitle</label>
          <input v-model="subtitle" :class="inputClass" type="text" :placeholder="mapSubtitle || 'Location'" />
        </div>

        <!-- Paper & Orientation -->
        <div>
          <label :class="sectionLabelClass">Paper</label>
          <div class="flex gap-2">
            <select v-model="paper" :class="inputClass" class="flex-1">
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
                :class="['mf-ibtn w-9 h-9', orientation === value && 'mf-ibtn--active']"
                @click="orientation = value"
              >
                <component :is="icon" :size="15" />
              </button>
            </div>
          </div>
        </div>

        <!-- Pin Scale -->
        <div>
          <label :class="sectionLabelClass">Pin Scale</label>
          <div class="flex gap-1">
            <button v-for="{ value, label } in ([{ value: 0.25, label: '¼×' }, { value: 0.5, label: '½×' }, { value: 0.75, label: '¾×' }, { value: 1, label: '1×' }] as const)" :key="value" :class="['flex-1 py-1 rounded border text-xs font-medium transition-colors cursor-pointer', markerScale === value ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800' : 'bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500']" @click="markerScale = value">{{ label }}</button>
          </div>
        </div>

        <!-- Poster grid -->
        <div>
          <label :class="sectionLabelClass">Poster Grid</label>
          <div class="flex gap-1">
            <button v-for="preset in GRID_PRESETS" :key="preset" :title="preset" :class="`w-8 h-10 p-0.5 rounded border cursor-pointer transition-colors ${grid === preset ? 'border-teal-400' : 'border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500'}`" @click="grid = preset">
              <div class="w-full h-full grid rounded-sm overflow-hidden" :style="`grid-template-columns: repeat(${preset.split('x')[0]}, 1fr); grid-template-rows: repeat(${preset.split('x')[1]}, 1fr); gap: 1px;`" :class="grid === preset ? 'bg-teal-400' : 'bg-gray-200 dark:bg-zinc-600'">
                <div v-for="i in Number(preset.split('x')[0]) * Number(preset.split('x')[1])" :key="i" :class="grid === preset ? 'bg-teal-50 dark:bg-teal-950/50' : 'bg-white dark:bg-zinc-800'" />
              </div>
            </button>
          </div>
        </div>

        <div class="border-t border-gray-100 dark:border-zinc-800" />

        <!-- Legend -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <span :class="sectionLabelClass" style="margin-bottom:0">Legend</span>
            <button role="switch" :aria-checked="legend" :class="['relative inline-flex h-4 w-7 items-center rounded-full transition-colors cursor-pointer', legend ? 'bg-teal-600' : 'bg-gray-200 dark:bg-zinc-600']" @click="legend = !legend">
              <span :class="['inline-block h-3 w-3 rounded-full bg-white shadow transition-transform', legend ? 'translate-x-3.5' : 'translate-x-0.5']" />
            </button>
          </div>
          <div :class="['flex flex-wrap gap-1.5', !legend && 'opacity-40 pointer-events-none']">
            <button :class="[pillClass, legendTitle ? pillActive : pillInactive]" @click="legendTitle = !legendTitle"><Heading :size="12" />Title</button>
            <button :class="[pillClass, legendArea ? pillActive : pillInactive]" @click="legendArea = !legendArea"><Captions :size="12" />Subtitle</button>
            <button :class="[pillClass, legendPins ? pillActive : pillInactive]" @click="legendPins = !legendPins"><MapPin :size="12" />Pins</button>
            <button :class="[pillClass, legendRoutes ? pillActive : pillInactive]" @click="legendRoutes = !legendRoutes"><Route :size="12" />Routes</button>
            <button :class="[pillClass, legendBlankLabels ? pillActive : pillInactive]" @click="legendBlankLabels = !legendBlankLabels"><PenLine :size="12" />Blank Labels</button>
            <button :class="[pillClass, compass ? pillActive : pillInactive]" @click="compass = !compass"><Compass :size="12" />Compass</button>
            <button :class="[pillClass, scale ? pillActive : pillInactive]" @click="scale = !scale"><Ruler :size="12" />Scale</button>
            <button :class="[pillClass, legendSeparatePage ? pillActive : pillInactive]" @click="legendSeparatePage = !legendSeparatePage"><FileText :size="12" />Separate Page</button>
          </div>
        </div>

        <div class="border-t border-gray-100 dark:border-zinc-800" />

        <div class="flex gap-2">
          <button :class="`${btnBase} justify-center px-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50`" @click="emit('delete')"><Trash2 :size="15" /> Delete</button>
          <button :class="`${btnBase} flex-1 justify-center bg-teal-600 text-white hover:bg-teal-700`" @click="save">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>
