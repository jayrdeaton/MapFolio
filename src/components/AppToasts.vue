<script setup lang="ts">
import { X } from '@lucide/vue'

defineProps<{
  notification: { message: string; type: 'success' | 'error' | 'info' } | null
  addressResolveProg: { done: number; total: number } | null
  onCancel?: (() => void) | null
}>()
</script>

<template>
  <div class="fixed left-1/2 -translate-x-1/2 z-2000 flex flex-col items-center gap-2 no-print pointer-events-none max-w-[calc(100vw-2rem)]" style="bottom: calc(1.5rem + env(safe-area-inset-bottom))">
    <Transition name="mf-toast">
      <div v-if="addressResolveProg" class="bg-teal-600 text-white text-sm px-4 pt-2.5 pb-2 rounded shadow-lg min-w-52">
        <div class="whitespace-nowrap mb-1.5">Resolving addresses {{ addressResolveProg.done }} / {{ addressResolveProg.total }}</div>
        <div class="h-1 bg-teal-400/50 rounded-full overflow-hidden">
          <div class="h-full bg-white/80 rounded-full transition-[width] duration-500" :style="{ width: `${(addressResolveProg.done / addressResolveProg.total) * 100}%` }" />
        </div>
      </div>
    </Transition>

    <Transition name="mf-toast">
      <div v-if="notification" :class="['text-white text-sm rounded shadow-lg whitespace-nowrap flex items-center gap-2', onCancel ? 'pointer-events-auto pl-4 pr-2 py-2' : 'px-4 py-2.5', notification.type === 'error' ? 'bg-rose-500' : notification.type === 'info' ? 'bg-teal-600' : 'bg-emerald-500']">
        {{ notification.message }}
        <button v-if="onCancel" class="shrink-0 opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded" title="Cancel" @click="onCancel">
          <X :size="13" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style>
.mf-toast-enter-active,
.mf-toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.mf-toast-enter-from,
.mf-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.mf-toast-enter-to,
.mf-toast-leave-from {
  transform: translateY(0);
}
</style>
