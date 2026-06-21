<script setup lang="ts">
import { Copy, Eye, EyeOff, MapPin, Pencil, Scissors, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'

import ContextMenu from '@/components/ContextMenu.vue'
import RoutePreview from '@/components/RoutePreview.vue'
import { useElementLongPress } from '@/composables/useElementLongPress'
import { formatDistance, routeDistanceM } from '@/composables/useRoutes'
import type { Route as RouteType } from '@/types'

const props = defineProps<{ route: RouteType; hidden?: boolean; distanceUnit: 'km' | 'mi'; selected?: boolean; placeholder?: string }>()
const emit = defineEmits<{
  'toggle-visibility': [routeId: number]
  'continue-drawing': [routeId: number]
  'edit-route': [route: RouteType]
  'clip-copy': [route: RouteType]
  'clip-cut': [route: RouteType]
  'delete-route': [routeId: number]
  select: [route: RouteType, shiftHeld: boolean, metaHeld: boolean]
}>()

const distLabel = computed(() => {
  const m = routeDistanceM(props.route.points)
  return m > 0 ? formatDistance(m, props.distanceUnit) : '0 pts'
})

const rowRef = ref<HTMLElement | null>(null)
const menu = ref<InstanceType<typeof ContextMenu> | null>(null)

function openMenu(x: number, y: number) {
  menu.value?.openAt(x, y)
}
useElementLongPress(rowRef, openMenu)
</script>

<template>
  <div ref="rowRef" :class="['group flex items-center gap-2 px-4 py-1.5 transition-all', selected ? 'bg-cyan-50 dark:bg-cyan-900/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60', hidden ? 'opacity-40' : '']" @mousedown="($event.shiftKey || $event.metaKey || $event.ctrlKey) && $event.preventDefault()" @contextmenu.prevent="openMenu($event.clientX, $event.clientY)">
    <!-- Style preview / drag handle -->
    <div class="route-drag-handle shrink-0 cursor-grab active:cursor-grabbing" title="Drag to reorder">
      <RoutePreview :color="route.color" :line-style="route.lineStyle ?? 'solid'" :waypoint-style="route.waypointStyle ?? 'circle'" :waypoint-size="route.waypointSize ?? 'm'" :waypoint-show-number="route.waypointShowNumber" preview />
    </div>

    <!-- Name + distance -->
    <div class="flex-1 min-w-0 cursor-pointer" :title="`Select ${route.name || 'route'}`" @click="emit('select', route, $event.shiftKey, $event.metaKey || $event.ctrlKey)">
      <div class="text-sm font-medium truncate transition-colors" :class="route.name ? 'text-gray-800 dark:text-zinc-200 group-hover:text-cyan-500 dark:group-hover:text-cyan-400' : 'text-gray-400 dark:text-zinc-500 italic'">{{ route.name || placeholder || 'Unnamed route' }}</div>
      <div class="text-xs text-gray-400 dark:text-zinc-500">
        {{ distLabel }}<span v-if="route.points.length > 0"> · {{ route.points.length }} pts</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-1 shrink-0">
      <button class="mf-ibtn w-7 h-7" :title="hidden ? 'Show this route on map' : 'Hide this route from map'" @click="emit('toggle-visibility', route.id)">
        <EyeOff v-if="hidden" :size="13" />
        <Eye v-else :size="13" />
      </button>
      <ContextMenu ref="menu">
        <button class="mf-menu-item" @click="emit('edit-route', route)"><Pencil :size="14" /> Edit Route</button>
        <button class="mf-menu-item" @click="emit('continue-drawing', route.id)"><MapPin :size="14" /> Add Waypoints</button>
        <button class="mf-menu-item" @click="emit('clip-copy', route)"><Copy :size="14" /> Copy Route</button>
        <button class="mf-menu-item" @click="emit('clip-cut', route)"><Scissors :size="14" /> Cut Route</button>
        <button class="mf-menu-item mf-menu-item--danger" @click="emit('delete-route', route.id)"><Trash2 :size="14" /> Delete Route</button>
      </ContextMenu>
    </div>
  </div>
</template>
