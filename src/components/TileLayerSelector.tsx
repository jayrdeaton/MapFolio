import { TileLayer } from 'react-leaflet'

import { TILE_LAYER_VARIANTS, TileProvider, TileVariant } from './MapOptions'

interface TileLayerSelectorProps {
  provider?: TileProvider
  variant?: TileVariant
}

function TileLayerSelector({ provider = 'esri', variant = 'standard' }: TileLayerSelectorProps) {
  const providerVariants = TILE_LAYER_VARIANTS[provider] ?? TILE_LAYER_VARIANTS.esri
  const tileConfig = (providerVariants as Record<string, (typeof providerVariants)[keyof typeof providerVariants]>)[variant] ?? providerVariants.standard

  const tileProps = {
    attribution: tileConfig.attribution,
    url: tileConfig.url,
    ...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {})
  }

  return <TileLayer {...tileProps} />
}

export default TileLayerSelector
