<script setup lang="ts">
import { Check, Copy, FileDown, FileUp, Globe, Map, Pencil, Plus, Trash2, X } from '@lucide/vue'

import type { MapData } from '@/types'

defineProps<{
  maps: MapData[]
  activeId: string
}>()

const emit = defineEmits<{
  switch: [id: string]
  create: [name: string]
  rename: [id: string, name: string]
  duplicate: [id: string]
  delete: [id: string]
  export: [id: string]
  'export-geojson': [id: string]
  'export-all': []
  import: []
  close: []
}>()

const renamingId = ref<string | null>(null)
const renameValue = ref('')
const newMapName = ref('')
const showNewInput = ref(false)
const confirmDeleteId = ref<string | null>(null)
const showExportPicker = ref(false)

function exportAll() {
  emit('export-all')
  showExportPicker.value = false
}

function exportMap(id: string) {
  emit('export', id)
  showExportPicker.value = false
}

function exportGeoJson(id: string) {
  emit('export-geojson', id)
  showExportPicker.value = false
}

function startRename(map: MapData) {
  renamingId.value = map.id
  renameValue.value = map.name
  nextTick(() => {
    const el = document.getElementById(`rename-${map.id}`)
    el?.focus()
    ;(el as HTMLInputElement)?.select()
  })
}

