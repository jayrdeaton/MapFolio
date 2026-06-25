<script setup lang="ts">
import { Eye, EyeOff, Magnet, PenLine, Printer, RectangleHorizontal, RectangleVertical, ScanSearch, Trash2, X } from '@lucide/vue'

import type { PrintOrientation } from '@/types'

defineProps<{
  areaName: string
  snapEnabled: boolean
  orientation: PrintOrientation
  isHidden: boolean
  isDownloadingPdf: boolean
}>()

const emit = defineEmits<{
  'update:snapEnabled': [value: boolean]
  'update:orientation': [value: PrintOrientation]
  fit: []
  edit: []
  hide: []
  delete: []
  download: []
  done: []
}>()
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-2 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg no-print pointer-events-auto">
    <span class="max-w-36 truncate text-sm">{{ areaName }}</span>
    <button :class="['mf-ibtn w-6 h-6', snapEnabled && 'mf-ibtn--active']" title="Snap: rotation to 15° increments, legend to corners (Shift inverts)" @click.stop="emit('update:snapEnabled', !snapEnabled)"><Magnet :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" title="Fit print area to visible elements" @click.stop="emit('fit')"><ScanSearch :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" :title="orientation === 'portrait' ? 'Switch to landscape' : 'Switch to portrait'" @click.stop="emit('update:orientation', orientation === 'portrait' ? 'landscape' : 'portrait')">
      <RectangleVertical v-if="orientation === 'portrait'" :size="13" />
      <RectangleHorizontal v-else :size="13" />
    </button>
    <button class="mf-ibtn w-6 h-6" title="Edit print area settings" @click.stop="emit('edit')"><PenLine :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" :title="isHidden ? 'Show' : 'Hide'" @click.stop="emit('hide')">
      <EyeOff v-if="isHidden" :size="13" />
      <Eye v-else :size="13" />
    </button>
    <button class="mf-ibtn mf-ibtn--danger w-6 h-6" title="Delete print area" @click.stop="emit('delete')"><Trash2 :size="13" /></button>
    <button :disabled="isDownloadingPdf" class="mf-ibtn mf-ibtn--primary w-6 h-6" :title="isDownloadingPdf ? 'Building PDF…' : 'Export PDF'" @click.stop="emit('download')"><Printer :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" title="Deselect" @click.stop="emit('done')"><X :size="13" /></button>
  </div>
</template>
