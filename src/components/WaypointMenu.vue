<script setup lang="ts">
import { Copy, Eye, EyeOff, MapPin, Pencil, Trash2, Unlink } from '@lucide/vue'

import ContextMenu from '@/components/ContextMenu.vue'
import type { Pin, Route } from '@/types'

const props = defineProps<{
  route: Route
  pointIndex: number
  linkedPin: Pin | null
  hiddenPinIds: Set<number>
}>()

const emit = defineEmits<{
  'edit-route': []
  'edit-pin': []
  'copy-coords': [coords: string]
  'break-link': []
  'hide-pin': []
  'delete-pin': []
  'add-after': []
  'delete-waypoint': []
}>()

const menuRef = ref<InstanceType<typeof ContextMenu> | null>(null)

const point = computed(() => props.route.points[props.pointIndex])
const coordStr = computed(() => {
  const pt = point.value
  return pt ? `${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}` : ''
})
const isPinHidden = computed(() => !!props.linkedPin && props.hiddenPinIds.has(props.linkedPin.id))

function openAt(x: number, y: number) {
  menuRef.value?.openAt(x, y)
}

defineExpose({ openAt })
</script>

<template>
  <ContextMenu ref="menuRef" no-trigger>
    <template v-if="linkedPin">
      <button class="mf-menu-item" @click="emit('edit-pin')"><Pencil :size="14" /> Edit Pin</button>
    </template>
    <button class="mf-menu-item" @click="emit('edit-route')"><Pencil :size="14" /> Edit Route</button>
    <button class="mf-menu-item" @click="emit('add-after')"><MapPin :size="14" /> Add Waypoints After</button>
    <button class="mf-menu-item" @click="emit('copy-coords', coordStr)"><Copy :size="14" /> {{ coordStr }}</button>
    <template v-if="linkedPin">
      <div class="mf-menu-separator" />
      <button class="mf-menu-item" @click="emit('break-link')"><Unlink :size="14" /> Unlink Pin</button>
      <button class="mf-menu-item" @click="emit('hide-pin')">
        <EyeOff v-if="!isPinHidden" :size="14" />
        <Eye v-else :size="14" />
        {{ isPinHidden ? 'Show Pin' : 'Hide Pin' }}
      </button>
    </template>
    <div class="mf-menu-separator" />
    <button class="mf-menu-item mf-menu-item--danger" @click="emit('delete-waypoint')"><Trash2 :size="14" /> Delete Waypoint</button>
    <template v-if="linkedPin">
      <button class="mf-menu-item mf-menu-item--danger" @click="emit('delete-pin')"><Trash2 :size="14" /> Delete Pin</button>
    </template>
  </ContextMenu>
</template>
