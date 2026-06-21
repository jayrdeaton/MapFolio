import L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { Pin, Route } from '@/types'

const ROUTE_PENCIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`
const ROUTE_TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
const ROUTE_EYE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
const ROUTE_WAYPOINTS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`
const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const SCISSORS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`
const INSERT_WP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`
const UNLINK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

interface UseRoutePopupOptions {
  routes: Ref<Route[]>
  pins: Ref<Pin[]>
  hiddenPinIds: Ref<Set<number>>
  leafletMap: ShallowRef<L.Map | null>
  isDrawingRoute: Ref<boolean>
  onEditRoute: (route: Route) => void
  onContinueDrawing: (id: number) => void
  onToggleVisibility: (id: number) => void
  onDeleteRoute: (id: number) => void
  onExtendFrom: (routeId: number, pointIndex: number) => void
  onRemoveWaypoint: (routeId: number, pointIndex: number) => void
  onBreakLink: (routeId: number, pointIndex: number) => void
  onEditPin: (pin: Pin) => void
  onHidePin: (id: number) => void
  onDeletePin: (id: number) => void
  onInsertWaypoint: (routeId: number, lat: number, lng: number) => void
  onClipCopyRoute: (route: Route) => void
  onClipCutRoute: (route: Route) => void
}

export function useRoutePopup({ routes, pins, hiddenPinIds, leafletMap, isDrawingRoute, onEditRoute, onContinueDrawing, onToggleVisibility, onDeleteRoute, onExtendFrom, onRemoveWaypoint, onBreakLink, onEditPin, onHidePin, onDeletePin, onInsertWaypoint, onClipCopyRoute, onClipCutRoute }: UseRoutePopupOptions) {
  let routePopup: L.Popup | null = null

  function openRoutePopup(lat: number, lng: number, content: string, bindButtons: () => void) {
    if (!routePopup) routePopup = L.popup()
    // Close first so Leaflet re-fires popupopen even when reusing the same instance
    routePopup.close()
    routePopup.setLatLng([lat, lng])
    routePopup.setContent(content)
    routePopup.openOn(leafletMap.value!)
    // Popup DOM is synchronously ready after openOn — bind handlers directly
    bindButtons()
  }

  function handleContextRoute(routeId: number, lat: number, lng: number) {
    if (isDrawingRoute.value) return
    const route = routes.value.find((r) => r.id === routeId)
    if (!route) return

    const pts = route.points.length

    const insertBtn = pts >= 2 ? `<button class="pin-popup-action-row route-popup-insert" data-route-id="${routeId}" data-lat="${lat}" data-lng="${lng}">${ROUTE_WAYPOINTS_SVG} Insert Waypoint</button>` : ''
    const content = `<div class="pin-popup">
      <button class="pin-popup-action-row route-popup-edit" data-route-id="${routeId}">${ROUTE_PENCIL_SVG} Edit Route</button>
      ${insertBtn}
      <button class="pin-popup-action-row route-popup-waypoints" data-route-id="${routeId}">${INSERT_WP_SVG} Extend Route</button>
      <button class="pin-popup-action-row route-popup-clip-copy" data-route-id="${routeId}">${COPY_SVG} Copy Route</button>
      <button class="pin-popup-action-row route-popup-clip-cut" data-route-id="${routeId}">${SCISSORS_SVG} Cut Route</button>
      <button class="pin-popup-action-row route-popup-hide" data-route-id="${routeId}">${ROUTE_EYE_SVG} Hide Route</button>
      <button class="pin-popup-action-row pin-popup-delete route-popup-delete" data-route-id="${routeId}">${ROUTE_TRASH_SVG} Delete Route</button>
    </div>`

    openRoutePopup(lat, lng, content, () => {
      document.querySelector<HTMLButtonElement>(`.route-popup-edit[data-route-id="${routeId}"]`)?.addEventListener(
        'click',
        () => {
          routePopup?.close()
          onEditRoute(route)
        },
        { once: true }
      )
      document.querySelector<HTMLButtonElement>(`.route-popup-waypoints[data-route-id="${routeId}"]`)?.addEventListener(
        'click',
        () => {
          routePopup?.close()
          onContinueDrawing(routeId)
        },
        { once: true }
      )
      document.querySelector<HTMLButtonElement>(`.route-popup-insert[data-route-id="${routeId}"]`)?.addEventListener(
        'click',
        (e) => {
          routePopup?.close()
          const btn = e.currentTarget as HTMLButtonElement
          onInsertWaypoint(routeId, parseFloat(btn.dataset.lat!), parseFloat(btn.dataset.lng!))
        },
        { once: true }
      )
      document.querySelector<HTMLButtonElement>(`.route-popup-clip-copy[data-route-id="${routeId}"]`)?.addEventListener(
        'click',
        () => {
          routePopup?.close()
          onClipCopyRoute(route)
        },
        { once: true }
      )
      document.querySelector<HTMLButtonElement>(`.route-popup-clip-cut[data-route-id="${routeId}"]`)?.addEventListener(
        'click',
        () => {
          routePopup?.close()
          onClipCutRoute(route)
        },
        { once: true }
      )
      document.querySelector<HTMLButtonElement>(`.route-popup-hide[data-route-id="${routeId}"]`)?.addEventListener(
        'click',
        () => {
          routePopup?.close()
          onToggleVisibility(routeId)
        },
        { once: true }
      )
      document.querySelector<HTMLButtonElement>(`.route-popup-delete[data-route-id="${routeId}"]`)?.addEventListener(
        'click',
        () => {
          routePopup?.close()
          onDeleteRoute(routeId)
        },
        { once: true }
      )
    })
  }

  function handleContextWaypoint(routeId: number, pointIndex: number) {
    if (!leafletMap.value || isDrawingRoute.value) return
    const route = routes.value.find((r) => r.id === routeId)
    if (!route || !route.points[pointIndex]) return

    const point = route.points[pointIndex]!
    const { lat, lng } = point
    const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    const linkedPin = point.pinId ? pins.value.find((p) => p.id === point.pinId) : null

    const buildContent = () => {
      if (!linkedPin) {
        return `<div class="pin-popup">
          <button class="pin-popup-action-row wp-popup-edit-route" data-route-id="${routeId}">${ROUTE_PENCIL_SVG} Edit Route</button>
          <button class="pin-popup-action-row wp-popup-extend" data-route-id="${routeId}" data-index="${pointIndex}">${INSERT_WP_SVG} Extend Route</button>
          <button class="pin-popup-action-row wp-popup-copy-coords">${COPY_SVG}<span class="pin-popup-action-label">${coordStr}</span></button>
          <button class="pin-popup-action-row pin-popup-delete wp-popup-remove" data-route-id="${routeId}" data-index="${pointIndex}">${ROUTE_TRASH_SVG} Delete Waypoint</button>
        </div>`
      }
      const pin = linkedPin
      const isHidden = hiddenPinIds.value.has(pin.id)
      const addrRow = pin.address ? `<button class="pin-popup-action-row wp-popup-copy-addr" data-copy="${pin.address}">${COPY_SVG}<span class="pin-popup-action-label">${pin.address}</span></button>` : ''
      return `<div class="pin-popup">
        <button class="pin-popup-action-row wp-popup-edit-pin pin-popup-edit">${ROUTE_PENCIL_SVG} Edit Pin</button>
        <button class="pin-popup-action-row wp-popup-break" data-route-id="${routeId}" data-index="${pointIndex}">${UNLINK_SVG} Unlink Pin</button>
        <button class="pin-popup-action-row wp-popup-copy-coords">${COPY_SVG}<span class="pin-popup-action-label">${coordStr}</span></button>
        ${addrRow}
        <button class="pin-popup-action-row wp-popup-hide-pin">${ROUTE_EYE_SVG} ${isHidden ? 'Show Pin' : 'Hide Pin'}</button>
        <button class="pin-popup-action-row pin-popup-delete wp-popup-delete-pin">${ROUTE_TRASH_SVG} Delete Pin</button>
        <button class="pin-popup-action-row wp-popup-edit-route" data-route-id="${routeId}">${ROUTE_PENCIL_SVG} Edit Route</button>
        <button class="pin-popup-action-row wp-popup-extend" data-route-id="${routeId}" data-index="${pointIndex}">${INSERT_WP_SVG} Extend Route</button>
        <button class="pin-popup-action-row pin-popup-delete wp-popup-remove" data-route-id="${routeId}" data-index="${pointIndex}">${ROUTE_TRASH_SVG} Delete Waypoint</button>
      </div>`
    }

    openRoutePopup(lat, lng, buildContent(), () => {
      document.querySelector<HTMLElement>(`.wp-popup-edit-route[data-route-id="${routeId}"]`)?.addEventListener(
        'click',
        () => {
          routePopup?.close()
          onEditRoute(route)
        },
        { once: true }
      )
      document.querySelector<HTMLButtonElement>(`.wp-popup-break[data-route-id="${routeId}"][data-index="${pointIndex}"]`)?.addEventListener(
        'click',
        () => {
          routePopup?.close()
          onBreakLink(routeId, pointIndex)
        },
        { once: true }
      )
      document.querySelector<HTMLButtonElement>(`.wp-popup-extend[data-route-id="${routeId}"][data-index="${pointIndex}"]`)?.addEventListener(
        'click',
        () => {
          routePopup?.close()
          onExtendFrom(routeId, pointIndex)
        },
        { once: true }
      )
      document.querySelector<HTMLButtonElement>(`.wp-popup-remove[data-route-id="${routeId}"][data-index="${pointIndex}"]`)?.addEventListener(
        'click',
        () => {
          routePopup?.close()
          onRemoveWaypoint(routeId, pointIndex)
        },
        { once: true }
      )
      const copyBtn = document.querySelector<HTMLButtonElement>('.wp-popup-copy-coords')
      copyBtn?.addEventListener(
        'click',
        () => {
          navigator.clipboard.writeText(coordStr).then(() => {
            if (copyBtn) {
              copyBtn.innerHTML = `${CHECK_SVG} Copied!`
              setTimeout(() => {
                copyBtn.innerHTML = `${COPY_SVG}<span class="pin-popup-action-label">${coordStr}</span>`
              }, 1500)
            }
          })
        },
        { once: true }
      )
      if (linkedPin) {
        document.querySelector<HTMLElement>('.wp-popup-edit-pin')?.addEventListener(
          'click',
          () => {
            routePopup?.close()
            onEditPin(linkedPin)
          },
          { once: true }
        )
        document.querySelector<HTMLButtonElement>('.wp-popup-hide-pin')?.addEventListener(
          'click',
          () => {
            routePopup?.close()
            onHidePin(linkedPin.id)
          },
          { once: true }
        )
        document.querySelector<HTMLButtonElement>('.wp-popup-delete-pin')?.addEventListener(
          'click',
          () => {
            routePopup?.close()
            onDeletePin(linkedPin.id)
          },
          { once: true }
        )
        const addrBtn = document.querySelector<HTMLButtonElement>('.wp-popup-copy-addr')
        if (addrBtn) {
          addrBtn.addEventListener(
            'click',
            () => {
              navigator.clipboard.writeText(addrBtn.dataset.copy ?? '').then(() => {
                const original = addrBtn.innerHTML
                addrBtn.innerHTML = `${CHECK_SVG} Copied!`
                setTimeout(() => {
                  addrBtn.innerHTML = original
                }, 1500)
              })
            },
            { once: true }
          )
        }
      }
    })
  }

  return { handleContextRoute, handleContextWaypoint }
}
