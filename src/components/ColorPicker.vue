<script setup lang="ts">
const props = defineProps<{ modelValue: string; hideTransparent?: boolean }>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const PRESET_COLORS = [
  '#ffffff', // white
  '#000000', // black
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#14b8a6', // teal
  '#0d9488', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899' // pink
]

const isCustom = computed(() => {
  const presets = new Set(['transparent', '#6b7280', ...PRESET_COLORS])
  return !presets.has(props.modelValue)
})
</script>

<template>
  <div class="flex gap-0.5">
    <!-- Custom color input -->
    <div class="relative flex-1 aspect-square">
      <input type="color" :value="modelValue === 'transparent' ? '#ffffff' : modelValue" class="w-full h-full p-0.5 cursor-pointer rounded border border-gray-300 dark:border-zinc-700 block" title="Custom color" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
      <span v-if="isCustom" class="pointer-events-none absolute inset-0 flex items-center justify-center text-white text-xs drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">✓</span>
    </div>
    <!-- Transparent -->
    <button v-if="!hideTransparent" class="relative flex-1 aspect-square rounded-full cursor-pointer transition-all border border-gray-900/10 dark:border-white/20 overflow-hidden hover:scale-110" title="No color" @click="$emit('update:modelValue', 'transparent')">
      <span class="absolute inset-0" style="background: repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 8px 8px" />
      <span v-if="modelValue === 'transparent'" class="absolute inset-0 flex items-center justify-center text-teal-600 text-xs font-bold">✓</span>
    </button>
    <!-- Grey (when transparent is hidden) -->
    <button v-else class="relative flex-1 aspect-square rounded-full cursor-pointer transition-all border border-gray-900/10 dark:border-white/20 hover:scale-110" style="background: #6b7280" title="Grey" @click="$emit('update:modelValue', '#6b7280')">
      <span v-if="modelValue === '#6b7280'" class="absolute inset-0 flex items-center justify-center text-white text-xs drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">✓</span>
    </button>
    <!-- Preset colors -->
    <button v-for="c in PRESET_COLORS" :key="c" class="relative flex-1 aspect-square rounded-full cursor-pointer transition-all border border-gray-900/10 dark:border-white/20 hover:scale-110" :style="{ background: c }" @click="$emit('update:modelValue', c)">
      <span v-if="modelValue === c" class="absolute inset-0 flex items-center justify-center text-white text-xs drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">✓</span>
    </button>
  </div>
</template>
