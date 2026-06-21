<script setup lang="ts">
import type { CaptionSize } from '@/types'

const props = defineProps<{
  color: string
  size?: CaptionSize
  background?: boolean
  // List rows / pills: a uniform compact glyph at a fixed small size. The edit form omits this so it
  // shows the caption's real size as a live preview. Both render the same skin (halo / highlight chip).
  preview?: boolean
}>()

// Preview-only font sizes (px) — proportional to the real CaptionSize but scaled up so the
// size choice reads clearly in the edit form's ~44px box. Mirrors CAPTION_PX ordering.
const PREVIEW_PX: Record<CaptionSize, number> = { xs: 14, s: 19, m: 24, l: 30, xl: 38 }

// Preview mode is a compact list/pill icon at a fixed small size; the form scales by CaptionSize.
const fontPx = computed(() => (props.preview ? 16 : PREVIEW_PX[props.size ?? 'm']))

// Perceived luminance (Rec. 601) of the text colour. Keyed off the text colour (not the app theme)
// so the halo always opposes the glyph — dark text gets a white glow, light text a dark one. Mirrors
// CaptionMarker.isLightColor so the preview's halo matches the map exactly.
function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}

// Mirror CaptionMarker's "skin" across every context (form, list rows, pills) so all three reflect
// the caption's real treatment.
const style = computed(() => {
  const base = { color: props.color, fontSize: fontPx.value + 'px' }
  // Highlight pill. The map caption uses a solid white/dark pill for legibility on tiles, but that
  // colour vanishes against the app's matching white/dark UI surfaces — the form box, list rows and
  // pills are all the same colour as the pill. So the highlight uses one neutral translucent chip:
  // visible on any surface and theme, signalling "this caption has a highlight background." Padding
  // scales with the glyph so it stays proportional from the 16px row icon up to the form's preview.
  if (props.background) {
    const padY = Math.max(1, Math.round(fontPx.value * 0.14))
    const padX = Math.max(4, Math.round(fontPx.value * 0.34))
    return { ...base, background: 'rgba(125,125,125,0.22)', padding: `${padY}px ${padX}px`, borderRadius: '5px', border: '1px solid rgba(125,125,125,0.4)' }
  }
  // No background: the same legibility halo the map caption uses — a glow that opposes the text
  // colour. Dark (default) text gets the white glow, which reads on the dark selection pill / dark
  // panels; on light surfaces the dark text stays legible and the glow is simply imperceptible.
  const halo = isLightColor(props.color) ? '#18181b' : '#fff'
  return { ...base, textShadow: `0 0 2px ${halo},0 0 2px ${halo},0 0 3px ${halo}` }
})
</script>

<template>
  <span class="font-bold leading-none" :style="style">T</span>
</template>
