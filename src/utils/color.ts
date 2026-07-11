// WCAG relative luminance — returns true when the color is perceptually dark
// (i.e. light text reads better on it). Returns false for transparent/unknown.
export function isDarkColor(color: string): boolean {
  if (!color || color === 'transparent') return false
  const hex = color.replace('#', '')
  if (hex.length !== 6) return false
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.5
}

// ITU-R BT.601 luma — perceived brightness of an sRGB triple, used to collapse a color to
// its grayscale equivalent (as opposed to isDarkColor's WCAG-linearized luminance above,
// which answers a different question: "is white or black text more readable on this?").
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// Grayscale equivalent of a hex color, for the print "Black & White" export option.
// Passes through non-6-digit values (e.g. 'transparent') unchanged.
export function toGrayscaleColor(color: string): string {
  const hex = color.replace('#', '')
  if (hex.length !== 6) return color
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const v = Math.round(luma(r, g, b))
  const h = v.toString(16).padStart(2, '0')
  return `#${h}${h}${h}`
}

// Desaturates every pixel already painted on a canvas. Recoloring pin/route/caption hex
// values (toGrayscaleColor, above) doesn't touch color emoji glyphs — canvas fillText
// ignores fillStyle for color-font glyphs, and ctx.filter is not reliably applied to
// OffscreenCanvas text rendering inside a Worker (this runs in pdfExport.worker.ts), so a
// pixel-level pass after drawing is the only mechanism that's actually guaranteed to work.
export function desaturateCanvas(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number) {
  const imgData = ctx.getImageData(0, 0, w, h)
  const d = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(luma(d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0))
    d[i] = v
    d[i + 1] = v
    d[i + 2] = v
  }
  ctx.putImageData(imgData, 0, 0)
}
