const MI_REGIONS = new Set(['US', 'GB', 'LR', 'MM'])
function regionDefaultUnits(): 'km' | 'mi' {
  return MI_REGIONS.has((navigator.language.split('-')[1] ?? '').toUpperCase()) ? 'mi' : 'km'
}

export function useGlobalDisplaySettings() {
  const showCoords = ref<boolean>(localStorage.getItem('mapfolio_show_coords') !== 'false')
  const showScale = ref<boolean>(localStorage.getItem('mapfolio_show_scale') !== 'false')
  const showZoom = ref<boolean>(localStorage.getItem('mapfolio_show_zoom') !== 'false')
  const stored = localStorage.getItem('mapfolio_units')
  const mapUnits = ref<'km' | 'mi'>(stored === 'mi' || stored === 'km' ? stored : regionDefaultUnits())
  const angleSnapEnabled = ref(localStorage.getItem('mapfolio_angle_snap') === 'true')

  watch(showCoords, (v) => localStorage.setItem('mapfolio_show_coords', String(v)))
  watch(showScale, (v) => localStorage.setItem('mapfolio_show_scale', String(v)))
  watch(showZoom, (v) => localStorage.setItem('mapfolio_show_zoom', String(v)))
  watch(mapUnits, (v) => localStorage.setItem('mapfolio_units', v))
  watch(angleSnapEnabled, (v) => localStorage.setItem('mapfolio_angle_snap', String(v)))

  return { showCoords, showScale, showZoom, mapUnits, angleSnapEnabled }
}
