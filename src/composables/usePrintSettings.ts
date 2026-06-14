export type PrintPaperSize = 'letter' | 'tabloid' | 'a'
export type PrintOrientation = 'portrait' | 'landscape'

const COOKIE_KEY = 'mapfolio_print_v1'
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'CO', 'VE', 'CL', 'PH'])
const VALID_PAPERS: PrintPaperSize[] = ['letter', 'tabloid', 'a']
const VALID_ORIENTATIONS: PrintOrientation[] = ['portrait', 'landscape']
const VALID_GRIDS = ['1x1', '2x1', '1x2', '2x2', '3x2', '2x3', '3x3']
const VALID_SCALES = ['off', 'km', 'mi']

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
  const compass = ref<boolean>(typeof saved.compass === 'boolean' ? saved.compass : true)
  const scale = ref<'off' | 'km' | 'mi'>(VALID_SCALES.includes(saved.scale as string) ? (saved.scale as 'off' | 'km' | 'mi') : 'km')
  const contrast = ref<boolean>(typeof saved.contrast === 'boolean' ? saved.contrast : true)

  watch([paper, orientation, grid, legend, compass, scale, contrast], () =>
    writeCookie({
      paper: paper.value,
      orientation: orientation.value,
      grid: grid.value,
      legend: legend.value,
      compass: compass.value,
      scale: scale.value,
      contrast: contrast.value
    })
  )

  return { paper, orientation, grid, legend, compass, scale, contrast }
}
