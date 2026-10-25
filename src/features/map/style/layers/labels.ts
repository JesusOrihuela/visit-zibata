/** Etiquetas: nombres de vialidades (solo con zoom suficiente), áreas verdes, residenciales y Zibatá. */
import type { LayerSpecification } from 'maplibre-gl'
import { SOURCE } from '../ids.ts'
import { mapTheme as t } from '../theme.ts'

export const FONT = {
  sans: 'Archivo Medium',
  sansStrong: 'Archivo SemiBold',
  serif: 'Archivo Regular',
  serifItalic: 'Archivo Italic',
} as const

export function labelLayers(): LayerSpecification[] {
  return [
    {
      id: 'road-label',
      type: 'symbol',
      source: SOURCE.base,
      'source-layer': 'roads',
      minzoom: 15.5,
      filter: [
        'all',
        ['has', 'name'],
        [
          'any',
          ['in', ['get', 'class'], ['literal', ['highway', 'primary', 'tertiary']]],
          ['all', ['==', ['get', 'class'], 'street'], ['>=', ['zoom'], 16.8]],
        ],
      ],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-font': [FONT.sans],
        'text-size': ['interpolate', ['linear'], ['zoom'], 15.5, 10.5, 18, 13],
        'text-letter-spacing': 0.02,
        'text-max-angle': 30,
        'symbol-spacing': 320,
        'text-pitch-alignment': 'viewport',
      },
      paint: {
        'text-color': t.label.road,
        'text-halo-color': t.label.roadHalo,
        'text-halo-width': 1.6,
      },
    },
    {
      id: 'place-label-district',
      type: 'symbol',
      source: SOURCE.base,
      'source-layer': 'labels',
      minzoom: 15.2,
      filter: ['==', ['get', 'class'], 'district'],
      layout: {
        'text-field': ['upcase', ['get', 'name']],
        'text-font': [FONT.sansStrong],
        'text-size': 10,
        'text-letter-spacing': 0.14,
        'text-max-width': 8,
        'text-padding': 8,
      },
      paint: {
        'text-color': t.label.district,
        'text-halo-color': t.label.halo,
        'text-halo-width': 1.2,
      },
    },
    {
      id: 'place-label-landscape',
      type: 'symbol',
      source: SOURCE.base,
      'source-layer': 'labels',
      minzoom: 13.8,
      filter: [
        'in',
        ['get', 'class'],
        ['literal', ['park', 'golf', 'water', 'education', 'landmark']],
      ],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': [
          'match',
          ['get', 'class'],
          ['park', 'golf', 'water'],
          ['literal', [FONT.serifItalic]],
          ['literal', [FONT.sans]],
        ],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          ['match', ['get', 'class'], ['golf', 'education'], 13, 11.5],
          17,
          ['match', ['get', 'class'], ['golf', 'education'], 17, 15],
        ],
        'symbol-sort-key': ['get', 'rank'],
        'text-max-width': 9,
        'text-padding': 6,
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'class'],
          ['park', 'golf'],
          t.label.green,
          'water',
          t.label.water,
          t.label.landmark,
        ],
        'text-halo-color': t.label.halo,
        'text-halo-width': 1.4,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 13.8, 0, 14.4, 1],
      },
    },
    {
      id: 'zibata-name',
      type: 'symbol',
      source: SOURCE.areaLabel,
      maxzoom: 13.8,
      layout: {
        'text-field': 'ZIBATÁ',
        'text-font': [FONT.serif],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 20, 13.8, 34],
        'text-letter-spacing': 0.32,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-pitch-alignment': 'viewport',
      },
      paint: {
        'text-color': t.label.zibata,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 13.8, 0],
        'text-halo-color': t.label.halo,
        'text-halo-width': 1,
      },
    },
  ]
}
