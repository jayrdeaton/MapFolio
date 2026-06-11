import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

import { Pin } from '../types'

interface PinMarkerProps {
  pin: Pin
  onDelete: (id: number) => void
}

function PinMarker({ pin, onDelete }: PinMarkerProps) {
  const map = useMap()

  useEffect(() => {
    const icon = L.divIcon({
      html: `<div class="pin-marker">
        <span class="pin-emoji">${pin.emoji}</span>
        <div class="pin-dot" style="background:${pin.color}"></div>
      </div>`,
      className: '',
      iconSize: [40, 52],
      iconAnchor: [20, 52]
    })

    const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map)

    marker.bindPopup(`
      <div class="pin-popup">
        <div class="pin-popup-name">${pin.emoji} ${pin.name}</div>
        ${pin.description ? `<div class="pin-popup-desc">${pin.description}</div>` : ''}
        <button class="pin-popup-delete" data-pin-id="${pin.id}">Remove pin</button>
      </div>
    `)

    marker.on('popupopen', () => {
      const btn = document.querySelector<HTMLButtonElement>(`.pin-popup-delete[data-pin-id="${pin.id}"]`)
      btn?.addEventListener('click', () => {
        onDelete(pin.id)
        marker.closePopup()
      })
    })

    return () => {
      map.removeLayer(marker)
    }
  }, [pin, map, onDelete])

  return null
}

export default PinMarker
