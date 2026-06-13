<script setup lang="ts">
import { Maximize2, Pencil, Plus, Route, Trash2 } from '@lucide/vue'
import type { Route as RouteType } from '../types'
import { routeDistanceM, formatDistance } from '../composables/useRoutes'

const props = defineProps<{
  routes: RouteType[]
  drawingRouteId: number | null
  distanceUnit: 'km' | 'mi'
}>()

const emit = defineEmits<{
  'new-route': []
  'continue-drawing': [routeId: number]
  'fit-to-route': [route: RouteType]
  'edit-route': [route: RouteType]
  'delete-route': [routeId: number]
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
        <span class="block text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide">
          Routes ({{ routes.length }})
        </span>
        <button
          class="w-7 h-7 flex items-center justify-center rounded border border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer transition-colors"
          title="New route"
          @click="emit('new-route')"
        >
          <Plus :size="13" />
        </button>
      </div>

      <div v-if="routes.length === 0" class="text-xs text-gray-400 dark:text-zinc-600 text-center py-4">
        No routes yet — click + to start drawing
      </div>

      <div v-else class="space-y-1.5">
        <div
          v-for="route in routes"
          :key="route.id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700"
        >
          <!-- Color swatch -->
          <div class="w-3 h-3 rounded-full shrink-0" :style="{ background: route.color }" />

          <!-- Name + distance -->
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">
              {{ route.name || 'Unnamed route' }}
            </div>
            <div class="text-xs text-gray-400 dark:text-zinc-500">
              {{ distLabel(route) }}
              <span v-if="route.points.length > 0"> · {{ route.points.length }} pts</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-0.5 shrink-0">
            <button
              v-if="route.points.length > 0"
              class="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Fit map to route"
              @click="emit('fit-to-route', route)"
            >
              <Maximize2 :size="12" />
            </button>
            <button
              class="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Edit route"
              @click="emit('edit-route', route)"
            >
              <Pencil :size="12" />
            </button>
            <button
              class="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
              title="Delete route"
              @click="emit('delete-route', route.id)"
            >
              <Trash2 :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <p class="text-xs text-gray-400 dark:text-zinc-600 text-center">
      Click + to create a route, then tap the map to add waypoints
    </p>
  </div>
</template>
