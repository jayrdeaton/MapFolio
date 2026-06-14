<script setup lang="ts">
import L from 'leaflet'
const props = defineProps<{
  lat: number
  lng: number
  map: L.Map
}>()

const emit = defineEmits<{
  pin: [lat: number, lng: number]
  dismiss: []
}>()

let marker: L.Marker | null = null
let fadeTimer: ReturnType<typeof setTimeout> | null = null
let fading = false

function buildIcon() {
  return L.divIcon({
    html: `<div class="search-marker"><div class="search-marker-ring"></div><div class="search-marker-dot"></div></div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  })
}

function startFade() {
  if (fading) return
  fading = true
  const DURATION = 500
  const iconEl = marker?.getElement()
  const tooltipEl = marker?.getTooltip()?.getElement()
  ;[iconEl, tooltipEl].forEach((el) => {
    if (!el) return
    el.style.transition = `opacity ${DURATION}ms ease`
    el.style.opacity = '0'
  })
  fadeTimer = setTimeout(() => emit('dismiss'), DURATION)
}

// Fade only once the marker has panned well off the visible map area.
// Small nudges (marker still on screen) leave it alone.
function onMove() {
  if (fading || !marker) return
  const map = props.map
  const { clientWidth: w, clientHeight: h } = map.getContainer()
  const pt = map.latLngToContainerPoint([props.lat, props.lng])
  const OFFSCREEN_MARGIN = 80
  if (pt.x < -OFFSCREEN_MARGIN || pt.x > w + OFFSCREEN_MARGIN || pt.y < -OFFSCREEN_MARGIN || pt.y > h + OFFSCREEN_MARGIN) {
    startFade()
  }
}

function onMoveEnd() {
  props.map.on('move', onMove)
}

onMounted(() => {
  marker = L.marker([props.lat, props.lng], {
    icon: buildIcon(),
    interactive: true,
    zIndexOffset: 500
  }).addTo(props.map)

  marker.on('click', () => emit('pin', props.lat, props.lng))
  // Register the off-screen check only after the initial navigation settles,
  // so the setView animation doesn't immediately trigger a fade.
  props.map.once('moveend', onMoveEnd)
})

onUnmounted(() => {
  if (fadeTimer) clearTimeout(fadeTimer)
  props.map.off('moveend', onMoveEnd)
  props.map.off('move', onMove)
  if (marker) props.map.removeLayer(marker)
})

defineExpose({ fade: startFade })
</script>
