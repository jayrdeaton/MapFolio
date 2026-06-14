<script setup lang="ts">
import { SquareCheck, Undo2 } from '@lucide/vue'

defineProps<{
  emoji: string
  count: number
  canUndo: boolean
}>()

const emit = defineEmits<{
  undo: []
  done: []
}>()
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-2 bg-white text-gray-800 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg no-print pointer-events-auto">
    <span class="text-base leading-none">{{ emoji }}</span>
    Placing pins
    <span v-if="count > 0" class="font-normal opacity-60">· {{ count }}</span>
    <button :class="`w-6 h-6 flex items-center justify-center rounded transition-colors ${canUndo ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' : 'text-gray-200 cursor-not-allowed'}`" :disabled="!canUndo" title="Undo last pin" @click.stop="emit('undo')">
      <Undo2 :size="13" />
    </button>
    <button class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Done" @click.stop="emit('done')">
      <SquareCheck :size="15" />
    </button>
  </div>
</template>
