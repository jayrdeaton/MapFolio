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
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1100 w-max sm:w-auto flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-2xl sm:rounded-full shadow-lg no-print pointer-events-auto max-w-[calc(100vw-5rem)]">
    <!-- Identity -->
    <div class="flex items-center gap-2 w-full sm:w-auto min-w-0">
      <PinPreview :emoji="emoji" :color="color" :dot-size="dotSize" :dot-shape="dotShape" :show-number="showNumber" preview class="shrink-0" />
      <span class="truncate min-w-0">Placing pins</span>
      <span v-if="count > 0" class="font-normal opacity-60 shrink-0">· {{ count }}</span>
      <button class="sm:hidden ml-auto mf-ibtn w-6 h-6" title="Done" @click.stop="emit('done')"><X :size="13" /></button>
    </div>

    <!-- Divider (mobile only) -->
    <div class="w-full border-t border-gray-100 dark:border-zinc-700 sm:hidden" />

    <!-- Actions -->
    <div class="flex items-center gap-1.5 sm:gap-2">
      <button class="mf-ibtn w-6 h-6" :disabled="!canUndo" title="Undo last pin" @click.stop="emit('undo')"><Undo2 :size="13" /></button>
      <button class="mf-ibtn w-6 h-6" :disabled="!canRedo" title="Redo last pin" @click.stop="emit('redo')"><Redo2 :size="13" /></button>
      <button class="hidden sm:flex mf-ibtn w-6 h-6" title="Done" @click.stop="emit('done')"><X :size="13" /></button>
    </div>
  </div>
</template>
