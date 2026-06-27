<script setup lang="ts">
import { Circle, Contrast, Eye, EyeOff, Maximize2, Plus, Printer, Snail, Trash2, Zap } from '@lucide/vue'

import PrintAreaListItem from '@/components/PrintAreaListItem.vue'
import type { ExportQuality } from '@/composables/useMapExport'
import type { MapStyle, PrintArea } from '@/types'
import { MAP_STYLE_CONFIGS } from '@/types'
import { printAreaPlaceholder } from '@/utils'

defineProps<{
  printAreas: PrintArea[]
  activePrintAreaId: string | null
  selectedPrintAreaIds: string[]
  allPrintAreasHidden: boolean
  isDownloadingPdf: boolean
  mapStyle: MapStyle
  mapName: string
  mapSubtitle: string
}>()

const emit = defineEmits<{
  'add-area': []
  'select-area': [id: string, additive: boolean]
  'edit-area': [id: string]
  'toggle-visibility': [id: string]
  'toggle-all-visibility': []
  'fit-to-view': []
  'copy-area': [id: string]
  'cut-area': [id: string]
  'delete-area': [id: string]
  reorder: [areas: PrintArea[]]
  'clear-all': []
  'download-pdf': []
  'cancel-pdf': []
}>()

const enhanceContrast = defineModel<boolean>('enhanceContrast', { required: true })
const exportQuality = defineModel<ExportQuality>('exportQuality', { required: true })

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
const sectionLabelClass = 'block text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
</script>

<template>
  <div>
    <!-- ── Sticky header ────────────────────────────────────────────────── -->
    <div class="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800 px-4 pt-4 pb-2">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide"><Printer :size="12" /> Print</span>
        <div class="flex gap-1">
          <button class="mf-ibtn mf-ibtn--primary w-7 h-7" title="Add print" @click="emit('add-area')">
            <Plus :size="13" />
          </button>
          <button :disabled="printAreas.length === 0" class="mf-ibtn w-7 h-7" title="Fit map to active print" @click="emit('fit-to-view')">
            <Maximize2 :size="13" />
          </button>
          <button :disabled="printAreas.length === 0" :class="['mf-ibtn w-7 h-7', !allPrintAreasHidden && 'mf-ibtn--active']" :title="allPrintAreasHidden ? 'Show all prints' : 'Hide all prints'" @click="emit('toggle-all-visibility')">
            <Eye v-if="!allPrintAreasHidden" :size="13" />
            <EyeOff v-else :size="13" />
          </button>
          <button :disabled="printAreas.length === 0" class="mf-ibtn mf-ibtn--danger w-7 h-7" title="Delete all prints" @click="emit('clear-all')">
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Scrollable body ─────────────────────────────────────────────── -->
    <div class="py-1">
      <div v-if="printAreas.length === 0" class="text-xs text-gray-400 dark:text-zinc-600 text-center py-4 px-4">No prints yet</div>
      <div v-else>
        <VueDraggable :model-value="printAreas" item-key="id" handle=".print-area-drag-handle" :animation="150" ghost-class="opacity-40" @update:model-value="emit('reorder', $event)">
          <template #item="{ element: area }">
            <PrintAreaListItem :area="area" :selected="selectedPrintAreaIds.includes(area.id) || activePrintAreaId === area.id" :placeholder="area.title ? undefined : printAreaPlaceholder(area.id, printAreas, mapName)" :subtitle-placeholder="area.subtitle ? undefined : mapSubtitle" @select="(id, additive) => emit('select-area', id, additive)" @toggle-visibility="emit('toggle-visibility', $event)" @copy="emit('copy-area', $event)" @cut="emit('cut-area', $event)" @edit="emit('edit-area', $event)" @delete="emit('delete-area', $event)" />
          </template>
        </VueDraggable>
      </div>
    </div>

    <!-- ── Sticky footer: quality + download ────────────────────────────── -->
    <div class="sticky bottom-0 bg-gray-50 dark:bg-zinc-800 border-t border-gray-100 dark:border-zinc-800 px-4 pt-3 pb-4 space-y-3">
      <!-- Render quality -->
      <div class="flex items-center justify-between gap-2">
        <span :class="sectionLabelClass" style="margin-bottom: 0">Quality</span>
        <div class="flex gap-1 items-center">
          <button v-if="MAP_STYLE_CONFIGS[mapStyle].printBlackPoint !== undefined" :class="['mf-ibtn w-7 h-7', enhanceContrast && 'mf-ibtn--active']" title="Enhance contrast" @click="enhanceContrast = !enhanceContrast"><Contrast :size="13" /></button>
          <div v-if="!isIOS" class="mf-seg">
            <button :class="['mf-seg-btn w-7', exportQuality === 'draft' && 'mf-seg-btn--active']" title="Draft" @click="exportQuality = 'draft'"><Zap :size="13" /></button>
            <button :class="['mf-seg-btn w-7', exportQuality === 'standard' && 'mf-seg-btn--active']" title="Standard" @click="exportQuality = 'standard'"><Circle :size="13" /></button>
            <button :class="['mf-seg-btn w-7', exportQuality === 'hires' && 'mf-seg-btn--active']" title="Hi-res" @click="exportQuality = 'hires'"><Snail :size="13" /></button>
          </div>
        </div>
      </div>

      <div>
        <button class="w-full px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed" :class="isDownloadingPdf ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-teal-600 text-white hover:bg-teal-700'" :disabled="!isDownloadingPdf && !activePrintAreaId && selectedPrintAreaIds.length !== 1" @click="isDownloadingPdf ? emit('cancel-pdf') : emit('download-pdf')"><Printer :size="14" /> {{ isDownloadingPdf ? 'Cancel' : 'PDF' }}</button>
        <p v-if="!activePrintAreaId && selectedPrintAreaIds.length !== 1" class="text-xs text-center text-gray-400 dark:text-zinc-500 mt-1.5">
          {{ printAreas.length === 0 ? 'Add a print above to export' : selectedPrintAreaIds.length > 1 ? 'Select one print to export' : 'Select a print to export' }}
        </p>
      </div>
    </div>
  </div>
</template>
