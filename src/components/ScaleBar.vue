<script setup lang="ts">
import L from 'leaflet'
const props = defineProps<{
  map: L.Map | null
}>()

const unit = defineModel<'km' | 'mi'>('unit', { required: true })

function toggleUnit() {
  unit.value = unit.value === 'km' ? 'mi' : 'km'
}

const TARGET_PX = 220

function niceValue(value: number, steps: number[]): number {
  return steps.reduce((best, s) => (s <= value ? s : best), steps[0] ?? 0)
}

const barWidthPx = ref(0)
const label = ref('')

function updateScale() {
  const map = props.map
  if (!map) return

  const { lat } = map.getCenter()
  const zoom = map.getZoom()
  const metersPerPx = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8)
  const targetMeters = TARGET_PX * metersPerPx

  let width: number
  let lbl: string

  if (unit.value === 'mi') {
    const targetMi = targetMeters / 1609.344
    if (targetMi >= 0.25) {
      const niceMi = niceValue(targetMi, [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000])
      width = (niceMi * 1609.344) / metersPerPx
      lbl = `${niceMi} mi`
    } else {
      const targetFt = targetMeters * 3.28084
      const niceFt = niceValue(targetFt, [50, 100, 200, 300, 400, 500, 1000, 2000])
      width = niceFt / 3.28084 / metersPerPx
      lbl = `${niceFt} ft`
    }
  } else {
    const targetKm = targetMeters / 1000
    if (targetKm >= 1) {
      const niceKm = niceValue(targetKm, [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000])
      width = (niceKm * 1000) / metersPerPx
      lbl = `${niceKm} km`
    } else {
      const niceM = niceValue(targetMeters, [50, 100, 200, 500, 1000])
      width = niceM / metersPerPx
      lbl = `${niceM} m`
    }
  }

  barWidthPx.value = Math.round(width)
  label.value = lbl
}

function attachListeners(map: L.Map) {
  map.on('move', updateScale)
  updateScale()
}

function detachListeners(map: L.Map) {
  map.off('move', updateScale)
}

watch(
  () => props.map,
  (newMap, oldMap) => {
    if (oldMap) detachListeners(oldMap)
    if (newMap) attachListeners(newMap)
  },
  { immediate: true }
)

watch(unit, updateScale)

onUnmounted(() => {
  if (props.map) detachListeners(props.map)
})
</script>

<template>
  <button v-if="barWidthPx > 0" type="button" :title="unit === 'mi' ? 'Switch distances to kilometers' : 'Switch distances to miles'" class="group pointer-events-auto select-none inline-block cursor-pointer text-left" @click="toggleUnit">
    <div class="bg-white/95 dark:bg-zinc-900/95 rounded-md shadow-sm border border-gray-300/60 dark:border-zinc-600/60 group-hover:border-cyan-500 dark:group-hover:border-cyan-400 transition-colors px-2 pt-1.5 pb-1.5">
      <div class="flex h-1.25 border border-gray-800 dark:border-zinc-300 overflow-hidden" :style="{ width: `${barWidthPx}px` }">
        <div class="flex-1 bg-gray-800 dark:bg-zinc-300" />
        <div class="flex-1 bg-white dark:bg-zinc-900 border-l border-gray-800 dark:border-zinc-300" />
      </div>
      <div class="flex justify-between mt-0.75" :style="{ width: `${barWidthPx}px` }">
        <span v-if="barWidthPx >= 60" class="text-[9px] leading-none font-sans text-gray-900 dark:text-zinc-100">0</span>
        <span class="text-[9px] leading-none font-sans text-gray-900 dark:text-zinc-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">{{ label }}</span>
      </div>
    </div>
  </button>
</template>
