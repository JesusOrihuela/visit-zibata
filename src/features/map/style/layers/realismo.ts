/**
 * Capas de realismo nativas: suelo de Sentinel-2, relieve sombreado con tinte por altitud y, fuera del
 * contorno, la imagen de contexto con las calles principales de la región. Los datos salen de
 * `npm run map:build:realismo` y se sirven del mismo origen (public/map/realismo).
 *
 * Con el realismo apagado nada de esto entra en el estilo, así que no se descarga ni un byte.
 */
import type {
  ExpressionSpecification,
  LayerSpecification,
  LightSpecification,
  SkySpecification,
  SourceSpecification,
} from 'maplibre-gl'
import descriptor from '../../realismo/descriptor.json'
import { SOURCE } from '../ids.ts'

export interface RealismoStyleOptions {
  /** URL absoluta de la carpeta con los datos (termina en "/"). */
  baseUrl: string
}

const ATTRIBUTION = {
  sentinel: `Contains modified Copernicus Sentinel data ${descriptor.creditos.anio}`,
  alturas: `Alturas estimadas con <a href="https://sites.research.google/gr/open-buildings/temporal/" target="_blank" rel="noopener">Open Buildings 2.5D</a> (Google Research)`,
  relieve:
    'Copernicus DEM GLO-30 © DLR e.V. y Airbus Defence and Space, provisto por la Unión Europea y la ESA, vía ' +
    '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener">Mapterhorn</a>',
}

export const realismoTheme = {
  groundOutside: '#d9cdb6',
  groundZibata: '#e6dac4',
  boundaryEdge: '#cdbfa7',
  road: '#f3ecdd',
  roadCasing: '#c9bba0',
  sky: { sky: '#b9cfe0', horizon: '#f3dcc0', fog: '#efd9bd' },
  light: '#fff0dc',
} as const

export const realismoLight: LightSpecification = {
  anchor: 'map',
  color: realismoTheme.light,
  intensity: 0.5,
  position: [1.6, 225, 34],
}

export const realismoSky: SkySpecification = {
  'sky-color': realismoTheme.sky.sky,
  'horizon-color': realismoTheme.sky.horizon,
  'fog-color': realismoTheme.sky.fog,
  'sky-horizon-blend': 0.6,
  'horizon-fog-blend': 0.7,
  'fog-ground-blend': 0.7,
  'atmosphere-blend': 0,
}

type Esquinas = [[number, number], [number, number], [number, number], [number, number]]

const bounds = (e: Esquinas): [number, number, number, number] => [
  e[0][0],
  e[2][1],
  e[1][0],
  e[0][1],
]

export function realismoSources(
  options: RealismoStyleOptions,
): Record<string, SourceSpecification> {
  const { baseUrl } = options
  const sources: Record<string, SourceSpecification> = {
    [SOURCE.soil]: {
      type: 'image',
      url: `${baseUrl}suelo.webp`,
      coordinates: descriptor.suelo.coordenadas as Esquinas,
    },
    [SOURCE.relief]: {
      type: 'raster-dem',
      tiles: [`${baseUrl}relieve/{z}/{x}/{y}.webp`],
      tileSize: 512,
      minzoom: descriptor.relieve.zoom,
      maxzoom: descriptor.relieve.zoom,
      bounds: bounds(descriptor.contexto.coordenadas as Esquinas),
      encoding: 'terrarium',
      attribution: `${ATTRIBUTION.relieve} · ${ATTRIBUTION.sentinel} · ${ATTRIBUTION.alturas}`,
    },
  }
  sources[SOURCE.context] = {
    type: 'image',
    url: `${baseUrl}contexto.webp`,
    coordinates: descriptor.contexto.coordenadas as Esquinas,
  }
  sources[SOURCE.contextRoads] = { type: 'geojson', data: `${baseUrl}vias.geojson` }
  return sources
}

