import { Pin } from '../types'

interface PrintLegendProps {
  title: string
  pins: Pin[]
}

function PrintLegend({ title, pins }: PrintLegendProps) {
  if (!title && pins.length === 0) return null

  return (
    <div className='print-legend'>
      {title && <div className='print-legend-title'>{title}</div>}
      {pins.length > 0 && (
        <>
          <div className='print-legend-header'>Legend</div>
          <div className='print-legend-items'>
            {pins.map((pin) => (
              <div key={pin.id} className='print-legend-item'>
                <span className='print-legend-emoji'>{pin.emoji}</span>
                <div className='print-legend-text'>
                  <div className='print-legend-name'>{pin.name}</div>
                  {pin.description && <div className='print-legend-desc'>{pin.description}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default PrintLegend
