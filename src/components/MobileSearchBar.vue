<script setup lang="ts">
import type { SearchLocation } from '@/components/MapSearch.vue'

defineProps<{
  clearTrigger: number
}>()

const emit = defineEmits<{
  locationSelect: [loc: SearchLocation]
  clear: []
}>()
</script>

<template>
  <div class="sm:hidden bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 shrink-0 z-900 no-print">
    <MapSearch :auto-focus="true" :clear-trigger="clearTrigger" @location-select="emit('locationSelect', $event)" @clear="emit('clear')" />
  </div>
</template>
