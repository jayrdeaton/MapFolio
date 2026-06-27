import type { ExportOptions } from '@/composables/useMapExport'
import { exportMapToPdf } from '@/composables/useMapExport'

type WorkerExportOpts = Omit<ExportOptions, 'signal' | 'onProgress'>

let abortController: AbortController | null = null

self.onmessage = async (e: MessageEvent<{ type: string; opts?: WorkerExportOpts }>) => {
  const { type, opts } = e.data

  if (type === 'cancel') {
    abortController?.abort()
    return
  }

  if (type === 'export' && opts) {
    abortController = new AbortController()
    try {
      const bytes = await exportMapToPdf({
        ...opts,
        signal: abortController.signal,
        onProgress: (msg) => self.postMessage({ type: 'progress', msg })
      })
      self.postMessage({ type: 'done', bytes }, [bytes.buffer])
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        self.postMessage({ type: 'cancelled' })
      } else {
        self.postMessage({ type: 'error', message: String(err) })
      }
    } finally {
      abortController = null
    }
  }
}
