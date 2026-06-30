import type L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { MapExportLayers } from '@/composables/useMaps'
import type { Caption, MapData, MapStyle, Pin, PrintArea, Route } from '@/types'
import { encodeShareState, MAX_SHARE_URL_LENGTH } from '@/utils/share'

export function useShareClipboard(options: { pins: Ref<Pin[]>; routes: Ref<Route[]>; captions: Ref<Caption[]>; printAreas: Ref<PrintArea[]>; mapStyle: Ref<MapStyle>; mapTitle: Ref<string>; mapArea: Ref<string>; leafletMap: ShallowRef<L.Map | null>; maps: Ref<MapData[]>; activeId: Ref<string>; showNotification: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const { pins, routes, captions, printAreas, mapStyle, mapTitle, mapArea, leafletMap, maps, activeId, showNotification } = options

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
    const vis = <T extends { hidden?: boolean }>(arr: T[]) => (layers.includeHidden ? arr : arr.filter((x) => !x.hidden))
    const encoded = encodeShareState({
      pins: layers.pins ? vis(pins.value) : [],
      routes: layers.routes ? vis(routes.value) : [],
      captions: layers.captions ? vis(captions.value) : [],
      printAreas: layers.printAreas ? vis(printAreas.value) : [],
      mapStyle: mapStyle.value,
      mapTitle: mapTitle.value,
      area: mapArea.value,
      center: c ? [c.lat, c.lng] : undefined,
      zoom: z
    })
    return `${location.origin}${location.pathname}#${encoded}`
  }

  function buildShareUrlForMap(m: MapData, layers: MapExportLayers): string {
    const vis = <T extends { hidden?: boolean }>(arr: T[]) => (layers.includeHidden ? arr : arr.filter((x) => !x.hidden))
    const encoded = encodeShareState({
      pins: layers.pins ? vis(m.pins) : [],
      routes: layers.routes ? vis(m.routes) : [],
      captions: layers.captions ? vis(m.captions ?? []) : [],
      printAreas: layers.printAreas ? vis(m.printAreas ?? []) : [],
      mapStyle: m.mapStyle,
      mapTitle: m.name,
      area: m.area,
      center: m.center,
      zoom: m.zoom
    })
    return `${location.origin}${location.pathname}#${encoded}`
  }

  async function copyShareLink(layers: MapExportLayers = { pins: true, routes: true, captions: true, printAreas: true, includeHidden: true }, mapId?: string) {
    let url: string
    if (mapId && mapId !== activeId.value) {
      const m = maps.value.find((x) => x.id === mapId)
      if (!m) {
        showNotification('Map not found', 'error')
        return
      }
      url = buildShareUrlForMap(m, layers)
    } else {
      url = buildShareUrl(layers)
    }
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
