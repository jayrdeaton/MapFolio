<script setup lang="ts">
import { Eye, EyeOff, Pencil, Trash2 } from '@lucide/vue'

import type { Pin } from '../types'

defineProps<{ pin: Pin; hidden?: boolean; resolving?: boolean }>()
const emit = defineEmits<{
  delete: [id: number]
  edit: [pin: Pin]
  zoom: [pin: Pin]
  'toggle-visibility': [id: number]
}>()
</script>

<template>
  <div :class="['group flex items-center gap-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-all', hidden ? 'opacity-40' : '']">
    <button class="pin-drag-handle text-base leading-none shrink-0 cursor-grab active:cursor-grabbing hover:scale-125 transition-transform" :title="pin.name ? `Zoom to ${pin.name}` : 'Zoom to pin'" @click="emit('zoom', pin)">{{ pin.emoji }}</button>
    <div class="flex-1 min-w-0 cursor-pointer" :title="pin.name ? `Zoom to ${pin.name}` : 'Zoom to pin'" @click="emit('zoom', pin)">
      <div class="text-sm font-medium truncate transition-colors" :class="pin.name ? 'text-gray-800 dark:text-zinc-200 group-hover:text-cyan-500 dark:group-hover:text-cyan-400' : 'text-gray-400 dark:text-zinc-500 italic'">{{ pin.name || 'Unnamed' }}</div>
      <div v-if="pin.description" class="text-xs text-gray-400 dark:text-zinc-500 truncate">{{ pin.description }}</div>
      <div class="text-xs text-gray-400 dark:text-zinc-500 font-mono tabular-nums">{{ pin.lat.toFixed(4) }}, {{ pin.lng.toFixed(4) }}</div>
      <div v-if="pin.address" class="text-xs text-gray-400 dark:text-zinc-500 truncate">{{ pin.address }}</div>
      <div v-else-if="resolving" class="text-xs text-gray-300 dark:text-zinc-600 animate-pulse">Resolving address…</div>
    </div>
    <div class="flex gap-1">
      <button :class="['w-7 h-7 flex items-center justify-center rounded border cursor-pointer transition-colors', hidden ? 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800' : 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600']" :title="hidden ? 'Show this pin on map' : 'Hide this pin from map'" @click="emit('toggle-visibility', pin.id)">
        <EyeOff v-if="hidden" :size="13" />
        <Eye v-else :size="13" />
      </button>
      <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-cyan-500 dark:hover:text-cyan-400 cursor-pointer transition-colors" title="Edit pin" @click="emit('edit', pin)">
        <Pencil :size="13" />
      </button>
      <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-red-300 dark:hover:border-red-800 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors" title="Remove pin" @click="emit('delete', pin.id)">
        <Trash2 :size="13" />
      </button>
    </div>
  </div>
</template>
