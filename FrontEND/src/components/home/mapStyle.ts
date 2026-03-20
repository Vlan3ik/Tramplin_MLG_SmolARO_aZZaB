import type { StyleSpecification } from 'maplibre-gl'

export const cartoStyle: StyleSpecification = {
  version: 8,
  sources: {
    openStreetMap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm-base', type: 'raster', source: 'openStreetMap' }],
}
