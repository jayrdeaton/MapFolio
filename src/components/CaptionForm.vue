<script setup lang="ts">
import { Trash2, X } from '@lucide/vue'

import CaptionPreview from '@/components/CaptionPreview.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import type { Caption, CaptionSize } from '@/types'

const props = defineProps<{
  show: boolean
  editingCaption: Caption | null
  textPlaceholder?: string
}>()

const emit = defineEmits<{
  save: [caption: Caption, stickyColor: string, stickySize: CaptionSize, stickyBackground: boolean]
  delete: []
  close: []
}>()

const SIZES: CaptionSize[] = ['xs', 's', 'm', 'l', 'xl']

const text = ref('')
const color = ref('#ffffff')
const size = ref<CaptionSize>('m')
const background = ref(true)

watch(
  () => props.editingCaption,
  (c) => {
    if (!c) return
    text.value = c.text
    color.value = c.color
    size.value = c.size
    background.value = c.background ?? false
  },
  { immediate: true }
)

function toggleBackground() {
  background.value = !background.value
  if (!background.value && (color.value === 'transparent' || color.value === '#ffffff')) color.value = '#111827'
}

function save() {
  if (!props.editingCaption) return
  // rotation is omitted here — it's edited live on the map via the rotate handle, and the
  // parent re-applies the caption's current rotation when saving.
  const updated: Caption = {
    ...props.editingCaption,
    text: text.value.trim(),
    color: color.value,
    size: size.value,
    background: background.value || undefined
  }
  emit('save', updated, color.value, size.value, background.value)
}

const inputClass = 'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20'
const sectionLabelClass = 'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const btnBase = 'px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer'

defineExpose({ save })
</script>

<template>
  <div v-if="show" class="fixed bottom-0 left-0 right-0 z-1800 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl no-print max-h-[90vh] overflow-y-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-110 sm:rounded-2xl">
    <div class="p-4 pb-8">
      <div class="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full mx-auto mb-4" />

      <div class="flex items-center gap-3 mb-4">
        <div class="shrink-0 w-11 h-11 flex items-center justify-center">
          <CaptionPreview :color="color" :size="size" :background="background" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-gray-900 dark:text-zinc-100 text-lg font-bold leading-tight">Edit Caption</h2>
          <p class="text-xs font-mono text-gray-400 dark:text-zinc-500 tabular-nums">{{ editingCaption?.lat.toFixed(5) }}, {{ editingCaption?.lng.toFixed(5) }}</p>
        </div>
        <button class="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label :class="sectionLabelClass">Text</label>
          <input v-model="text" type="text" :placeholder="textPlaceholder || 'Caption text…'" :class="inputClass" @keydown.enter="save" />
        </div>

        <div>
          <label :class="sectionLabelClass">Size</label>
          <div class="flex gap-1">
            <button v-for="s in SIZES" :key="s" :class="['flex-1 py-1.5 rounded text-xs font-semibold uppercase transition-colors cursor-pointer border', size === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-zinc-950 text-gray-600 dark:text-zinc-300 border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800']" @click="size = s">{{ s }}</button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label :class="sectionLabelClass" style="margin-bottom: 0">{{ background ? 'Background' : 'Color' }}</label>
            <button :class="['relative w-10 h-6 rounded-full transition-colors cursor-pointer', background ? 'bg-teal-600' : 'bg-gray-300 dark:bg-zinc-700']" @click="toggleBackground">
              <span :class="['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', background && 'translate-x-4']" />
            </button>
          </div>
          <ColorPicker v-model="color" :hide-transparent="!background" />
        </div>

        <div class="border-t border-gray-100 dark:border-zinc-800" />

        <div class="flex gap-2">
          <button :class="`${btnBase} justify-center px-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50`" @click="emit('delete')"><Trash2 :size="15" /> Delete</button>
          <button :class="`${btnBase} flex-1 justify-center bg-teal-600 text-white hover:bg-teal-700`" @click="save">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>
