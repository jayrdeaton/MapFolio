import { Layers } from 'lucide-react'

import { MAP_STYLE_CONFIGS, MapStyle } from '../types'

interface MapOptionsProps {
  mapStyle: MapStyle
  onStyleChange: (style: MapStyle) => void
}

const STYLES: MapStyle[] = ['clean', 'minimal', 'standard', 'satellite', 'terrain', 'dark']

function MapOptions({ mapStyle, onStyleChange }: MapOptionsProps) {
  return (
    <div className='mb-5'>
      <h3 className='mb-3 text-gray-800 text-sm font-semibold flex items-center gap-1.5 uppercase tracking-wide'>
        <Layers size={14} /> Map Style
      </h3>
      <div className='grid grid-cols-2 gap-1.5'>
        {STYLES.map((style) => {
          const config = MAP_STYLE_CONFIGS[style]
          const selected = mapStyle === style
          return (
            <button
              key={style}
              onClick={() => onStyleChange(style)}
              className={`p-2 rounded border text-left cursor-pointer transition-all ${
                selected
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className='text-sm font-medium leading-tight'>{config.name}</div>
              <div className='text-xs text-gray-400 mt-0.5 leading-tight'>{config.description}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MapOptions
