<script setup lang="ts">
import { Check, FileDown, FileUp, Link, Loader2, Map, Plus, X } from '@lucide/vue'

import MapListItem from '@/components/MapListItem.vue'
import type { MapExportLayers, MapExportOptions } from '@/composables/useMaps'
import type { MapData } from '@/types'
import { encodeShareState, MAX_SHARE_URL_LENGTH } from '@/utils'

const props = defineProps<{
  maps: MapData[]
  activeId: string
}>()

const emit = defineEmits<{
  switch: [id: string]
  edit: [id: string]
  create: [name: string]
  duplicate: [id: string]
  delete: [id: string]
  export: [opts: MapExportOptions]
  'copy-link': [opts: { layers: MapExportLayers; mapId: string }]
  import: []
  close: []
  reorder: [maps: MapData[]]
}>()

const newMapName = ref('')
const showNewInput = ref(false)

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

// ── Export dialog ─────────────────────────────────────────────────────────
const showExport = ref(false)
const isExporting = ref(false)
const exportScope = ref<string>('') // a map id, or 'all'
const exportFormat = ref<'json' | 'geojson' | 'link'>('json')
const layers = ref<MapExportLayers>({ pins: true, routes: true, captions: true, printAreas: true, includeHidden: true })

const isLink = computed(() => exportFormat.value === 'link')

const scopeMaps = computed(() => (exportScope.value === 'all' ? props.maps : props.maps.filter((m) => m.id === exportScope.value)))
const counts = computed(() => {
  const inc = layers.value.includeHidden
  const vis = <T extends { hidden?: boolean }>(arr: T[] | undefined) => (inc ? (arr?.length ?? 0) : (arr?.filter((x) => !x.hidden).length ?? 0))
  return {
    pins: scopeMaps.value.reduce((n, m) => n + vis(m.pins), 0),
    routes: scopeMaps.value.reduce((n, m) => n + vis(m.routes), 0),
    captions: scopeMaps.value.reduce((n, m) => n + vis(m.captions), 0),
    printAreas: scopeMaps.value.reduce((n, m) => n + vis(m.printAreas), 0)
  }
})

// GeoJSON has no caption or print area concept; both are omitted for that format.
const captionsDisabled = computed(() => exportFormat.value === 'geojson' || counts.value.captions === 0)
const printAreasDisabled = computed(() => exportFormat.value === 'geojson' || counts.value.printAreas === 0)
const geojsonDisabled = computed(() => exportScope.value === 'all')
const linkDisabled = computed(() => exportScope.value === 'all')

// The actual layers that will be written, after honoring counts + per-format rules.
const resolvedLayers = computed<MapExportLayers>(() => ({
  pins: layers.value.pins && counts.value.pins > 0,
  routes: layers.value.routes && counts.value.routes > 0,
  captions: !captionsDisabled.value && layers.value.captions && counts.value.captions > 0,
  printAreas: !printAreasDisabled.value && layers.value.printAreas && counts.value.printAreas > 0
}))

const canExport = computed(() => resolvedLayers.value.pins || resolvedLayers.value.routes || resolvedLayers.value.captions)

// Candidate share URL for the selected map (stored view is fine for length-gauging;
// App.vue rebuilds it with the live center/zoom when copying the active map).
const shareUrl = computed(() => {
  if (!isLink.value) return ''
  const m = props.maps.find((x) => x.id === exportScope.value)
  if (!m) return ''
  const inc = resolvedLayers.value
  const encoded = encodeShareState({
    pins: inc.pins ? m.pins : [],
    routes: inc.routes ? m.routes : [],
    captions: inc.captions ? (m.captions ?? []) : [],
    mapStyle: m.mapStyle,
    mapTitle: m.name,
    area: m.area,
    center: m.center,
    zoom: m.zoom
  })
  const origin = typeof window !== 'undefined' ? `${location.origin}${location.pathname}` : ''
  return `${origin}#${encoded}`
})
const linkTooLong = computed(() => isLink.value && shareUrl.value.length > MAX_SHARE_URL_LENGTH)
const actionDisabled = computed(() => !canExport.value || (isLink.value && linkTooLong.value))

watch([geojsonDisabled, linkDisabled], () => {
  if (exportScope.value === 'all' && exportFormat.value !== 'json') exportFormat.value = 'json'
})

