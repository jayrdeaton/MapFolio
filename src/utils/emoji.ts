// Pre-render emoji onto a canvas so the glyph is clipped to exact pixel dimensions.
// Apple Color Emoji glyphs (especially 🕊️) paint outside the em-square via a separate
// compositing layer that bypasses CSS overflow:hidden/clip-path entirely. Canvas always
// clips to its own bounds. Results are memoized per emoji+size+DPR.
const _emojiUrlCache = new Map<string, string>()

// fontPx: the CSS font-size used to draw the emoji (controls visual weight).
// canvasPx: the canvas/img display size — larger than fontPx to give a buffer so glyphs
// whose ink box slightly exceeds the em-square are not clipped by the canvas boundary.
export function emojiToDataUrl(emoji: string, fontPx: number, canvasPx: number): string {
  const dpr = Math.ceil(window.devicePixelRatio ?? 1)
  const key = `${emoji}:${fontPx}:${canvasPx}:${dpr}`
  if (_emojiUrlCache.has(key)) return _emojiUrlCache.get(key)!
  const canvas = document.createElement('canvas')
  canvas.width = canvasPx * dpr
  canvas.height = canvasPx * dpr
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.scale(dpr, dpr)
    ctx.font = `${fontPx}px sans-serif`
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    // Use the actual ink bounding box to center the glyph precisely.
    // textBaseline:'middle' centers on the em-square midpoint, not the visual glyph center —
    // emoji like 🕊️ have ink that extends well above the em-square so they'd appear high.
    const m = ctx.measureText(emoji)
    // Center ink in the (larger) canvas: positive actualBoundingBoxLeft means ink starts left of drawX
    const drawX = canvasPx / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2
    // Center ink vertically: baseline Y that puts ink center at canvasPx/2
    const drawY = canvasPx / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
    ctx.fillText(emoji, drawX, drawY)
  }
  const url = canvas.toDataURL()
  _emojiUrlCache.set(key, url)
  return url
}
