<script setup lang="ts">
import { Trash2, X } from '@lucide/vue'

import ColorPicker from '@/components/ColorPicker.vue'
import type { Pin, PinDotSize } from '@/types'
import { DEFAULT_EMOJIS } from '@/types'
import { emojiToName } from '@/utils'

const props = defineProps<{
  show: boolean
  editingPin: Pin | null
  pendingPin: Pin | null
  pinDotSize: PinDotSize
}>()

const emit = defineEmits<{
  save: [pin: Pin, stickyEmoji: string, stickyColor: string]
  delete: []
  close: []
}>()

const newPinName = ref('')
const newPinDescription = ref('')
const newPinEmoji = ref('📍')
const newPinColor = ref('#06b6d4')
const customEmoji = ref('')
const showAllEmojis = ref(false)

const activeEmoji = computed(() => customEmoji.value.trim() || newPinEmoji.value)

watch(
  () => props.editingPin,
  (pin) => {
    if (!pin) return
    newPinName.value = pin.name
    newPinDescription.value = pin.description
    newPinEmoji.value = pin.emoji
    newPinColor.value = pin.color
    customEmoji.value = ''
    showAllEmojis.value = false
  },
  { immediate: true }
)

function save() {
  if (!props.editingPin) return
  const resolvedEmoji = customEmoji.value.trim() || newPinEmoji.value
  const updated: Pin = {
    ...props.editingPin,
    name: newPinName.value.trim() || emojiToName(activeEmoji.value),
    description: newPinDescription.value.trim(),
    emoji: resolvedEmoji,
    color: newPinColor.value
  }
  emit('save', updated, resolvedEmoji, newPinColor.value)
}

const inputClass = 'w-full py-1.5 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
const sectionLabelClass = 'block mb-1 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'
const btnBase = 'px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer'
</script>

<template>
  <div v-if="show" class="fixed bottom-0 left-0 right-0 z-1800 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl no-print max-h-[90vh] overflow-y-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-110 sm:rounded-2xl">
    <div class="p-4 pb-8">
      <div class="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full mx-auto mb-4" />

      <div class="flex items-center gap-3 mb-4">
        <div class="flex flex-col items-center shrink-0 w-8">
          <span class="text-2xl leading-none">{{ activeEmoji }}</span>
          <div v-if="pinDotSize !== 'none'" class="rounded-full border-2 border-white shadow mt-1" :style="{ background: newPinColor, width: ({ s: '8px', m: '12px', l: '16px' } as const)[pinDotSize], height: ({ s: '8px', m: '12px', l: '16px' } as const)[pinDotSize] }" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-gray-900 dark:text-zinc-100 text-lg font-bold leading-tight">Edit Pin</h2>
          <p class="text-xs font-mono text-gray-400 dark:text-zinc-500 tabular-nums">{{ editingPin?.lat.toFixed(5) }}, {{ editingPin?.lng.toFixed(5) }}</p>
          <p v-if="editingPin?.address" class="text-xs text-gray-400 dark:text-zinc-500 truncate">{{ editingPin.address }}</p>
        </div>
        <button class="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label :class="sectionLabelClass">Pin Name</label>
          <input v-model="newPinName" type="text" :placeholder="emojiToName(activeEmoji) || 'Name this pin…'" :class="inputClass" @keydown.enter="save" />
        </div>

        <div>
          <label :class="sectionLabelClass">Description</label>
          <input v-model="newPinDescription" type="text" placeholder='"Great for swimming in summer"' :class="inputClass" @keydown.enter="save" />
        </div>

        <div>
          <label :class="sectionLabelClass">Icon</label>
          <div class="flex flex-wrap gap-0.5 mb-2">
            <button
              v-for="emoji in showAllEmojis ? DEFAULT_EMOJIS : DEFAULT_EMOJIS.slice(0, 11)"
              :key="emoji"
              :class="['w-8 h-8 text-base rounded cursor-pointer transition-all flex items-center justify-center', newPinEmoji === emoji && !customEmoji.trim() ? 'ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-950/30' : 'hover:bg-gray-100 dark:hover:bg-zinc-800']"
              @click="newPinEmoji = emoji; customEmoji = ''"
            >
              {{ emoji }}
            </button>
            <button class="w-8 h-8 text-xs rounded cursor-pointer flex items-center justify-center font-medium text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800" @click="showAllEmojis = !showAllEmojis">{{ showAllEmojis ? '−' : '···' }}</button>
          </div>
          <input v-model="customEmoji" type="text" placeholder="Or type any emoji…" :class="inputClass" :maxlength="4" />
        </div>

        <div>
          <label :class="sectionLabelClass">Color</label>
          <ColorPicker v-model="newPinColor" />
        </div>

        <div class="flex gap-2">
          <button :class="`${btnBase} justify-center px-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50`" @click="emit('delete')"><Trash2 :size="15" /> {{ pendingPin?.id === editingPin?.id ? 'Cancel' : 'Delete' }}</button>
          <button :class="`${btnBase} flex-1 justify-center bg-cyan-500 text-white hover:bg-cyan-600`" @click="save">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>
