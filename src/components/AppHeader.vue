<script setup lang="ts">
import { ChevronDown, Info, Search } from '@lucide/vue'

import type { SearchLocation } from '@/components/MapSearch.vue'
import MapSearch from '@/components/MapSearch.vue'

defineProps<{
  showSearch: boolean
  searchClearTrigger: number
  activeMapName: string
}>()

const emit = defineEmits<{
  'update:showSearch': [value: boolean]
  'location-select': [loc: SearchLocation]
  'clear-search': []
  'open-info': []
  'open-maps': []
}>()

const colorMode = useColorMode()

function cycleColorMode() {
  const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (colorMode.preference === 'system') colorMode.preference = systemIsDark ? 'light' : 'dark'
  else if (colorMode.preference === 'dark') colorMode.preference = systemIsDark ? 'system' : 'light'
  else colorMode.preference = systemIsDark ? 'dark' : 'system'
}
</script>

<template>
  <header class="relative z-[1000] bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 pb-3 flex items-center gap-3 shrink-0 no-print" style="padding-top: calc(0.75rem + env(safe-area-inset-top))">
    <div class="flex-1">
      <button class="flex items-center gap-1.5 group cursor-pointer rounded-lg px-1 -ml-1 py-0.5 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors" title="Switch map" @click="emit('open-maps')">
        <img src="/icon.svg" alt="MapFolio" class="w-5 h-5 shrink-0" />
        <span class="text-gray-800 dark:text-zinc-100 text-base font-bold truncate max-w-40">{{ activeMapName || 'MapFolio' }}</span>
        <ChevronDown :size="14" class="text-gray-400 dark:text-zinc-500 shrink-0 group-hover:text-gray-600 dark:group-hover:text-zinc-300 transition-colors" />
      </button>
    </div>

    <div class="hidden sm:flex flex-2 items-center justify-center gap-2">
      <MapSearch :clear-trigger="searchClearTrigger" @location-select="emit('location-select', $event)" @clear="emit('clear-search')" />
    </div>

    <div class="flex-1 flex items-center gap-1 justify-end">
      <!-- Mobile search toggle -->
      <button class="sm:hidden p-1.5 rounded-lg transition-colors cursor-pointer" :class="showSearch ? 'bg-teal-600 text-white hover:bg-teal-700' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800'" :aria-label="showSearch ? 'Close search' : 'Search'" @click="emit('update:showSearch', !showSearch)">
        <Search :size="18" />
      </button>

      <!-- Info / help -->
      <button aria-label="How to use MapFolio" class="p-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer" @click="emit('open-info')">
        <Info :size="18" />
      </button>

      <!-- Theme toggle -->
      <button :aria-label="colorMode.preference === 'system' ? 'System mode' : colorMode.preference === 'light' ? 'Light mode' : 'Dark mode'" class="p-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer" @click="cycleColorMode">
        <svg v-if="colorMode.preference === 'system'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <svg v-else-if="colorMode.preference === 'light'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>

      <!-- GitHub -->
      <a href="https://github.com/jayrdeaton/mapfolio" target="_blank" rel="noopener" aria-label="GitHub" class="p-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      </a>
    </div>
  </header>
</template>
