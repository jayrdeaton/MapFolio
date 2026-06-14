<script setup lang="ts">
import App from './components/App.vue'

const showSplash = ref(true)

onMounted(() => {
  setTimeout(() => {
    showSplash.value = false
  }, 50)
})
</script>

<template>
  <Transition name="splash">
    <div v-if="showSplash" style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 9999">
      <img src="/icon-180.png" style="width: 80px; height: 80px; border-radius: 18px; animation: splash-in 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) both" alt="" />
    </div>
  </Transition>
  <App />
</template>

<style>
@keyframes splash-in {
  from {
    opacity: 0;
    transform: scale(0.88);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.splash-leave-active {
  transition: opacity 0.25s;
}
.splash-leave-to {
  opacity: 0;
}
</style>
