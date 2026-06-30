<script setup lang="ts">
import { Eye, EyeOff, Maximize2, Plus, Trash2, Type } from '@lucide/vue'
import { ref } from 'vue'

import CaptionListItem from '@/components/CaptionListItem.vue'
import type { Caption } from '@/types'
import { captionPlaceholder } from '@/utils/placeholder'

const props = defineProps<{
  captions: Caption[]
  filteredCaptions: Caption[]
  hiddenCaptionIds: Set<number>
  allCaptionsHidden: boolean
  selectedCaptionIds: Set<number>
}>()

const emit = defineEmits<{
  'place-at-center': []
  'fit-to-captions': []
  'toggle-all-visibility': []
  'clear-all': []
  'delete-caption': [id: number]
  'edit-caption': [caption: Caption]
  'copy-coords': [text: string]
  'clip-copy-caption': [caption: Caption]
  'clip-cut-caption': [caption: Caption]
  'select-caption': [caption: Caption]
  'toggle-caption': [caption: Caption]
  'range-select-captions': [ids: number[]]
  'toggle-visibility': [id: number]
}>()

const captionSearch = defineModel<string>('captionSearch', { required: true })

const anchorCaptionId = ref<number | null>(null)

function handleCaptionSelect(caption: Caption, shiftHeld: boolean, metaHeld: boolean) {
  if (metaHeld) {
    emit('toggle-caption', caption)
    return
  }
  if (shiftHeld && anchorCaptionId.value !== null) {
    const anchorIdx = props.filteredCaptions.findIndex((c) => c.id === anchorCaptionId.value)
    const clickedIdx = props.filteredCaptions.findIndex((c) => c.id === caption.id)
    if (anchorIdx !== -1 && clickedIdx !== -1) {
      const lo = Math.min(anchorIdx, clickedIdx)
      const hi = Math.max(anchorIdx, clickedIdx)
      emit(
        'range-select-captions',
        props.filteredCaptions.slice(lo, hi + 1).map((c) => c.id)
      )
      return
    }
  }
  anchorCaptionId.value = caption.id
  emit('select-caption', caption)
}

const sectionLabelClass = 'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const inputClass = 'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20'
</script>

<template>
  <div>
    <!-- Sticky header: title + actions + search -->
    <div class="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800 px-4 pt-4 pb-2">
      <div class="flex items-center justify-between mb-2">
        <span :class="sectionLabelClass" class="flex items-center gap-1.5" style="margin-bottom: 0"><Type :size="12" /> Captions ({{ captions.length }})</span>
        <div class="flex gap-1">
          <button class="mf-ibtn mf-ibtn--primary w-7 h-7" title="New caption" @click="emit('place-at-center')">
            <Plus :size="13" />
          </button>
          <button :disabled="captions.length === 0" class="mf-ibtn w-7 h-7" title="Fit map to captions" @click="emit('fit-to-captions')">
            <Maximize2 :size="13" />
          </button>
          <button :disabled="captions.length === 0" :class="['mf-ibtn w-7 h-7', !allCaptionsHidden && 'mf-ibtn--active']" :title="allCaptionsHidden ? 'Show all captions on map' : 'Hide all captions from map'" @click="emit('toggle-all-visibility')">
            <Eye v-if="!allCaptionsHidden" :size="13" />
            <EyeOff v-else :size="13" />
          </button>
          <button :disabled="captions.length === 0" class="mf-ibtn mf-ibtn--danger w-7 h-7" title="Delete all captions" @click="emit('clear-all')">
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
      <input v-if="captions.length > 5" v-model="captionSearch" type="search" placeholder="Search captions…" :class="inputClass" />
    </div>

    <!-- Captions list -->
    <div class="py-1">
      <div v-if="captions.length === 0" class="text-xs text-gray-400 dark:text-zinc-600 text-center py-4 px-4">No captions yet</div>
      <div v-else>
        <p v-if="captionSearch && filteredCaptions.length === 0" class="text-xs text-gray-400 dark:text-zinc-600 text-center py-2 px-4">No captions match</p>
        <CaptionListItem v-for="caption in filteredCaptions" :key="caption.id" :caption="caption" :hidden="hiddenCaptionIds.has(caption.id)" :selected="selectedCaptionIds.has(caption.id)" :placeholder="caption.text ? undefined : captionPlaceholder(caption, captions)" @select="handleCaptionSelect" @edit-caption="emit('edit-caption', $event)" @copy-coords="emit('copy-coords', $event)" @clip-copy="emit('clip-copy-caption', $event)" @clip-cut="emit('clip-cut-caption', $event)" @toggle-visibility="emit('toggle-visibility', $event)" @delete-caption="emit('delete-caption', $event)" />
      </div>
    </div>

    <!-- Sticky footer: hint -->
    <div class="sticky bottom-0 bg-gray-50 dark:bg-zinc-800 border-t border-gray-100 dark:border-zinc-800 px-4 pt-3 pb-4">
      <p class="text-xs text-gray-400 dark:text-zinc-600 text-center">Right-click the map (or long press) to add a caption</p>
    </div>
  </div>
</template>