function commitRename(id: string) {
  const name = renameValue.value.trim()
  if (name) emit('rename', id, name)
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

function submitNew() {
  const name = newMapName.value.trim() || 'New Map'
  emit('create', name)
  newMapName.value = ''
  showNewInput.value = false
}

function cancelNew() {
  newMapName.value = ''
  showNewInput.value = false
}

function confirmDelete(id: string) {
  confirmDeleteId.value = id
}

function doDelete(id: string) {
  confirmDeleteId.value = null
  emit('delete', id)
}

const sectionLabelClass = 'block text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
</script>

<template>
  <div class="p-4 overflow-y-auto space-y-3">
    <!-- Header row -->
    <div class="flex items-center justify-between">
      <span :class="sectionLabelClass">Maps ({{ maps.length }})</span>
      <div class="flex gap-1">
        <button class="w-7 h-7 flex items-center justify-center rounded border border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer transition-colors" title="New map" @click="showNewInput = true">
          <Plus :size="13" />
        </button>
      </div>
    </div>

    <!-- New map input -->
    <div v-if="showNewInput" class="flex gap-1.5">
      <input v-model="newMapName" placeholder="Map name…" class="flex-1 py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" autofocus @keydown.enter="submitNew" @keydown.escape="cancelNew" />
      <button class="w-7 h-7 flex items-center justify-center rounded border border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer transition-colors shrink-0" title="Create" @click="submitNew">
        <Check :size="13" />
      </button>
      <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors shrink-0" title="Cancel" @click="cancelNew">
        <X :size="13" />
      </button>
    </div>

    <!-- Map list -->
    <div class="space-y-0.5">
      <div v-for="map in maps" :key="map.id">
        <!-- Rename mode -->
        <div v-if="renamingId === map.id" class="flex gap-1.5 py-1">
          <input :id="`rename-${map.id}`" v-model="renameValue" class="flex-1 py-1 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" @keydown.enter="commitRename(map.id)" @keydown.escape="cancelRename" @blur="commitRename(map.id)" />
          <button class="w-7 h-7 flex items-center justify-center rounded border border-cyan-400 bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer transition-colors shrink-0" @mousedown.prevent="commitRename(map.id)">
            <Check :size="13" />
          </button>
        </div>

        <!-- Delete confirm -->
        <div v-else-if="confirmDeleteId === map.id" class="flex items-center gap-2 py-1.5 rounded bg-red-50 dark:bg-red-950/20">
          <span class="flex-1 text-sm text-red-600 dark:text-red-400 truncate">Delete "{{ map.name }}"?</span>
          <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors shrink-0" title="Cancel" @click="confirmDeleteId = null">
            <X :size="13" />
          </button>
          <button class="w-7 h-7 flex items-center justify-center rounded border border-red-400 bg-red-500 text-white hover:bg-red-600 cursor-pointer transition-colors shrink-0" title="Confirm delete" @click="doDelete(map.id)">
            <Trash2 :size="13" />
          </button>
        </div>

        <!-- Normal row -->
        <div v-else class="group flex items-center gap-2 py-1.5 rounded transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/60">
          <button class="flex-1 flex items-center gap-2 text-left min-w-0 cursor-pointer" :title="map.id === activeId ? 'Active map' : `Switch to ${map.name}`" @click="map.id !== activeId && emit('switch', map.id)">
            <Map :size="14" :class="map.id === activeId ? 'text-cyan-500 shrink-0' : 'text-gray-400 dark:text-zinc-600 shrink-0'" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate transition-colors text-gray-800 dark:text-zinc-200 group-hover:text-cyan-500 dark:group-hover:text-cyan-400">
                {{ map.name }}
              </div>
              <div v-if="map.area" class="text-xs text-gray-400 dark:text-zinc-500 truncate">{{ map.area }}</div>
              <div class="text-xs text-gray-400 dark:text-zinc-500 font-mono tabular-nums">
                {{ map.pins.length + map.routes.length > 0 ? `${map.pins.length}p ${map.routes.length}r` : 'empty' }}
              </div>
            </div>
          </button>

          <div class="flex gap-1 shrink-0">
            <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-cyan-500 dark:hover:text-cyan-400 cursor-pointer transition-colors" title="Rename" @click="startRename(map)">
              <Pencil :size="13" />
            </button>
            <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-600 dark:hover:text-zinc-300 cursor-pointer transition-colors" title="Duplicate" @click="emit('duplicate', map.id)">
              <Copy :size="13" />
            </button>
            <button :disabled="maps.length <= 1" class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-red-300 dark:hover:border-red-800 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none" title="Delete map" @click="confirmDelete(map.id)">
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Import / Export -->
    <div class="pt-3 border-t border-gray-100 dark:border-zinc-800">
      <!-- Export picker -->
      <div v-if="showExportPicker">
        <div class="flex items-center justify-between mb-2">
          <span :class="sectionLabelClass" style="margin-bottom: 0">Export which map?</span>
          <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors" @click="showExportPicker = false">
            <X :size="13" />
          </button>
        </div>
        <div class="space-y-0.5">
          <div class="flex items-center gap-2 py-1.5 px-1">
            <FileDown :size="13" class="text-gray-400 dark:text-zinc-500 shrink-0" />
            <span class="flex-1 text-sm text-gray-800 dark:text-zinc-200">All Maps</span>
            <div class="flex gap-1 shrink-0">
              <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-600 dark:hover:text-zinc-300 cursor-pointer transition-colors" title="Export all as JSON" @click="exportAll()">
                <FileDown :size="13" />
              </button>
            </div>
          </div>
          <div v-for="map in maps" :key="map.id" class="flex items-center gap-2 py-1.5 px-1">
            <Map :size="13" class="text-gray-400 dark:text-zinc-500 shrink-0" />
            <span class="flex-1 text-sm text-gray-800 dark:text-zinc-200 truncate">{{ map.name }}</span>
            <div class="flex gap-1 shrink-0">
              <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-600 dark:hover:text-zinc-300 cursor-pointer transition-colors" title="Export as JSON" @click="exportMap(map.id)">
                <FileDown :size="13" />
              </button>
              <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-600 dark:hover:text-zinc-300 cursor-pointer transition-colors" title="Export as GeoJSON" @click="exportGeoJson(map.id)">
                <Globe :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Normal row -->
      <div v-else class="flex items-center justify-between">
        <span :class="sectionLabelClass" style="margin-bottom: 0">Import / Export</span>
        <div class="flex gap-1">
          <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors" :title="maps.length <= 1 ? 'Export as JSON' : 'Export map…'" @click="maps.length <= 1 ? emit('export', maps[0]!.id) : (showExportPicker = true)">
            <FileDown :size="13" />
          </button>
          <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors" :title="maps.length <= 1 ? 'Export as GeoJSON' : 'Export map…'" @click="maps.length <= 1 ? emit('export-geojson', maps[0]!.id) : (showExportPicker = true)">
            <Globe :size="13" />
          </button>
          <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors" title="Import map from file" @click="emit('import')">
            <FileUp :size="13" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
