<script setup lang="ts">
import { LTileLayer } from '@vue-leaflet/vue-leaflet'
import { computed } from 'vue'

import { MAP_STYLE_CONFIGS, MapStyle } from '../types'

const props = defineProps<{ style: MapStyle }>()
const config = computed(() => MAP_STYLE_CONFIGS[props.style])
</script>

<template>
  <LTileLayer
    :key="style"
    :url="config.url"
    :attribution="config.attribution"
    :subdomains="config.subdomains ?? ''"
  />
</template>
