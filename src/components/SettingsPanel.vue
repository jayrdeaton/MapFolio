<script setup lang="ts">
import { Crosshair, Layers, Magnet, Ruler, Triangle, Type, ZoomIn } from '@lucide/vue'

import type { MapStyle } from '@/types'
import { MAP_STYLE_CONFIGS } from '@/types'

const props = defineProps<{
  mapStyle: MapStyle
  showLabels: boolean
  isDark: boolean
  previewTile: { z: number; x: number; y: number }
}>()
const emit = defineEmits<{
  'style-change': [style: MapStyle]
  'labels-change': [value: boolean]
}>()

const showCoords = defineModel<boolean>('showCoords', { required: true })
const showScale = defineModel<boolean>('showScale', { required: true })
const showZoom = defineModel<boolean>('showZoom', { required: true })
const mapUnits = defineModel<'km' | 'mi'>('mapUnits', { required: true })
const routeSnap = defineModel<boolean>('routeSnap', { required: true })
const angleSnap = defineModel<boolean>('angleSnap', { required: true })

const sectionLabelClass = 'block text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide'

const STYLES: MapStyle[] = ['clean', 'minimal', 'standard', 'satellite', 'terrain']
const labelsApplicable = computed(() => props.mapStyle === 'clean' || props.mapStyle === 'satellite')

// Preview swatch rendered from each style's own tile source at the map's current
// center/zoom — a live preview with no bundled assets.
function previewUrl(style: MapStyle): string {
  const cfg = MAP_STYLE_CONFIGS[style]
  const base = props.isDark && cfg.darkUrl ? cfg.darkUrl : cfg.url
  return base.replace('{s}', 'a').replace('{z}', String(props.previewTile.z)).replace('{x}', String(props.previewTile.x)).replace('{y}', String(props.previewTile.y)).replace('{r}', '')
}
</script>

<template>
  <div>
    <!-- Sticky header -->
    <div class="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800 px-4 pt-4 pb-3">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wide"> <Layers :size="12" /> Style</span>
      </div>
    </div>

    <!-- Style list -->
    <div class="py-1 border-t border-gray-100 dark:border-zinc-800">
      <button v-for="style in STYLES" :key="style" :class="['group w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-all', mapStyle === style ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60']" @click="emit('style-change', style)">
        <img :src="previewUrl(style)" alt="" loading="lazy" class="w-20 h-20 rounded object-cover shrink-0 border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800" />
        <div class="min-w-0">
          <div :class="['text-sm font-medium leading-tight transition-colors', mapStyle === style ? 'text-teal-600' : 'text-gray-800 dark:text-zinc-200 group-hover:text-teal-600 dark:group-hover:text-teal-400']">{{ MAP_STYLE_CONFIGS[style].name }}</div>
          <div class="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 leading-tight">{{ MAP_STYLE_CONFIGS[style].description }}</div>
        </div>
      </button>
    </div>

    <!-- Sticky footer: display options -->
    <div class="sticky bottom-0 bg-gray-50 dark:bg-zinc-800 border-t border-gray-100 dark:border-zinc-800 px-4 pt-3 pb-4">
      <div class="flex items-center justify-between">
        <span :class="sectionLabelClass" style="margin-bottom: 0">Display</span>
        <div class="flex items-center gap-1">
          <!-- Distance units (km/mi) — drives the scale bar, route distances, and PDF scale -->
          <div class="mf-seg">
            <button v-for="u in ['km', 'mi'] as const" :key="u" :title="`Show distances in ${u === 'km' ? 'kilometers' : 'miles'}`" :class="['mf-seg-btn', mapUnits === u && 'mf-seg-btn--active']" @click="mapUnits = u">{{ u }}</button>
          </div>
          <button :disabled="!labelsApplicable" :title="!labelsApplicable ? 'Labels are baked into this style' : showLabels ? 'Hide map labels' : 'Show map labels'" :class="['mf-ibtn w-7 h-7', labelsApplicable && showLabels && 'mf-ibtn--active']" @click="emit('labels-change', !showLabels)">
            <Type :size="13" />
          </button>
          <button :title="showZoom ? 'Hide zoom controls' : 'Show zoom controls'" :class="['mf-ibtn w-7 h-7', showZoom && 'mf-ibtn--active']" @click="showZoom = !showZoom">
            <ZoomIn :size="13" />
          </button>
          <button :title="showCoords ? 'Hide coordinates' : 'Show coordinates'" :class="['mf-ibtn w-7 h-7', showCoords && 'mf-ibtn--active']" @click="showCoords = !showCoords">
            <Crosshair :size="13" />
          </button>
          <button :title="showScale ? 'Hide scale bar' : 'Show scale bar'" :class="['mf-ibtn w-7 h-7', showScale && 'mf-ibtn--active']" @click="showScale = !showScale">
            <Ruler :size="13" />
          </button>
        </div>
      </div>

      <!-- Route drawing defaults -->
      <div class="flex items-center justify-between mt-3">
        <span :class="sectionLabelClass" style="margin-bottom: 0">Drawing</span>
        <div class="flex gap-1">
          <button :class="['mf-ibtn w-7 h-7', routeSnap && 'mf-ibtn--active']" title="Snap pins and waypoints to each other" @click="routeSnap = !routeSnap"><Magnet :size="13" /></button>
          <button :class="['mf-ibtn w-7 h-7', angleSnap && 'mf-ibtn--active']" title="Lock route segments and caption rotation to 15° angles (Shift inverts)" @click="angleSnap = !angleSnap"><Triangle :size="13" /></button>
        </div>
      </div>
    </div>
  </div>
</template>
