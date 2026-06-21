<script setup lang="ts">
import { Eye, EyeOff, Maximize2, Plus, Route as RouteIcon, Trash2 } from '@lucide/vue'
import { ref } from 'vue'

import RouteListItem from '@/components/RouteListItem.vue'
import type { Route as RouteType } from '@/types'
import { routePlaceholder } from '@/utils'

const props = defineProps<{
  routes: RouteType[]
  hiddenRouteIds: Set<number>
  allRoutesHidden: boolean
  drawingRouteId: number | null
  selectedRouteIds: Set<number>
}>()

const distanceUnit = defineModel<'km' | 'mi'>('distanceUnit', { required: true })

const emit = defineEmits<{
  'new-route': []
  'continue-drawing': [routeId: number]
  'edit-route': [route: RouteType]
  'clip-copy-route': [route: RouteType]
  'clip-cut-route': [route: RouteType]
  'delete-route': [routeId: number]
  'toggle-visibility': [routeId: number]
  'toggle-all-visibility': []
  'fit-to-all': []
  'clear-all': []
  reorder: [routes: RouteType[]]
  'select-route': [route: RouteType]
  'toggle-route': [route: RouteType]
  'range-select-routes': [ids: number[]]
}>()

const anchorRouteId = ref<number | null>(null)

function handleRouteSelect(route: RouteType, shiftHeld: boolean, metaHeld: boolean) {
  if (metaHeld) {
    emit('toggle-route', route)
    return
  }
  if (shiftHeld && anchorRouteId.value !== null) {
    const anchorIdx = props.routes.findIndex((r) => r.id === anchorRouteId.value)
    const clickedIdx = props.routes.findIndex((r) => r.id === route.id)
    if (anchorIdx !== -1 && clickedIdx !== -1) {
      const lo = Math.min(anchorIdx, clickedIdx)
      const hi = Math.max(anchorIdx, clickedIdx)
      emit(
        'range-select-routes',
        props.routes.slice(lo, hi + 1).map((r) => r.id)
      )
      return
    }
  }
  anchorRouteId.value = route.id
  emit('select-route', route)
}
</script>

<template>
  <div>
    <!-- Sticky header: title + actions -->
    <div class="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800 px-4 pt-4 pb-2">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide"><RouteIcon :size="12" /> Routes ({{ routes.length }})</span>
        <div class="flex gap-1">
          <button class="mf-ibtn mf-ibtn--primary w-7 h-7" title="New route" @click="emit('new-route')">
            <Plus :size="13" />
          </button>
          <button :disabled="routes.length === 0" class="mf-ibtn w-7 h-7" title="Fit map to visible routes" @click="emit('fit-to-all')">
            <Maximize2 :size="13" />
          </button>
          <button :disabled="routes.length === 0" :class="['mf-ibtn w-7 h-7', !allRoutesHidden && 'mf-ibtn--active']" :title="allRoutesHidden ? 'Show all routes on map' : 'Hide all routes from map'" @click="emit('toggle-all-visibility')">
            <Eye v-if="!allRoutesHidden" :size="13" />
            <EyeOff v-else :size="13" />
          </button>
          <button :disabled="routes.length === 0" class="mf-ibtn mf-ibtn--danger w-7 h-7" title="Delete all routes" @click="emit('clear-all')">
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- Routes list -->
    <div class="py-1">
      <div v-if="routes.length === 0" class="text-xs text-gray-400 dark:text-zinc-600 text-center py-4 px-4">No routes yet - click + to start drawing</div>

      <VueDraggable v-else :model-value="routes" item-key="id" handle=".route-drag-handle" :animation="150" ghost-class="opacity-40" @update:model-value="emit('reorder', $event)">
        <template #item="{ element: route }">
          <RouteListItem :route="route" :hidden="hiddenRouteIds.has(route.id)" :distance-unit="distanceUnit" :selected="selectedRouteIds.has(route.id)" :placeholder="route.name ? undefined : routePlaceholder(route, routes)" @toggle-visibility="emit('toggle-visibility', $event)" @continue-drawing="emit('continue-drawing', $event)" @edit-route="emit('edit-route', $event)" @clip-copy="emit('clip-copy-route', $event)" @clip-cut="emit('clip-cut-route', $event)" @delete-route="emit('delete-route', $event)" @select="handleRouteSelect" />
        </template>
      </VueDraggable>
    </div>

    <!-- Sticky footer: hint + waypoint settings + import/export -->
    <div class="sticky bottom-0 bg-gray-50 dark:bg-zinc-800 border-t border-gray-100 dark:border-zinc-800 px-4 pt-3 pb-4 space-y-3">
      <p class="text-xs text-gray-400 dark:text-zinc-600 text-center">Click + to create a route, then tap the map to add waypoints</p>
      <div class="flex items-center justify-between">
        <span class="block text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide">Distance</span>
        <div class="flex h-7 rounded border border-gray-300 dark:border-zinc-700 overflow-hidden">
          <button v-for="u in ['km', 'mi'] as const" :key="u" :title="`Show distances in ${u === 'km' ? 'kilometers' : 'miles'}`" :class="`px-2 text-xs font-medium cursor-pointer transition-colors ${u === 'mi' ? 'border-l border-gray-300 dark:border-zinc-700' : ''} ${distanceUnit === u ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`" @click="distanceUnit = u">{{ u }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
