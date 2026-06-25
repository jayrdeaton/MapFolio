import type { PrintOrientation, PrintPaperSize } from '@/types'

import type { ExportQuality } from './useMapExport'

const COOKIE_KEY = 'mapfolio_print_v1'
const VALID_QUALITY: ExportQuality[] = ['draft', 'standard', 'hires']
const VALID_PAPERS: PrintPaperSize[] = ['letter', 'tabloid', 'a']
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'CO', 'VE', 'CL', 'PH'])
function defaultPaper(): PrintPaperSize {
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

  const stickyPaper = ref<PrintPaperSize>(VALID_PAPERS.includes(saved.stickyPaper as PrintPaperSize) ? (saved.stickyPaper as PrintPaperSize) : defaultPaper())
  const stickyOrientation = ref<PrintOrientation>(saved.stickyOrientation === 'landscape' ? 'landscape' : 'portrait')

  const contrast = ref<boolean>(typeof saved.contrast === 'boolean' ? saved.contrast : true)
  const exportQuality = ref<ExportQuality>(VALID_QUALITY.includes(saved.exportQuality as ExportQuality) ? (saved.exportQuality as ExportQuality) : saved.fastExport === true ? 'draft' : 'standard')

  watch([stickyPaper, stickyOrientation, contrast, exportQuality], () =>
    writeCookie({
      stickyPaper: stickyPaper.value,
      stickyOrientation: stickyOrientation.value,
      contrast: contrast.value,
      exportQuality: exportQuality.value
    })
  )

  return { stickyPaper, stickyOrientation, contrast, exportQuality }
}
