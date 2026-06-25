<script setup lang="ts">
import ColorPicker from '@/components/ColorPicker.vue'

const shape = defineModel<'circle' | 'square' | 'diamond' | 'none'>('shape', { required: true })
const size = defineModel<string>('size', { required: true })
const showNumber = defineModel<boolean>('showNumber', { required: true })
const color = defineModel<string>('color', { required: true })

const props = defineProps<{
  sizes: string[]
  numberDisabledSizes?: string[]
  withColorPicker?: boolean
  // Include a "None" option (used for route waypoints; not for pins).
  withNone?: boolean
}>()

const BASE_SHAPES = [
  { value: 'circle' as const, label: 'Circle' },
  { value: 'square' as const, label: 'Square' },
  { value: 'diamond' as const, label: 'Diamond' }
]
const SHAPES = computed(() => (props.withNone ? [{ value: 'none' as const, label: 'None' }, ...BASE_SHAPES] : BASE_SHAPES))

function selectSize(s: string) {
  size.value = s
  if (showNumber.value && props.numberDisabledSizes?.includes(s)) {
    showNumber.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex gap-1.5">
      <button :disabled="shape === 'none' || numberDisabledSizes?.includes(size)" :class="['flex items-center justify-center h-8 w-8 shrink-0 rounded border text-xs font-bold transition-colors', shape === 'none' || numberDisabledSizes?.includes(size) ? 'border-gray-200 dark:border-zinc-700 text-gray-300 dark:text-zinc-600 cursor-not-allowed' : showNumber ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 cursor-pointer' : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-pointer']" title="Show number" @click="shape !== 'none' && !numberDisabledSizes?.includes(size) && (showNumber = !showNumber)">#</button>
      <div class="w-px self-stretch bg-gray-200 dark:bg-zinc-700 shrink-0" />
      <button v-for="s in SHAPES" :key="s.value" :class="['flex flex-1 items-center justify-center h-8 px-1 rounded border transition-colors cursor-pointer', shape === s.value ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400' : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500']" @click="shape = s.value">
        <svg width="36" height="16" class="overflow-visible">
          <circle v-if="s.value === 'circle'" cx="18" cy="7" r="5" fill="currentColor" />
          <rect v-else-if="s.value === 'square'" x="13" y="2" width="10" height="10" rx="1.5" fill="currentColor" />
          <rect v-else-if="s.value === 'diamond'" x="13" y="2" width="10" height="10" rx="1.5" fill="currentColor" transform="rotate(45 18 7)" />
          <circle v-else cx="18" cy="7" r="5" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-dasharray="3 2" />
        </svg>
      </button>
    </div>
    <div class="flex gap-1.5 mt-2">
      <button v-for="s in sizes" :key="s" :disabled="shape === 'none'" :class="`flex-1 py-2 rounded border text-xs font-medium transition-colors ${shape === 'none' ? 'border-gray-200 dark:border-zinc-700 text-gray-300 dark:text-zinc-600 cursor-not-allowed' : size === s ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 cursor-pointer' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer'}`" @click="shape !== 'none' && selectSize(s)">{{ s.toUpperCase() }}</button>
    </div>
    <div v-if="withColorPicker" class="mt-2">
      <ColorPicker v-model="color" />
    </div>
  </div>
</template>
