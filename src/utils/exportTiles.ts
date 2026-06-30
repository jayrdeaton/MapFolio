import type { MapStyleConfig } from '@/types'

export function lngToTileFrac(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom)
}

export function latToTileFrac(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
}

export function tileUrl(config: MapStyleConfig, isDark: boolean, z: number, x: number, y: number): string {
  const template = isDark && config.darkUrl ? config.darkUrl : config.url
  const subdomains = config.subdomains ?? 'abc'
  const s = subdomains[Math.abs(x + y) % subdomains.length]!
  return template
    .replace('{s}', s)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{r}', config.retina ? '@2x' : '')
}

// Sample 8×8 pixels from a loaded tile and return true if they're all near-white.
// Near-white uniform tiles are blank server responses, not real map content.
function isTileBlank(img: ImageBitmap): boolean {
  const s = new OffscreenCanvas(8, 8)
  const c = s.getContext('2d')
  if (!c) return false
  c.drawImage(img, 0, 0, 8, 8)
  const { data: d } = c.getImageData(0, 0, 8, 8)
  for (let i = 0; i < d.length; i += 4) {
    if ((d[i] ?? 0) < 250 || (d[i + 1] ?? 0) < 250 || (d[i + 2] ?? 0) < 250) return false
  }
  return true
}

export async function fetchTile(url: string, retries = 2, signal?: AbortSignal): Promise<ImageBitmap | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise<void>((r) => setTimeout(r, 400 * attempt))
    try {
      const resp = await fetch(url, { mode: 'cors', signal })
      if (!resp.ok) continue
      const blob = await resp.blob()
      const img = await createImageBitmap(blob)
      if (isTileBlank(img)) {
        img.close()
        continue
      }
      return img
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      // swallow other errors and retry
    }
  }
  return null
}

export async function fetchTilesConcurrent(jobs: (() => Promise<void>)[], limit: number, signal?: AbortSignal): Promise<void> {
  const queue = [...jobs]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      signal?.throwIfAborted()
      const job = queue.shift()
      if (job) await job()
    }
  })
  await Promise.all(workers)
}
