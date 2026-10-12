import { estaAbierto } from '../../lib/estado.ts'
import type { ZonedMoment } from '../../lib/hours.ts'
import { searchTerms } from '../../lib/text.ts'
import type { Catalog, Place } from '../../types/domain.ts'
import { allGiroIds } from '../places/placeIcon.ts'
import type { SearchIndex } from '../search/searchIndex.ts'

export interface Filters {
  query: string
  categoryId: string | null
  /** Plaza activa: la seleccionada en el mapa o en el filtro de plazas. */
  plazaId: string | null
  favoritesOnly: boolean
  /**
   * Solo lo que está abierto en este momento.
   *
   * Deja fuera los once locales sin horario publicado. Es deliberado: el filtro dice "abierto
   * ahora", y de esos no se sabe. Colarlos sería afirmar algo que la guía no tiene, y esconderlos
   * del resto de la guía por no tener el dato sería castigar al negocio por un hueco nuestro, así
   * que solo desaparecen mientras el filtro está puesto.
   *
   * También deja fuera los cerrados temporalmente, aunque su horario diga que a esta hora abren.
   * Esa es la razón de que pregunte por `estaAbierto` y no por el horario a secas.
   */
  openNowOnly: boolean
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  categoryId: null,
  plazaId: null,
  favoritesOnly: false,
  openNowOnly: false,
}

/**
 * Las categorías en las que aparece un local: las de todos sus giros, principales y secundarios,
 * sin repetir. Un secundario pesa menos a la vista, pero es igual de cierto: si Castore hace ramen,
 * tiene que salir al filtrar Asiática.
 */
export function categoriesOf(place: Place, catalog: Catalog): string[] {
  return [
    ...new Set(
      allGiroIds(place)
        .map((giro) => catalog.categoryOfGiro.get(giro)?.id)
        .filter((id): id is string => id !== undefined),
    ),
  ]
}

/** Filtros que reducen la lista (la plaza no cuenta: seleccionarla es navegar, no filtrar). */
export function hasActiveFilters(
  filters: Pick<Filters, 'query' | 'categoryId' | 'favoritesOnly' | 'openNowOnly'>,
): boolean {
  return (
    searchTerms(filters.query).length > 0 ||
    filters.categoryId !== null ||
    filters.favoritesOnly ||
    filters.openNowOnly
  )
}

/**
 * Aplica búsqueda + categoría + favoritos + abierto ahora (+ plaza si se indica). Con búsqueda
 * activa los resultados van por relevancia; sin ella, en el orden curado del catálogo.
 *
 * `now` entra como parámetro y no se lee del reloj aquí para que la función siga siendo pura: es lo
 * que permite probar "abierto a las 14:00 de un martes" sin tocar el reloj del sistema.
 */
export function applyFilters(
  catalog: Catalog,
  searchIndex: SearchIndex,
  filters: Filters,
  favoriteIds: ReadonlySet<string> = new Set(),
  now?: ZonedMoment,
): Place[] {
  const ranked = searchIndex.search(filters.query)
  const candidates =
    ranked === null
      ? catalog.places
      : ranked
          .map((id) => catalog.placeById.get(id))
          .filter((place): place is Place => place !== undefined)

  return candidates.filter(
    (place) =>
      (filters.categoryId === null || categoriesOf(place, catalog).includes(filters.categoryId)) &&
      (filters.plazaId === null || place.plazaId === filters.plazaId) &&
      (!filters.favoritesOnly || favoriteIds.has(place.id)) &&
      (!filters.openNowOnly || (now !== undefined && estaAbierto(place, now))),
  )
}

export function countByPlaza(places: readonly Place[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const place of places) counts.set(place.plazaId, (counts.get(place.plazaId) ?? 0) + 1)
  return counts
}

/** Lugares agrupados por plaza conservando el orden de aparición. */
export function groupByPlaza(places: readonly Place[]): [string, Place[]][] {
  const groups = new Map<string, Place[]>()
  for (const place of places) {
    const list = groups.get(place.plazaId) ?? []
    list.push(place)
    groups.set(place.plazaId, list)
  }
  return [...groups]
}

/** Nº de lugares por categoría dentro de un conjunto (para las pastillas de filtro). */
export function countByCategory(places: readonly Place[], catalog: Catalog): Map<string, number> {
  const counts = new Map<string, number>()
  for (const place of places)
    for (const category of categoriesOf(place, catalog))
      counts.set(category, (counts.get(category) ?? 0) + 1)
  return counts
}
