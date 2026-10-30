/**
 * Etiquetas del mapa: nombre de la calle, del residencial y de lo que se ve desde arriba (parque, golf,
 * agua, escuela).
 *
 * Las tres recetas son la misma letra y el mismo peso, y se distinguen por dos cosas y solo dos: el
 * tamaño (10 para la calle, 12 para lo demás) y el color. La caja no se toca aquí: los nombres llegan
 * del pipeline ya en capital inicial con las partículas en minúscula (`displayName`), así que el mapa
 * no cambia mayúsculas según el zoom ni según cómo lo guardara quien lo subió a OSM.
 *
 * MapLibre registra cada archivo con su propio nombre y no aplica los ejes de uno variable: por eso el
 * mapa usa un peso estático de Special Gothic (500) y no el archivo variable de la interfaz.
 */
import type { LayerSpecification } from 'maplibre-gl'
import { SOURCE } from '../ids.ts'
import { mapTheme as t } from '../theme.ts'

/** Un solo peso para todo el mapa. El 400 se retiró cuando la marca de agua dejó de existir. */
export const FONT = {
  sans: 'Special Gothic Medium',
} as const

/** El aire entre letras de un rótulo, igual en las tres recetas. Un poco abierto lee mejor sobre el mapa. */
const TRACKING = 0.02
/** El tamaño se fija por rol: la calle no compite con lo que se ve desde arriba. */
const TAMANO_CALLE = 10
const TAMANO_LUGAR = 12

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
        'text-size': TAMANO_CALLE,
        'text-letter-spacing': TRACKING,
        'text-max-angle': 30,
        'symbol-spacing': 320,
        'text-pitch-alignment': 'viewport',
      },
      paint: {
        'text-color': t.label.road,
        'text-halo-color': t.label.halo,
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
        'text-field': ['get', 'name'],
        'text-font': [FONT.sans],
        'text-size': TAMANO_LUGAR,
        'text-letter-spacing': TRACKING,
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
      filter: ['in', ['get', 'class'], ['literal', ['park', 'golf', 'water', 'education']]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': [FONT.sans],
        'text-size': TAMANO_LUGAR,
        'text-letter-spacing': TRACKING,
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
          // Escuela y hito comparten el gris apagado del residencial: informan, no llaman.
          t.label.district,
        ],
        'text-halo-color': t.label.halo,
        'text-halo-width': 1.4,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 13.8, 0, 14.4, 1],
      },
    },
  ]
}
