/**
 * Árboles y arbustos: tronco, copa en dos pisos y matorral bajo, generados en el pipeline solo donde
 * hay arbolado o área verde real (scripts/map/lib/trees.ts). Crecen al acercarse, como los edificios,
 * y no son interactivos. Van traslúcidos y en verdes apagados para que sean entorno, no protagonistas.
 *
 * El color sale de la especie: la mezcla es orientativa, pero evita que todo el arbolado sea el mismo
 * bloque verde. El arbusto entra en z16, cuando su altura ya se distingue del suelo.
 */
import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl'
import { LAYER, SOURCE } from '../ids.ts'
import { mapTheme as t } from '../theme.ts'
import { growingHeight } from './buildings.ts'

const colorPorEspecie: ExpressionSpecification = [
  'match',
  ['get', 'species'],
  'mezquite',
  t.tree.especies.mezquite,
  'huizache',
  t.tree.especies.huizache,
  'palo-verde',
  t.tree.especies['palo-verde'],
  'tepehuaje',
  t.tree.especies.tepehuaje,
  'jaboncillo',
  t.tree.especies.jaboncillo,
  'cazahuate',
  t.tree.especies.cazahuate,
  'jacaranda',
  t.tree.especies.jacaranda,
  'pirul',
  t.tree.especies.pirul,
  'garambullo',
  t.tree.especies.garambullo,
  'organo',
  t.tree.especies.organo,
  'nopal',
  t.tree.especies.nopal,
  t.tree.high,
]

export function treeLayers(): LayerSpecification[] {
  return [
    {
      id: LAYER.treeShrubs,
      type: 'fill-extrusion',
      source: SOURCE.base,
      'source-layer': 'shrubs',
      minzoom: 16,
      paint: {
        'fill-extrusion-color': colorPorEspecie,
        'fill-extrusion-height': growingHeight(['get', 'height']),
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.9,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: LAYER.treeTrunks,
      type: 'fill-extrusion',
      source: SOURCE.base,
      'source-layer': 'trees',
      minzoom: 16,
      filter: ['==', ['get', 'part'], 'trunk'],
      paint: {
        'fill-extrusion-color': t.tree.trunk,
        'fill-extrusion-height': growingHeight(['get', 'height']),
        'fill-extrusion-base': 0,
      },
    },
    {
      id: LAYER.trees,
      type: 'fill-extrusion',
      source: SOURCE.base,
      'source-layer': 'trees',
      minzoom: 13,
      filter: ['in', ['get', 'part'], ['literal', ['crown', 'top']]],
      layout: { 'fill-extrusion-rounded-corner-distance': 3 },
      paint: {
        'fill-extrusion-color': colorPorEspecie,
        'fill-extrusion-height': growingHeight(['get', 'height']),
        // La copa se apoya en el suelo de lejos y se levanta sobre el tronco al acercarse (z16),
        // que es cuando el tronco entra en la tesela.
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15.4, 0, 16, ['get', 'base']],
        'fill-extrusion-opacity': 0.88,
        'fill-extrusion-vertical-gradient': true,
      },
    },
  ]
}
