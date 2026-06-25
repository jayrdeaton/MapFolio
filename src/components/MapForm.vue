<script setup lang="ts">
import { Map, Trash2, X } from '@lucide/vue'

import type { MapData } from '@/types'

const props = defineProps<{
  show: boolean
  editingMap: MapData | null
  autoArea: string
  canDelete?: boolean
}>()

const emit = defineEmits<{
  save: [name: string, area: string]
  delete: []
  close: []
}>()

const name = ref('')
const area = ref('')

watch(
  () => props.editingMap,
  (map) => {
    if (!map) return
    name.value = map.name
    area.value = map.area ?? ''
  },
  { immediate: true }
)

function save() {
  if (!props.editingMap) return
  emit('save', name.value.trim() || props.editingMap.name, area.value.trim())
}

const inputClass = 'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20'
const sectionLabelClass = 'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const btnBase = 'px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer'
</script>

<template>
  <div v-if="show && editingMap" class="fixed bottom-0 left-0 right-0 z-1800 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl no-print max-h-[90vh] overflow-y-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-110 sm:rounded-2xl">
    <div class="p-4 pb-8">
      <div class="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full mx-auto mb-4" />

      <div class="flex items-center gap-3 mb-4">
        <div class="shrink-0 w-11 h-11 flex items-center justify-center text-gray-400 dark:text-zinc-500">
          <Map :size="22" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-gray-900 dark:text-zinc-100 text-lg font-bold leading-tight">Edit Map</h2>
        </div>
        <button class="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label :class="sectionLabelClass">Name</label>
          <input v-model="name" :class="inputClass" type="text" placeholder="My Map" @keydown.enter="save" />
        </div>

        <div>
          <label :class="sectionLabelClass">Area</label>
          <input v-model="area" :class="inputClass" type="text" :placeholder="autoArea || 'e.g. Yellowstone, Wyoming'" @keydown.enter="save" />
          <p class="mt-1 text-xs text-gray-400 dark:text-zinc-500">Auto-detected from map center · used as subtitle on printed maps</p>
        </div>

        <div class="border-t border-gray-100 dark:border-zinc-800" />

        <div class="flex gap-2">
          <button v-if="canDelete" :class="`${btnBase} justify-center px-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50`" @click="emit('delete')"><Trash2 :size="15" /> Delete</button>
          <button :class="`${btnBase} flex-1 justify-center bg-teal-600 text-white hover:bg-teal-700`" @click="save">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>
