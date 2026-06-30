<script setup lang="ts">
import { Copy, Eye, EyeOff, Link2Off, Pencil, Printer, Scissors, Trash2, X } from '@lucide/vue'

import CaptionPreview from '@/components/CaptionPreview.vue'
import PinPreview from '@/components/PinPreview.vue'
import RoutePreview from '@/components/RoutePreview.vue'
import type { Caption, Pin, PrintArea, Route } from '@/types'
import { captionPlaceholder, pinPlaceholder, printAreaPlaceholder, routePlaceholder } from '@/utils/placeholder'

const props = defineProps<{
  selectedPins: Pin[]
  selectedRoutes: Route[]
  selectedCaptions: Caption[]
  selectedPrintAreas: PrintArea[]
  allPins: Pin[]
  allRoutes: Route[]
  allCaptions: Caption[]
  allPrintAreas: PrintArea[]
  mapName: string
  allSelectedHidden: boolean
  singlePinLinked: boolean
  // pin.id → its displayed index (only pins with numbering on); shown in the single-pin preview.
  pinNumbers: Map<number, number>
}>()

const emit = defineEmits<{
  clear: []
  edit: []
  unlink: []
  copy: []
  cut: []
  delete: []
  'toggle-visibility': []
}>()

const totalCount = computed(() => props.selectedPins.length + props.selectedRoutes.length + props.selectedCaptions.length + props.selectedPrintAreas.length)
const singlePin = computed(() => (totalCount.value === 1 && props.selectedPins.length === 1 ? props.selectedPins[0] : null))
const singleRoute = computed(() => (totalCount.value === 1 && props.selectedRoutes.length === 1 ? props.selectedRoutes[0] : null))
const singleCaption = computed(() => (totalCount.value === 1 && props.selectedCaptions.length === 1 ? props.selectedCaptions[0] : null))
const singlePrintArea = computed(() => (totalCount.value === 1 && props.selectedPrintAreas.length === 1 ? props.selectedPrintAreas[0] : null))

const hasHideable = computed(() => totalCount.value > 0)
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-1100 w-max sm:w-auto flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-2xl sm:rounded-full shadow-lg no-print pointer-events-auto max-w-[calc(100vw-5rem)]">
    <!-- Identity: preview + name (+ X on mobile) -->
    <div class="flex items-center gap-2 w-full sm:w-auto min-w-0">
      <!-- Single pin -->
      <template v-if="singlePin">
        <PinPreview :emoji="singlePin.emoji" :color="singlePin.color" :dot-size="singlePin.dotSize" :dot-shape="singlePin.dotShape" :show-number="singlePin.showNumber" :number="pinNumbers.get(singlePin.id)" preview class="shrink-0" />
        <span class="truncate min-w-0 sm:max-w-48">{{ singlePin.name || pinPlaceholder(singlePin, allPins) }}</span>
      </template>

      <!-- Single route -->
      <template v-else-if="singleRoute">
        <RoutePreview :color="singleRoute.color" :line-style="singleRoute.lineStyle ?? 'solid'" :waypoint-style="singleRoute.waypointStyle ?? 'circle'" :waypoint-size="singleRoute.waypointSize ?? 'm'" :waypoint-show-number="singleRoute.waypointShowNumber" preview class="shrink-0" />
        <span class="truncate min-w-0 sm:max-w-48">{{ singleRoute.name || routePlaceholder(singleRoute, allRoutes) }}</span>
      </template>

      <!-- Single caption -->
      <template v-else-if="singleCaption">
        <CaptionPreview :color="singleCaption.color" :size="singleCaption.size" :background="singleCaption.background" preview class="shrink-0" />
        <span class="truncate min-w-0 sm:max-w-48">{{ singleCaption.text || captionPlaceholder(singleCaption, allCaptions) }}</span>
      </template>

      <!-- Single print area -->
      <template v-else-if="singlePrintArea">
        <Printer :size="14" class="shrink-0 text-gray-500 dark:text-zinc-400" />
        <span class="truncate min-w-0 sm:max-w-48">{{ singlePrintArea.title || printAreaPlaceholder(singlePrintArea.id, allPrintAreas, mapName) }}</span>
      </template>

      <!-- Multi-select -->
      <template v-else>
        <span>{{ totalCount }} selected</span>
      </template>

      <!-- Close on mobile (right side of top row) -->
      <button class="sm:hidden ml-auto w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" title="Close" @click.stop="emit('clear')">
        <X :size="13" />
      </button>
    </div>

    <!-- Divider (mobile only) -->
    <div class="w-full border-t border-gray-100 dark:border-zinc-700 sm:hidden" />

    <!-- Actions -->
    <div class="flex items-center gap-1.5 sm:gap-2">
      <!-- Edit (single only) -->
      <button v-if="singlePin || singleRoute || singleCaption || singlePrintArea" :title="singlePin ? 'Edit Pin' : singleRoute ? 'Edit Route' : singleCaption ? 'Edit Caption' : 'Edit Print'" class="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" @click.stop="emit('edit')">
        <Pencil :size="13" />
      </button>

      <!-- Unlink pin from waypoint (single linked pin only) -->
      <button v-if="singlePin && singlePinLinked" title="Unlink pin from route" class="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" @click.stop="emit('unlink')">
        <Link2Off :size="13" />
      </button>

      <!-- Hide / show selected -->
      <button v-if="hasHideable" class="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" :title="allSelectedHidden ? 'Show' : 'Hide'" @click.stop="emit('toggle-visibility')">
        <EyeOff v-if="allSelectedHidden" :size="13" />
        <Eye v-else :size="13" />
      </button>

      <!-- Cut -->
      <button class="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" title="Cut" @click.stop="emit('cut')">
        <Scissors :size="13" />
      </button>

      <!-- Copy -->
      <button class="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" title="Copy" @click.stop="emit('copy')">
        <Copy :size="13" />
      </button>

      <!-- Delete (always red, matching .mf-menu-item--danger) -->
      <button class="w-6 h-6 flex items-center justify-center rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors shrink-0" title="Delete" @click.stop="emit('delete')">
        <Trash2 :size="13" />
      </button>

      <!-- Close on desktop (end of actions row) -->
      <button class="hidden sm:flex w-6 h-6 items-center justify-center rounded text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0" title="Close" @click.stop="emit('clear')">
        <X :size="13" />
      </button>
    </div>
  </div>
</template>
