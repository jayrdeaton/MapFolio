<script setup lang="ts">
import { Crosshair, Layers, Link, MapPin, Printer, Route } from '@lucide/vue'

const props = defineProps<{
  activeFab: 'style' | 'export' | 'pins' | 'routes' | null
  pinCount: number
  routeCount: number
  isLocating: boolean
}>()

const emit = defineEmits<{
  toggle: [fab: 'style' | 'export' | 'pins' | 'routes']
  locate: []
  share: []
}>()

const fabBase = 'w-11 h-11 rounded-full flex items-center justify-center shadow-md border cursor-pointer transition-all'
const fabDefault = 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
const fabActive = 'bg-cyan-500 text-white border-cyan-500 hover:bg-cyan-600'
</script>

<template>
  <div class="absolute right-4 top-4 z-1000 flex flex-col gap-2 no-print">
    <button
      :class="`${fabBase} ${activeFab === 'pins' ? fabActive : fabDefault} relative`"
      title="Pins"
      @click="emit('toggle', 'pins')"
    >
      <MapPin :size="18" />
      <span
        v-if="pinCount > 0"
        class="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-cyan-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 ring-2 ring-white dark:ring-zinc-950 pointer-events-none"
      >{{ pinCount > 99 ? '99+' : pinCount }}</span>
    </button>
    <button
      :class="`${fabBase} ${activeFab === 'routes' ? fabActive : fabDefault} relative`"
      title="Routes"
      @click="emit('toggle', 'routes')"
    >
      <Route :size="18" />
      <span
        v-if="routeCount > 0"
        class="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-cyan-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 ring-2 ring-white dark:ring-zinc-950 pointer-events-none"
      >{{ routeCount > 99 ? '99+' : routeCount }}</span>
    </button>
    <button
      :class="`${fabBase} ${activeFab === 'style' ? fabActive : fabDefault}`"
      title="Map style"
      @click="emit('toggle', 'style')"
    >
      <Layers :size="18" />
    </button>
    <button
      :class="`${fabBase} ${activeFab === 'export' ? fabActive : fabDefault}`"
      title="Print & export"
      @click="emit('toggle', 'export')"
    >
      <Printer :size="18" />
    </button>
    <button
      :class="`${fabBase} ${fabDefault}`"
      :disabled="isLocating"
      title="Go to my location"
      @click="emit('locate')"
    >
      <Crosshair :size="18" :class="isLocating ? 'animate-spin' : ''" />
    </button>
    <button
      :class="`${fabBase} ${fabDefault}`"
      title="Copy share link"
      @click="emit('share')"
    >
      <Link :size="18" />
    </button>
  </div>
</template>
