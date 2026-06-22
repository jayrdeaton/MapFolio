<script setup lang="ts">
import { Trash2, X } from '@lucide/vue'

import DotPicker from '@/components/DotPicker.vue'
import RoutePreview from '@/components/RoutePreview.vue'
import { formatDistance, routeDistanceM } from '@/composables/useRoutes'
import type { Route, RouteLineStyle, RouteWaypointSize, RouteWaypointStyle } from '@/types'

const props = defineProps<{
  show: boolean
  editingRoute: Route | null
  distanceUnit: 'km' | 'mi'
  namePlaceholder?: string
}>()

const emit = defineEmits<{
  save: [route: Route]
  delete: []
  close: []
}>()

const name = ref('')
const color = ref('#06b6d4')
const lineStyle = ref<RouteLineStyle>('solid')
const waypointStyle = ref<RouteWaypointStyle>('circle')
const waypointShowNumber = ref(false)
const waypointSize = ref<RouteWaypointSize>('m')

const LINE_STYLES: { value: RouteLineStyle; label: string; dasharray?: string; strokeWidth?: number; arrow?: boolean; double?: boolean }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed', dasharray: '12 8' },
  { value: 'dotted', label: 'Dotted', dasharray: '1 9', strokeWidth: 4 },
  { value: 'long-dash', label: 'Long Dash', dasharray: '22 10' },
  { value: 'dash-dot', label: 'Dash-dot', dasharray: '14 5 2 5' },
  { value: 'arrow', label: 'Arrow', arrow: true },
  { value: 'double', label: 'Double', double: true },
  { value: 'none', label: 'None' }
]

watch(
  () => props.editingRoute,
  (route) => {
    if (!route) return
    name.value = route.name
    color.value = route.color
    lineStyle.value = route.lineStyle ?? 'solid'
    const raw = route.waypointStyle as string | undefined
    waypointStyle.value = (raw === 'number' ? 'circle' : (raw ?? 'circle')) as RouteWaypointStyle
    waypointShowNumber.value = raw === 'number' ? true : (route.waypointShowNumber ?? false)
    waypointSize.value = route.waypointSize ?? 'm'
  },
  { immediate: true }
)

const dotSize = computed({
  get: () => waypointSize.value as string,
  set: (v: string) => {
    waypointSize.value = v as RouteWaypointSize
  }
})

function save() {
  if (!props.editingRoute) return
  emit('save', { ...props.editingRoute, name: name.value.trim(), color: color.value, lineStyle: lineStyle.value, waypointStyle: waypointStyle.value, waypointShowNumber: waypointShowNumber.value, waypointSize: waypointSize.value })
}

const inputClass = 'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
const sectionLabelClass = 'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const btnBase = 'px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer'

defineExpose({ save })
</script>

<template>
  <div v-if="show" class="fixed bottom-0 left-0 right-0 z-1800 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl no-print max-h-[90vh] overflow-y-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-110 sm:rounded-2xl">
    <div class="p-4 pb-8">
      <div class="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full mx-auto mb-4" />

      <div class="flex items-center gap-3 mb-4">
        <RoutePreview :color="color" :line-style="lineStyle" :waypoint-style="waypointStyle" :waypoint-size="waypointSize" :waypoint-show-number="waypointShowNumber" />
        <div class="flex-1 min-w-0">
          <h2 class="text-gray-900 dark:text-zinc-100 text-lg font-bold leading-tight">Edit Route</h2>
          <p v-if="editingRoute" class="text-xs text-gray-400 dark:text-zinc-500">
            {{ editingRoute.points.length }} waypoint{{ editingRoute.points.length !== 1 ? 's' : '' }}
            <template v-if="editingRoute.points.length > 1"> · {{ formatDistance(routeDistanceM(editingRoute.points), distanceUnit) }} </template>
          </p>
        </div>
        <button class="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label :class="sectionLabelClass">Name</label>
          <input v-model="name" type="text" :placeholder="namePlaceholder || 'Name this route…'" :class="inputClass" @keydown.enter="save" />
        </div>

        <div>
          <label :class="sectionLabelClass">Line Style</label>
          <div class="grid grid-cols-4 gap-1.5">
            <button v-for="s in LINE_STYLES" :key="s.value" :disabled="s.value === 'none' && waypointStyle === 'none'" :title="s.value === 'none' && waypointStyle === 'none' ? 'Enable waypoints first' : s.label" :class="['flex flex-col items-center gap-1.5 py-2 px-1 rounded border transition-colors', s.value === 'none' && waypointStyle === 'none' ? 'border-gray-200 dark:border-zinc-700 opacity-40 cursor-not-allowed' : lineStyle === s.value ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 cursor-pointer' : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer']" @click="!(s.value === 'none' && waypointStyle === 'none') && (lineStyle = s.value)">
              <svg width="36" height="10" class="overflow-visible">
                <template v-if="s.value === 'none'">
                  <line x1="2" y1="5" x2="34" y2="5" stroke="#d1d5db" stroke-width="1.5" stroke-dasharray="3 3" />
                </template>
                <template v-else-if="s.arrow">
                  <line x1="2" y1="5" x2="22" y2="5" :stroke="color" stroke-width="2.5" stroke-linecap="round" />
                  <polygon points="22,1 34,5 22,9" :fill="color" stroke="white" stroke-width="1.5" stroke-linejoin="round" />
                </template>
                <template v-else-if="s.double">
                  <line x1="2" y1="3" x2="34" y2="3" :stroke="color" stroke-width="2" stroke-linecap="round" />
                  <line x1="2" y1="7" x2="34" y2="7" :stroke="color" stroke-width="2" stroke-linecap="round" />
                </template>
                <template v-else>
                  <line x1="2" y1="5" x2="34" y2="5" :stroke="color" :stroke-width="s.strokeWidth ?? 2.5" stroke-linecap="round" :stroke-dasharray="s.dasharray" />
                </template>
              </svg>
              <span class="text-xs text-gray-500 dark:text-zinc-400">{{ s.label }}</span>
            </button>
          </div>
        </div>

        <div>
          <label :class="sectionLabelClass">Waypoints</label>
          <DotPicker v-model:shape="waypointStyle" v-model:size="dotSize" v-model:show-number="waypointShowNumber" v-model:color="color" :sizes="['xs', 's', 'm', 'l', 'xl']" :with-color-picker="true" with-none />
        </div>

        <div class="border-t border-gray-100 dark:border-zinc-800" />

        <div class="flex gap-2">
          <button :class="`${btnBase} justify-center px-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50`" @click="emit('delete')"><Trash2 :size="15" /> Delete</button>
          <button :class="`${btnBase} flex-1 justify-center bg-cyan-500 text-white hover:bg-cyan-600`" @click="save">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>
