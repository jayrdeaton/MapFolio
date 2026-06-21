import 'leaflet.markercluster'

import L from 'leaflet'

// Minimal shapes for the private markercluster / Leaflet internals.
// These members aren't in @types/leaflet(.markercluster) but are stable in 1.5.3.
interface InternalLatLngBounds {
  _southWest?: L.LatLng
  _northEast?: L.LatLng
  _mcSafe?: boolean
  intersects?: (other?: InternalLatLngBounds) => boolean
}
interface InternalMarkerCluster {
  _bounds?: InternalLatLngBounds
  _childClusters?: InternalMarkerCluster[]
  _zoom: number
  _latlng: L.LatLng
  _group: { _map: L.Map; _maxZoom: number }
}
interface MarkerClusterProto {
  _recursively?: (this: MarkerClusterProto, boundsToApplyTo: InternalLatLngBounds, ...args: unknown[]) => unknown
  _recursivelyPatched?: boolean
  zoomToBounds?: (this: InternalMarkerCluster, fitBoundsOptions?: L.FitBoundsOptions) => void
  _zoomToBoundsPatched?: boolean
  _animationSpiderfy?: (this: MarkerClusterProto, childMarkers: unknown[], positions: unknown[]) => unknown
  _animationSpiderfyPatched?: boolean
}
interface InternalPopupProto {
  _onRemoveGuarded?: boolean
  onRemove?: (this: { _container?: HTMLElement }, map: L.Map) => void
}
interface WindowWithLeaflet {
  L?: { Polyline?: typeof L.Polyline }
}

interface UseMarkerClusterOptions {
  isPlacingPin: Ref<boolean>
  isPlacingCaption: Ref<boolean>
  isDrawingRoute: Ref<boolean>
  onClusterClickPlace: (latlng: L.LatLng) => void
  onClusterClickDraw: (e: L.LeafletMouseEvent) => void
}

