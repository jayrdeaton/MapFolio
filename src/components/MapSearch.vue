<script setup lang="ts">
import { OpenStreetMapProvider } from 'leaflet-geosearch'
import { Loader, MapPin, Search, X } from '@lucide/vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'

export interface SearchLocation {
  lat: number
  lng: number
  label: string
}

const props = withDefaults(defineProps<{ autoFocus?: boolean; clearTrigger?: number }>(), { autoFocus: false })

const emit = defineEmits<{
  'location-select': [location: SearchLocation]
  clear: []
}>()

const provider = new OpenStreetMapProvider({
  params: { 'accept-language': 'en', addressdetails: 1, limit: 5 }
})

type SearchResult = Awaited<ReturnType<typeof provider.search>>[number]

const query = ref('')
const results = ref<SearchResult[]>([])
const isSearching = ref(false)
const showResults = ref(false)
const selectedIndex = ref(-1)
const searchRef = ref<HTMLDivElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function searchLocations(searchQuery: string) {
  if (searchQuery.length < 2) {
    results.value = []
    showResults.value = false
    return
  }
  isSearching.value = true
  try {
    const res = await provider.search({ query: searchQuery })
    results.value = res.slice(0, 8)
    showResults.value = true
    selectedIndex.value = -1
  } catch {
    results.value = []
  } finally {
    isSearching.value = false
  }
}

function handleInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  query.value = value
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => searchLocations(value), 200)
}

function handleKeyDown(e: KeyboardEvent) {
  if (!showResults.value || results.value.length === 0) return
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectedIndex.value = selectedIndex.value < results.value.length - 1 ? selectedIndex.value + 1 : 0
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : results.value.length - 1
      break
    case 'Enter':
      e.preventDefault()
      if (selectedIndex.value >= 0 && results.value[selectedIndex.value]) {
        handleSelectResult(results.value[selectedIndex.value])
      }
      break
    case 'Escape':
      showResults.value = false
      selectedIndex.value = -1
      break
  }
}

function handleSelectResult(result: SearchResult) {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  query.value = result.label
  showResults.value = false
  results.value = []
  selectedIndex.value = -1
  emit('location-select', { lat: result.y, lng: result.x, label: result.label })
}

watch(() => props.clearTrigger, (v, old) => {
  if (v !== undefined && v !== old) {
    query.value = ''
    results.value = []
    showResults.value = false
    selectedIndex.value = -1
  }
})

function handleClear() {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  query.value = ''
  results.value = []
  showResults.value = false
  selectedIndex.value = -1
  emit('clear')
}

function formatLabel(label: string) {
  const parts = label.split(', ')
  if (parts.length <= 2) return label
  if (parts.length > 4) return `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`
  return label
}

function handleClickOutside(event: MouseEvent) {
  if (searchRef.value && !searchRef.value.contains(event.target as Node)) {
    showResults.value = false
    selectedIndex.value = -1
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  if (props.autoFocus) inputRef.value?.focus()
})
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))
</script>

<template>
  <div class="relative w-full max-w-100" ref="searchRef">
    <div class="relative flex items-center">
      <Search class="absolute left-3 text-gray-500 dark:text-zinc-400 pointer-events-none z-2" :size="18" />
      <input
        ref="inputRef"
        type="text"
        placeholder="Search for places, cities, addresses..."
        :value="query"
        @input="handleInput"
        @keydown="handleKeyDown"
        @focus="() => results.length > 0 && (showResults = true)"
        class="w-full py-3 pl-10 pr-10 border-2 border-gray-200 dark:border-zinc-700 rounded-lg text-base sm:text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 transition-all placeholder:text-gray-500 dark:placeholder:text-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
      />
      <Loader v-if="isSearching" class="absolute right-10 text-teal-500 animate-spin" :size="18" />
      <button
        v-if="query"
        @click="handleClear"
        class="absolute right-3 bg-transparent border-0 text-gray-500 dark:text-zinc-400 cursor-pointer flex items-center justify-center p-1 rounded hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
        type="button"
      >
        <X :size="16" />
      </button>
    </div>

    <div
      v-if="showResults && results.length > 0"
      class="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg z-1000 max-h-100 overflow-y-auto mt-1"
    >
      <div
        v-for="(result, index) in results"
        :key="`${result.x}-${result.y}-${index}`"
        :class="[
          'flex items-start p-3 cursor-pointer border-b border-gray-100 dark:border-zinc-800 transition-colors last:border-b-0',
          index === selectedIndex ? 'bg-gray-50 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
        ]"
        @click="handleSelectResult(result)"
        @mouseenter="selectedIndex = index"
      >
        <MapPin class="text-teal-500 mr-3 mt-0.5 shrink-0" :size="14" />
        <div class="flex-1 min-w-0">
          <div class="font-medium text-gray-800 dark:text-zinc-200 mb-1 wrap-break-word leading-tight">{{ formatLabel(result.label) }}</div>
          <div class="text-xs text-gray-500 dark:text-zinc-500 font-mono">{{ result.y.toFixed(4) }}, {{ result.x.toFixed(4) }}</div>
        </div>
      </div>
    </div>

    <div
      v-if="showResults && results.length === 0 && !isSearching && query.length >= 3"
      class="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg z-1000 mt-1"
    >
      <div class="flex items-center gap-2 p-4 text-gray-500 dark:text-zinc-400 italic">
        <MapPin :size="14" />
        No locations found
      </div>
    </div>
  </div>
</template>
