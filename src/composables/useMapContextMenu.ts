import L from 'leaflet'

const MAP_LOCATION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`
const MAP_PINS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
const MAP_ROUTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`
const MAP_PASTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`
const MAP_CAPTION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`
const MAP_PRINT_AREA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>`
const PRINT_EDIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`
const PRINT_CUT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>`
const PRINT_EXPORT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`
const PRINT_DELETE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
const MAP_COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const MAP_CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

interface UseMapContextMenuOptions {
  leafletMap: Ref<L.Map | null>
  hasClipboard: Ref<boolean>
  onPlacePinSingle: (latlng: L.LatLng) => void
  onPlacePinMultiple: (latlng: L.LatLng) => void
  onStartRoute: (latlng: L.LatLng) => void
  onPlaceCaption: (lat: number, lng: number) => void
  onAddPrintArea: () => void
  onPaste: (lat: number, lng: number) => void
  onDownloadPdf: () => void
  onEditPrintArea: () => void
  onCutPrintArea: () => void
  onCopyPrintArea: () => void
  onRemovePrintArea: () => void
}

export function useMapContextMenu({ leafletMap, hasClipboard, onPlacePinSingle, onPlacePinMultiple, onStartRoute, onPlaceCaption, onAddPrintArea, onPaste, onDownloadPdf, onEditPrintArea, onCutPrintArea, onCopyPrintArea, onRemovePrintArea }: UseMapContextMenuOptions) {
  let ctxPopup: L.Popup | null = null

  function closeMapContextPopup() {
    if (ctxPopup) {
      ctxPopup.close()
      ctxPopup = null
    }
  }

  function openMapContextPopup(latlng: L.LatLng, map: L.Map) {
    closeMapContextPopup()
    const pasteRow = hasClipboard.value ? `<button class="pin-popup-action-row map-ctx-paste">${MAP_PASTE_SVG} Paste Here</button>` : ''
    ctxPopup = L.popup()
      .setLatLng(latlng)
      .setContent(
        `<div class="pin-popup" style="padding:4px 0;min-width:170px;">
          <button class="pin-popup-action-row map-ctx-one">${MAP_LOCATION_SVG} Place Pin</button>
          <button class="pin-popup-action-row map-ctx-many">${MAP_PINS_SVG} Place Multiple Pins</button>
          <button class="pin-popup-action-row map-ctx-route">${MAP_ROUTE_SVG} Start Route</button>
          <button class="pin-popup-action-row map-ctx-caption">${MAP_CAPTION_SVG} Add Caption</button>
          <button class="pin-popup-action-row map-ctx-print-area">${MAP_PRINT_AREA_SVG} Add Print</button>
          <button class="pin-popup-action-row map-ctx-copy-coords">${MAP_COPY_SVG}<span class="pin-popup-action-label">${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</span></button>
          ${pasteRow}
        </div>`
      )
      .openOn(map)

    document.querySelector<HTMLButtonElement>('.map-ctx-one')?.addEventListener(
      'click',
      () => {
        closeMapContextPopup()
        onPlacePinSingle(latlng)
      },
      { once: true }
    )
    document.querySelector<HTMLButtonElement>('.map-ctx-many')?.addEventListener(
      'click',
      () => {
        closeMapContextPopup()
        onPlacePinMultiple(latlng)
      },
      { once: true }
    )
    document.querySelector<HTMLButtonElement>('.map-ctx-route')?.addEventListener(
      'click',
      () => {
        closeMapContextPopup()
        onStartRoute(latlng)
      },
      { once: true }
    )
    document.querySelector<HTMLButtonElement>('.map-ctx-caption')?.addEventListener(
      'click',
      () => {
        closeMapContextPopup()
        onPlaceCaption(latlng.lat, latlng.lng)
      },
      { once: true }
    )
    document.querySelector<HTMLButtonElement>('.map-ctx-print-area')?.addEventListener(
      'click',
      () => {
        closeMapContextPopup()
        onAddPrintArea()
      },
      { once: true }
    )
    const coordsBtn = document.querySelector<HTMLButtonElement>('.map-ctx-copy-coords')
    if (coordsBtn) {
      const coordStr = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`
      coordsBtn.addEventListener(
        'click',
        () => {
          navigator.clipboard.writeText(coordStr).then(() => {
            coordsBtn.innerHTML = `${MAP_CHECK_SVG} Copied!`
            setTimeout(() => {
              coordsBtn.innerHTML = `${MAP_COPY_SVG}<span class="pin-popup-action-label">${coordStr}</span>`
            }, 1500)
          })
        },
        { once: true }
      )
    }
    if (hasClipboard.value) {
      document.querySelector<HTMLButtonElement>('.map-ctx-paste')?.addEventListener(
        'click',
        () => {
          closeMapContextPopup()
          onPaste(latlng.lat, latlng.lng)
        },
        { once: true }
      )
    }
  }

  // Print-area context menu (right-click on the area outline).
  function openPrintAreaContextMenu(clientX: number, clientY: number) {
    const map = leafletMap.value
    if (!map) return
    closeMapContextPopup()
    const rect = map.getContainer().getBoundingClientRect()
    const latlng = map.containerPointToLatLng(L.point(clientX - rect.left, clientY - rect.top))
    ctxPopup = L.popup()
      .setLatLng(latlng)
      .setContent(
        `<div class="pin-popup" style="padding:4px 0;min-width:150px;">
          <button class="pin-popup-action-row print-ctx-edit">${PRINT_EDIT_SVG} Edit Print</button>
          <button class="pin-popup-action-row print-ctx-cut">${PRINT_CUT_SVG} Cut Print</button>
          <button class="pin-popup-action-row print-ctx-copy">${MAP_COPY_SVG} Copy Print</button>
          <button class="pin-popup-action-row print-ctx-export">${PRINT_EXPORT_SVG} Export PDF</button>
          <button class="pin-popup-action-row pin-popup-delete print-ctx-delete">${PRINT_DELETE_SVG} Delete Print</button>
        </div>`
      )
      .openOn(map)

    document.querySelector<HTMLButtonElement>('.print-ctx-edit')?.addEventListener(
      'click',
      () => {
        closeMapContextPopup()
        onEditPrintArea()
      },
      { once: true }
    )
    document.querySelector<HTMLButtonElement>('.print-ctx-cut')?.addEventListener(
      'click',
      () => {
        closeMapContextPopup()
        onCutPrintArea()
      },
      { once: true }
    )
    document.querySelector<HTMLButtonElement>('.print-ctx-copy')?.addEventListener(
      'click',
      () => {
        closeMapContextPopup()
        onCopyPrintArea()
      },
      { once: true }
    )
    document.querySelector<HTMLButtonElement>('.print-ctx-export')?.addEventListener(
      'click',
      () => {
        closeMapContextPopup()
        onDownloadPdf()
      },
      { once: true }
    )
    document.querySelector<HTMLButtonElement>('.print-ctx-delete')?.addEventListener(
      'click',
      () => {
        closeMapContextPopup()
        onRemovePrintArea()
      },
      { once: true }
    )
  }

  return { openMapContextPopup, openPrintAreaContextMenu, closeMapContextPopup }
}
