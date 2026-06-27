<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue'
import type L from 'leaflet'

import { useZoomRepeat } from '@/composables/useZoomRepeat'

defineProps<{
  leafletMap: L.Map
  atMaxZoom: boolean
  atMinZoom: boolean
}>()

const { startZoomRepeat, stopZoomRepeat } = useZoomRepeat()
</script>

<template>
  <div class="pointer-events-auto flex flex-col w-8 rounded overflow-hidden shadow-sm border border-gray-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
    <button
      :disabled="atMaxZoom"
      :class="['h-7 flex items-center justify-center border-b border-gray-200/60 dark:border-zinc-700/60 transition-colors select-none', atMaxZoom ? 'text-gray-300 dark:text-zinc-600 cursor-not-allowed' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100/80 dark:hover:bg-zinc-800/80 cursor-pointer']"
      style="touch-action: manipulation"
      aria-label="Zoom in"
      title="Zoom in"
      @pointerdown.prevent="
        startZoomRepeat(
          () => leafletMap.zoomIn(),
          () => atMaxZoom
        )
      "
      @pointerup="stopZoomRepeat()"
      @pointerleave="stopZoomRepeat()"
      @pointercancel="stopZoomRepeat()"
    >
      <Plus :size="13" />
    </button>
    <button
      :disabled="atMinZoom"
      :class="['h-7 flex items-center justify-center transition-colors select-none', atMinZoom ? 'text-gray-300 dark:text-zinc-600 cursor-not-allowed' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100/80 dark:hover:bg-zinc-800/80 cursor-pointer']"
      style="touch-action: manipulation"
      aria-label="Zoom out"
      title="Zoom out"
      @pointerdown.prevent="
        startZoomRepeat(
          () => leafletMap.zoomOut(),
          () => atMinZoom
        )
      "
      @pointerup="stopZoomRepeat()"
      @pointerleave="stopZoomRepeat()"
      @pointercancel="stopZoomRepeat()"
    >
      <Minus :size="13" />
    </button>
  </div>
</template>
