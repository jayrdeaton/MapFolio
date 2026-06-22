<script setup lang="ts">
import type { CaptionSize } from '@/types'
import { isDarkColor } from '@/utils'

const props = defineProps<{
  color: string
  size?: CaptionSize
  background?: boolean
  preview?: boolean
}>()

const PREVIEW_PX: Record<CaptionSize, number> = { xs: 14, s: 19, m: 24, l: 30, xl: 38 }
const fontPx = computed(() => (props.preview ? 16 : PREVIEW_PX[props.size ?? 'm']))

const style = computed(() => {
  if (props.background) {
    const textColor = isDarkColor(props.color) ? '#ffffff' : '#111827'
    const padY = Math.max(1, Math.round(fontPx.value * 0.14))
    const padX = Math.max(4, Math.round(fontPx.value * 0.34))
    return { color: textColor, fontSize: fontPx.value + 'px', background: props.color, padding: `${padY}px ${padX}px`, borderRadius: '5px' }
  }
  return { color: props.color, fontSize: fontPx.value + 'px', textShadow: '0 0 2px #fff,0 0 2px #fff,0 0 3px #fff' }
})
</script>

<template>
  <span class="font-bold leading-none" :style="style">T</span>
</template>
