import type L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { MapExportLayers } from '@/composables/useMaps'
import type { Caption, MapStyle, Pin, Route } from '@/types'
import { encodeShareState, MAX_SHARE_URL_LENGTH } from '@/utils'

export function useShareClipboard(options: { pins: Ref<Pin[]>; routes: Ref<Route[]>; captions: Ref<Caption[]>; mapStyle: Ref<MapStyle>; mapTitle: Ref<string>; mapArea: Ref<string>; leafletMap: ShallowRef<L.Map | null>; showNotification: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const { pins, routes, captions, mapStyle, mapTitle, mapArea, leafletMap, showNotification } = options

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

  // Builds the share URL for the active map's live view, including only the layers
  // requested (defaults to everything). The link now carries full styling — pins,
  // routes, AND captions — so it round-trips a map identically to a file export.
  function buildShareUrl(layers: MapExportLayers): string {
    const c = leafletMap.value?.getCenter()
    const z = leafletMap.value?.getZoom()
    const encoded = encodeShareState({
      pins: layers.pins ? pins.value : [],
      routes: layers.routes ? routes.value : [],
      captions: layers.captions ? captions.value : [],
      mapStyle: mapStyle.value,
      mapTitle: mapTitle.value,
      area: mapArea.value,
      center: c ? [c.lat, c.lng] : undefined,
      zoom: z
    })
    return `${location.origin}${location.pathname}#${encoded}`
  }

  async function copyShareLink(layers: MapExportLayers = { pins: true, routes: true, captions: true }) {
    const url = buildShareUrl(layers)
    // Belt-and-suspenders: the export dialog already disables this when the link is
    // too long, but guard here too so a bypass can't silently produce a dead link.
    if (url.length > MAX_SHARE_URL_LENGTH) {
      showNotification('This map is too large for a share link - export a file instead', 'error')
      return
    }
    const ok = await copyText(url)
    showNotification(ok ? 'Link copied to clipboard!' : 'Could not copy - check browser permissions', ok ? 'success' : 'error')
  }

  return { copyShareLink }
}
