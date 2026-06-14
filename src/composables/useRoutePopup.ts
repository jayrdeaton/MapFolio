import L from 'leaflet'
import type { ShallowRef } from 'vue'

import type { Pin, Route } from '@/types'
import { formatDistance, routeDistanceM } from './useRoutes'

const ROUTE_PENCIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`
const ROUTE_TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
const ROUTE_EYE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
const ROUTE_WAYPOINTS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.586 5.414-5.172 5.172"/><path d="m18.586 13.414-5.172 5.172"/><path d="M6 12h12"/><circle cx="12" cy="20" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="20" cy="12" r="2"/><circle cx="4" cy="12" r="2"/></svg>`
const ROUTE_PLUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
const UNLINK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`

interface UseRoutePopupOptions {
  routes: Ref<Route[]>
  pins: Ref<Pin[]>
  leafletMap: ShallowRef<L.Map | null>
  distanceUnit: ComputedRef<'km' | 'mi'>
  isDrawingRoute: Ref<boolean>
  onEditRoute: (route: Route) => void
  onContinueDrawing: (id: number) => void
  onToggleVisibility: (id: number) => void
  onDeleteRoute: (id: number) => void
  onExtendFrom: (routeId: number, pointIndex: number) => void
  onRemoveWaypoint: (routeId: number, pointIndex: number) => void
  onBreakLink: (routeId: number, pointIndex: number) => void
}

export function useRoutePopup({ routes, pins, leafletMap, distanceUnit, isDrawingRoute, onEditRoute, onContinueDrawing, onToggleVisibility, onDeleteRoute, onExtendFrom, onRemoveWaypoint, onBreakLink }: UseRoutePopupOptions) {
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

  function handleClickRoute(routeId: number, lat: number, lng: number) {
    if (isDrawingRoute.value) return
    const route = routes.value.find((r) => r.id === routeId)
    if (!route) return

    const pts = route.points.length
    const unit = distanceUnit.value
    const distStr = pts > 1 ? formatDistance(routeDistanceM(route.points), unit) : ''
    const stats = `${pts} waypoint${pts !== 1 ? 's' : ''}${distStr ? ' · ' + distStr : ''}`

    const content = `<div class="pin-popup">
      <div class="pin-popup-header">
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
          <div style="width:10px;height:10px;border-radius:50%;background:${route.color};flex-shrink:0;"></div>
          <span class="pin-popup-name">${route.name}</span>
        </div>
        <div class="pin-popup-actions">
          <button class="pin-popup-btn pin-popup-hide route-popup-hide" data-route-id="${routeId}" title="Hide">${ROUTE_EYE_SVG}</button>
          <button class="pin-popup-btn pin-popup-copy route-popup-waypoints" data-route-id="${routeId}" title="Edit waypoints">${ROUTE_WAYPOINTS_SVG}</button>
          <button class="pin-popup-btn pin-popup-edit route-popup-edit" data-route-id="${routeId}" title="Edit">${ROUTE_PENCIL_SVG}</button>
          <button class="pin-popup-btn pin-popup-delete route-popup-delete" data-route-id="${routeId}" title="Delete">${ROUTE_TRASH_SVG}</button>
        </div>
      </div>
      <div class="pin-popup-footer"><span class="pin-popup-coords">${stats}</span></div>
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

  function handleWaypointTap(routeId: number, pointIndex: number) {
    if (!leafletMap.value || isDrawingRoute.value) return
    const route = routes.value.find((r) => r.id === routeId)
    if (!route || !route.points[pointIndex]) return

    const point = route.points[pointIndex]!
    const { lat, lng } = point
    const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
    const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

    const linkedPin = point.pinId ? pins.value.find((p) => p.id === point.pinId) : null

    const header = linkedPin ? `<span style="font-size:14px;line-height:1;flex-shrink:0">${linkedPin.emoji}</span><span class="pin-popup-name" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${linkedPin.name || 'Unnamed pin'}</span>` : `<div style="width:10px;height:10px;border-radius:50%;background:${route.color};flex-shrink:0;"></div><span class="pin-popup-name">Waypoint ${pointIndex + 1}</span>`

    const content = `<div class="pin-popup">
      <div class="pin-popup-header">
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
          ${header}
        </div>
        <div class="pin-popup-actions">
          ${linkedPin ? `<button class="pin-popup-btn wp-popup-break" data-route-id="${routeId}" data-index="${pointIndex}" title="Break pin link">${UNLINK_SVG}</button>` : ''}
          <button class="pin-popup-btn wp-popup-extend" data-route-id="${routeId}" data-index="${pointIndex}" title="Extend path from here">${ROUTE_PLUS_SVG}</button>
          <button class="pin-popup-btn pin-popup-delete wp-popup-remove" data-route-id="${routeId}" data-index="${pointIndex}" title="Remove waypoint">${ROUTE_TRASH_SVG}</button>
        </div>
      </div>
      <div class="pin-popup-footer">
        <div class="pin-popup-row">
          <span class="pin-popup-coords">${linkedPin ? `Linked · ${coordStr}` : coordStr}</span>
          <button class="pin-popup-btn wp-popup-copy-coords" title="Copy coordinates">${COPY_SVG}</button>
        </div>
      </div>
    </div>`

    openRoutePopup(lat, lng, content, () => {
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
              copyBtn.innerHTML = CHECK_SVG
              setTimeout(() => {
                copyBtn.innerHTML = COPY_SVG
              }, 1500)
            }
          })
        },
        { once: true }
      )
    })
  }

  return { handleClickRoute, handleWaypointTap }
}
