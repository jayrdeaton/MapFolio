import type { Route, RouteLineStyle, RouteWaypointSize, RouteWaypointStyle } from '@/types'

const LINE_DASH: Partial<Record<RouteLineStyle, { dasharray?: string; strokeWidth?: number }>> = {
  dashed: { dasharray: '12 8' },
  dotted: { dasharray: '1 9', strokeWidth: 4 },
  'long-dash': { dasharray: '22 10' },
  'dash-dot': { dasharray: '14 5 2 5' }
}

const PREVIEW_WP = {
  xs: { r: 3, sqHalf: 3, fontSize: 4 },
  s: { r: 5, sqHalf: 4, fontSize: 5.5 },
  m: { r: 7, sqHalf: 5, fontSize: 7 },
  l: { r: 9, sqHalf: 7, fontSize: 9 },
  xl: { r: 11, sqHalf: 9, fontSize: 11 }
} as const

function nodeRadius(style: RouteWaypointStyle, size: RouteWaypointSize): number {
  const wp = PREVIEW_WP[size]
  return style === 'circle' ? wp.r : style === 'none' ? 0 : wp.sqHalf
}

function nodeHtml(cx: number, label: string, style: RouteWaypointStyle, showNumber: boolean, size: RouteWaypointSize, color: string): string {
  const wp = PREVIEW_WP[size]
  let shape: string
  if (style === 'circle') {
    shape = `<circle cx="${cx}" cy="10" r="${wp.r}" fill="${color}" stroke="white" stroke-width="2"/>`
  } else if (style === 'square') {
    const h = wp.sqHalf
    shape = `<rect x="${cx - h}" y="${10 - h}" width="${h * 2}" height="${h * 2}" rx="1.5" fill="${color}" stroke="white" stroke-width="2"/>`
  } else if (style === 'diamond') {
    const h = wp.sqHalf
    shape = `<rect x="${cx - h}" y="${10 - h}" width="${h * 2}" height="${h * 2}" rx="1.5" fill="${color}" stroke="white" stroke-width="2" transform="rotate(45 ${cx} 10)"/>`
  } else {
    return ''
  }
  const text = showNumber ? `<text x="${cx}" y="10" text-anchor="middle" dominant-baseline="central" font-size="${wp.fontSize}" fill="white" font-weight="bold">${label}</text>` : ''
  return shape + text
}

function resolveStyle(route: Route): { style: RouteWaypointStyle; showNumber: boolean } {
  const raw = route.waypointStyle as string | undefined
  if (raw === 'number') return { style: 'circle', showNumber: true }
  return { style: (raw ?? 'circle') as RouteWaypointStyle, showNumber: route.waypointShowNumber ?? false }
}

export function routePreviewSvgString(route: Route): string {
  const color = route.color
  const lineStyle = route.lineStyle ?? 'solid'
  const { style: waypointStyle, showNumber } = resolveStyle(route)
  const waypointSize = route.waypointSize ?? 'm'
  const hasNodes = waypointStyle !== 'none'
  const nr = hasNodes ? nodeRadius(waypointStyle, waypointSize) : 0
  const x1 = hasNodes ? 8 + nr : 2
  const x2 = hasNodes ? 44 - nr : 50
  const arrowX2 = hasNodes ? 44 - nr : 44

  let defs = ''
  let line = ''

  if (lineStyle === 'arrow') {
    const id = `rps-arrow-${route.id}`
    defs = `<defs><marker id="${id}" markerWidth="13" markerHeight="9" refX="10" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0,0.5 12,4.5 0,8.5" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></marker></defs>`
    line = `<line x1="${x1}" y1="10" x2="${arrowX2}" y2="10" stroke="${color}" stroke-width="2.5" stroke-linecap="round" marker-end="url(#${id})"/>`
  } else if (lineStyle === 'double') {
    line = `<line x1="${x1}" y1="8" x2="${x2}" y2="8" stroke="${color}" stroke-width="2" stroke-linecap="round"/><line x1="${x1}" y1="12" x2="${x2}" y2="12" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`
  } else if (lineStyle === 'none') {
    line = `<line x1="2" y1="10" x2="50" y2="10" stroke="#d1d5db" stroke-width="1.5" stroke-dasharray="3 3"/>`
  } else {
    const dash = LINE_DASH[lineStyle]
    const sw = dash?.strokeWidth ?? 2.5
    const da = dash?.dasharray ? ` stroke-dasharray="${dash.dasharray}"` : ''
    line = `<line x1="${x1}" y1="10" x2="${x2}" y2="10" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"${da}/>`
  }

  const left = hasNodes ? nodeHtml(8, '1', waypointStyle, showNumber, waypointSize, color) : ''
  const right = hasNodes ? nodeHtml(44, '2', waypointStyle, showNumber, waypointSize, color) : ''

  return `<svg width="52" height="20" viewBox="0 0 52 20" style="overflow:visible;flex-shrink:0;">${defs}${line}${left}${right}</svg>`
}

export function waypointPreviewSvgString(route: Route, pointIndex: number, colorOverride?: string): string {
  const color = colorOverride ?? route.color
  const { style, showNumber } = resolveStyle(route)
  const label = String(pointIndex + 1)

  let node: string
  if (style === 'circle') {
    node = `<circle cx="10" cy="10" r="9" fill="${color}" stroke="white" stroke-width="2.5"/>`
  } else if (style === 'square') {
    node = `<rect x="3" y="3" width="14" height="14" rx="2" fill="${color}" stroke="white" stroke-width="2"/>`
  } else if (style === 'diamond') {
    node = `<rect x="3" y="3" width="14" height="14" rx="2" fill="${color}" stroke="white" stroke-width="2" transform="rotate(45 10 10)"/>`
  } else {
    node = `<circle cx="10" cy="10" r="6" fill="${color}" stroke="white" stroke-width="2" opacity="0.4"/>`
  }
  const text = showNumber ? `<text x="10" y="10" text-anchor="middle" dominant-baseline="central" font-size="9" fill="white" font-weight="bold">${label}</text>` : ''

  return `<svg width="20" height="20" viewBox="0 0 20 20" style="overflow:visible;flex-shrink:0;">${node}${text}</svg>`
}
