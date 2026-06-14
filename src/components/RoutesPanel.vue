<script setup lang="ts">
import { Eye, EyeOff, FileDown, FileUp, Globe, Maximize2, Pencil, Plus, Trash2, Waypoints } from '@lucide/vue'

import { formatDistance, routeDistanceM } from '@/composables/useRoutes'
import type { Route as RouteType } from '@/types'

const props = defineProps<{
  routes: RouteType[]
  hiddenRouteIds: Set<number>
  allRoutesHidden: boolean
  drawingRouteId: number | null
  distanceUnit: 'km' | 'mi'
}>()

const emit = defineEmits<{
  'new-route': []
  'continue-drawing': [routeId: number]
  'edit-route': [route: RouteType]
  'delete-route': [routeId: number]
  'toggle-visibility': [routeId: number]
  'toggle-all-visibility': []
  'fit-to-all': []
  'clear-all': []
  reorder: [routes: RouteType[]]
  'export-json': []
  'export-geojson': []
  import: []
}>()

function distLabel(route: RouteType): string {
  const m = routeDistanceM(route.points)
  return m > 0 ? formatDistance(m, props.distanceUnit) : '0 pts'
}
</script>

<template>
  <div class="p-4 overflow-y-auto space-y-4">
    <div>
      <div class="flex items-center justify-between mb-2">
        <span class="block text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide"> Routes ({{ routes.length }}) </span>
        <div class="flex gap-1">
          <button class="w-7 h-7 flex items-center justify-center rounded border border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer transition-colors" title="New route" @click="emit('new-route')">
            <Plus :size="13" />
          </button>
          <button v-if="routes.length > 0" class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors" title="Fit map to visible routes" @click="emit('fit-to-all')">
            <Maximize2 :size="13" />
          </button>
          <button v-if="routes.length > 0" :class="`w-7 h-7 flex items-center justify-center rounded border cursor-pointer transition-colors ${!allRoutesHidden ? 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600' : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`" :title="allRoutesHidden ? 'Show all routes on map' : 'Hide all routes from map'" @click="emit('toggle-all-visibility')">
            <Eye v-if="!allRoutesHidden" :size="13" />
            <EyeOff v-else :size="13" />
          </button>
          <button v-if="routes.length > 0" class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-red-300 dark:hover:border-red-800 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors" title="Clear all routes" @click="emit('clear-all')">
            <Trash2 :size="13" />
          </button>
        </div>
      </div>

      <div v-if="routes.length === 0" class="text-xs text-gray-400 dark:text-zinc-600 text-center py-4">No routes yet — click + to start drawing</div>

      <VueDraggable v-else :model-value="routes" item-key="id" handle=".route-drag-handle" :animation="150" ghost-class="opacity-40" class="space-y-1.5" @update:model-value="emit('reorder', $event)">
        <template #item="{ element: route }">
          <div :class="['group flex items-center gap-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-all', hiddenRouteIds.has(route.id) ? 'opacity-40' : '']">
            <!-- Color swatch / drag handle -->
            <div class="route-drag-handle w-3 h-3 rounded-full shrink-0 cursor-grab active:cursor-grabbing" :style="{ background: route.color }" />

            <!-- Name + distance -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-zinc-200 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 truncate transition-colors">
                {{ route.name || 'Unnamed route' }}
              </div>
              <div class="text-xs text-gray-400 dark:text-zinc-500">
                {{ distLabel(route) }}
                <span v-if="route.points.length > 0"> · {{ route.points.length }} pts</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-1 shrink-0">
              <button :class="['w-7 h-7 flex items-center justify-center rounded border cursor-pointer transition-colors', hiddenRouteIds.has(route.id) ? 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800' : 'border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600']" :title="hiddenRouteIds.has(route.id) ? 'Show this route on map' : 'Hide this route from map'" @click="emit('toggle-visibility', route.id)">
                <EyeOff v-if="hiddenRouteIds.has(route.id)" :size="13" />
                <Eye v-else :size="13" />
              </button>
              <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-cyan-500 dark:hover:text-cyan-400 cursor-pointer transition-colors" title="Edit waypoints" @click="emit('continue-drawing', route.id)">
                <Waypoints :size="13" />
              </button>
              <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-cyan-500 dark:hover:text-cyan-400 cursor-pointer transition-colors" title="Edit route" @click="emit('edit-route', route)">
                <Pencil :size="13" />
              </button>
              <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-red-300 dark:hover:border-red-800 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors" title="Delete route" @click="emit('delete-route', route.id)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </template>
      </VueDraggable>
    </div>

    <p class="text-xs text-gray-400 dark:text-zinc-600 text-center">Click + to create a route, then tap the map to add waypoints</p>

    <div class="pt-3 border-t border-gray-100 dark:border-zinc-800">
      <div class="flex items-center justify-between">
        <span class="block text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide">Import / Export</span>
        <div class="flex gap-1">
          <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Export as JSON" :disabled="routes.length === 0" @click="emit('export-json')">
            <FileDown :size="13" />
          </button>
          <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Export as GeoJSON" :disabled="routes.length === 0" @click="emit('export-geojson')">
            <Globe :size="13" />
          </button>
          <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors" title="Import from JSON or GeoJSON" @click="emit('import')">
            <FileUp :size="13" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
