/**
 * Validación de relaciones entre colecciones (lo que Zod no puede ver archivo por archivo):
 * IDs duplicados, referencias inexistentes, campos derivados desincronizados y coordenadas
 * fuera de Zibatá. La usan la app en runtime y `npm run data:validate` en build.
 */
import type { Category, LatLng, Place, Plaza } from '../types/domain.ts'
import { PUBLISHABLE_STATUS } from './rules.ts'

export type IssueLevel = 'error' | 'warning'
export type DatasetName = 'categories' | 'plazas' | 'places'

export interface DataIssue {
  level: IssueLevel
  dataset: DatasetName
  id?: string
  message: string
}

export interface CommercialDataset {
  categories: Category[]
  plazas: Plaza[]
  places: Place[]
}

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

export function isWithinBounds({ lat, lng }: LatLng, bounds: Bounds): boolean {
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north
}

type Ring = readonly (readonly number[])[]

/** Punto dentro de un anillo (ray casting, lng/lat planos: suficiente a escala de una plaza). */
function insideRing([lng, lat]: readonly number[], ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi = 0, yi = 0] = ring[i] ?? []
    const [xj = 0, yj = 0] = ring[j] ?? []
    if (
      yi > (lat ?? 0) !== yj > (lat ?? 0) &&
      (lng ?? 0) < ((xj - xi) * ((lat ?? 0) - yi)) / (yj - yi) + xi
    ) {
      inside = !inside
    }
  }
  return inside
}

/** ¿Está el punto dentro de la geometría de la plaza (respetando huecos)? */
export function isInsidePlazaGeometry({ lat, lng }: LatLng, geometry: Plaza['geometry']): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.some(
    ([outer, ...holes]) =>
      outer !== undefined &&
      insideRing([lng, lat], outer) &&
      !holes.some((hole) => insideRing([lng, lat], hole)),
  )
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

/** Categorías de los locales activos de una plaza, en el orden de la taxonomía. */
export function deriveCategoryIds(
  placesOfPlaza: readonly Place[],
  categories: readonly Category[],
): string[] {
  const categoryOfGiro = new Map(
    categories.flatMap((category) => category.giros.map((giro) => [giro.id, category.id] as const)),
  )
  const used = new Set(
    placesOfPlaza
      .filter((place) => place.active)
      .flatMap((place) => place.giros.map((giro) => categoryOfGiro.get(giro)))
      .filter((id): id is string => id !== undefined),
  )
  return [...categories]
    .sort((a, b) => a.order - b.order)
    .filter((category) => used.has(category.id))
    .map((category) => category.id)
}

/**
 * Recalcula los campos derivados de cada plaza (`placeIds`, `categories`) a partir de los locales.
 * Conserva el orden existente de `placeIds` y añade al final los locales nuevos.
 */
export function syncPlazaDerivedFields(dataset: CommercialDataset): Plaza[] {
  return dataset.plazas.map((plaza) => {
    const placesOfPlaza = dataset.places.filter((place) => place.plazaId === plaza.id)
    const ids = new Set(placesOfPlaza.map((place) => place.id))
    const kept = plaza.placeIds.filter((id) => ids.has(id))
    const added = placesOfPlaza.map((place) => place.id).filter((id) => !kept.includes(id))
    return {
      ...plaza,
      placeIds: [...kept, ...added],
      categories: deriveCategoryIds(placesOfPlaza, dataset.categories),
    }
  })
}

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value))
}

