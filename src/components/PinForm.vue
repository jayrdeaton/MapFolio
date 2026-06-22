<script setup lang="ts">
import { Trash2, X } from '@lucide/vue'

import ColorPicker from '@/components/ColorPicker.vue'
import DotPicker from '@/components/DotPicker.vue'
import PinPreview from '@/components/PinPreview.vue'
import type { Pin, PinDotShape, PinDotSize } from '@/types'
import { DEFAULT_EMOJIS } from '@/types'
import { emojiToName } from '@/utils'

const props = defineProps<{
  show: boolean
  editingPin: Pin | null
  globalDotSize: PinDotSize
  nameIndex?: number
}>()

const emit = defineEmits<{
  save: [pin: Pin, stickyEmoji: string, stickyColor: string, stickyDotSize: PinDotSize, stickyDotShape: PinDotShape]
  delete: []
  close: []
}>()

const newPinName = ref('')
const newPinDescription = ref('')
const newPinEmoji = ref('📍')
const newPinColor = ref('#ffffff')
const customEmoji = ref('')
const showAllEmojis = ref(false)
const showCustomInput = ref(false)
const newPinDotSize = ref<PinDotSize>('m')
const newPinDotShape = ref<PinDotShape>('circle')
const newPinShowNumber = ref(false)

const dotSize = computed({
  get: () => newPinDotSize.value as string,
  set: (v: string) => {
    newPinDotSize.value = v as PinDotSize
  }
})

const activeEmoji = computed(() => customEmoji.value.trim() || newPinEmoji.value)

function selectEmoji(emoji: string) {
  newPinEmoji.value = emoji
  customEmoji.value = ''
}

function switchToEmoji() {
  if (!activeEmoji.value) selectEmoji(DEFAULT_EMOJIS[0]!)
}

function switchToDot() {
  newPinEmoji.value = ''
  customEmoji.value = ''
}

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
    showCustomInput.value = false
    const loadedSize = pin.dotSize ?? props.globalDotSize
    newPinDotSize.value = (loadedSize as string) === 'none' ? 'm' : loadedSize
    newPinDotShape.value = pin.dotShape ?? 'circle'
    newPinShowNumber.value = pin.showNumber ?? false
  },
  { immediate: true }
)

function save() {
  if (!props.editingPin) return
  const resolvedEmoji = customEmoji.value.trim() || newPinEmoji.value
  const updated: Pin = {
    ...props.editingPin,
    name: newPinName.value.trim(),
    description: newPinDescription.value.trim(),
    emoji: resolvedEmoji,
    color: newPinColor.value,
    dotSize: newPinDotSize.value,
    dotShape: newPinDotShape.value,
    showNumber: newPinShowNumber.value || undefined
  }
  emit('save', updated, resolvedEmoji, newPinColor.value, newPinDotSize.value, newPinDotShape.value)
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
        <div class="shrink-0">
          <PinPreview :emoji="activeEmoji" :color="newPinColor" :dot-size="activeEmoji ? undefined : newPinDotSize" :dot-shape="newPinDotShape" :show-number="newPinShowNumber" />
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
          <label :class="sectionLabelClass">Name</label>
          <input v-model="newPinName" type="text" :placeholder="[emojiToName(activeEmoji), props.nameIndex !== undefined ? props.nameIndex : ''].filter(Boolean).join(' ') || 'Name this pin…'" :class="inputClass" @keydown.enter="save" />
        </div>

        <div>
          <label :class="sectionLabelClass">Description</label>
          <input v-model="newPinDescription" type="text" placeholder='"Great for swimming in summer"' :class="inputClass" @keydown.enter="save" />
        </div>

        <div>
          <label :class="sectionLabelClass">Style</label>

          <!-- Mode toggle -->
          <div class="flex gap-1.5 mb-2">
            <button :class="['flex-1 py-1.5 rounded border text-sm font-medium transition-colors cursor-pointer', activeEmoji ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800']" @click="switchToEmoji">
              Bubble
            </button>
            <button :class="['flex-1 py-1.5 rounded border text-sm font-medium transition-colors cursor-pointer', !activeEmoji ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800']" @click="switchToDot">
              Dot
            </button>
          </div>

          <!-- Emoji bubble options -->
          <template v-if="activeEmoji !== undefined && activeEmoji !== ''">
            <div class="flex flex-wrap gap-0.5 mb-2">
              <button :class="['w-8 h-8 text-xs font-semibold rounded cursor-pointer flex items-center justify-center transition-all shrink-0', showCustomInput || customEmoji.trim() ? 'ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400' : 'text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800']" title="Custom emoji" @click="showCustomInput = !showCustomInput">Aa</button>
              <template v-if="showCustomInput">
                <input v-model="customEmoji" type="text" placeholder="Any text or emoji…" class="flex-1 min-w-0 h-8 ml-1 px-2 border border-gray-300 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" autofocus @keydown.enter="showCustomInput = false" />
              </template>
              <template v-else>
                <button v-for="emoji in showAllEmojis ? DEFAULT_EMOJIS : DEFAULT_EMOJIS.slice(0, 10)" :key="emoji" :class="['w-8 h-8 text-base rounded cursor-pointer transition-all flex items-center justify-center', newPinEmoji === emoji && !customEmoji.trim() ? 'ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-950/30' : 'hover:bg-gray-100 dark:hover:bg-zinc-800']" @click="selectEmoji(emoji)">
                  {{ emoji }}
                </button>
                <button class="w-8 h-8 text-xs rounded cursor-pointer flex items-center justify-center font-medium text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800" @click="showAllEmojis = !showAllEmojis">{{ showAllEmojis ? '−' : '···' }}</button>
              </template>
            </div>
            <div class="flex gap-1.5 mb-2">
              <button v-for="s in ['xs', 's', 'm', 'l', 'xl']" :key="s" :class="['flex-1 py-2 rounded border text-xs font-medium transition-colors cursor-pointer', newPinDotSize === s ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800']" @click="newPinDotSize = s as PinDotSize">{{ s.toUpperCase() }}</button>
            </div>
            <ColorPicker v-model="newPinColor" />
          </template>

          <!-- Dot options -->
          <template v-else>
            <DotPicker v-model:shape="newPinDotShape" v-model:size="dotSize" v-model:show-number="newPinShowNumber" v-model:color="newPinColor" :sizes="['xs', 's', 'm', 'l', 'xl']" :number-disabled-sizes="['xs', 's']" :with-color-picker="true" />
          </template>
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
