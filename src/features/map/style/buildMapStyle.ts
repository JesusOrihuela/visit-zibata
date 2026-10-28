/**
 * Construye el estilo completo de MapLibre a partir de los datos propios del proyecto
 * (teselas propias + GeoJSON locales). Sin servidores de mapas externos ni claves.
 */

import gothic400 from '@fontsource/special-gothic/files/special-gothic-latin-400-normal.woff2?url'
import gothic500 from '@fontsource/special-gothic/files/special-gothic-latin-500-normal.woff2?url'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { StyleSpecification } from 'maplibre-gl'
import type { Bbox } from '../../../config/map.ts'
import { plazaTones } from '../../../config/palette.ts'
import type { Plaza } from '../../../types/domain.ts'
import { SOURCE } from './ids.ts'
import { buildingLayers } from './layers/buildings.ts'
import { groundLayers, outsideVeilLayers } from './layers/ground.ts'
import { FONT, labelLayers } from './layers/labels.ts'
import { plazaBuildingLayers, plazaGroundLayers } from './layers/plazas.ts'
import {
  type RealismoStyleOptions,
  realismoLight,
  realismoOutsideLayers,
  realismoSky,
  realismoSources,
  withRealismoGround,
} from './layers/realismo.ts'
import { roadLayers } from './layers/roads.ts'
import { treeLayers } from './layers/trees.ts'
import { mapTheme } from './theme.ts'

export interface MapStyleOptions {
  tilesUrl: string
  plazaBuildingsUrl: string
  plazas: readonly Plaza[]
  boundary: Polygon
  areaBbox: Bbox
  center: [number, number]
  /** Capas de realismo (suelo, relieve, contexto). Sin esto el estilo es el de siempre. */
  realismo?: RealismoStyleOptions
}

/** Atribución de la ODbL para lo que sale de OpenStreetMap, y de cada fuente de las demás capas. */
export const MAP_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · ' +
  '<a href="https://overturemaps.org/" target="_blank" rel="noopener">Overture Maps</a> · ' +
  '<a href="https://esa-worldcover.org/" target="_blank" rel="noopener">ESA WorldCover</a> · ' +
  '<a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre</a>'

const absolute = (url: string) => new URL(url, window.location.href).href

export function plazaSitesGeoJSON(plazas: readonly Plaza[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: plazas.map((plaza) => ({
      type: 'Feature',
      properties: {
        plazaId: plaza.id,
        name: plaza.name,
        active: plaza.active,
        comingSoon: plaza.comingSoon === true,
      },
      geometry: plaza.geometry,
    })),
  }
}

/** Polígono "mundo con hueco": todo lo que queda fuera del contorno de Zibatá. */
export function outsideMask(boundary: Polygon, [west, south, east, north]: Bbox): Feature {
  const margin = 0.2
  const outer = [
    [west - margin, south - margin],
    [east + margin, south - margin],
    [east + margin, north + margin],
    [west - margin, north + margin],
    [west - margin, south - margin],
  ]
  const hole = [...(boundary.coordinates[0] ?? [])].reverse()
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [outer, hole] },
  }
}

export function buildMapStyle(options: MapStyleOptions): StyleSpecification {
  const tones = plazaTones(options.plazas.filter((plaza) => plaza.active).map((plaza) => plaza.id))
  const { realismo } = options
  return {
    version: 8,
    name: 'Zibatá: maqueta',
    'font-faces': {
      [FONT.sans]: absolute(gothic500),
      [FONT.serif]: absolute(gothic400),
    },
    sources: {
      [SOURCE.base]: {
        type: 'vector',
        url: options.tilesUrl,
        attribution: MAP_ATTRIBUTION,
      },
      [SOURCE.plazaSites]: {
        type: 'geojson',
        data: plazaSitesGeoJSON(options.plazas),
        promoteId: 'plazaId',
      },
      [SOURCE.plazaBuildings]: {
        type: 'geojson',
        data: options.plazaBuildingsUrl,
        promoteId: 'plazaId',
      },
      [SOURCE.mask]: { type: 'geojson', data: outsideMask(options.boundary, options.areaBbox) },
      [SOURCE.areaLabel]: {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: options.center },
        },
      },
      ...(realismo ? realismoSources(realismo) : {}),
    },
    sky: realismo
      ? realismoSky
      : {
          'sky-color': mapTheme.sky.sky,
          'horizon-color': mapTheme.sky.horizon,
          'fog-color': mapTheme.sky.fog,
          'sky-horizon-blend': 0.7,
          'horizon-fog-blend': 0.6,
          'fog-ground-blend': 0.82,
          'atmosphere-blend': 0,
        },
    light: realismo
      ? realismoLight
      : { anchor: 'map', color: mapTheme.light, intensity: 0.42, position: [1.25, 210, 42] },
    layers: [
      ...(realismo ? withRealismoGround(groundLayers()) : groundLayers()),
      ...plazaGroundLayers(tones),
      ...roadLayers(),
      ...(realismo ? realismoOutsideLayers(realismo) : outsideVeilLayers()),
      ...treeLayers(),
      ...buildingLayers(),
      ...plazaBuildingLayers(tones),
      ...labelLayers(),
    ],
  }
}
