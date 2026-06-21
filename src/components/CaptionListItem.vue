<script setup lang="ts">
import { Copy, Eye, EyeOff, Pencil, Scissors, Trash2 } from '@lucide/vue'
import { ref } from 'vue'

import CaptionPreview from '@/components/CaptionPreview.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import { useElementLongPress } from '@/composables/useElementLongPress'
import type { Caption } from '@/types'

defineProps<{ caption: Caption; hidden?: boolean; selected?: boolean; placeholder?: string }>()
const emit = defineEmits<{
  select: [caption: Caption, shiftHeld: boolean, metaHeld: boolean]
  'edit-caption': [caption: Caption]
  'copy-coords': [text: string]
  'clip-copy': [caption: Caption]
  'clip-cut': [caption: Caption]
  'delete-caption': [id: number]
  'toggle-visibility': [id: number]
}>()

const rowRef = ref<HTMLElement | null>(null)
const menu = ref<InstanceType<typeof ContextMenu> | null>(null)

function openMenu(x: number, y: number) {
  menu.value?.openAt(x, y)
}
useElementLongPress(rowRef, openMenu)
</script>

<template>
  <div ref="rowRef" :class="['group flex items-center gap-2 px-4 py-1.5 transition-all', selected ? 'bg-cyan-50 dark:bg-cyan-900/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60', hidden ? 'opacity-40' : '']" @mousedown="($event.shiftKey || $event.metaKey || $event.ctrlKey) && $event.preventDefault()" @contextmenu.prevent="openMenu($event.clientX, $event.clientY)">
    <button class="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer" :title="caption.text || 'Select caption'" @click="emit('select', caption, $event.shiftKey, $event.metaKey || $event.ctrlKey)">
      <CaptionPreview :color="caption.color" :size="caption.size" :background="caption.background" preview class="shrink-0" />
      <span class="flex-1 min-w-0">
        <span class="block truncate text-sm transition-colors" :class="caption.text ? 'text-gray-800 dark:text-zinc-200 group-hover:text-cyan-500 dark:group-hover:text-cyan-400' : 'text-gray-400 dark:text-zinc-500 italic'">{{ caption.text || placeholder || 'Caption' }}</span>
        <span class="block text-xs text-gray-400 dark:text-zinc-500 font-mono tabular-nums">{{ caption.lat.toFixed(4) }}, {{ caption.lng.toFixed(4) }}</span>
      </span>
    </button>
    <div class="flex gap-1 shrink-0">
      <button class="mf-ibtn w-7 h-7" :title="hidden ? 'Show this caption on map' : 'Hide this caption from map'" @click="emit('toggle-visibility', caption.id)">
        <EyeOff v-if="hidden" :size="13" />
        <Eye v-else :size="13" />
      </button>
      <ContextMenu ref="menu">
        <button class="mf-menu-item" @click="emit('edit-caption', caption)"><Pencil :size="14" /> Edit Caption</button>
        <button class="mf-menu-item" @click="emit('copy-coords', `${caption.lat.toFixed(5)}, ${caption.lng.toFixed(5)}`)">
          <Copy :size="14" /><span class="truncate max-w-36">{{ caption.lat.toFixed(5) }}, {{ caption.lng.toFixed(5) }}</span>
        </button>
        <button class="mf-menu-item" @click="emit('clip-copy', caption)"><Copy :size="14" /> Copy Caption</button>
        <button class="mf-menu-item" @click="emit('clip-cut', caption)"><Scissors :size="14" /> Cut Caption</button>
        <button class="mf-menu-item mf-menu-item--danger" @click="emit('delete-caption', caption.id)"><Trash2 :size="14" /> Delete Caption</button>
      </ContextMenu>
    </div>
  </div>
</template>
