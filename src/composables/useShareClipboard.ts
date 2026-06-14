import type L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { MapStyle, Pin } from '../types'
import { encodeShareState } from '../utils'

export function useShareClipboard(options: { pins: Ref<Pin[]>; mapStyle: Ref<MapStyle>; mapTitle: Ref<string>; leafletMap: ShallowRef<L.Map | null>; showNotification: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const { pins, mapStyle, mapTitle, leafletMap, showNotification } = options

  let urlUpdateTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleUrlUpdate() {
    if (urlUpdateTimer) clearTimeout(urlUpdateTimer)
    urlUpdateTimer = setTimeout(() => {
      const c = leafletMap.value?.getCenter()
      const z = leafletMap.value?.getZoom()
      const encoded = encodeShareState({
        pins: pins.value,
        mapStyle: mapStyle.value,
        mapTitle: mapTitle.value,
        center: c ? [c.lat, c.lng] : undefined,
        zoom: z
      })
      history.replaceState(null, '', `#${encoded}`)
    }, 1000)
  }

  async function copyText(text: string): Promise<boolean> {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:absolute;left:-9999px;top:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) return true
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  async function copyShareLink() {
    const c = leafletMap.value?.getCenter()
    const z = leafletMap.value?.getZoom()
    const encoded = encodeShareState({
      pins: pins.value,
      mapStyle: mapStyle.value,
      mapTitle: mapTitle.value,
      center: c ? [c.lat, c.lng] : undefined,
      zoom: z
    })
    history.replaceState(null, '', `#${encoded}`)
    const ok = await copyText(location.href)
    showNotification(ok ? 'Link copied to clipboard!' : 'Could not copy — check browser permissions', ok ? 'success' : 'error')
  }

  function cleanupShareClipboard() {
    if (urlUpdateTimer) clearTimeout(urlUpdateTimer)
  }

  return { scheduleUrlUpdate, copyShareLink, cleanupShareClipboard }
}
