<script setup lang="ts">
import { LTileLayer } from '@vue-leaflet/vue-leaflet'

import type { MapStyle } from '../types'
import { MAP_STYLE_CONFIGS } from '../types'

const props = defineProps<{ style: MapStyle; isDark: boolean }>()
const config = computed(() => MAP_STYLE_CONFIGS[props.style])
const effectiveUrl = computed(() => (props.isDark && config.value.darkUrl ? config.value.darkUrl : config.value.url))
const tileOptions = computed(() => (config.value.maxNativeZoom != null ? { maxNativeZoom: config.value.maxNativeZoom } : {}))
</script>

<template>
  <LTileLayer :key="`${style}-${isDark}`" :url="effectiveUrl" :attribution="config.attribution" :subdomains="config.subdomains ?? ''" :options="tileOptions" />
</template>
