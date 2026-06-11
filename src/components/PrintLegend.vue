<script setup lang="ts">
import { Pin } from '../types'

defineProps<{ title: string; pins: Pin[] }>()
</script>

<template>
  <div v-if="title || pins.length > 0" class="print-legend">
    <div v-if="title" class="print-legend-title">{{ title }}</div>
    <template v-if="pins.length > 0">
      <div class="print-legend-header">Legend</div>
      <div class="print-legend-items">
        <div v-for="pin in pins" :key="pin.id" class="print-legend-item">
          <span class="print-legend-emoji">{{ pin.emoji }}</span>
          <div class="print-legend-text">
            <div class="print-legend-name">{{ pin.name }}</div>
            <div v-if="pin.description" class="print-legend-desc">{{ pin.description }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
