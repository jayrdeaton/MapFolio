<script setup lang="ts">
import ColorPicker from '@/components/ColorPicker.vue'

const shape = defineModel<'circle' | 'square' | 'diamond' | 'none'>('shape', { required: true })
const size = defineModel<string>('size', { required: true })
const showNumber = defineModel<boolean>('showNumber', { required: true })
const color = defineModel<string>('color', { required: true })

const props = defineProps<{
  sizes: string[]
  numberDisabledSizes?: string[]
  noneDisabled?: boolean
  withColorPicker?: boolean
  // Dots get a white contrast ring by default; pass ring=false to render them ringless.
  ring?: boolean
}>()

const dotStroke = computed(() => (props.ring === false ? 'none' : 'white'))

const SHAPES = [
  { value: 'none' as const, label: 'None' },
  { value: 'circle' as const, label: 'Circle' },
  { value: 'square' as const, label: 'Square' },
  { value: 'diamond' as const, label: 'Diamond' }
]

function selectSize(s: string) {
  size.value = s
  if (showNumber.value && props.numberDisabledSizes?.includes(s)) {
    showNumber.value = false
  }
}
</script>

<template>
  <div>
    <div class="grid grid-cols-4 gap-1.5">
      <button v-for="s in SHAPES" :key="s.value" :disabled="s.value === 'none' && noneDisabled" :title="s.value === 'none' && noneDisabled ? 'Enable icon first' : undefined" :class="['flex flex-col items-center gap-1.5 py-2 px-1 rounded border transition-colors', s.value === 'none' && noneDisabled ? 'border-gray-200 dark:border-zinc-700 opacity-40 cursor-not-allowed' : shape === s.value ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 cursor-pointer' : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer']" @click="!(s.value === 'none' && noneDisabled) && (shape = s.value)">
        <svg width="36" height="14" class="overflow-visible">
          <circle v-if="s.value === 'circle'" cx="18" cy="7" r="5" :fill="color" :stroke="dotStroke" stroke-width="2" />
          <rect v-else-if="s.value === 'square'" x="13" y="2" width="10" height="10" rx="1.5" :fill="color" :stroke="dotStroke" stroke-width="2" />
          <rect v-else-if="s.value === 'diamond'" x="13" y="2" width="10" height="10" rx="1.5" :fill="color" :stroke="dotStroke" stroke-width="2" transform="rotate(45 18 7)" />
          <circle v-else cx="18" cy="7" r="5" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-dasharray="3 2" />
        </svg>
        <span class="text-xs text-gray-500 dark:text-zinc-400">{{ s.label }}</span>
      </button>
    </div>
    <div class="flex gap-1.5 mt-1.5">
      <button :disabled="shape === 'none' || numberDisabledSizes?.includes(size)" :class="`w-8 py-1 rounded border text-xs font-medium transition-colors shrink-0 ${shape === 'none' || numberDisabledSizes?.includes(size) ? 'border-gray-200 dark:border-zinc-700 text-gray-300 dark:text-zinc-600 cursor-not-allowed' : showNumber ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 cursor-pointer' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer'}`" title="Show number" @click="shape !== 'none' && !numberDisabledSizes?.includes(size) && (showNumber = !showNumber)">#</button>
      <button v-for="s in sizes" :key="s" :disabled="shape === 'none'" :class="`flex-1 py-1 rounded border text-xs font-medium transition-colors ${shape === 'none' ? 'border-gray-200 dark:border-zinc-700 text-gray-300 dark:text-zinc-600 cursor-not-allowed' : size === s ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 cursor-pointer' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer'}`" @click="shape !== 'none' && selectSize(s)">{{ s.toUpperCase() }}</button>
    </div>
    <div v-if="withColorPicker" class="mt-1.5">
      <span class="block mb-1 mt-0.5 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide">Color</span>
      <ColorPicker v-model="color" />
    </div>
  </div>
</template>
