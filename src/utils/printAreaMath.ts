import L from 'leaflet'

export const CLICK_SLOP = 4
export const EDGE_HIT = 14
export const ROTATE_OFFSET = 28
export const CORNER_CURSORS = ['nw-resize', 'ne-resize', 'se-resize', 'sw-resize'] as const

// Custom rotation cursor — a circular arrow (dark glyph + white halo so it reads on any
// tile). CSS has no native "rotate" cursor; data-URI SVG is the only way. Hotspot centered.
export const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">' + '<g stroke="white" stroke-width="4"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></g>' + '<g stroke="#1f2937" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></g>' + '</svg>')}") 12 12, grab`

export interface RectState {
  center: L.LatLng
  halfW: number
  halfH: number
  angle: number
}

export function cornerOffsets(halfW: number, halfH: number): [number, number][] {
  return [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH]
  ]
}

export function localToScreen(lx: number, ly: number, cx: number, cy: number, angle: number): L.Point {
  const c = Math.cos(angle),
    s = Math.sin(angle)
  return L.point(cx + lx * c - ly * s, cy + lx * s + ly * c)
}

export function screenToLocal(px: L.Point, cx: number, cy: number, angle: number): { x: number; y: number } {
  const c = Math.cos(angle),
    s = Math.sin(angle)
  const dx = px.x - cx,
    dy = px.y - cy
  return { x: dx * c + dy * s, y: -dx * s + dy * c }
}
