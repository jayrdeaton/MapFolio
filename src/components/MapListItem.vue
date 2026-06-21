<script setup lang="ts">
import { Copy, Map, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'

import ContextMenu from '@/components/ContextMenu.vue'
import { useElementLongPress } from '@/composables/useElementLongPress'
import type { MapData } from '@/types'

const props = defineProps<{ map: MapData; active?: boolean; canDelete?: boolean }>()
const emit = defineEmits<{
  switch: [id: string]
  duplicate: [id: string]
  delete: [id: string]
}>()

const rowRef = ref<HTMLElement | null>(null)
const menu = ref<InstanceType<typeof ContextMenu> | null>(null)

function openMenu(x: number, y: number) {
  menu.value?.openAt(x, y)
}
useElementLongPress(rowRef, openMenu)

const counts = computed(() => {
  const p = props.map.pins.length
  const r = props.map.routes.length
  const c = props.map.captions?.length ?? 0
  const parts: string[] = []
  if (p) parts.push(`${p} point${p === 1 ? '' : 's'}`)
  if (r) parts.push(`${r} route${r === 1 ? '' : 's'}`)
  if (c) parts.push(`${c} caption${c === 1 ? '' : 's'}`)
  return parts
})

const countLabel = computed(() => (counts.value.length ? counts.value.join(' · ') : 'empty'))

function doDelete() {
  menu.value?.close()
  // Defer the blocking confirm() until the menu has closed and repainted, so
  // it isn't left hanging behind the dialog. Two frames guarantees a paint.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const detail = counts.value.length ? `\n\nThis will also permanently delete ${counts.value.join(', ')}.` : ''
      if (!window.confirm(`Delete "${props.map.name}"?${detail}\n\nThis is permanent and cannot be undone.`)) return
      emit('delete', props.map.id)
    })
  )
}
</script>

<template>
  <div ref="rowRef" :class="['group flex items-center gap-2 px-4 py-1.5 transition-all', active ? 'bg-cyan-50 dark:bg-cyan-900/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60']" @contextmenu.prevent="openMenu($event.clientX, $event.clientY)">
    <button class="flex-1 flex items-center gap-2 text-left min-w-0 cursor-pointer" :title="active ? 'Active map' : `Switch to ${map.name}`" @click="!active && emit('switch', map.id)">
      <Map :size="14" class="shrink-0 transition-colors" :class="active ? 'text-cyan-500' : 'text-gray-400 dark:text-zinc-600 group-hover:text-cyan-400'" />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate transition-colors" :class="active ? 'text-cyan-500' : 'text-gray-800 dark:text-zinc-200 group-hover:text-cyan-500 dark:group-hover:text-cyan-400'">
          {{ map.name }}
        </div>
        <div v-if="map.area" class="text-xs text-gray-400 dark:text-zinc-500 truncate">{{ map.area }}</div>
        <div class="text-xs text-gray-400 dark:text-zinc-500 tabular-nums">{{ countLabel }}</div>
      </div>
    </button>

    <div class="flex gap-1 shrink-0">
      <ContextMenu ref="menu">
        <button class="mf-menu-item" @click="emit('duplicate', map.id)"><Copy :size="14" /> Duplicate Map</button>
        <button v-if="canDelete" class="mf-menu-item mf-menu-item--danger" @click="doDelete"><Trash2 :size="14" /> Delete Map</button>
      </ContextMenu>
    </div>
  </div>
</template>
