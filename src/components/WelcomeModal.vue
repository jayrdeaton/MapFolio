<script setup lang="ts">
import { Layers, MapPin, Printer, Share2, X } from '@lucide/vue'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Transition name="mf-modal">
    <div
      v-if="show"
      class="fixed inset-0 z-2000 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 no-print"
      @click.self="emit('close')"
    >
      <div class="bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 w-full sm:max-w-2xl max-h-[90vh] flex flex-col">

        <!-- Header -->
        <div class="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-zinc-800 shrink-0">
          <img src="/icon.svg" alt="" class="w-7 h-7 shrink-0" />
          <div class="flex-1">
            <h2 class="text-base font-bold leading-tight">MapFolio</h2>
          </div>
          <button
            class="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Content -->
        <div class="overflow-y-auto px-6 py-5 space-y-5">

          <!-- Hero -->
          <div>
            <p class="text-xl font-bold leading-snug mb-1.5">Place custom pins on any map. Print it or share it.</p>
            <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Drop emoji-labeled markers anywhere in the world, choose a map style, then export a print-ready PDF at any paper size, or copy a link with your entire map encoded in the URL.</p>
          </div>

          <!-- Feature sections — 2-col grid on wider screens -->
          <div class="grid sm:grid-cols-2 gap-3.5">

            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin :size="15" class="text-cyan-500" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Placing Pins</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Right-click (or long-press on mobile) anywhere on the map. Drag to reposition. Click a pin to edit its name, emoji, color, or description.</p>
              </div>
            </div>

            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center shrink-0 mt-0.5">
                <Layers :size="15" class="text-cyan-500" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Map Styles</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Switch between Clean, Satellite, Minimal, and other tile styles. Toggle the Labels overlay to add place names as a separate layer.</p>
              </div>
            </div>

            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center shrink-0 mt-0.5">
                <Printer :size="15" class="text-cyan-500" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Print to PDF</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Set a print area rectangle, choose paper size and orientation, and download a PDF. Supports poster grids, rotated areas, and optional legend and compass overlays.</p>
              </div>
            </div>

            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center shrink-0 mt-0.5">
                <Share2 :size="15" class="text-cyan-500" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Share & Export</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Copy a link that encodes your pins and map style in the URL, no account needed. Export pins as JSON or GeoJSON, or import a file to merge.</p>
              </div>
            </div>

          </div>

          <!-- Shortcuts & tips -->
          <div class="pt-1 border-t border-gray-100 dark:border-zinc-800">
            <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Shortcuts & Tips</p>
            <div class="grid sm:grid-cols-2 gap-x-5 gap-y-2 text-sm">
              <div class="flex items-start gap-2.5">
                <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Right-click</kbd>
                <span class="text-gray-600 dark:text-zinc-400">Drop a pin at the cursor</span>
              </div>
              <div class="flex items-start gap-2.5">
                <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">⌘Z / Ctrl+Z</kbd>
                <span class="text-gray-600 dark:text-zinc-400">Undo last pin action</span>
              </div>
              <div class="flex items-start gap-2.5">
                <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Escape</kbd>
                <span class="text-gray-600 dark:text-zinc-400">Close panel or cancel placement</span>
              </div>
              <div class="flex items-start gap-2.5">
                <kbd class="shrink-0 text-xs bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Shift</kbd>
                <span class="text-gray-600 dark:text-zinc-400">Hold while rotating print area to toggle 15° snap</span>
              </div>
              <div class="flex items-start gap-2.5 sm:col-span-2">
                <kbd class="shrink-0 text-xs bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Option / Alt</kbd>
                <span class="text-gray-600 dark:text-zinc-400">Hold while print area is visible to pan and zoom through the handles without moving it</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="px-6 pb-5 pt-3 border-t border-gray-100 dark:border-zinc-800 shrink-0">
          <button
            class="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-semibold transition-colors cursor-pointer"
            @click="emit('close')"
          >
            Get Started
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style>
.mf-modal-enter-active,
.mf-modal-leave-active { transition: opacity 0.2s ease; }
.mf-modal-enter-from,
.mf-modal-leave-to { opacity: 0; }
</style>