export function useMarkerCluster({ isPlacingPin, isPlacingCaption, isDrawingRoute, onClusterClickPlace, onClusterClickDraw }: UseMarkerClusterOptions) {
  const clusterGroup = shallowRef<L.MarkerClusterGroup | null>(null)

  function setupClusterGroup(map: L.Map): L.MarkerClusterGroup {
    const cg = L.markerClusterGroup({
      disableClusteringAtZoom: 17,
      showCoverageOnHover: false,
      maxClusterRadius: 15,
      spiderfyOnMaxZoom: true,
      // animate:false uses the non-animated code path (_noAnimationZoomIn) which adds
      // markers directly via featureGroup.addLayer → onAdd → update(), placing icons at
      // the correct final positions immediately. The animated path sets icons at the
      // cluster centroid first then transitions to final positions; if the CSS transition
      // is suppressed or timing is off, icons can land at the wrong screen coordinates.
      animate: false
    })

    // Prevent right-click on clusters from falling through to the map contextmenu handler.
    cg.on('clustercontextmenu', () => {})

    // While placing a pin or drawing a route, a click on a cluster bubble must
    // place/add at that point instead of zooming.
    cg.on('clusterclick', ((e: L.LeafletMouseEvent) => {
      if (!isPlacingPin.value && !isDrawingRoute.value) return
      const latlng = e.originalEvent ? map.mouseEventToLatLng(e.originalEvent) : e.latlng
      if (isPlacingPin.value) onClusterClickPlace(latlng)
      else onClusterClickDraw({ ...e, latlng } as L.LeafletMouseEvent)
    }) as L.LeafletEventHandlerFn)

    cg.addTo(map)
    return cg
  }

  function patchMarkerCluster(cg: L.MarkerClusterGroup) {
    const topCluster = (cg as unknown as { _topClusterLevel?: InternalMarkerCluster })._topClusterLevel
    if (!topCluster) return

    const mcProto = Object.getPrototypeOf(topCluster) as MarkerClusterProto

    // Patch _removeIcon on chunk Leaflet's Marker.prototype (parent of MarkerCluster.prototype).
    // During zoom-out animations, markercluster calls _recursivelyRemoveChildrenFromMap which
    // calls removeLayer on cluster-icon Markers created with chunk Leaflet. If _icon is null
    // (cluster icon added to _featureGroup but onAdd never ran due to animation timing),
    // _removeIcon calls DomEvent.off(null) which crashes with "obj[eventsKey] undefined".
    // That crash aborts the removal loop, leaving cluster internal state inconsistent and
    // causing markers to land at wrong screen positions on subsequent zooms.
    // Best-effort prototype patch for _removeIcon. Prototype traversal may not cover all
    // code paths (esbuild CJS-to-ESM inlining can make _removeIcon bypass the prototype
    // lookup), so this is a secondary defence. Primary defence is patchFeatureGroup below.
    const markerProto = Object.getPrototypeOf(mcProto) as {
      _removeIcon?: () => void
      _removeIconPatched?: boolean
    }
    if (markerProto && typeof markerProto._removeIcon === 'function' && !markerProto._removeIconPatched) {
      markerProto._removeIconPatched = true
      const origRemoveIcon = markerProto._removeIcon
      markerProto._removeIcon = function (this: Record<string, unknown>) {
        try {
          origRemoveIcon.call(this)
        } catch {
          if (this['_icon']) {
            try {
              ;(this['_icon'] as Element).remove()
            } catch {
              /* ok */
            }
            this['_icon'] = null
          }
          if (this['_shadow']) {
            try {
              ;(this['_shadow'] as Element).remove()
            } catch {
              /* ok */
            }
            this['_shadow'] = null
          }
          this['_initIconPos'] = null
        }
      }
    }

    // Patch _recursively: markercluster 1.5.3 bug where c._bounds._northEast can be undefined
    // (empty cluster). Setting intersects as an own property on boundsToApplyTo always wins over
    // the prototype, bypassing the dual-Leaflet-instance instanceof mismatch.
    if (mcProto && typeof mcProto._recursively === 'function' && !mcProto._recursivelyPatched) {
      const _origRecursively = mcProto._recursively
      mcProto._recursively = function (this: MarkerClusterProto, boundsToApplyTo: InternalLatLngBounds, ...args: unknown[]) {
        const alreadySafe = boundsToApplyTo?._mcSafe
        const origIntersects = boundsToApplyTo?.intersects
        if (!alreadySafe && origIntersects) {
          boundsToApplyTo._mcSafe = true
          // ESM Leaflet's intersects() calls toLatLngBounds(other) which fails instanceof on
          // window.L LatLngBounds objects. Read _southWest/_northEast directly instead.
          boundsToApplyTo.intersects = function (other?: InternalLatLngBounds) {
            const sw2 = other?._southWest
            const ne2 = other?._northEast
            if (!sw2 || !ne2) return false
            const sw = boundsToApplyTo._southWest
            const ne = boundsToApplyTo._northEast
            if (!sw || !ne) return false
            return ne2.lat >= sw.lat && sw2.lat <= ne.lat && ne2.lng >= sw.lng && sw2.lng <= ne.lng
          }
        }
        try {
          return _origRecursively.apply(this, [boundsToApplyTo, ...args])
        } finally {
          if (!alreadySafe && origIntersects) {
            boundsToApplyTo._mcSafe = false
            boundsToApplyTo.intersects = origIntersects
          }
        }
      }
      mcProto._recursivelyPatched = true
    }

    // Patch zoomToBounds: passes window.L LatLngBounds to ESM Leaflet's getBoundsZoom/fitBounds,
    // which fails instanceof. Reimplement using array-format bounds to bypass the check.
    if (mcProto && typeof mcProto.zoomToBounds === 'function' && !mcProto._zoomToBoundsPatched) {
      mcProto._zoomToBoundsPatched = true
      mcProto.zoomToBounds = function (this: InternalMarkerCluster, fitBoundsOptions?: L.FitBoundsOptions) {
        const mapObj = this._group._map
        const bnd = this._bounds
        const sw = bnd?._southWest
        const ne = bnd?._northEast
        if (!sw || !ne) return

        // All markers share the exact same location — zoom would do nothing useful.
        if (sw.lat === ne.lat && sw.lng === ne.lng) {
          ;(this as unknown as { spiderfy: () => void }).spiderfy()
          return
        }

        const boundsArr: L.LatLngBoundsLiteral = [
          [sw.lat, sw.lng],
          [ne.lat, ne.lng]
        ]
        const childClusters = (this._childClusters ?? []).slice()
        const boundsZoom = mapObj.getBoundsZoom(boundsArr)
        let zoom = this._zoom + 1
        const mapZoom = mapObj.getZoom()

        while (childClusters.length > 0 && boundsZoom > zoom) {
          zoom++
          const next: InternalMarkerCluster[] = []
          for (const c of childClusters) next.push(...(c._childClusters ?? []))
          childClusters.length = 0
          childClusters.push(...next)
        }

        if (boundsZoom > zoom) {
          // Cluster hierarchy bottomed out — jump directly to disableClusteringAtZoom.
          mapObj.setView(this._latlng, this._group._maxZoom + 1)
        } else if (boundsZoom <= mapZoom) {
          mapObj.setView(this._latlng, mapZoom + 1)
        } else {
          mapObj.fitBounds(boundsArr, fitBoundsOptions)
        }
      }
    }

    // Patch _animationSpiderfy: two dual-instance problems fixed together:
    //   1. Spider leg polylines are created with window.L.Polyline whose _clipPoints crashes —
    //      swap in ESM L.Polyline so legs go through the correct rendering path.
    //   2. The cluster's this._latlng is a window.L.LatLng. ESM L.Polyline._projectLatlngs
    //      checks `latlngs[0] instanceof LatLng` (ESM), which fails for window.L.LatLng and
    //      leaves the polyline with no bounds, crashing Bounds.intersects — convert temporarily.
    if (mcProto && typeof mcProto._animationSpiderfy === 'function' && !mcProto._animationSpiderfyPatched) {
      mcProto._animationSpiderfyPatched = true
      const _origAnimSpiderfy = mcProto._animationSpiderfy
      mcProto._animationSpiderfy = function (this: MarkerClusterProto, childMarkers: unknown[], positions: unknown[]) {
        const wL = (window as unknown as WindowWithLeaflet).L
        const origPolyline = wL?.Polyline
        if (wL) wL.Polyline = L.Polyline
        const self = this as unknown as { _latlng: L.LatLng | { lat: number; lng: number } }
        const origLatlng = self._latlng
        if (origLatlng && !(origLatlng instanceof L.LatLng)) {
          self._latlng = L.latLng(origLatlng.lat, origLatlng.lng)
        }
        try {
          return _origAnimSpiderfy.call(this, childMarkers, positions)
        } finally {
          self._latlng = origLatlng
          if (wL && origPolyline) wL.Polyline = origPolyline
        }
      }
    }
  }

  function patchBounds() {
    // ESM L.Bounds.intersects() calls toBounds(other) which fails for window.L.Bounds objects
    // (they don't pass instanceof, so the constructor loop gets .length=undefined, skips all
    // iterations, and returns an empty Bounds with min/max=undefined → crash reading .x).
    // Patch to duck-type the argument for cross-instance Bounds.
    //
    // IMPORTANT: Leaflet 1.9.4 uses `Bounds.prototype = {...}` (full replacement), so
    // Bounds.prototype.constructor === Object (not Bounds). Using .constructor.prototype would
    // patch Object.prototype instead — poisoning every object. Use Object.getPrototypeOf instead.
    const boundsInstance = L.bounds([0, 0], [1, 1])
    const boundsProto = Object.getPrototypeOf(boundsInstance) as {
      intersects?: (bounds: unknown) => boolean
      _boundsIntersectsPatched?: boolean
      min?: L.Point
      max?: L.Point
    }
    if (!boundsProto._boundsIntersectsPatched) {
      boundsProto._boundsIntersectsPatched = true
      const origIntersects = boundsProto.intersects
      boundsProto.intersects = function (this: typeof boundsProto, bounds: unknown) {
        // Only duck-type if bounds is a non-null object that isn't an ESM Bounds but DOES have
        // the min/max shape. This handles window.L.Bounds cross-instance objects while letting
        // arrays/primitives fall through to origIntersects so toBounds() can convert them.
        if (bounds && typeof bounds === 'object' && Object.getPrototypeOf(bounds) !== boundsProto) {
          const b = bounds as { min?: { x?: number; y?: number }; max?: { x?: number; y?: number } }
          if (b.min !== undefined && b.max !== undefined) {
            const min2 = b.min
            const max2 = b.max
            if (!min2 || !max2 || min2.x === undefined || max2.x === undefined) return false
            const min = this.min
            const max = this.max
            if (!min || !max || min.x === undefined || max.x === undefined) return false
            return max2.x >= min.x && min2.x <= max.x && (max2.y ?? 0) >= (min.y ?? 0) && (min2.y ?? 0) <= (max.y ?? 0)
          }
        }
        return origIntersects!.call(this, bounds)
      }
    }
  }

  function patchPopup() {
    // Popup crash guard: cross-instance interactions can leave _container undefined when
    // a popup is removed before onAdd ran.
    const popupProto = L.Popup.prototype as unknown as InternalPopupProto
    if (!popupProto._onRemoveGuarded) {
      popupProto._onRemoveGuarded = true
      const _origPopupOnRemove = L.Popup.prototype.onRemove as (map: L.Map) => void
      popupProto.onRemove = function (this: { _container?: HTMLElement }, map: L.Map) {
        if (!this._container) return
        _origPopupOnRemove.call(this, map)
      }
    }
  }

  function patchFeatureGroup(cg: L.MarkerClusterGroup) {
    // Patch _featureGroup.removeLayer as an OWN INSTANCE METHOD so it cannot be
    // bypassed by any prototype chain or esbuild CJS-to-ESM inlining. Markercluster
    // calls fg.removeLayer(marker) directly inside _recursivelyRemoveChildrenFromMap.
    // When _removeIcon → DomEvent.off(null) crashes, the exception aborts the whole
    // removal loop, leaving _featureGroup._layers and ESM map._layers out of sync.
    // That inconsistency causes markers to either disappear or land at wrong positions
    // on the next zoom. The catch block re-does the cleanup that removeLayer would have
    // done so the loop can continue cleanly to the next marker.
    const fg = (cg as unknown as { _featureGroup?: L.FeatureGroup })._featureGroup
    if (!fg || (fg as unknown as Record<string, unknown>)._removeLayerSafe) return
    ;(fg as unknown as Record<string, unknown>)._removeLayerSafe = true

    const origRemoveLayer = fg.removeLayer.bind(fg)
    ;(fg as unknown as Record<string, unknown>).removeLayer = function (layer: L.Layer) {
      try {
        return origRemoveLayer(layer)
      } catch {
        const id = fg.getLayerId(layer)
        const fgLayers = (fg as unknown as Record<string, unknown>)._layers as Record<number, unknown> | undefined
        if (fgLayers) delete fgLayers[id]
        const map = (fg as unknown as Record<string, unknown>)._map as L.Map | undefined
        if (map) {
          const mapLayers = (map as unknown as Record<string, unknown>)._layers as Record<number, unknown> | undefined
          if (mapLayers) delete mapLayers[id]
        }
        const m = layer as unknown as Record<string, unknown>
        if (m['_icon']) {
          try {
            ;(m['_icon'] as Element).remove()
          } catch {
            /* ok */
          }
          m['_icon'] = null
        }
        if (m['_shadow']) {
          try {
            ;(m['_shadow'] as Element).remove()
          } catch {
            /* ok */
          }
          m['_shadow'] = null
        }
        m['_initIconPos'] = null
      }
    }
  }

  function patchDomEvent() {
    // Guard DomEvent.off against null/undefined obj. During cluster zoom animations,
    // _animationZoomIn/_animationZoomOut call _recursivelyRemoveChildrenFromMap, which
    // calls removeLayer → onRemove → _removeIcon → DomEvent.off(this._icon). If _icon is
    // null (e.g. no icon/shadow created, or cross-instance lifecycle mismatch), this crashes
    // with "undefined is not an object (evaluating 'obj[eventsKey]')". That crash aborts the
    // removal loop mid-execution, leaving cluster internal state inconsistent, which causes
    // markers to be placed at wrong screen positions on the next zoom.
    const domEvent = L.DomEvent as Record<string, unknown>
    if (domEvent._offPatched) return
    domEvent._offPatched = true
    const origOff = domEvent.off as (...args: unknown[]) => typeof L.DomEvent
    domEvent.off = function (obj: unknown, ...rest: unknown[]) {
      if (!obj) return L.DomEvent
      try {
        return origOff.call(this, obj, ...rest)
      } catch {
        return L.DomEvent
      }
    }
  }

  function patchClickRouting(map: L.Map) {
    // Fix: Leaflet routes clicks via map._targets[L.stamp(domElement)]. When two Leaflet
    // objects independently reach the same stamp counter value, the wrong marker fires for
    // a click that never touched its icon. This patch validates each candidate target by
    // checking whether its icon's bounding rect actually contains the click point, and falls
    // back to a BCR scan of all _targets when the stamp-based result is wrong.
    type MapInternal = L.Map & {
      _findEventTargets: (e: MouseEvent, type: string) => L.Layer[]
      _targets: Record<number, L.Layer>
    }
    const m = map as unknown as MapInternal
    if ((m as unknown as Record<string, boolean>)._fetPatched) return
    ;(m as unknown as Record<string, boolean>)._fetPatched = true
    const origFET = m._findEventTargets.bind(m)
    m._findEventTargets = function (e: MouseEvent, type: string): L.Layer[] {
      const targets = origFET(e, type)
      if (type !== 'click' && type !== 'preclick') return targets

      const { clientX, clientY } = e
      const HIT = 12 // px margin for small icons

      function hitsIcon(t: L.Layer): boolean {
        const icon = (t as unknown as { _icon?: HTMLElement | null })._icon
        if (!icon) return true // non-icon layers (map itself) always pass
        const b = icon.getBoundingClientRect()
        return clientX >= b.left - HIT && clientX <= b.right + HIT && clientY >= b.top - HIT && clientY <= b.bottom + HIT
      }

      const filtered = targets.filter(hitsIcon)
      if (filtered.length > 0) return filtered

      // Stamp-lookup returned a wrong target (collision); scan _targets by BCR instead.
      for (const id of Object.keys(m._targets)) {
        const layer = m._targets[Number(id)]
        if (!layer || layer === (map as unknown as L.Layer)) continue
        if (hitsIcon(layer)) return [layer]
      }

      return targets
    }
  }

  function initClusterGroup(map: L.Map) {
    const cg = setupClusterGroup(map)
    patchMarkerCluster(cg)
    patchFeatureGroup(cg)
    patchBounds()
    patchPopup()
    patchDomEvent()
    patchClickRouting(map)
    clusterGroup.value = cg

    return cg
  }

  // Fix wrong marker positions after initial load.
  //
  // cg.onAdd() sets _currentShownBounds = _getExpandedVisibleBounds() at the moment
  // the cluster is added to the map. If the browser hasn't finished CSS layout yet
  // (map container clientHeight/Width still 0), getBounds().pad() divides by zero and
  // produces NaN bounds. Every subsequent addLayer() call's contains() check then
  // returns false, so markers are stored in the cluster tree but never added to the
  // featureGroup — and are therefore never positioned on screen.
  //
  // Fix: recompute _currentShownBounds from the live viewport, do a full cluster
  // rebuild (clearLayers → addLayers). addLayers' final _recursivelyAddChildrenToMap
  // call then adds all markers to the featureGroup via fg.addLayer → marker.onAdd →
  // update(), placing each icon at the correct screen position.
  function refreshClusterPositions() {
    const cg = clusterGroup.value
    if (!cg) return
    const cgI = cg as unknown as {
      _map?: L.Map
      _getExpandedVisibleBounds?: () => L.LatLngBounds
      _currentShownBounds?: L.LatLngBounds
      _featureGroup?: L.FeatureGroup
      _topClusterLevel?: { getAllChildMarkers: (storage?: L.Marker[]) => L.Marker[] }
    }
    if (!cgI._map) return

    const newBounds = cgI._getExpandedVisibleBounds?.()

    const allMarkersBeforeRebuild: L.Marker[] = []
    cgI._topClusterLevel?.getAllChildMarkers(allMarkersBeforeRebuild)

    if (newBounds) {
      cgI._currentShownBounds = newBounds
    }

    if (allMarkersBeforeRebuild.length === 0) return

    cg.clearLayers()
    cg.addLayers(allMarkersBeforeRebuild)
  }

  // Suppress cluster zoom/spiderfy while in placement/drawing modes.
  watch([isPlacingPin, isPlacingCaption, isDrawingRoute], ([placing, placingCaption, drawing]) => {
    const cg = clusterGroup.value as (L.MarkerClusterGroup & { options: { zoomToBoundsOnClick: boolean; spiderfyOnMaxZoom: boolean } }) | null
    if (cg) {
      const active = placing || placingCaption || drawing
      cg.options.zoomToBoundsOnClick = !active
      cg.options.spiderfyOnMaxZoom = !active
    }
  })

  return { clusterGroup, initClusterGroup, refreshClusterPositions }
}
