<script setup lang="ts">
import { CircleDotDashed, Eye, EyeOff, MapPin, Maximize2, Plus, Trash2 } from '@lucide/vue'
import { ref } from 'vue'

import PinListItem from '@/components/PinListItem.vue'
import type { Pin } from '@/types'
import { pinPlaceholder } from '@/utils/placeholder'

const props = defineProps<{
  pins: Pin[]
  filteredPins: Pin[]
  hiddenPinIds: Set<number>
  allPinsHidden: boolean
  resolvingPinId: number | null
  showClusters: boolean
  selectedPinIds: Set<number>
  // pin.id → its displayed index (only pins with numbering on); used for the row preview.
  pinNumbers: Map<number, number>
}>()

const emit = defineEmits<{
  'place-at-center': []
  'fit-to-pins': []
  'toggle-all-visibility': []
  'clear-all': []
  'delete-pin': [id: number]
  'edit-pin': [pin: Pin]
  'copy-coords': [text: string]
  'clip-copy-pin': [pin: Pin]
  'clip-cut-pin': [pin: Pin]
  'select-pin': [pin: Pin]
  'toggle-pin': [pin: Pin]
  'range-select-pins': [ids: number[]]
  'toggle-visibility': [id: number]
  reorder: [pins: Pin[]]
  'clusters-change': [value: boolean]
}>()

const pinSearch = defineModel<string>('pinSearch', { required: true })

const anchorPinId = ref<number | null>(null)

function handlePinSelect(pin: Pin, shiftHeld: boolean, metaHeld: boolean) {
  if (metaHeld) {
    emit('toggle-pin', pin)
    return
  }
  if (shiftHeld && anchorPinId.value !== null) {
    const anchorIdx = props.filteredPins.findIndex((p) => p.id === anchorPinId.value)
    const clickedIdx = props.filteredPins.findIndex((p) => p.id === pin.id)
    if (anchorIdx !== -1 && clickedIdx !== -1) {
      const lo = Math.min(anchorIdx, clickedIdx)
      const hi = Math.max(anchorIdx, clickedIdx)
      emit(
        'range-select-pins',
        props.filteredPins.slice(lo, hi + 1).map((p) => p.id)
      )
      return
    }
  }
  anchorPinId.value = pin.id
  emit('select-pin', pin)
}

const sectionLabelClass = 'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const inputClass = 'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20'
</script>

<template>
  <div>
    <!-- Sticky header: title + actions + search -->
    <div class="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800 px-4 pt-4 pb-2">
      <div class="flex items-center justify-between mb-2">
        <span :class="sectionLabelClass" class="flex items-center gap-1.5" style="margin-bottom: 0"><MapPin :size="12" /> Pins ({{ pins.length }})</span>
        <div class="flex gap-1">
          <button class="mf-ibtn mf-ibtn--primary w-7 h-7" title="New pin" @click="emit('place-at-center')">
            <Plus :size="13" />
          </button>
          <button :disabled="pins.length === 0" class="mf-ibtn w-7 h-7" title="Fit map to pins" @click="emit('fit-to-pins')">
            <Maximize2 :size="13" />
          </button>
          <button :disabled="pins.length === 0" :class="['mf-ibtn w-7 h-7', !allPinsHidden && 'mf-ibtn--active']" :title="allPinsHidden ? 'Show all pins on map' : 'Hide all pins from map'" @click="emit('toggle-all-visibility')">
            <Eye v-if="!allPinsHidden" :size="13" />
            <EyeOff v-else :size="13" />
          </button>
          <button :disabled="pins.length === 0" class="mf-ibtn mf-ibtn--danger w-7 h-7" title="Delete all pins" @click="emit('clear-all')">
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
      <input v-if="pins.length > 5" v-model="pinSearch" type="search" placeholder="Search pins…" :class="inputClass" />
    </div>

    <!-- Pins list -->
    <div class="py-1">
      <div v-if="pins.length === 0" class="text-xs text-gray-400 dark:text-zinc-600 text-center py-4 px-4">No pins yet</div>
      <div v-else>
        <p v-if="pinSearch && filteredPins.length === 0" class="text-xs text-gray-400 dark:text-zinc-600 text-center py-2 px-4">No pins match</p>
        <VueDraggable v-else :model-value="filteredPins" item-key="id" handle=".pin-drag-handle" :animation="150" ghost-class="opacity-40" @update:model-value="emit('reorder', $event)">
          <template #item="{ element: pin }">
            <PinListItem :pin="pin" :hidden="hiddenPinIds.has(pin.id)" :resolving="resolvingPinId === pin.id" :number="pinNumbers.get(pin.id)" :selected="selectedPinIds.has(pin.id)" :placeholder="pin.name ? undefined : pinPlaceholder(pin, pins)" @delete="emit('delete-pin', $event)" @edit="emit('edit-pin', $event)" @copy-coords="emit('copy-coords', $event)" @clip-copy="emit('clip-copy-pin', $event)" @clip-cut="emit('clip-cut-pin', $event)" @select="handlePinSelect" @toggle-visibility="emit('toggle-visibility', $event)" />
          </template>
        </VueDraggable>
      </div>
    </div>

    <!-- Sticky footer: hint + settings -->
    <div class="sticky bottom-0 bg-gray-50 dark:bg-zinc-800 border-t border-gray-100 dark:border-zinc-800 px-4 pt-3 pb-4">
      <p class="text-xs text-gray-400 dark:text-zinc-600 text-center mb-3">Right-click the map (or long press) to place a pin</p>
      <div class="flex items-center justify-between">
        <span :class="sectionLabelClass" style="margin-bottom: 0">Display</span>
        <div class="flex gap-1">
          <button :class="['mf-ibtn w-7 h-7', showClusters && 'mf-ibtn--active']" :title="showClusters ? 'Ungroup pins' : 'Group nearby pins into clusters'" @click="emit('clusters-change', !showClusters)"><CircleDotDashed :size="13" /></button>
        </div>
      </div>
    </div>
  </div>
</template>