function openExport() {
  exportScope.value = props.activeId
  exportFormat.value = 'json'
  layers.value = { pins: true, routes: true, captions: true, printAreas: true, includeHidden: true }
  showExport.value = true
}

async function doExport() {
  if (exportFormat.value === 'link') {
    emit('copy-link', { layers: resolvedLayers.value, mapId: exportScope.value })
    showExport.value = false
    return
  }
  isExporting.value = true
  emit('export', { scope: exportScope.value, format: exportFormat.value, layers: resolvedLayers.value })
  await new Promise((resolve) => setTimeout(resolve, 600))
  showExport.value = false
  isExporting.value = false
}

const sectionLabelClass = 'block text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const iconBtnClass = 'w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors'
const fieldClass = 'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20'
const fieldLabelClass = 'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
</script>

<template>
  <div>
    <!-- Sticky header -->
    <div class="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800 px-4 pt-4 pb-2">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide"><Map :size="12" /> Maps ({{ maps.length }})</span>
        <button class="w-7 h-7 flex items-center justify-center rounded border border-teal-400 bg-teal-600 text-white hover:bg-teal-700 cursor-pointer transition-colors" title="New map" @click="showNewInput = true">
          <Plus :size="13" />
        </button>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="py-1 space-y-3">
      <!-- New map input -->
      <div v-if="showNewInput" class="px-4 flex gap-1.5">
        <input v-model="newMapName" placeholder="Map name…" class="flex-1 py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20" autofocus @keydown.enter="submitNew" @keydown.escape="cancelNew" />
        <button class="w-7 h-7 flex items-center justify-center rounded border border-teal-400 bg-teal-600 text-white hover:bg-teal-700 cursor-pointer transition-colors shrink-0" title="Create" @click="submitNew">
          <Check :size="13" />
        </button>
        <button class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors shrink-0" title="Cancel" @click="cancelNew">
          <X :size="13" />
        </button>
      </div>

      <!-- Map list -->
      <div>
        <VueDraggable :model-value="maps" item-key="id" handle=".map-drag-handle" :animation="150" ghost-class="opacity-40" @update:model-value="emit('reorder', $event)">
          <template #item="{ element: map }">
            <MapListItem :map="map" :active="map.id === activeId" :can-delete="maps.length > 1" @switch="emit('switch', $event)" @edit="emit('edit', $event)" @duplicate="emit('duplicate', $event)" @delete="emit('delete', $event)" />
          </template>
        </VueDraggable>
      </div>
    </div>

    <!-- Sticky footer: import / export -->
    <div class="sticky bottom-0 bg-gray-50 dark:bg-zinc-800 border-t border-gray-100 dark:border-zinc-800 px-4 pt-3 pb-4">
      <!-- Export dialog -->
      <div v-if="showExport" class="space-y-3">
        <div class="flex items-center justify-between">
          <span :class="sectionLabelClass">Export</span>
          <button :class="iconBtnClass" title="Cancel" @click="showExport = false">
            <X :size="13" />
          </button>
        </div>

        <!-- Which map -->
        <div>
          <span :class="fieldLabelClass">Map</span>
          <select v-model="exportScope" :class="fieldClass">
            <option v-for="m in maps" :key="m.id" :value="m.id">{{ m.id === activeId ? `${m.name} (this map)` : m.name }}</option>
            <option v-if="maps.length > 1" value="all">All Maps</option>
          </select>
        </div>

        <!-- Which layers -->
        <div>
          <span :class="fieldLabelClass">Include</span>
          <div class="space-y-1.5">
            <label :class="['flex items-center gap-2 text-sm', counts.pins === 0 ? 'text-gray-400 dark:text-zinc-600 cursor-not-allowed' : 'text-gray-800 dark:text-zinc-200 cursor-pointer']">
              <input v-model="layers.pins" type="checkbox" :disabled="counts.pins === 0" class="accent-teal-600" />
              Pins <span class="text-gray-400 dark:text-zinc-500 tabular-nums">({{ counts.pins }})</span>
            </label>
            <label :class="['flex items-center gap-2 text-sm', counts.routes === 0 ? 'text-gray-400 dark:text-zinc-600 cursor-not-allowed' : 'text-gray-800 dark:text-zinc-200 cursor-pointer']">
              <input v-model="layers.routes" type="checkbox" :disabled="counts.routes === 0" class="accent-teal-600" />
              Routes <span class="text-gray-400 dark:text-zinc-500 tabular-nums">({{ counts.routes }})</span>
            </label>
            <label :class="['flex items-center gap-2 text-sm', captionsDisabled ? 'text-gray-400 dark:text-zinc-600 cursor-not-allowed' : 'text-gray-800 dark:text-zinc-200 cursor-pointer']">
              <input v-model="layers.captions" type="checkbox" :disabled="captionsDisabled" class="accent-teal-600" />
              Captions <span class="text-gray-400 dark:text-zinc-500 tabular-nums">({{ counts.captions }})</span>
            </label>
            <label :class="['flex items-center gap-2 text-sm', printAreasDisabled ? 'text-gray-400 dark:text-zinc-600 cursor-not-allowed' : 'text-gray-800 dark:text-zinc-200 cursor-pointer']">
              <input v-model="layers.printAreas" type="checkbox" :disabled="printAreasDisabled" class="accent-teal-600" />
              Prints <span class="text-gray-400 dark:text-zinc-500 tabular-nums">({{ counts.printAreas }})</span>
            </label>
            <div class="border-t border-gray-100 dark:border-zinc-700 pt-1.5 mt-0.5">
              <label class="flex items-center gap-2 text-sm text-gray-800 dark:text-zinc-200 cursor-pointer">
                <input v-model="layers.includeHidden" type="checkbox" class="accent-teal-600" />
                Hidden Items
              </label>
            </div>
          </div>
        </div>

        <!-- Format -->
        <div>
          <span :class="fieldLabelClass">Format</span>
          <div class="space-y-1.5">
            <label class="flex items-center gap-2 text-sm text-gray-800 dark:text-zinc-200 cursor-pointer">
              <input v-model="exportFormat" type="radio" value="json" class="accent-teal-600" />
              <span class="flex flex-col leading-tight">
                <span>MapFolio JSON</span>
                <span class="text-xs text-gray-400 dark:text-zinc-500">Full fidelity, re-importable</span>
              </span>
            </label>
            <label :class="['flex items-center gap-2 text-sm', geojsonDisabled ? 'text-gray-400 dark:text-zinc-600 cursor-not-allowed' : 'text-gray-800 dark:text-zinc-200 cursor-pointer']">
              <input v-model="exportFormat" type="radio" value="geojson" :disabled="geojsonDisabled" class="accent-teal-600" />
              <span class="flex flex-col leading-tight">
                <span>GeoJSON</span>
                <span class="text-xs text-gray-400 dark:text-zinc-500">For other map tools · pins and routes only</span>
              </span>
            </label>
            <label :class="['flex items-center gap-2 text-sm', linkDisabled ? 'text-gray-400 dark:text-zinc-600 cursor-not-allowed' : 'text-gray-800 dark:text-zinc-200 cursor-pointer']">
              <input v-model="exportFormat" type="radio" value="link" :disabled="linkDisabled" class="accent-teal-600" />
              <span class="flex flex-col leading-tight">
                <span>Share Link</span>
                <span class="text-xs text-gray-400 dark:text-zinc-500">Opens in one tap · best for smaller maps</span>
              </span>
            </label>
          </div>
          <p v-if="linkTooLong" class="mt-2 text-xs text-amber-600 dark:text-amber-500">This map is too large for a share link - export a file instead.</p>
        </div>

        <!-- Actions -->
        <div class="flex gap-1.5 pt-1">
          <button class="flex-1 h-8 flex items-center justify-center gap-1.5 rounded border border-teal-400 bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors" :disabled="actionDisabled || isExporting" :title="linkTooLong ? 'Too large for a share link. Export a file instead.' : undefined" @click="doExport">
            <Loader2 v-if="isExporting" :size="14" class="animate-spin" />
            <component :is="isLink ? Link : FileDown" v-else :size="14" />
            {{ isExporting ? 'Downloading…' : isLink ? 'Copy Link' : 'Export' }}
          </button>
          <button class="px-3 h-8 rounded border border-gray-300 dark:border-zinc-700 text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors" @click="showExport = false">Cancel</button>
        </div>
      </div>

      <!-- Normal row -->
      <div v-else class="flex items-center justify-between">
        <span :class="sectionLabelClass">Import / Export</span>
        <div class="flex gap-1">
          <button :class="iconBtnClass" title="Export…" @click="openExport">
            <FileDown :size="13" />
          </button>
          <button :class="iconBtnClass" title="Import from MapFolio JSON or GeoJSON" @click="emit('import')">
            <FileUp :size="13" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
