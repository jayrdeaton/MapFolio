<script setup lang="ts">
import { Magnet, SquareCheck, Undo2 } from '@lucide/vue'

import type { Route } from '@/types'

defineProps<{
  route: Route
  distance: string
  snapEnabled: boolean
}>()

const emit = defineEmits<{
  'update:snapEnabled': [value: boolean]
  undo: []
  done: []
}>()
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-2 bg-white text-gray-800 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg no-print pointer-events-auto">
    <span class="w-3 h-3 rounded-full shrink-0 ring-2 ring-gray-200" :style="{ background: route.color }" />
    {{ route.name }}
    <span v-if="distance" class="font-normal opacity-60">· {{ distance }}</span>
    <button :class="`w-6 h-6 flex items-center justify-center rounded transition-colors ${snapEnabled ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`" title="Snap waypoints to pins (Shift for angle snap)" @click.stop="emit('update:snapEnabled', !snapEnabled)"><Magnet :size="13" /></button>
    <button class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Undo last point" @click.stop="emit('undo')"><Undo2 :size="13" /></button>
    <button class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Done" @click.stop="emit('done')"><SquareCheck :size="15" /></button>
  </div>
</template>
