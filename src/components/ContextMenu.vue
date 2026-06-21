<script setup lang="ts">
import { EllipsisVertical } from '@lucide/vue'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

// Shared row action menu. Renders the kebab trigger where it's placed; the
// menu itself is teleported to <body> so it never gets clipped by the panel's
// `overflow-y-auto`. Opens via the kebab (anchored under it) or via
// `openAt(x, y)` for right-click / long-press on the host row.
// `noTrigger` renders only the teleported menu (no kebab button) — for hosts that open it
// purely via `openAt(x, y)`, e.g. a map right-click menu.
withDefaults(defineProps<{ triggerClass?: string; iconSize?: number; noTrigger?: boolean }>(), {
  triggerClass: 'w-7 h-7',
  iconSize: 13,
  noTrigger: false
})

const MENU_W = 168
const GAP = 8

const open = ref(false)
const pos = ref<{ left: number; top: number }>({ left: 0, top: 0 })
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

function clampAndPlace(left: number, top: number, estHeight: number) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (left + MENU_W > vw - GAP) left = vw - GAP - MENU_W
  if (left < GAP) left = GAP
  if (top + estHeight > vh - GAP) top = Math.max(GAP, vh - GAP - estHeight)
  pos.value = { left, top }
}

async function show(left: number, top: number) {
  clampAndPlace(left, top, 120)
  open.value = true
  await nextTick()
  const h = menuRef.value?.offsetHeight ?? 120
  // Re-clamp now that we know the real height (e.g. flip up near the bottom).
  clampAndPlace(pos.value.left, pos.value.top, h)
}

function openAt(x: number, y: number) {
  void show(x, y)
}

function openUnderTrigger() {
  const r = triggerRef.value?.getBoundingClientRect()
  if (r) void show(r.right - MENU_W, r.bottom + 4)
}

function close() {
  open.value = false
}

function toggle() {
  if (open.value) close()
  else openUnderTrigger()
}

function onDocPointerDown(e: PointerEvent) {
  const t = e.target as Node
  if (menuRef.value?.contains(t) || triggerRef.value?.contains(t)) return
  close()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(open, (v) => {
  if (v) {
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('scroll', close, true)
    window.removeEventListener('resize', close)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
})

defineExpose({ openAt, close })
</script>

<template>
  <button v-if="!noTrigger" ref="triggerRef" class="mf-ibtn" :class="[triggerClass, { 'mf-ibtn--active': open }]" title="More actions" aria-haspopup="menu" :aria-expanded="open" @click.stop="toggle">
    <EllipsisVertical :size="iconSize" />
  </button>

  <Teleport to="body">
    <div v-if="open" ref="menuRef" class="mf-menu fixed z-2000 no-print" :style="{ left: `${pos.left}px`, top: `${pos.top}px` }" role="menu" @click="close">
      <slot />
    </div>
  </Teleport>
</template>
