<script setup lang="ts">
import { Crosshair, ScanSearch } from '@lucide/vue'

defineProps<{
  isLocating: boolean
  canFitAll: boolean
  fitLabel: string
}>()

const emit = defineEmits<{
  locate: []
  'fit-all': []
}>()

// Smaller than the primary FAB stack (top-right) to read as secondary map-navigation helpers.
const btnBase = 'w-9 h-9 rounded-full flex items-center justify-center shadow-md border bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 transition-all'
</script>

<template>
  <!-- Sits bottom-right, just above Leaflet's attribution control. -->
  <div class="absolute right-2 z-1000 flex flex-col gap-2 no-print" style="bottom: calc(env(safe-area-inset-bottom) + 1.5rem)">
    <button :aria-label="fitLabel" :title="fitLabel" :disabled="!canFitAll" :class="`${btnBase} ${canFitAll ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800' : 'opacity-50 cursor-not-allowed'}`" @click="emit('fit-all')">
      <ScanSearch :size="16" />
    </button>
    <button aria-label="Go to my location" title="My location" :disabled="isLocating" :class="`${btnBase} cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-default`" @click="emit('locate')">
      <Crosshair :size="16" :class="isLocating ? 'animate-spin' : ''" />
    </button>
  </div>
</template>
