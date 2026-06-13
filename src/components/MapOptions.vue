<script setup lang="ts">
import { Layers } from '@lucide/vue'
import { computed } from 'vue'

import { MAP_STYLE_CONFIGS, MapStyle, PinDotSize } from '../types'

const props = defineProps<{
  mapStyle: MapStyle
  showLabels: boolean
  showClusters: boolean
  pinDotSize: PinDotSize
}>()
const emit = defineEmits<{
  'style-change': [style: MapStyle]
  'labels-change': [value: boolean]
  'clusters-change': [value: boolean]
  'dot-size-change': [size: PinDotSize]
}>()

const DOT_SIZES: { value: PinDotSize; label: string }[] = [
  { value: 'none', label: '—' },
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
]

const STYLES: MapStyle[] = ['clean', 'minimal', 'standard', 'satellite', 'terrain']
const labelsApplicable = computed(() => props.mapStyle === 'clean' || props.mapStyle === 'satellite')
</script>

<template>
  <div class="mb-5">
    <h3 class="mb-3 text-gray-800 dark:text-zinc-200 text-sm font-semibold flex items-center gap-1.5 uppercase tracking-wide">
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
            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-300'
            : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800'
        ]"
      >
        <div class="text-sm font-medium leading-tight">{{ MAP_STYLE_CONFIGS[style].name }}</div>
        <div class="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 leading-tight">{{ MAP_STYLE_CONFIGS[style].description }}</div>
      </button>
    </div>
  </div>

  <div class="pt-3 border-t border-gray-100 dark:border-zinc-800 space-y-1.5">
    <h3 class="mb-2 text-gray-800 dark:text-zinc-200 text-sm font-semibold uppercase tracking-wide">Overlays</h3>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-gray-600 dark:text-zinc-400">Labels</span>
        <span v-if="!labelsApplicable" class="text-[10px] text-gray-400 dark:text-zinc-600">included in style</span>
      </div>
      <button
        :class="`h-6 px-2.5 rounded text-xs font-medium border cursor-pointer transition-colors ${
          showLabels && labelsApplicable
            ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600'
            : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
        }`"
        @click="emit('labels-change', !showLabels)"
      >{{ showLabels ? 'On' : 'Off' }}</button>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-xs text-gray-600 dark:text-zinc-400">Cluster pins</span>
      <button
        :class="`h-6 px-2.5 rounded text-xs font-medium border cursor-pointer transition-colors ${showClusters ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`"
        @click="emit('clusters-change', !showClusters)"
      >{{ showClusters ? 'On' : 'Off' }}</button>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-xs text-gray-600 dark:text-zinc-400">Pin dot</span>
      <div class="flex gap-1">
        <button
          v-for="opt in DOT_SIZES"
          :key="opt.value"
          :class="`h-6 px-2.5 rounded text-xs font-medium border cursor-pointer transition-colors ${pinDotSize === opt.value ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`"
          @click="emit('dot-size-change', opt.value)"
        >{{ opt.label }}</button>
      </div>
    </div>
  </div>
</template>
