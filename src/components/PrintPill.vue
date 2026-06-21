<script setup lang="ts">
import { Magnet, Printer, ScanSearch, X } from '@lucide/vue'

defineProps<{
  snapEnabled: boolean
  isDownloadingPdf: boolean
}>()

const emit = defineEmits<{
  'update:snapEnabled': [value: boolean]
  fit: []
  download: []
  done: []
}>()
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-2 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg no-print pointer-events-auto">
    Print
    <button :class="['mf-ibtn w-6 h-6', snapEnabled && 'mf-ibtn--active']" title="Rotation snap" @click.stop="emit('update:snapEnabled', !snapEnabled)"><Magnet :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" title="Fit print area to visible elements" @click.stop="emit('fit')"><ScanSearch :size="13" /></button>
    <button :disabled="isDownloadingPdf" class="mf-ibtn mf-ibtn--primary w-6 h-6" :title="isDownloadingPdf ? 'Building PDF…' : 'Export PDF'" @click.stop="emit('download')"><Printer :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" title="Done" @click.stop="emit('done')"><X :size="13" /></button>
  </div>
</template>
