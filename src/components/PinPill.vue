<script setup lang="ts">
import { Redo2, Undo2, X } from '@lucide/vue'

import PinPreview from '@/components/PinPreview.vue'
import type { PinDotShape, PinDotSize } from '@/types'

defineProps<{
  emoji: string
  color: string
  dotSize?: PinDotSize
  dotShape?: PinDotShape
  showNumber?: boolean
  count: number
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  undo: []
  redo: []
  done: []
}>()
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-2 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg no-print pointer-events-auto">
    <PinPreview :emoji="emoji" :color="color" :dot-size="dotSize" :dot-shape="dotShape" :show-number="showNumber" preview />
    Placing pins
    <span v-if="count > 0" class="font-normal opacity-60">· {{ count }}</span>
    <button class="mf-ibtn w-6 h-6" :disabled="!canUndo" title="Undo last pin" @click.stop="emit('undo')"><Undo2 :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" :disabled="!canRedo" title="Redo last pin" @click.stop="emit('redo')"><Redo2 :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" title="Done" @click.stop="emit('done')"><X :size="13" /></button>
  </div>
</template>
