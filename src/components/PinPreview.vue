<script setup lang="ts">
import type { PinDotShape, PinDotSize } from '@/types'
import { isDarkColor } from '@/utils'
import { emojiToDataUrl } from '@/utils/emoji'

const props = defineProps<{
  emoji: string
  color: string
  dotSize?: PinDotSize
  dotShape?: PinDotShape
  showNumber?: boolean
  // The pin's actual index to render inside the dot. Falls back to "#" when omitted (e.g. the
  // edit form, where a not-yet-placed pin has no index).
  number?: number
  // List rows / pills: a compact miniature. The edit form omits this to show a live preview.
  preview?: boolean
}>()

const resolvedSize = computed<PinDotSize>(() => (props.preview ? 's' : (props.dotSize ?? 'm')))
const resolvedShape = computed(() => props.dotShape ?? 'circle')
const numberVisible = computed(() => props.showNumber && (props.preview || ['m', 'l', 'xl'].includes(props.dotSize ?? 'm')))
const numFontSize = computed(() => {
  if (props.preview) return (props.number ?? 0) >= 100 ? '6px' : (props.number ?? 0) >= 10 ? '7px' : '8px'
  if (resolvedSize.value === 'xl') return '13px'
  if (resolvedSize.value === 'l') return '10px'
  return '8px'
})
const BUBBLE_EMOJI_SIZE: Record<PinDotSize, number> = { xs: 14, s: 16, m: 20, l: 24, xl: 30 }
const emojiFontPx = computed(() => (props.preview ? 14 : BUBBLE_EMOJI_SIZE[resolvedSize.value]))
// canvasPx adds a 2px buffer on each side so glyphs whose ink slightly exceeds the em-square
// are not clipped at the canvas edge (same logic as PinMarker).
const emojiCanvasPx = computed(() => emojiFontPx.value + 4)
const emojiSrc = computed(() => (props.emoji ? emojiToDataUrl(props.emoji, emojiFontPx.value, emojiCanvasPx.value) : ''))
const dotRingBox = computed(() => (props.color === 'transparent' ? 'none' : '0 0 0 2px #ffffff'))
const dotFilter = computed(() => (props.color === 'transparent' ? undefined : 'drop-shadow(0 1px 4px rgba(0,0,0,0.3))'))
const numColor = computed(() => (isDarkColor(props.color) ? '#ffffff' : '#1f2937'))
</script>

<template>
  <div class="flex flex-col items-center">
    <!-- Emoji bubble mode -->
    <div v-if="emoji" :style="color !== 'transparent' ? { filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.3))' } : undefined" class="flex flex-col items-center">
      <div :class="['pin-bubble', preview ? 'pin-bubble--preview' : '', color === 'transparent' ? 'pin-bubble--clear' : '']" :style="color !== 'transparent' ? { background: color } : undefined">
        <!-- Canvas-rendered img prevents Apple Color Emoji from painting outside overflow:hidden via its own compositing layer -->
        <img :src="emojiSrc" :style="{ display: 'block', width: `${emojiCanvasPx}px`, height: `${emojiCanvasPx}px`, minWidth: 0, minHeight: 0, pointerEvents: 'none', ...(color === 'transparent' ? { filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' } : {}) }" />
      </div>
      <div v-if="color !== 'transparent'" class="pin-bubble-tip" :style="{ borderTopColor: color }" />
    </div>
    <!-- Dot mode -->
    <template v-else>
      <div :class="['pin-dot', `pin-dot--${resolvedSize}`, `pin-dot--${resolvedShape}`]" :style="{ background: color, boxShadow: dotRingBox, filter: dotFilter }">
        <span
          v-if="numberVisible"
          :style="{
            color: numColor,
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
    </template>
  </div>
</template>
