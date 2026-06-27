<script setup lang="ts">
import { Copy, Eye, EyeOff, Pencil, Printer, Scissors, Trash2 } from '@lucide/vue'
import { ref } from 'vue'

import ContextMenu from '@/components/ContextMenu.vue'
import { useElementLongPress } from '@/composables/useElementLongPress'
import type { PrintArea } from '@/types'
import { isAdditiveEvent } from '@/utils'

defineProps<{ area: PrintArea; selected?: boolean; placeholder?: string; subtitlePlaceholder?: string }>()
const emit = defineEmits<{
  select: [id: string, additive: boolean]
  'toggle-visibility': [id: string]
  edit: [id: string]
  copy: [id: string]
  cut: [id: string]
  delete: [id: string]
}>()

const rowRef = ref<HTMLElement | null>(null)
const menu = ref<InstanceType<typeof ContextMenu> | null>(null)

function openMenu(x: number, y: number) {
  menu.value?.openAt(x, y)
}
useElementLongPress(rowRef, openMenu)
</script>

<template>
  <div ref="rowRef" :class="['group flex items-center gap-2 px-4 py-1.5 transition-all', selected ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60', area.hidden ? 'opacity-40' : '']" @mousedown="($event.shiftKey || $event.metaKey || $event.ctrlKey) && $event.preventDefault()" @contextmenu.prevent="openMenu($event.clientX, $event.clientY)">
    <!-- Printer icon / drag handle -->
    <div class="print-area-drag-handle shrink-0 cursor-grab active:cursor-grabbing text-gray-400 dark:text-zinc-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors" :title="area.title ? `Select ${area.title}` : 'Select Print'" @click="emit('select', area.id, $event.shiftKey || isAdditiveEvent($event))">
      <Printer :size="14" />
    </div>

    <!-- Title + subtitle -->
    <div class="flex-1 min-w-0 cursor-pointer" :title="`Select ${area.title || placeholder || 'print'}`" @click="emit('select', area.id, $event.shiftKey || isAdditiveEvent($event))">
      <div class="text-sm font-medium truncate transition-colors" :class="area.title ? 'text-gray-800 dark:text-zinc-200 group-hover:text-teal-600 dark:group-hover:text-teal-400' : 'text-gray-400 dark:text-zinc-500 italic'">
        {{ area.title || placeholder || 'Unnamed' }}
      </div>
      <div v-if="area.subtitle || subtitlePlaceholder" class="text-xs truncate" :class="area.subtitle ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-300 dark:text-zinc-600 italic'">{{ area.subtitle || subtitlePlaceholder }}</div>
    </div>

    <!-- Actions -->
    <div class="flex gap-1 shrink-0">
      <button class="mf-ibtn w-7 h-7" :title="area.hidden ? 'Show on map' : 'Hide from map'" @click="emit('toggle-visibility', area.id)">
        <EyeOff v-if="area.hidden" :size="13" />
        <Eye v-else :size="13" />
      </button>
      <ContextMenu ref="menu">
        <button class="mf-menu-item" @click="emit('copy', area.id)"><Copy :size="14" /> Copy Print</button>
        <button class="mf-menu-item" @click="emit('cut', area.id)"><Scissors :size="14" /> Cut Print</button>
        <button class="mf-menu-item" @click="emit('edit', area.id)"><Pencil :size="14" /> Edit Print</button>
        <button class="mf-menu-item mf-menu-item--danger" @click="emit('delete', area.id)"><Trash2 :size="14" /> Delete Print</button>
      </ContextMenu>
    </div>
  </div>
</template>
