<script setup lang="ts">
import type { PinDotShape, PinDotSize } from '@/types'

const props = defineProps<{
  emoji: string
  color: string
  dotSize?: PinDotSize
  dotShape?: PinDotShape
  showNumber?: boolean
  // The pin's actual index to render inside the dot. Falls back to "#" when omitted (e.g. the
  // edit form, where a not-yet-placed pin has no index).
  number?: number
  // List rows / pills: a compact miniature — a small emoji stacked over a small uniform dot,
  // like the map marker. Dotless pins just show the emoji. The edit form omits this to show
  // the pin's real emoji + dot size as a live preview.
  preview?: boolean
}>()

// Preview uses a uniform 16px dot ('s') so every pin dot — and the route preview's waypoints —
// read at the same size. The form keeps the pin's real dot size.
const resolvedSize = computed<PinDotSize>(() => (props.preview ? 's' : (props.dotSize ?? 'none')))
const resolvedShape = computed(() => props.dotShape ?? 'circle')
const hasDot = computed(() => (props.dotSize ?? 'none') !== 'none')
const numberVisible = computed(() => props.showNumber && hasDot.value && (props.preview || ['m', 'l', 'xl'].includes(props.dotSize ?? 'none')))
const numFontSize = computed(() => {
  // Compact preview dot: shrink the font for multi-digit indices so they fit the small dot.
  if (props.preview) return (props.number ?? 0) >= 100 ? '6px' : (props.number ?? 0) >= 10 ? '7px' : '8px'
  if (resolvedSize.value === 'xl') return '13px'
  if (resolvedSize.value === 'l') return '10px'
  return '8px'
})
</script>

<template>
  <div class="flex flex-col items-center">
    <span v-if="emoji" class="pin-emoji" :style="preview ? { fontSize: '16px' } : undefined">{{ emoji }}</span>
    <div v-if="hasDot" :class="['pin-dot', `pin-dot--${resolvedSize}`, `pin-dot--${resolvedShape}`]" :style="{ background: color }">
      <span
        v-if="numberVisible"
        :style="{
          color: 'white',
          fontSize: numFontSize,
          fontWeight: '700',
          lineHeight: '1',
          pointerEvents: 'none',
          userSelect: 'none',
          transform: resolvedShape === 'diamond' ? 'rotate(-45deg)' : undefined
        }"
        >{{ number ?? '#' }}</span
      >
    </div>
  </div>
</template>
