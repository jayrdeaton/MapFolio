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
  cancel: []
  done: []
}>()
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1100 w-max sm:w-auto flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-2xl sm:rounded-full shadow-lg no-print pointer-events-auto max-w-[calc(100vw-5rem)]">
    <!-- Identity -->
    <div class="flex items-center gap-2 w-full sm:w-auto min-w-0">
      <span class="truncate min-w-0 sm:max-w-36">{{ areaName }}</span>
      <button class="sm:hidden ml-auto mf-ibtn w-6 h-6" title="Deselect" @click.stop="emit('done')"><X :size="13" /></button>
    </div>

    <!-- Divider (mobile only) -->
    <div class="w-full border-t border-gray-100 dark:border-zinc-700 sm:hidden" />

    <!-- Actions -->
    <div class="flex items-center gap-1.5 sm:gap-2">
      <button :class="['mf-ibtn w-6 h-6', snapEnabled && 'mf-ibtn--active']" title="Snap: rotation to 15° increments, legend to corners (Shift inverts)" @click.stop="emit('update:snapEnabled', !snapEnabled)"><Magnet :size="13" /></button>
      <button class="mf-ibtn w-6 h-6" title="Fit print to visible elements" @click.stop="emit('fit')"><ScanSearch :size="13" /></button>
      <button class="mf-ibtn w-6 h-6" :title="orientation === 'portrait' ? 'Switch to landscape' : 'Switch to portrait'" @click.stop="emit('update:orientation', orientation === 'portrait' ? 'landscape' : 'portrait')">
        <RectangleVertical v-if="orientation === 'portrait'" :size="13" />
        <RectangleHorizontal v-else :size="13" />
      </button>
      <button class="mf-ibtn w-6 h-6" title="Edit" @click.stop="emit('edit')"><PenLine :size="13" /></button>
      <button class="mf-ibtn w-6 h-6" :title="isHidden ? 'Show' : 'Hide'" @click.stop="emit('hide')">
        <EyeOff v-if="isHidden" :size="13" />
        <Eye v-else :size="13" />
      </button>
      <button class="mf-ibtn mf-ibtn--danger w-6 h-6" title="Delete" @click.stop="emit('delete')"><Trash2 :size="13" /></button>
      <button :class="['mf-ibtn w-6 h-6', isDownloadingPdf ? 'mf-ibtn--destructive' : 'mf-ibtn--primary']" :title="isDownloadingPdf ? 'Cancel export' : 'Export PDF'" @click.stop="isDownloadingPdf ? emit('cancel') : emit('download')"><Printer :size="13" /></button>
      <button class="hidden sm:flex mf-ibtn w-6 h-6" title="Deselect" @click.stop="emit('done')"><X :size="13" /></button>
    </div>
  </div>
</template>