export function validateRelations(dataset: CommercialDataset, bounds?: Bounds): DataIssue[] {
  const issues: DataIssue[] = []
  const error = (d: DatasetName, message: string, id?: string) =>
    issues.push({ level: 'error', dataset: d, id, message })
  const warn = (d: DatasetName, message: string, id?: string) =>
    issues.push({ level: 'warning', dataset: d, id, message })

  const { categories, plazas, places } = dataset

  for (const dup of findDuplicates(categories.map((c) => c.id))) {
    error('categories', `ID de categoría duplicado: "${dup}"`, dup)
  }
  // Los slugs van a la URL, así que deben ser únicos DENTRO de cada idioma: dos categorías con el
  // mismo slug en inglés harían ambigua /en/area/x?category=…, y el filtro resolvería a la primera.
  // Entre idiomas no importa que se repitan: viven en árboles distintos.
  for (const locale of ['es', 'en'] as const) {
    for (const dup of findDuplicates(categories.map((c) => c.slug[locale]))) {
      error('categories', `Slug de categoría duplicado en ${locale}: "${dup}"`, dup)
    }
  }
  for (const category of categories) {
    for (const dup of findDuplicates(category.giros.map((giro) => giro.id))) {
      error('categories', `Giro duplicado "${dup}" en "${category.id}"`, category.id)
    }
  }
  for (const dup of findDuplicates(plazas.map((p) => p.id))) {
    error('plazas', `ID de plaza duplicado: "${dup}"`, dup)
  }
  for (const dup of findDuplicates(plazas.map((p) => p.slug))) {
    error('plazas', `Slug de plaza duplicado: "${dup}"`, dup)
  }
  for (const dup of findDuplicates(places.map((p) => p.id))) {
    error('places', `ID de local duplicado: "${dup}"`, dup)
  }
  for (const dup of findDuplicates(places.map((p) => p.slug))) {
    error('places', `Slug de local duplicado: "${dup}"`, dup)
  }

  const giroIds = new Set(categories.flatMap((c) => c.giros.map((giro) => giro.id)))
  for (const dup of findDuplicates(categories.flatMap((c) => c.giros.map((giro) => giro.id)))) {
    error('categories', `El giro "${dup}" está en más de una categoría`)
  }
  const plazaById = new Map(plazas.map((p) => [p.id, p]))
  const placeById = new Map(places.map((p) => [p.id, p]))

  for (const place of places) {
    const plaza = plazaById.get(place.plazaId)
    if (!plaza) {
      error('places', `La plaza "${place.plazaId}" no existe`, place.id)
    } else if (place.active && !plaza.active) {
      warn('places', `Local activo en la plaza inactiva "${plaza.id}": no se mostrará`, place.id)
    }

    for (const giro of place.giros) {
      if (!giroIds.has(giro)) error('places', `El giro "${giro}" no existe`, place.id)
    }
    for (const dup of findDuplicates(place.giros)) {
      error('places', `Giro repetido "${dup}"`, place.id)
    }

    if (place.active && !place.verification) {
      warn('places', 'Local activo sin verificación (estado, confianza, fecha y fuentes)', place.id)
    } else if (place.active && place.verification) {
      if (!PUBLISHABLE_STATUS.includes(place.verification.status)) {
        error(
          'places',
          `Un local con estado "${place.verification.status}" no puede publicarse como activo`,
          place.id,
        )
      }
    }

    if (bounds && place.location && !isWithinBounds(place.location, bounds)) {
      error('places', 'Las coordenadas del local están fuera del área de Zibatá', place.id)
    } else if (plaza && place.location && !isInsidePlazaGeometry(place.location, plaza.geometry)) {
      warn(
        'places',
        `Las coordenadas del local quedan fuera del polígono de "${plaza.id}"`,
        place.id,
      )
    }
  }

  for (const plaza of plazas) {
    if (bounds && !isWithinBounds(plaza.coordinates, bounds)) {
      error('plazas', 'Las coordenadas de la plaza están fuera del área de Zibatá', plaza.id)
    }
    // El marcador se ancla en `coordinates` y el volumen se dibuja con `geometry`: deben coincidir.
    if (!isInsidePlazaGeometry(plaza.coordinates, plaza.geometry)) {
      error('plazas', 'El punto de la plaza queda fuera de su propio polígono', plaza.id)
    }

    for (const dup of findDuplicates(plaza.placeIds)) {
      error('plazas', `El local "${dup}" aparece repetido en placeIds`, plaza.id)
    }
    for (const placeId of plaza.placeIds) {
      const place = placeById.get(placeId)
      if (!place) {
        error('plazas', `placeIds referencia un local inexistente: "${placeId}"`, plaza.id)
      } else if (place.plazaId !== plaza.id) {
        error('plazas', `El local "${placeId}" pertenece a la plaza "${place.plazaId}"`, plaza.id)
      }
    }

    const placesOfPlaza = places.filter((place) => place.plazaId === plaza.id)
    const missing = placesOfPlaza.filter((place) => !plaza.placeIds.includes(place.id))
    for (const place of missing) {
      error('plazas', `Falta el local "${place.id}" en placeIds`, plaza.id)
    }

    const expectedCategories = deriveCategoryIds(placesOfPlaza, categories)
    if (!sameMembers(expectedCategories, plaza.categories)) {
      error(
        'plazas',
        `categories no coincide con los locales activos (esperado: ${expectedCategories.join(', ') || 'ninguna'})`,
        plaza.id,
      )
    }

    if (plaza.active && !placesOfPlaza.some((place) => place.active)) {
      warn('plazas', 'Plaza activa sin locales activos', plaza.id)
    }
  }

  return issues
}

/**
 * Cobertura de traducciones.
 *
 * Zod deja `en` opcional a propósito: un texto puede llegar solo en español y traducirse después.
 * El problema es publicarlo así, que deja al visitante inglés leyendo español sin aviso. Pasó con
 * trece locales y pasó la validación sin quejarse, porque nadie lo comprobaba. Esta sí.
 *
 * Va aparte de `validateRelations` y no dentro: las pruebas construyen catálogos mínimos que no
 * necesitan traducciones, y la comprobación es del conjunto publicado, no de la estructura. La llama
 * `npm run data:validate` (y por tanto el build y el despliegue).
 */
export function validateTranslations(dataset: CommercialDataset): DataIssue[] {
  const issues: DataIssue[] = []
  const missing = (dataset: DatasetName, what: string, id: string) =>
    issues.push({
      level: 'error',
      dataset,
      id,
      message: `Falta la traducción al inglés de ${what}`,
    })

  for (const place of dataset.places) {
    if (place.description && !place.description.en) missing('places', 'la descripción', place.id)
  }
  for (const plaza of dataset.plazas) {
    if (plaza.description && !plaza.description.en) missing('plazas', 'la descripción', plaza.id)
  }
  for (const category of dataset.categories) {
    if (!category.label.en) missing('categories', 'la etiqueta de la categoría', category.id)
    for (const giro of category.giros) {
      if (!giro.label.en) missing('categories', `la etiqueta del giro "${giro.id}"`, category.id)
    }
  }

  return issues
}
