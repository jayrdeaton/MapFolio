<script setup lang="ts">
import { MapPin, Pencil, Trash2, X } from '@lucide/vue'

import RoutePreview from '@/components/RoutePreview.vue'
import type { Pin, Route } from '@/types'

const props = defineProps<{
  route: Route
  pointIndex: number
  linkedPin: Pin | null
}>()

const emit = defineEmits<{
  'edit-route': []
  'edit-pin': []
  delete: []
  clear: []
}>()

const label = computed(() => props.linkedPin?.name || `Waypoint ${props.pointIndex + 1}`)
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1100 w-max sm:w-auto flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-2xl sm:rounded-full shadow-lg no-print pointer-events-auto max-w-[calc(100vw-5rem)]">
    <!-- Identity -->
    <div class="flex items-center gap-2 w-full sm:w-auto min-w-0">
      <RoutePreview :color="route.color" :line-style="route.lineStyle ?? 'solid'" :waypoint-style="route.waypointStyle ?? 'circle'" :waypoint-size="route.waypointSize ?? 'm'" :waypoint-show-number="route.waypointShowNumber" preview class="shrink-0" />
      <span class="truncate min-w-0 sm:max-w-48">{{ label }}</span>
      <button class="sm:hidden ml-auto w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" title="Close" @click.stop="emit('clear')">
        <X :size="13" />
      </button>
    </div>

    <!-- Divider (mobile only) -->
    <div class="w-full border-t border-gray-100 dark:border-zinc-700 sm:hidden" />

    <!-- Actions -->
    <div class="flex items-center gap-1.5 sm:gap-2">
      <button v-if="linkedPin" title="Edit pin" class="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" @click.stop="emit('edit-pin')">
        <MapPin :size="13" />
      </button>
      <button title="Edit route" class="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" @click.stop="emit('edit-route')">
        <Pencil :size="13" />
      </button>
      <button title="Delete waypoint" class="w-6 h-6 flex items-center justify-center rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors shrink-0" @click.stop="emit('delete')">
        <Trash2 :size="13" />
      </button>
      <button class="hidden sm:flex w-6 h-6 items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" title="Close" @click.stop="emit('clear')">
        <X :size="13" />
      </button>
    </div>
  </div>
</template>
