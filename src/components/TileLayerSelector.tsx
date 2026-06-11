import { TileLayer } from 'react-leaflet'

import { MAP_STYLE_CONFIGS, MapStyle } from '../types'

interface TileLayerSelectorProps {
  style: MapStyle
}

function TileLayerSelector({ style }: TileLayerSelectorProps) {
  const config = MAP_STYLE_CONFIGS[style]
  return (
    <TileLayer
      key={style}
      url={config.url}
      attribution={config.attribution}
      {...(config.subdomains ? { subdomains: config.subdomains } : {})}
    />
  )
}

export default TileLayerSelector
