export type PrintPaperSize = 'letter' | 'tabloid' | 'a'
export type PrintOrientation = 'portrait' | 'landscape'

const COOKIE_KEY = 'mapfolio_print_v1'
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'CO', 'VE', 'CL', 'PH'])
const VALID_PAPERS: PrintPaperSize[] = ['letter', 'tabloid', 'a']
const VALID_ORIENTATIONS: PrintOrientation[] = ['portrait', 'landscape']
const VALID_GRIDS = ['1x1', '2x1', '1x2', '2x2', '3x2', '2x3', '3x3']

function regionDefaultPaper(): PrintPaperSize {
  return LETTER_REGIONS.has((navigator.language.split('-')[1] ?? '').toUpperCase()) ? 'letter' : 'a'
}

function readCookie(): Record<string, unknown> {
  try {
    const match = document.cookie.split('; ').find((r) => r.startsWith(COOKIE_KEY + '='))
    if (!match) return {}
    return JSON.parse(decodeURIComponent(match.slice(COOKIE_KEY.length + 1)))
  } catch {
    return {}
  }
}

function writeCookie(data: Record<string, unknown>) {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(data))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

export function usePrintSettings() {
  const saved = readCookie()

  const paper = ref<PrintPaperSize>(VALID_PAPERS.includes(saved.paper as PrintPaperSize) ? (saved.paper as PrintPaperSize) : regionDefaultPaper())
  const orientation = ref<PrintOrientation>(VALID_ORIENTATIONS.includes(saved.orientation as PrintOrientation) ? (saved.orientation as PrintOrientation) : 'portrait')
  const grid = ref<string>(VALID_GRIDS.includes(saved.grid as string) ? (saved.grid as string) : '1x1')
  const legend = ref<boolean>(typeof saved.legend === 'boolean' ? saved.legend : true)
  // When true, the legend (title/subtitle/items) is exported on its own PDF page
  // instead of as an on-map overlay. Compass and scale always stay on the map.
  const legendSeparatePage = ref<boolean>(typeof saved.legendSeparatePage === 'boolean' ? saved.legendSeparatePage : false)
  const legendTitle = ref<boolean>(typeof saved.legendTitle === 'boolean' ? saved.legendTitle : true)
  const legendArea = ref<boolean>(typeof saved.legendArea === 'boolean' ? saved.legendArea : true)
  const legendBlankLabels = ref<boolean>(typeof saved.legendBlankLabels === 'boolean' ? saved.legendBlankLabels : false)
  const compass = ref<boolean>(typeof saved.compass === 'boolean' ? saved.compass : true)
  // Scale is now a simple on/off toggle; the unit (km/mi) lives in map-level settings.
  // Migrate the legacy 'off' | 'km' | 'mi' value: anything that wasn't 'off' means on.
  const scale = ref<boolean>(typeof saved.scale === 'boolean' ? saved.scale : saved.scale !== 'off')
  const contrast = ref<boolean>(typeof saved.contrast === 'boolean' ? saved.contrast : true)
  // "Fast draft": fetch far fewer tiles at a lower zoom and shrink the output for a quick,
  // lightweight PDF. Off by default — the standard export renders at full detail.
  const fastExport = ref<boolean>(typeof saved.fastExport === 'boolean' ? saved.fastExport : false)

  watch([paper, orientation, grid, legend, legendSeparatePage, legendTitle, legendArea, legendBlankLabels, compass, scale, contrast, fastExport], () =>
    writeCookie({
      paper: paper.value,
      orientation: orientation.value,
      grid: grid.value,
      legend: legend.value,
      legendSeparatePage: legendSeparatePage.value,
      legendTitle: legendTitle.value,
      legendArea: legendArea.value,
      legendBlankLabels: legendBlankLabels.value,
      compass: compass.value,
      scale: scale.value,
      contrast: contrast.value,
      fastExport: fastExport.value
    })
  )

  return { paper, orientation, grid, legend, legendSeparatePage, legendTitle, legendArea, legendBlankLabels, compass, scale, contrast, fastExport }
}
