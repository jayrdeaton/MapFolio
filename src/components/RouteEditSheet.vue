<script setup lang="ts">
import { ref, watch } from 'vue'
import { Trash2, X } from '@lucide/vue'
import type { Route } from '../types'
import { routeDistanceM, formatDistance } from '../composables/useRoutes'

const props = defineProps<{
  show: boolean
  editingRoute: Route | null
  distanceUnit: 'km' | 'mi'
}>()

const emit = defineEmits<{
  save: [route: Route]
  delete: []
  close: []
}>()

const PRESET_COLORS = [
  '#06b6d4', // cyan
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#94a3b8', // slate
]

const name = ref('')
const color = ref('#06b6d4')

watch(
  () => props.editingRoute,
  route => {
    if (!route) return
    name.value = route.name
    color.value = route.color
  },
  { immediate: true }
)

function save() {
  if (!props.editingRoute) return
  emit('save', { ...props.editingRoute, name: name.value.trim() || 'Unnamed route', color: color.value })
}

const inputClass =
  'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
const sectionLabelClass =
  'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const btnBase = 'px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer'
</script>

<template>
  <div
    v-if="show"
    class="fixed bottom-0 left-0 right-0 z-1800 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl no-print max-h-[90vh] overflow-y-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-96 sm:rounded-2xl"
  >
    <div class="p-4 pb-8">
      <div class="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full mx-auto mb-4" />

      <div class="flex items-center gap-3 mb-4">
        <div class="w-4 h-4 rounded-full shrink-0 ring-2 ring-white dark:ring-zinc-900 shadow" :style="{ background: color }" />
        <div class="flex-1 min-w-0">
          <h2 class="text-gray-900 dark:text-zinc-100 text-lg font-bold leading-tight">Edit Route</h2>
          <p v-if="editingRoute" class="text-xs text-gray-400 dark:text-zinc-500">
            {{ editingRoute.points.length }} waypoint{{ editingRoute.points.length !== 1 ? 's' : '' }}
            <template v-if="editingRoute.points.length > 1">
              · {{ formatDistance(routeDistanceM(editingRoute.points), distanceUnit) }}
            </template>
          </p>
        </div>
        <button
          class="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label :class="sectionLabelClass">Route Name</label>
          <input
            v-model="name"
            type="text"
            placeholder="Name this route…"
            :class="inputClass"
            @keydown.enter="save"
          />
        </div>

        <div>
          <label :class="sectionLabelClass">Color</label>
          <div class="flex items-center gap-2">
            <button
              v-for="c in PRESET_COLORS"
              :key="c"
              class="w-7 h-7 rounded-full cursor-pointer transition-transform hover:scale-110"
              :style="{ background: c }"
              :class="color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-zinc-500 scale-110' : ''"
              @click="color = c"
            />
            <input
              type="color"
              v-model="color"
              class="w-9 h-7 p-0.5 cursor-pointer rounded border border-gray-300 dark:border-zinc-700 ml-1"
              title="Custom color"
            />
          </div>
        </div>

        <div class="flex gap-2 pt-1">
          <button
            :class="`${btnBase} justify-center px-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50`"
            @click="emit('delete')"
          >
            <Trash2 :size="15" /> Delete
          </button>
          <button
            :class="`${btnBase} flex-1 justify-center bg-cyan-500 text-white hover:bg-cyan-600`"
            @click="save"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
