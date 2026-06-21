<script setup lang="ts">
import { Magnet, Redo2, Triangle, Undo2, X } from '@lucide/vue'

import RoutePreview from '@/components/RoutePreview.vue'
import type { Route } from '@/types'

const props = defineProps<{
  route: Route
  distance: string
  snapEnabled: boolean
  angleSnapEnabled: boolean
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  'update:snapEnabled': [value: boolean]
  'update:angleSnapEnabled': [value: boolean]
  undo: []
  redo: []
  done: []
}>()

const shiftHeld = ref(false)

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Shift') shiftHeld.value = true
}
function onKeyUp(e: KeyboardEvent) {
  if (e.key === 'Shift') shiftHeld.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

const effectiveAngleSnap = computed(() => props.angleSnapEnabled !== shiftHeld.value)
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-2 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg no-print pointer-events-auto">
    <RoutePreview :color="route.color" :line-style="route.lineStyle ?? 'solid'" :waypoint-style="route.waypointStyle ?? 'circle'" :waypoint-size="route.waypointSize ?? 'm'" :waypoint-show-number="route.waypointShowNumber" preview class="shrink-0" />
    {{ route.name }}
    <span v-if="distance" class="font-normal opacity-60">· {{ distance }}</span>
    <button :class="['mf-ibtn w-6 h-6', snapEnabled && 'mf-ibtn--active']" title="Snap waypoints to pins" @click.stop="emit('update:snapEnabled', !snapEnabled)"><Magnet :size="13" /></button>
    <button :class="['mf-ibtn w-6 h-6', effectiveAngleSnap && 'mf-ibtn--active']" title="Angle snap (15° increments, Shift to toggle)" @click.stop="emit('update:angleSnapEnabled', !angleSnapEnabled)"><Triangle :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" :disabled="!canUndo" title="Undo last point" @click.stop="emit('undo')"><Undo2 :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" :disabled="!canRedo" title="Redo last point" @click.stop="emit('redo')"><Redo2 :size="13" /></button>
    <button class="mf-ibtn w-6 h-6" title="Done" @click.stop="emit('done')"><X :size="13" /></button>
  </div>
</template>
