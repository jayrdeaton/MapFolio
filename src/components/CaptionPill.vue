<script setup lang="ts">
import { Minus, Plus, Redo2, Triangle, Undo2, X } from '@lucide/vue'

import CaptionPreview from '@/components/CaptionPreview.vue'
import type { CaptionSize } from '@/types'

const props = defineProps<{
  color: string
  size: CaptionSize
  count: number
  angleSnapEnabled: boolean
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  'update:angleSnapEnabled': [value: boolean]
  'update:size': [value: CaptionSize]
  undo: []
  redo: []
  done: []
}>()

const SIZES: CaptionSize[] = ['xs', 's', 'm', 'l', 'xl']
const canShrink = computed(() => SIZES.indexOf(props.size) > 0)
const canGrow = computed(() => SIZES.indexOf(props.size) < SIZES.length - 1)

function step(dir: 1 | -1) {
  const next = SIZES[SIZES.indexOf(props.size) + dir]
  if (next) emit('update:size', next)
}
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-2 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg no-print pointer-events-auto">
    <CaptionPreview :color="color" preview />
    Placing captions
    <span v-if="count > 0" class="font-normal opacity-60">· {{ count }}</span>

    <!-- Size adjuster -->
    <div class="flex items-center gap-1">
      <button :disabled="!canShrink" class="mf-ibtn w-6 h-6" title="Smaller" @click.stop="step(-1)"><Minus :size="13" /></button>
      <span class="w-5 text-center text-xs font-semibold uppercase tabular-nums text-gray-500 dark:text-zinc-400">{{ size }}</span>
      <button :disabled="!canGrow" class="mf-ibtn w-6 h-6" title="Larger" @click.stop="step(1)"><Plus :size="13" /></button>
    </div>

    <!-- Angle snap (15° increments when rotating with the on-map handle) -->
    <button :class="['mf-ibtn w-6 h-6', angleSnapEnabled && 'mf-ibtn--active']" title="Angle snap (15° increments) when rotating" @click.stop="emit('update:angleSnapEnabled', !angleSnapEnabled)"><Triangle :size="13" /></button>

    <button class="mf-ibtn w-6 h-6" :disabled="!canUndo" title="Undo last caption" @click.stop="emit('undo')"><Undo2 :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" :disabled="!canRedo" title="Redo last caption" @click.stop="emit('redo')"><Redo2 :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" title="Done" @click.stop="emit('done')"><X :size="13" /></button>
  </div>
</template>
