<script setup lang="ts">
import { Download, X } from '@lucide/vue'
import { onMounted, onUnmounted } from 'vue'

defineProps<{
  blobUrl: string
}>()

const emit = defineEmits<{
  download: []
  close: []
}>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-2000 flex items-center justify-center p-4 no-print">
      <div class="absolute inset-0 bg-black/60" @click="emit('close')" />
      <div class="relative z-10 flex flex-col bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh]">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <span class="text-sm font-semibold text-gray-800 dark:text-zinc-100">PDF Preview</span>
          <button class="mf-ibtn w-7 h-7" title="Close" @click="emit('close')"><X :size="14" /></button>
        </div>
        <div class="flex-1 min-h-0 overflow-hidden bg-gray-100 dark:bg-zinc-800" style="min-height: 60vh">
          <iframe :src="blobUrl" class="w-full h-full border-0" style="min-height: 60vh" />
        </div>
        <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-zinc-700 shrink-0">
          <button class="px-3 py-1.5 text-sm rounded text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer" @click="emit('close')">Close</button>
          <button class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors cursor-pointer" @click="emit('download')"><Download :size="14" /> Download</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
