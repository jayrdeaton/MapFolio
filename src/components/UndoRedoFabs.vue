<script setup lang="ts">
import { Redo2, Undo2 } from '@lucide/vue'

defineProps<{
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  undo: []
  redo: []
}>()
</script>

<template>
  <div class="absolute left-2 top-2 z-1000 no-print flex flex-col gap-2">
    <button :disabled="!canUndo" :class="['w-9 h-9 rounded-full flex items-center justify-center shadow-md border transition-all', canUndo ? 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer' : 'bg-white/50 dark:bg-zinc-900/50 text-gray-400 dark:text-zinc-600 border-gray-200/50 dark:border-zinc-700/50 cursor-not-allowed']" aria-label="Undo" title="Undo (⌘Z)" @click="emit('undo')">
      <Undo2 :size="16" />
    </button>
    <button v-if="canRedo" class="w-9 h-9 rounded-full flex items-center justify-center shadow-md border transition-all bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer" aria-label="Redo" title="Redo (⌘Y)" @click="emit('redo')">
      <Redo2 :size="16" />
    </button>
  </div>
</template>