/** Mete el relieve y el suelo en el orden del terreno y repinta el fondo con el tono cálido del realismo. */
export function withRealismoGround(ground: LayerSpecification[]): LayerSpecification[] {
  const layers: LayerSpecification[] = []
  for (const layer of ground) {
    if (layer.id === 'landuse-built') {
      layers.push(
        {
          id: 'realismo-tinte',
          type: 'color-relief',
          source: SOURCE.relief,
          paint: {
            'color-relief-opacity': 0.55,
            'color-relief-color': [
              'interpolate',
              ['linear'],
              ['elevation'],
              1930,
              '#efe6d2',
              2060,
              '#e3d6b8',
              2200,
              '#cdbf9a',
              2320,
              '#b3a483',
            ] as ExpressionSpecification,
          },
        },
        {
          id: 'realismo-relieve',
          type: 'hillshade',
          source: SOURCE.relief,
          paint: {
            'hillshade-exaggeration': 0.6,
            'hillshade-illumination-direction': 225,
            'hillshade-shadow-color': '#6e5a3c',
            'hillshade-highlight-color': '#fff1d6',
            'hillshade-accent-color': '#8b7552',
          },
        },
      )
    }
    if (layer.id === 'landuse-green') {
      layers.push({
        id: 'realismo-suelo',
        type: 'raster',
        source: SOURCE.soil,
        paint: {
          'raster-opacity': 0.18,
          'raster-saturation': -0.6,
          'raster-contrast': -0.05,
          'raster-brightness-min': 0.15,
        },
      })
    }
    if (layer.id === 'background' && layer.type === 'background') {
      layers.push({ ...layer, paint: { 'background-color': realismoTheme.groundOutside } })
    } else if (layer.id === 'zibata-ground' && layer.type === 'fill') {
      layers.push({ ...layer, paint: { 'fill-color': realismoTheme.groundZibata } })
    } else {
      layers.push(layer)
    }
  }
  return layers
}

const roadWidth = (a: number, b: number): ExpressionSpecification =>
  [
    'interpolate',
    ['exponential', 1.6],
    ['zoom'],
    9,
    a,
    14,
    b,
    17,
    b * 2.4,
  ] as ExpressionSpecification

const ROAD_CLASSES: [string, number, number][] = [
  ['secundaria', 0.4, 1.3],
  ['principal', 0.7, 2.2],
  ['autopista', 1.0, 3.0],
]

/**
 * Lo que sustituye al velo exterior: la imagen de contexto (satélite apagado, laderas y tinte ya
 * horneados, transparente dentro del contorno), las calles principales de la región y la línea del contorno.
 */
export function realismoOutsideLayers(): LayerSpecification[] {
  const layers: LayerSpecification[] = [
    {
      id: 'realismo-contexto',
      type: 'raster',
      source: SOURCE.context,
      paint: { 'raster-fade-duration': 0 },
    },
  ]
  for (const [clase, a, b] of ROAD_CLASSES) {
    const filter: ExpressionSpecification = ['==', ['get', 'clase'], clase]
    const layout = { 'line-cap': 'round', 'line-join': 'round' } as const
    layers.push(
      {
        id: `realismo-vias-borde-${clase}`,
        type: 'line',
        source: SOURCE.contextRoads,
        filter,
        layout,
        paint: {
          'line-color': realismoTheme.roadCasing,
          'line-opacity': 0.3,
          'line-width': roadWidth(a + 0.8, b + 1.2),
        },
      },
      {
        id: `realismo-vias-${clase}`,
        type: 'line',
        source: SOURCE.contextRoads,
        filter,
        layout,
        paint: {
          'line-color': realismoTheme.road,
          'line-opacity': 0.5,
          'line-width': roadWidth(a, b),
        },
      },
    )
  }
  layers.push({
    id: 'zibata-edge',
    type: 'line',
    source: SOURCE.base,
    'source-layer': 'boundary',
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': realismoTheme.boundaryEdge,
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 2.2],
      'line-blur': 1.2,
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0.9, 16.5, 0.35],
    },
  })
  return layers
}
