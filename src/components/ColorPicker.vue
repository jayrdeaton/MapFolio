<script setup lang="ts">
defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const PRESET_COLORS = [
  '#06b6d4', // cyan
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#94a3b8' // slate
]
</script>

<template>
  <div class="flex flex-wrap gap-0.5">
    <button v-for="c in PRESET_COLORS" :key="c" class="w-8 h-8 rounded-full cursor-pointer transition-all" :style="{ background: c }" :class="modelValue === c ? 'ring-2 ring-cyan-500' : 'hover:scale-110'" @click="$emit('update:modelValue', c)" />
    <input type="color" :value="modelValue" class="w-8 h-8 p-0.5 cursor-pointer rounded border border-gray-300 dark:border-zinc-700" title="Custom color" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
  </div>
</template>
