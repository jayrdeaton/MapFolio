<script setup lang="ts">
import { Captions, CircleDotDashed, Compass, Contrast, Crosshair, FileText, Heading, List, Magnet, MapPin, Maximize2, PenLine, Printer, Route, Ruler, ScanSearch, Settings, Share2, Triangle, Type, X, Zap, ZoomIn } from '@lucide/vue'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Transition name="mf-modal">
    <div v-if="show" class="fixed inset-0 z-2000 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 no-print" @click.self="emit('close')">
      <div class="bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-zinc-800 shrink-0">
          <img src="/icon.svg" alt="" class="w-7 h-7 shrink-0" />
          <div class="flex-1">
            <h2 class="text-base font-bold leading-tight">MapFolio</h2>
          </div>
          <button class="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer" @click="emit('close')">
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
              <div class="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <MapPin :size="15" class="text-gray-600 dark:text-zinc-300" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Pins</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Right-click or long-press anywhere to drop a pin. Tap to edit its name, emoji, color, or description. Drag to reposition.</p>
              </div>
            </div>

            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <Route :size="15" class="text-gray-600 dark:text-zinc-300" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Routes</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Draw paths by tapping points on the map. Routes show distance and can be styled with a custom color.</p>
              </div>
            </div>

            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <Type :size="15" class="text-gray-600 dark:text-zinc-300" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Captions</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Place geo-anchored text labels anywhere on the map. Drag to reposition, or rotate and resize from the panel.</p>
              </div>
            </div>

            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <Settings :size="15" class="text-gray-600 dark:text-zinc-300" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Settings</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Switch map styles (Clean, Satellite, Minimal…), toggle the Labels overlay, and change distance units.</p>
              </div>
            </div>

            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <Printer :size="15" class="text-gray-600 dark:text-zinc-300" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Print to PDF</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Set a print area rectangle, choose paper size and orientation, and download a PDF with optional legend and compass overlays.</p>
              </div>
            </div>

            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <Share2 :size="15" class="text-gray-600 dark:text-zinc-300" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Share & Export</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Copy a link that encodes your map in the URL, no account needed. Export as JSON or GeoJSON, or import to merge.</p>
              </div>
            </div>
          </div>

          <!-- Secondary map controls -->
          <div class="flex flex-wrap gap-3.5">
            <div class="flex gap-3 min-w-0">
              <div class="w-7 h-7 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <ScanSearch :size="13" class="text-gray-600 dark:text-zinc-300" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Fit all to view</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Pan and zoom to show all visible pins, routes, and captions at once.</p>
              </div>
            </div>
            <div class="flex gap-3 min-w-0">
              <div class="w-7 h-7 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <Crosshair :size="13" class="text-gray-600 dark:text-zinc-300" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">My location</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Center the map on your current GPS position.</p>
              </div>
            </div>
            <div class="flex gap-3 min-w-0">
              <div class="w-7 h-7 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <Maximize2 :size="13" class="text-gray-600 dark:text-zinc-300" />
              </div>
              <div>
                <p class="text-sm font-semibold mb-0.5">Focus mode</p>
                <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">Hide the toolbar to get a full-screen view of your map.</p>
              </div>
            </div>
          </div>

          <!-- Panel icon reference -->
          <div class="pt-1 border-t border-gray-100 dark:border-zinc-800 space-y-3">
            <div>
              <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Pins</p>
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-zinc-400">
                <span class="flex items-center gap-1"><CircleDotDashed :size="12" /> Cluster nearby pins</span>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Print: Legend</p>
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-zinc-400">
                <span class="flex items-center gap-1"><List :size="12" /> Show legend</span>
                <span class="flex items-center gap-1"><FileText :size="12" /> Own page</span>
                <span class="flex items-center gap-1"><Heading :size="12" /> Title</span>
                <span class="flex items-center gap-1"><Captions :size="12" /> Subtitle</span>
                <span class="flex items-center gap-1"><PenLine :size="12" /> Exploration mode</span>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Print: Overlays &amp; Quality</p>
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-zinc-400">
                <span class="flex items-center gap-1"><Compass :size="12" /> Compass</span>
                <span class="flex items-center gap-1"><Ruler :size="12" /> Scale bar</span>
                <span class="flex items-center gap-1"><Contrast :size="12" /> Enhance contrast</span>
                <span class="flex items-center gap-1"><Zap :size="12" /> Fast draft</span>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Settings: Display</p>
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-zinc-400">
                <span class="flex items-center gap-1"><Type :size="12" /> Labels</span>
                <span class="flex items-center gap-1"><ZoomIn :size="12" /> Zoom controls</span>
                <span class="flex items-center gap-1"><Crosshair :size="12" /> Coordinates</span>
                <span class="flex items-center gap-1"><Ruler :size="12" /> Scale bar</span>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Settings: Drawing</p>
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-zinc-400">
                <span class="flex items-center gap-1"><Magnet :size="12" /> Snap pins &amp; waypoints</span>
                <span class="flex items-center gap-1"><Triangle :size="12" /> Angle snap (15°)</span>
              </div>
            </div>
          </div>

          <!-- Shortcuts & tips -->
          <div class="hidden sm:block pt-1 border-t border-gray-100 dark:border-zinc-800 space-y-4">
            <div>
              <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">General</p>
              <div class="grid sm:grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Right-click</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Drop a pin at the cursor</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Escape</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Close panel or cancel placement</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Enter</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Save form / confirm action</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">⌘Z / ⌘⇧Z</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Undo / Redo</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">?</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Show this screen</span>
                </div>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Quick Actions</p>
              <div class="grid sm:grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">P</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Start placing pins</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">R</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Draw a new route</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">C</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Place a caption</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">A</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Activate print area</span>
                </div>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Selection</p>
              <div class="grid sm:grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">H</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Toggle hide / show</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">E</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Edit</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">F</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Fit view to selection</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Del / ⌫</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Delete</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">⌘C / ⌘X / ⌘V</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Copy / Cut / Paste</span>
                </div>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Navigation</p>
              <div class="grid sm:grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Scroll</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Zoom in / out</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">+ / −</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Zoom in / out</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Arrow keys</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Pan the map</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Shift+drag</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Box-zoom to a drawn rectangle</span>
                </div>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Print</p>
              <div class="grid sm:grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Shift</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Hold while rotating to toggle 15° snap</span>
                </div>
                <div class="flex items-start gap-2.5">
                  <kbd class="shrink-0 text-xs bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">Option / Alt</kbd>
                  <span class="text-gray-600 dark:text-zinc-400">Pan and zoom through handles without moving the area</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 pb-5 pt-3 border-t border-gray-100 dark:border-zinc-800 shrink-0">
          <button class="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors cursor-pointer" @click="emit('close')">Get Started</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.mf-modal-enter-active,
.mf-modal-leave-active {
  transition: opacity 0.2s ease;
}
.mf-modal-enter-from,
.mf-modal-leave-to {
  opacity: 0;
}
</style>
