import type { Caption, Pin, PrintArea, Route } from '@/types'

export interface MapClipboard {
  pins: Pin[]
  routes: Route[]
  captions: Caption[]
  printAreas: PrintArea[]
  sourceMapId: string | null
}

export function useMapClipboard() {
  const clipboard = ref<MapClipboard | null>(null)

  const hasClipboard = computed(() => !!clipboard.value && clipboard.value.pins.length + clipboard.value.routes.length + clipboard.value.captions.length + clipboard.value.printAreas.length > 0)
  const sourceMapId = computed(() => clipboard.value?.sourceMapId ?? null)

  function set(pins: Pin[], routes: Route[], captions: Caption[] = [], printAreas: PrintArea[] = [], mapId?: string) {
    clipboard.value = {
      pins: pins.map((p) => ({ ...p })),
      routes: routes.map((r) => ({ ...r, points: r.points.map((pt) => ({ ...pt })) })),
      captions: captions.map((c) => ({ ...c })),
      printAreas: printAreas.map((a) => ({ ...a, corners: a.corners.map((c) => [c[0], c[1]] as [number, number]) })),
      sourceMapId: mapId ?? null
    }
  }

  // Centroid of all item coords → shift everything so centroid lands at target.
  // pinId refs to pins in the clipboard are remapped to new IDs; refs to absent pins are stripped.
  function pasteAt(targetLat: number, targetLng: number): Omit<MapClipboard, 'sourceMapId'> | null {
    if (!clipboard.value) return null
    const { pins, routes, captions, printAreas } = clipboard.value

    const allLats = [...pins.map((p) => p.lat), ...routes.flatMap((r) => r.points.map((pt) => pt.lat)), ...captions.map((c) => c.lat), ...printAreas.flatMap((a) => a.corners.map((c) => c[0]))]
    const allLngs = [...pins.map((p) => p.lng), ...routes.flatMap((r) => r.points.map((pt) => pt.lng)), ...captions.map((c) => c.lng), ...printAreas.flatMap((a) => a.corners.map((c) => c[1]))]
    if (allLats.length === 0) return null

    const centerLat = allLats.reduce((a, b) => a + b, 0) / allLats.length
    const centerLng = allLngs.reduce((a, b) => a + b, 0) / allLngs.length
    const dLat = targetLat - centerLat
    const dLng = targetLng - centerLng

    const pinIdMap = new Map<number, number>()
    const newPins: Pin[] = pins.map((p) => {
      const id = uid()
      pinIdMap.set(p.id, id)
      return { ...p, id, lat: p.lat + dLat, lng: p.lng + dLng, address: undefined }
    })

    const newRoutes: Route[] = routes.map((r) => ({
      ...r,
      id: uid(),
      points: r.points.map((pt) => {
        const remappedId = pt.pinId !== undefined ? pinIdMap.get(pt.pinId) : undefined
        return remappedId !== undefined ? { lat: pt.lat + dLat, lng: pt.lng + dLng, pinId: remappedId } : { lat: pt.lat + dLat, lng: pt.lng + dLng }
      })
    }))

    const newCaptions: Caption[] = captions.map((c) => ({ ...c, id: uid(), lat: c.lat + dLat, lng: c.lng + dLng }))

    const newPrintAreas: PrintArea[] = printAreas.map((a) => ({
      ...a,
      id: String(uid()),
      name: '',
      corners: a.corners.map((c) => [c[0] + dLat, c[1] + dLng] as [number, number])
    }))

    return { pins: newPins, routes: newRoutes, captions: newCaptions, printAreas: newPrintAreas }
  }

  // Assigns new IDs but keeps original coords — used when pasting onto a different map.
  function pasteInPlace(): Omit<MapClipboard, 'sourceMapId'> | null {
    if (!clipboard.value) return null
    const { pins, routes, captions, printAreas } = clipboard.value

    const pinIdMap = new Map<number, number>()
    const newPins: Pin[] = pins.map((p) => {
      const id = uid()
      pinIdMap.set(p.id, id)
      return { ...p, id, address: undefined }
    })

    const newRoutes: Route[] = routes.map((r) => ({
      ...r,
      id: uid(),
      points: r.points.map((pt) => {
        const remappedId = pt.pinId !== undefined ? pinIdMap.get(pt.pinId) : undefined
        return remappedId !== undefined ? { lat: pt.lat, lng: pt.lng, pinId: remappedId } : { lat: pt.lat, lng: pt.lng }
      })
    }))

    const newCaptions: Caption[] = captions.map((c) => ({ ...c, id: uid() }))

    const newPrintAreas: PrintArea[] = printAreas.map((a) => ({
      ...a,
      id: String(uid()),
      name: '',
      corners: a.corners.map((c) => [c[0], c[1]] as [number, number])
    }))

    return { pins: newPins, routes: newRoutes, captions: newCaptions, printAreas: newPrintAreas }
  }

  return { clipboard, hasClipboard, sourceMapId, set, pasteAt, pasteInPlace }
}
