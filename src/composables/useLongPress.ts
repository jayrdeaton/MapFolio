import L from 'leaflet'

export function useLongPress(
  map: L.Map,
  options: {
    isBlocked: () => boolean
    onPlace: (latlng: L.LatLng) => void
  }
): () => void {
  const { isBlocked, onPlace } = options
  let lastPlaceAt = 0

  map.on('contextmenu', (e) => {
    if (Date.now() - lastPlaceAt < 400) return
    lastPlaceAt = Date.now()
    onPlace((e as L.LeafletMouseEvent).latlng)
  })

  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let lpStart: { x: number; y: number } | null = null
  let longPressFired = false
  const container = map.getContainer()

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1 || isBlocked()) return
    const t = e.touches[0]!
    lpStart = { x: t.clientX, y: t.clientY }
    longPressFired = false
    longPressTimer = setTimeout(() => {
      if (!lpStart) return
      const rect = container.getBoundingClientRect()
      const latlng = map.containerPointToLatLng(L.point(lpStart.x - rect.left, lpStart.y - rect.top))
      lastPlaceAt = Date.now()
      window.getSelection()?.removeAllRanges()
      longPressFired = true
      onPlace(latlng)
      lpStart = null
    }, 600)
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!lpStart || !longPressTimer) return
    const t = e.touches[0]!
    if (Math.hypot(t.clientX - lpStart.x, t.clientY - lpStart.y) > 10) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  const onTouchEnd = (_e: TouchEvent) => {
    if (longPressFired) {
      longPressFired = false
      const swallow = (ce: MouseEvent) => {
        ce.preventDefault()
        ce.stopImmediatePropagation()
      }
      document.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 300)
    }
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
    lpStart = null
  }

  container.addEventListener('touchstart', onTouchStart, { passive: true })
  container.addEventListener('touchmove', onTouchMove, { passive: true })
  container.addEventListener('touchend', onTouchEnd)
  container.addEventListener('touchcancel', onTouchEnd)

  return () => {
    container.removeEventListener('touchstart', onTouchStart)
    container.removeEventListener('touchmove', onTouchMove)
    container.removeEventListener('touchend', onTouchEnd)
    container.removeEventListener('touchcancel', onTouchEnd)
  }
}
