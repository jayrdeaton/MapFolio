<script setup lang="ts">
import { Layers } from '@lucide/vue'

import { MAP_STYLE_CONFIGS, MapStyle } from '../types'

defineProps<{ mapStyle: MapStyle }>()
const emit = defineEmits<{ 'style-change': [style: MapStyle] }>()

const STYLES: MapStyle[] = ['clean', 'minimal', 'standard', 'satellite', 'terrain', 'dark']
</script>

<template>
  <div class="mb-5">
    <h3 class="mb-3 text-gray-800 text-sm font-semibold flex items-center gap-1.5 uppercase tracking-wide">
      <Layers :size="14" /> Map Style
    </h3>
    <div class="grid grid-cols-2 gap-1.5">
      <button
        v-for="style in STYLES"
        :key="style"
        @click="emit('style-change', style)"
        :class="[
          'p-2 rounded border text-left cursor-pointer transition-all',
          mapStyle === style
            ? 'border-blue-500 bg-blue-50 text-blue-800'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
        ]"
      >
        <div class="text-sm font-medium leading-tight">{{ MAP_STYLE_CONFIGS[style].name }}</div>
        <div class="text-xs text-gray-400 mt-0.5 leading-tight">{{ MAP_STYLE_CONFIGS[style].description }}</div>
      </button>
    </div>
  </div>
</template>
