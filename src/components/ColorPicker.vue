<script setup lang="ts">
defineProps<{ modelValue: string; hideTransparent?: boolean }>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const PRESET_COLORS = [
  '#ffffff', // white
  '#000000', // black
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
]
</script>

<template>
  <div class="flex flex-wrap gap-0.5">
    <input type="color" :value="modelValue === 'transparent' ? '#ffffff' : modelValue" class="w-8 h-8 p-0.5 cursor-pointer rounded border border-gray-300 dark:border-zinc-700" title="Custom color" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
    <!-- Transparent / no color — swaps for grey when transparent is hidden -->
    <button
      v-if="!hideTransparent"
      class="w-8 h-8 rounded-full cursor-pointer transition-all border border-gray-900/10 dark:border-white/20 overflow-hidden relative"
      :class="modelValue === 'transparent' ? 'ring-2 ring-cyan-500' : 'hover:scale-110'"
      title="No color"
      @click="$emit('update:modelValue', 'transparent')"
    >
      <span class="absolute inset-0" style="background: repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 8px 8px" />
    </button>
    <button
      v-else
      class="w-8 h-8 rounded-full cursor-pointer transition-all border border-gray-900/10 dark:border-white/20"
      :class="modelValue === '#6b7280' ? 'ring-2 ring-cyan-500' : 'hover:scale-110'"
      style="background: #6b7280"
      title="Grey"
      @click="$emit('update:modelValue', '#6b7280')"
    />
    <button v-for="c in PRESET_COLORS" :key="c" class="w-8 h-8 rounded-full cursor-pointer transition-all border border-gray-900/10 dark:border-white/20" :style="{ background: c }" :class="modelValue === c ? 'ring-2 ring-cyan-500' : 'hover:scale-110'" @click="$emit('update:modelValue', c)" />
  </div>
</template>
