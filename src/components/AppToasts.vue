<script setup lang="ts">
defineProps<{
  notification: { message: string; type: 'success' | 'error' | 'info' } | null
  addressResolveProg: { done: number; total: number } | null
}>()
</script>

<template>
  <Transition name="mf-toast">
    <div v-if="addressResolveProg" class="fixed top-16 left-1/2 -translate-x-1/2 bg-cyan-500 text-white text-sm px-4 pt-2.5 pb-2 rounded shadow-lg z-1999 no-print min-w-52">
      <div class="whitespace-nowrap mb-1.5">Resolving addresses {{ addressResolveProg.done }} / {{ addressResolveProg.total }}</div>
      <div class="h-1 bg-cyan-400/50 rounded-full overflow-hidden">
        <div class="h-full bg-white/80 rounded-full transition-[width] duration-500" :style="{ width: `${(addressResolveProg.done / addressResolveProg.total) * 100}%` }" />
      </div>
    </div>
  </Transition>

  <div v-if="notification" :class="['fixed top-16 left-1/2 -translate-x-1/2 text-white text-sm px-4 py-2.5 rounded shadow-lg z-2000 animate-[slideIn_0.25s_ease] no-print whitespace-nowrap', notification.type === 'error' ? 'bg-rose-500' : notification.type === 'info' ? 'bg-cyan-500' : 'bg-emerald-500']">
    {{ notification.message }}
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
  transform: translateX(-50%) translateY(-6px);
}
.mf-toast-enter-to,
.mf-toast-leave-from {
  transform: translateX(-50%) translateY(0);
}
</style>
