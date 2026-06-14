import L from 'leaflet'

export default defineNuxtPlugin(() => {
  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
  })

  // leaflet.markercluster 1.5.3 can leave child clusters with _boundsNeedUpdate=true and
  // _bounds never initialized (empty LatLngBounds, _northEast=undefined) when a cluster's
  // _childCount drops to 0 before _recalculateBounds is first called. Leaflet 1.9.4's
  // intersects() has no null guard, so ne2.lat crashes. Return false for any empty bounds.
  const _origIntersects = (L.LatLngBounds.prototype as any).intersects
  ;(L.LatLngBounds.prototype as any).intersects = function (this: L.LatLngBounds, bounds: L.LatLngBoundsExpression): boolean {
    const b = L.latLngBounds(bounds as L.LatLngBoundsLiteral)
    if (!b.isValid() || !this.isValid()) return false
    return _origIntersects.call(this, b)
  }
})
