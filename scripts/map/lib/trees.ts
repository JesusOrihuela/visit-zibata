/**
 * Árboles y arbustos del mapa. Dos fuentes, las dos reales:
 *  - la cobertura arbórea de Overture (ESA WorldCover, 10 m), que dice dónde hay copa de árbol;
 *  - las áreas verdes de OpenStreetMap (parques, jardines, camellones, golf), que en Zibatá están
 *    arboladas y la clasificación satelital no siempre alcanza a ver.
 *
 * La fuente dice DÓNDE hay arbolado, no dónde está cada tronco: las plantas se colocan en una retícula
 * con desplazamiento determinista dentro de esas áreas, nunca sobre una vía ni encima de un edificio.
 *
 * La especie es una **composición orientativa**, no un inventario: se reparte de forma determinista
 * según la mezcla de la zona (nativa en la cobertura, urbana en las áreas verdes) y cambia el porte,
 * el ancho y el color. No se afirma que cada árbol del mapa sea de esa especie.
 *
 * Cada árbol son tres volúmenes (tronco, copa baja y copa alta); cada arbusto, uno bajo y ancho. El
 * arbusto solo entra en z16, que es cuando se distingue; así la densidad sube sin cargar la vista
 * inicial.
 */
import * as turf from '@turf/turf'
import type { Feature, LineString, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson'
import { stableUnit } from './classify.ts'
import { roundPositions } from './geo.ts'

export type Especie =
  | 'mezquite'
  | 'huizache'
  | 'palo-verde'
  | 'tepehuaje'
  | 'jaboncillo'
  | 'cazahuate'
  | 'jacaranda'
  | 'pirul'
  | 'garambullo'
  | 'organo'
  | 'nopal'

interface Arquetipo {
  /** Radio de copa o columna, en metros. */
  radio: [number, number]
  /** Altura total, en metros. */
  altura: [number, number]
  /** Lados del polígono: más lados, copa más redonda. */
  lados: number
  /** La copa alta mide este tanto del radio de la baja. */
  copa: number
  /** El tronco ocupa este tanto de la altura total. */
  tronco: number
}

/** Portes de la flora que se ve en Zibatá: nativas de sombra, ornamentales y cactáceas. */
const ARQUETIPOS: Record<Especie, Arquetipo> = {
  mezquite: { radio: [2.4, 3.6], altura: [5, 8], lados: 6, copa: 0.6, tronco: 0.3 },
  huizache: { radio: [1.8, 2.8], altura: [3.5, 6], lados: 5, copa: 0.62, tronco: 0.28 },
  'palo-verde': { radio: [1.4, 2.2], altura: [3.5, 5.5], lados: 4, copa: 0.55, tronco: 0.34 },
  tepehuaje: { radio: [2.1, 3.1], altura: [5, 7.5], lados: 5, copa: 0.6, tronco: 0.3 },
  jaboncillo: { radio: [1.8, 2.6], altura: [4, 6.5], lados: 6, copa: 0.62, tronco: 0.28 },
  cazahuate: { radio: [1.6, 2.4], altura: [4, 6], lados: 5, copa: 0.6, tronco: 0.3 },
  jacaranda: { radio: [2.3, 3.3], altura: [6, 9], lados: 7, copa: 0.6, tronco: 0.32 },
  pirul: { radio: [1.3, 1.9], altura: [7, 10], lados: 5, copa: 0.42, tronco: 0.24 },
  garambullo: { radio: [0.7, 1.0], altura: [2, 3.2], lados: 5, copa: 0.72, tronco: 0.28 },
  organo: { radio: [0.35, 0.55], altura: [3, 5], lados: 4, copa: 0.92, tronco: 0.18 },
  nopal: { radio: [0.9, 1.4], altura: [1.2, 2.2], lados: 5, copa: 0.68, tronco: 0.2 },
}

/** Mezcla de la cobertura arbórea: lo que ya estaba en el matorral y se rescató. */
export const MEZCLA_NATIVA: Partial<Record<Especie, number>> = {
  mezquite: 0.32,
  huizache: 0.2,
  'palo-verde': 0.14,
  tepehuaje: 0.14,
  jaboncillo: 0.1,
  cazahuate: 0.1,
}

/** Mezcla de las áreas verdes urbanas: nativas de sombra, ornamentales y algunas cactáceas. */
export const MEZCLA_URBANA: Partial<Record<Especie, number>> = {
  jacaranda: 0.18,
  pirul: 0.12,
  mezquite: 0.2,
  huizache: 0.12,
  'palo-verde': 0.1,
  tepehuaje: 0.08,
  jaboncillo: 0.06,
  cazahuate: 0.06,
  garambullo: 0.03,
  organo: 0.03,
  nopal: 0.02,
}

/** Estrato bajo: lo que tapa el suelo entre los árboles sin competir con ellos. */
export const MEZCLA_ARBUSTO: Partial<Record<Especie, number>> = {
  huizache: 0.35,
  'palo-verde': 0.2,
  nopal: 0.25,
  garambullo: 0.2,
}

export interface TreeOptions {
  /** Separación media entre plantas (m). */
  spacingM: number
  /** Distancia mínima entre la copa y el eje de una vía, por clase (m). */
  roadClearanceM: Record<string, number>
  /** Un árbol deja tres volúmenes; un arbusto, uno bajo. */
  forma?: 'arbol' | 'arbusto'
  /** Pesos de la mezcla; se normalizan. Por omisión, la nativa. */
  especies?: Partial<Record<Especie, number>>
}

export interface TreePart {
  /** `trunk` es el tronco; `crown`, la copa baja; `top`, la alta; `shrub`, el arbusto. */
  part: 'crown' | 'trunk' | 'top' | 'shrub'
  height: number
  base: number
  /** Solo en lo que lleva color por especie; el tronco usa el color fijo de la madera. */
  species?: Especie
}

const M_PER_DEG_LAT = 111_320
const CROWN_SIDES = 5
const TRUNK_SIDES = 3

/** Polígono regular (copa o tronco) de `radiusM`, con un giro estable para que no parezcan de molde. */
function disc(center: Position, radiusM: number, sides: number, seed: string, wobble = 0): Polygon {
  const [lng = 0, lat = 0] = center
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
  const turn = stableUnit(`${seed}:giro`) * Math.PI * 2
  const ring: Position[] = []
  for (let k = 0; k < sides; k++) {
    const angle = turn + (k / sides) * Math.PI * 2
    const r = radiusM * (1 - wobble / 2 + wobble * stableUnit(`${seed}:${k}`))
    ring.push([
      lng + (Math.cos(angle) * r) / mPerDegLng,
      lat + (Math.sin(angle) * r) / M_PER_DEG_LAT,
    ])
  }
  ring.push(ring[0] as Position)
  // 5 decimales (~1 m) bastan para un árbol y hacen la tesela más ligera.
  return { type: 'Polygon', coordinates: [roundPositions(ring, 5)] }
}

/** Elige una especie de la mezcla con un peso determinista: el mismo dato da el mismo mapa. */
function elegirEspecie(seed: string, mezcla: Partial<Record<Especie, number>>): Especie {
  const entradas = (Object.entries(mezcla) as [Especie, number][]).filter(([, peso]) => peso > 0)
  if (entradas.length === 0) return 'mezquite'
  const total = entradas.reduce((suma, [, peso]) => suma + peso, 0)
  let punto = stableUnit(`${seed}:especie`) * total
  for (const [especie, peso] of entradas) {
    punto -= peso
    if (punto <= 0) return especie
  }
  return entradas[entradas.length - 1]?.[0] ?? 'mezquite'
}

/** Índice espacial mínimo (celdas de ~60 m) para no comparar cada planta con todas las vías y casas. */
class Buckets<T> {
  private readonly cells = new Map<string, T[]>()
  private readonly sizeDeg: number
  constructor(sizeDeg: number) {
    this.sizeDeg = sizeDeg
  }
  add(bbox: number[], item: T) {
    const [w = 0, s = 0, e = 0, n = 0] = bbox
    for (let x = Math.floor(w / this.sizeDeg); x <= Math.floor(e / this.sizeDeg); x++)
      for (let y = Math.floor(s / this.sizeDeg); y <= Math.floor(n / this.sizeDeg); y++) {
        const key = `${x},${y}`
        const list = this.cells.get(key) ?? []
        list.push(item)
        this.cells.set(key, list)
      }
  }
  near([x = 0, y = 0]: Position): T[] {
    return this.cells.get(`${Math.floor(x / this.sizeDeg)},${Math.floor(y / this.sizeDeg)}`) ?? []
  }
}

export interface TreeObstacles {
  roads: Feature[]
  buildings: Feature<Polygon>[]
}

export function placeTrees(
  areas: Feature<Polygon | MultiPolygon>[],
  obstacles: TreeObstacles,
  options: TreeOptions,
): Feature<Polygon, TreePart>[] {
  const trees: Feature<Polygon, TreePart>[] = []
  if (areas.length === 0) return trees

  const cell = 60 / M_PER_DEG_LAT
  const widest = Math.max(...Object.values(options.roadClearanceM))
  const roadIndex = new Buckets<{ line: Feature<LineString>; clearance: number }>(cell)
  for (const road of obstacles.roads) {
    const roadClass = (road.properties as { class?: string }).class ?? 'street'
    const clearance = options.roadClearanceM[roadClass] ?? options.roadClearanceM.street ?? 6
    const margin = widest / M_PER_DEG_LAT
    for (const line of turf.flatten(road as Feature<LineString | MultiLineString>).features) {
      const [w = 0, s = 0, e = 0, n = 0] = turf.bbox(line)
      roadIndex.add([w - margin, s - margin, e + margin, n + margin], { line, clearance })
    }
  }
  const buildingIndex = new Buckets<Feature<Polygon>>(cell)
  for (const building of obstacles.buildings) {
    const [w = 0, s = 0, e = 0, n = 0] = turf.bbox(building)
    const margin = 6 / M_PER_DEG_LAT
    buildingIndex.add([w - margin, s - margin, e + margin, n + margin], building)
  }

  // Una sola retícula para todas las áreas, anclada al origen de coordenadas: el mismo árbol sale
  // igual en cada build y dos áreas vecinas no ponen dos árboles en el mismo sitio.
  const [, south0 = 0, , north0 = 0] = turf.bbox(turf.featureCollection(areas))
  const stepLat = options.spacingM / M_PER_DEG_LAT
  const stepLng =
    options.spacingM / (M_PER_DEG_LAT * Math.cos((((south0 + north0) / 2) * Math.PI) / 180))
  const planted = new Set<string>()
  const arbusto = options.forma === 'arbusto'
  const mezcla = options.especies ?? MEZCLA_NATIVA

  for (const area of areas) {
    const [west = 0, south = 0, east = 0, north = 0] = turf.bbox(area)
    for (let i = Math.floor(west / stepLng); i * stepLng <= east; i++) {
      for (let j = Math.floor(south / stepLat); j * stepLat <= north; j++) {
        const id = `${i},${j}`
        if (planted.has(id)) continue
        const jitter = (axis: string) => (stableUnit(`${id}:${axis}`) - 0.5) * 0.7
        const point: Position = [(i + jitter('x')) * stepLng, (j + jitter('y')) * stepLat]
        if (!turf.booleanPointInPolygon(point, area)) continue

        const especie = elegirEspecie(id, mezcla)
        const arquetipo = ARQUETIPOS[especie]
        const size = stableUnit(`${id}:tamaño`)
        const radius = arquetipo.radio[0] + size * (arquetipo.radio[1] - arquetipo.radio[0])
        const radioPlanta = arbusto ? radius * 0.75 : radius
        const onRoad = roadIndex
          .near(point)
          .some(
            ({ line, clearance }) =>
              turf.pointToLineDistance(point, line, { units: 'meters' }) < clearance + radioPlanta,
          )
        if (onRoad) continue
        const onBuilding = buildingIndex
          .near(point)
          .some(
            (building) =>
              turf.pointToPolygonDistance(point, building, { units: 'meters' }) < radioPlanta + 1,
          )
        if (onBuilding) continue

        planted.add(id)

        if (arbusto) {
          trees.push({
            type: 'Feature',
            properties: {
              part: 'shrub',
              height: Math.round((0.8 + size * 1.0) * 2) / 2,
              base: 0,
              species: especie,
            },
            geometry: disc(point, radioPlanta, 3, id, 0.4),
          })
          continue
        }

        const altura = arquetipo.altura[0] + size * (arquetipo.altura[1] - arquetipo.altura[0])
        const height = Math.round(altura * 2) / 2
        const trunkTop = Math.round(Math.max(0.4, height * arquetipo.tronco) * 2) / 2
        // Copa en dos pisos: ancha abajo y estrecha arriba. Con un solo prisma parecía un pilar.
        const waist = Math.round(((trunkTop + height) / 2) * 2) / 2
        const trunkRadius = Math.max(0.12, radius * 0.16)
        trees.push({
          type: 'Feature',
          properties: { part: 'trunk', height: trunkTop, base: 0 },
          geometry: disc(point, trunkRadius, TRUNK_SIDES, `${id}:tronco`),
        })
        trees.push({
          type: 'Feature',
          properties: { part: 'crown', height: waist, base: trunkTop, species: especie },
          geometry: disc(point, radius, arquetipo.lados, id, 0.25),
        })
        trees.push({
          type: 'Feature',
          properties: { part: 'top', height, base: waist, species: especie },
          geometry: disc(point, radius * arquetipo.copa, CROWN_SIDES, `${id}:copa`, 0.25),
        })
      }
    }
  }
  return trees
}
