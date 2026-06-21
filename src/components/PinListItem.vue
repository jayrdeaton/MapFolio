<script setup lang="ts">
import { Copy, Eye, EyeOff, Pencil, Scissors, Trash2 } from '@lucide/vue'
import { ref } from 'vue'

import ContextMenu from '@/components/ContextMenu.vue'
import PinPreview from '@/components/PinPreview.vue'
import { useElementLongPress } from '@/composables/useElementLongPress'
import type { Pin } from '@/types'

defineProps<{ pin: Pin; hidden?: boolean; resolving?: boolean; number?: number; selected?: boolean; placeholder?: string }>()
const emit = defineEmits<{
  delete: [id: number]
  edit: [pin: Pin]
  'copy-coords': [text: string]
  'clip-copy': [pin: Pin]
  'clip-cut': [pin: Pin]
  select: [pin: Pin, shiftHeld: boolean, metaHeld: boolean]
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
    <button class="pin-drag-handle text-base leading-none shrink-0 cursor-grab active:cursor-grabbing hover:scale-125 transition-transform" :title="pin.name ? `Select ${pin.name}` : 'Select pin'" @click="emit('select', pin, $event.shiftKey, $event.metaKey || $event.ctrlKey)">
      <PinPreview :emoji="pin.emoji" :color="pin.color" :dot-size="pin.dotSize" :dot-shape="pin.dotShape" :show-number="pin.showNumber" :number="number" preview />
    </button>
    <div class="flex-1 min-w-0 cursor-pointer" :title="pin.name ? `Select ${pin.name}` : 'Select pin'" @click="emit('select', pin, $event.shiftKey, $event.metaKey || $event.ctrlKey)">
      <div class="text-sm font-medium truncate transition-colors" :class="pin.name ? 'text-gray-800 dark:text-zinc-200 group-hover:text-cyan-500 dark:group-hover:text-cyan-400' : 'text-gray-400 dark:text-zinc-500 italic'">{{ pin.name || placeholder || 'Unnamed' }}</div>
      <div v-if="pin.description" class="text-xs text-gray-400 dark:text-zinc-500 truncate">{{ pin.description }}</div>
      <div class="text-xs text-gray-400 dark:text-zinc-500 font-mono tabular-nums">{{ pin.lat.toFixed(4) }}, {{ pin.lng.toFixed(4) }}</div>
      <div v-if="pin.address" class="text-xs text-gray-400 dark:text-zinc-500 truncate">{{ pin.address }}</div>
      <div v-else-if="resolving" class="text-xs text-gray-300 dark:text-zinc-600 animate-pulse">Resolving address…</div>
    </div>
    <div class="flex gap-1 shrink-0">
      <button class="mf-ibtn w-7 h-7" :title="hidden ? 'Show this pin on map' : 'Hide this pin from map'" @click="emit('toggle-visibility', pin.id)">
        <EyeOff v-if="hidden" :size="13" />
        <Eye v-else :size="13" />
      </button>
      <ContextMenu ref="menu">
        <button class="mf-menu-item" @click="emit('edit', pin)"><Pencil :size="14" /> Edit Pin</button>
        <button class="mf-menu-item" @click="emit('copy-coords', `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`)">
          <Copy :size="14" /><span class="truncate max-w-36">{{ pin.lat.toFixed(5) }}, {{ pin.lng.toFixed(5) }}</span>
        </button>
        <button v-if="pin.address" class="mf-menu-item" @click="emit('copy-coords', pin.address!)">
          <Copy :size="14" /><span class="truncate max-w-36">{{ pin.address }}</span>
        </button>
        <button class="mf-menu-item" @click="emit('clip-copy', pin)"><Copy :size="14" /> Copy Pin</button>
        <button class="mf-menu-item" @click="emit('clip-cut', pin)"><Scissors :size="14" /> Cut Pin</button>
        <button class="mf-menu-item mf-menu-item--danger" @click="emit('delete', pin.id)"><Trash2 :size="14" /> Delete Pin</button>
      </ContextMenu>
    </div>
  </div>
</template>
