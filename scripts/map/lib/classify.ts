/**
 * Clasificación de etiquetas OSM en las capas y clases que usa el estilo del mapa,
 * y heurística de alturas para edificios sin dato (Overture/ML no trae alturas en Zibatá).
 */
import type { OsmTags } from './osm.ts'

/** Palabras que en español van en minúscula dentro de un nombre propio (salvo al empezarlo). */
const MINOR_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'al', 'a'])

/**
 * Nombre tal como se rotula en el mapa: capital inicial y cada palabra relevante también, con las
 * partículas en minúscula ("Av. Paseo de las Pitahayas"). Se aplica siempre, venga el nombre de OSM
 * en mayúsculas, en minúsculas o mezclado: dos rótulos del mismo rol no pueden escribirse distinto
 * según cómo lo guardara quien lo subió.
 *
 * Lo que sí se pierde es la sigla que no es palabra ("CITEA" pasa a "Citea"). Es el precio de que la
 * regla sea una; si algún día hace falta conservar una, se escribe en la lista de excepciones.
 */
export function displayName(raw: string): string {
  return raw
    .toLocaleLowerCase('es')
    .split(/(\s+|-)/)
    .map((part, index) =>
      /^\s+$|^-$/.test(part) || (index > 0 && MINOR_WORDS.has(part))
        ? part
        : part.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('es')),
    )
    .join('')
}

export type RoadClass = 'highway' | 'primary' | 'tertiary' | 'street' | 'service' | 'path'

const ROAD_CLASS: Record<string, RoadClass> = {
  motorway: 'highway',
  trunk: 'highway',
  primary: 'primary',
  secondary: 'primary',
  tertiary: 'tertiary',
  unclassified: 'street',
  residential: 'street',
  living_street: 'street',
  road: 'street',
  service: 'service',
  pedestrian: 'path',
  footway: 'path',
  path: 'path',
  cycleway: 'path',
  steps: 'path',
  track: 'path',
}

export interface RoadProperties {
  class: RoadClass
  link: boolean
  name?: string
  roundabout?: boolean
  oneway?: boolean
}

export function classifyRoad(tags: OsmTags): RoadProperties | null {
  const highway = tags.highway
  if (!highway) return null
  const base = highway.replace(/_link$/, '')
  const roadClass = ROAD_CLASS[base]
  if (!roadClass) return null
  if (tags.access === 'private' && roadClass === 'service') return null
  return {
    class: roadClass,
    link: highway.endsWith('_link'),
    ...(tags.name ? { name: displayName(tags.name) } : {}),
    ...(tags.junction === 'roundabout' || tags.junction === 'circular' ? { roundabout: true } : {}),
    ...(tags.oneway === 'yes' ? { oneway: true } : {}),
  }
}

export type LanduseClass =
  | 'golf'
  | 'park'
  | 'pitch'
  | 'grass'
  | 'wood'
  | 'residential'
  | 'commercial'
  | 'education'
  | 'farmland'

export function classifyLanduse(tags: OsmTags): LanduseClass | null {
  const { leisure, landuse, natural, amenity } = tags
  if (leisure === 'golf_course') return 'golf'
  if (leisure && ['park', 'garden', 'dog_park', 'playground', 'nature_reserve'].includes(leisure)) {
    return 'park'
  }
  if (leisure && ['pitch', 'sports_centre', 'track', 'stadium'].includes(leisure)) return 'pitch'
  if (
    landuse &&
    ['grass', 'meadow', 'recreation_ground', 'village_green', 'flowerbed'].includes(landuse)
  ) {
    return 'grass'
  }
  if (
    landuse === 'forest' ||
    natural === 'wood' ||
    natural === 'scrub' ||
    natural === 'grassland'
  ) {
    return 'wood'
  }
  if (landuse === 'residential') return 'residential'
  if (landuse === 'commercial' || landuse === 'retail') return 'commercial'
  if (amenity && ['university', 'college', 'school', 'kindergarten'].includes(amenity))
    return 'education'
  if (landuse && ['farmland', 'farmyard', 'orchard'].includes(landuse)) return 'farmland'
  return null
}

export function isWaterArea(tags: OsmTags): boolean {
  return (
    tags.natural === 'water' ||
    tags.landuse === 'reservoir' ||
    tags.landuse === 'basin' ||
    tags.leisure === 'swimming_pool' ||
    tags.waterway === 'riverbank'
  )
}

export function isWaterway(tags: OsmTags): boolean {
  return ['river', 'stream', 'canal', 'drain', 'ditch'].includes(tags.waterway ?? '')
}

/**
 * Las clases que se rotulan. Los edificios con nombre quedan fuera a propósito: un "Edificio B" en
 * el mapa compite con el nombre de la zona sin orientar a nadie.
 */
export type LabelClass = 'golf' | 'park' | 'water' | 'district' | 'education'

export function classifyLabel(tags: OsmTags): LabelClass | null {
  if (!tags.name) return null
  if (tags.leisure === 'golf_course') return 'golf'
  if (tags.leisure === 'park' || tags.leisure === 'garden' || tags.leisure === 'nature_reserve')
    return 'park'
  if (tags.natural === 'water') return 'water'
  if (tags.landuse === 'residential') return 'district'
  // Los residenciales que OSM no dibuja como polígono suelen estar como lugar poblado: el nombre es
  // el mismo y el rótulo también.
  if (['neighbourhood', 'suburb', 'quarter'].includes(tags.place ?? '')) return 'district'
  if (['university', 'college', 'school'].includes(tags.amenity ?? '')) return 'education'
  return null
}

export type BuildingType = 'residential' | 'commercial' | 'education' | 'other'

export interface HeightInput {
  /** Identificador estable, usado para una variación determinista de altura. */
  id: string
  areaM2: number
  height?: number | null
  levels?: number | null
  type: BuildingType
}

/** Hash FNV-1a de 32 bits → [0, 1). Determinista para que el mapa no cambie entre builds. */
export function stableUnit(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x1_0000_0000
}

const round = (value: number, step = 0.1) => Math.round(Math.round(value / step) * step * 10) / 10

/**
 * Altura estimada en metros. Prioridad: altura medida → niveles × altura de nivel → heurística por
 * tipo y superficie (vivienda de 2 niveles, naves comerciales, edificios educativos).
 */
export function estimateHeight(input: HeightInput, levelHeight = 3.2): number {
  if (input.height && input.height > 0) return round(input.height)
  if (input.levels && input.levels > 0) return round(input.levels * levelHeight + 0.6)

  const jitter = stableUnit(input.id)
  const { areaM2, type } = input
  if (type === 'education') return round((areaM2 > 1500 ? 12 : 8.5) + jitter * 2)
  if (type === 'commercial') return round((areaM2 > 3000 ? 9 : 7) + jitter * 2)
  if (areaM2 < 40) return 3
  if (areaM2 < 350) return round(6 + jitter * 1.5)
  if (areaM2 < 1200) return round(7.5 + jitter * 2)
  if (areaM2 < 4000) return round(9 + jitter * 2)
  return round(10 + jitter * 3)
}
