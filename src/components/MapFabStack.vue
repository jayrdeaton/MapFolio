<script setup lang="ts">
import { EyeOff, MapPin, Maximize2, Minimize2, Printer, Route, Settings, Type } from '@lucide/vue'

defineProps<{
  activeFab: 'style' | 'export' | 'pins' | 'routes' | 'captions' | null
  focusMode: boolean
  pinCount: number
  routeCount: number
  captionCount: number
  allPinsHidden: boolean
  allRoutesHidden: boolean
  allCaptionsHidden: boolean
  printAreaCount: number
}>()

const emit = defineEmits<{
  toggle: [fab: 'style' | 'export' | 'pins' | 'routes' | 'captions']
  toggleFocus: []
}>()

const fabBase = 'w-11 h-11 rounded-full flex items-center justify-center shadow-md border cursor-pointer transition-all'
const fabDefault = 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
const fabActive = 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700'
</script>

<template>
  <div class="absolute right-2 top-2 z-1000 flex flex-col gap-2 no-print">
    <button :class="`${fabBase} ${fabDefault}`" :title="focusMode ? 'Exit focus mode' : 'Focus mode'" @click="emit('toggleFocus')">
      <Minimize2 v-if="focusMode" :size="18" />
      <Maximize2 v-else :size="18" />
    </button>
    <Transition name="mf-focus-right">
      <div v-if="!focusMode" class="flex flex-col gap-2">
        <button :class="`${fabBase} ${activeFab === 'style' ? fabActive : fabDefault}`" title="Settings" @click="emit('toggle', 'style')">
          <Settings :size="18" />
        </button>
        <button :class="`${fabBase} ${activeFab === 'pins' ? fabActive : fabDefault} relative`" title="Pins" @click="emit('toggle', 'pins')">
          <MapPin :size="18" />
          <span v-if="allPinsHidden" class="absolute -top-1 -right-1 w-[1.1rem] h-[1.1rem] bg-gray-400 dark:bg-zinc-600 text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-zinc-950 pointer-events-none">
            <EyeOff :size="8" />
          </span>
          <span v-else-if="pinCount > 0" class="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-teal-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 ring-2 ring-white dark:ring-zinc-950 pointer-events-none">{{ pinCount > 99 ? '99+' : pinCount }}</span>
        </button>
        <button :class="`${fabBase} ${activeFab === 'routes' ? fabActive : fabDefault} relative`" title="Routes" @click="emit('toggle', 'routes')">
          <Route :size="18" />
          <span v-if="allRoutesHidden" class="absolute -top-1 -right-1 w-[1.1rem] h-[1.1rem] bg-gray-400 dark:bg-zinc-600 text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-zinc-950 pointer-events-none">
            <EyeOff :size="8" />
          </span>
          <span v-else-if="routeCount > 0" class="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-teal-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 ring-2 ring-white dark:ring-zinc-950 pointer-events-none">{{ routeCount > 99 ? '99+' : routeCount }}</span>
        </button>
        <button :class="`${fabBase} ${activeFab === 'captions' ? fabActive : fabDefault} relative`" title="Captions" @click="emit('toggle', 'captions')">
          <Type :size="18" />
          <span v-if="allCaptionsHidden" class="absolute -top-1 -right-1 w-[1.1rem] h-[1.1rem] bg-gray-400 dark:bg-zinc-600 text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-zinc-950 pointer-events-none">
            <EyeOff :size="8" />
          </span>
          <span v-else-if="captionCount > 0" class="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-teal-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 ring-2 ring-white dark:ring-zinc-950 pointer-events-none">{{ captionCount > 99 ? '99+' : captionCount }}</span>
        </button>
        <button :class="`${fabBase} ${activeFab === 'export' ? fabActive : fabDefault} relative`" title="Print" @click="emit('toggle', 'export')">
          <Printer :size="18" />
          <span v-if="printAreaCount > 0 && activeFab !== 'export'" class="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-teal-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 ring-2 ring-white dark:ring-zinc-950 pointer-events-none">{{ printAreaCount > 99 ? '99+' : printAreaCount }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>
