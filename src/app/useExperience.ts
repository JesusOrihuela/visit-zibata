/** Datos derivados del estado: resultados, conteos por plaza y qué muestra el panel. */
import { useDeferredValue, useEffect, useMemo } from 'react'
import { useFavorites } from '../features/favorites/useFavorites.ts'
import {
  applyFilters,
  categoriesOf,
  countByCategory,
  countByPlaza,
  hasActiveFilters,
} from '../features/filters/filters.ts'
import { useZonedNow } from '../features/places/OpenStatus.tsx'
import { preferences } from '../features/ranking/preferences.ts'
import { categoryAffinity } from '../features/ranking/rankPlaces.ts'
import { usePersonalOrder } from '../features/ranking/usePersonalOrder.ts'
import { createSearchIndex } from '../features/search/searchIndex.ts'
import { getOpenStatus } from '../lib/hours.ts'
import { searchTerms } from '../lib/text.ts'
import type { Catalog, Place, Plaza } from '../types/domain.ts'
import { useAppState } from './AppStateContext.tsx'

export type PanelMode =
  | { kind: 'idle' }
  | { kind: 'explore' }
  | { kind: 'results'; places: Place[] }
  | { kind: 'plaza'; plaza: Plaza; places: Place[] }
  | { kind: 'place'; place: Place; plaza: Plaza; fromResults: boolean }

export function useExperience(catalog: Catalog) {
  const state = useAppState()
  const favorites = useFavorites()
  const searchIndex = useMemo(() => createSearchIndex(catalog), [catalog])
  const query = useDeferredValue(state.searchQuery)
  const hasQuery = searchTerms(query).length > 0
  /**
   * Al escribir se busca en todo Zibatá aunque haya una plaza abierta: quien busca "ramen" quiere
   * saber dónde hay, no si lo hay en la plaza que estaba mirando. La plaza sigue seleccionada en el
   * mapa y vuelve a acotar en cuanto se borra la búsqueda.
   */
  const scopedPlazaId = hasQuery ? null : state.selectedPlazaId

  // El reloj compartido de OpenStatus, no uno nuevo: avanza al cambiar el minuto, así que el filtro
  // y el orden se reevalúan solos cuando un local abre o cierra mientras alguien mira la guía.
  const ahora = useZonedNow()

  const filtersActive = hasActiveFilters({
    query,
    categoryId: state.activeCategoryId,
    favoritesOnly: state.favoritesOnly,
    openNowOnly: state.openNowOnly,
  })

  const matching = useMemo(
    () =>
      applyFilters(
        catalog,
        searchIndex,
        {
          query,
          categoryId: state.activeCategoryId,
          plazaId: null,
          favoritesOnly: state.favoritesOnly,
          openNowOnly: state.openNowOnly,
        },
        favorites.ids,
        ahora,
      ),
    [
      catalog,
      searchIndex,
      query,
      state.activeCategoryId,
      state.favoritesOnly,
      state.openNowOnly,
      favorites.ids,
      ahora,
    ],
  )

  const matchCounts = useMemo(
    () => (filtersActive ? countByPlaza(matching) : null),
    [filtersActive, matching],
  )

  // Conteo por categoría con los demás filtros aplicados (búsqueda, favoritos y plaza seleccionada, sin la
  // propia categoría): así cada pastilla anuncia exactamente los resultados que dará al pulsarla.
  /** Los lugares que cuentan las pastillas: los mismos filtros menos la categoría. */
  const forChips = useMemo(
    () =>
      applyFilters(
        catalog,
        searchIndex,
        {
          query,
          categoryId: null,
          plazaId: scopedPlazaId,
          favoritesOnly: state.favoritesOnly,
          openNowOnly: state.openNowOnly,
        },
        favorites.ids,
        ahora,
      ),
    [
      catalog,
      searchIndex,
      query,
      scopedPlazaId,
      state.favoritesOnly,
      state.openNowOnly,
      favorites.ids,
      ahora,
    ],
  )
  const categoryCounts = useMemo(() => countByCategory(forChips, catalog), [forChips, catalog])

  /**
   * Cuántos están abiertos ahora dentro del ámbito actual, **sin** contar el propio filtro de
   * abiertos. Es lo que la pastilla anuncia: los resultados que dará al pulsarla, no los que ya
   * está dando. Con el filtro puesto el número no cambia, que es lo que deja ver cuántos se
   * quedaron fuera.
   */
  const openNowCount = useMemo(
    () =>
      forChips.filter((place) => getOpenStatus(place.hours ?? null, ahora).state === 'open').length,
    [forChips, ahora],
  )
  /**
   * "Todo" cuenta lugares, no giros: un local con dos giros reales aparece en dos categorías, pero
   * sigue siendo un lugar.
   */
  const totalCount = forChips.length

  /**
   * Solo categorías con algún lugar activo (nunca pastillas que no llevan a nada) y, si esta persona
   * ya marcó cosas, en el orden en que suele elegir: lo que más le gusta, primero.
   */
  const visibleCategories = useMemo(() => {
    const used = new Set(catalog.places.flatMap((place) => categoriesOf(place, catalog)))
    const visible = catalog.categories.filter((category) => used.has(category.id))
    const affinity = categoryAffinity(
      preferences.read(),
      (id) => catalog.placeById.get(id),
      Date.now(),
      (giro) => catalog.categoryOfGiro.get(giro)?.id,
    )
    if (affinity.size === 0) return visible
    return visible
      .map((category, index) => ({ category, index, score: affinity.get(category.id) ?? 0 }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.category)
  }, [catalog])

  const placeCounts = useMemo(
    () =>
      new Map(
        catalog.plazas.map((plaza) => [plaza.id, catalog.placesByPlaza.get(plaza.id)?.length ?? 0]),
      ),
    [catalog],
  )

  const selectedPlaza = state.selectedPlazaId
    ? catalog.plazaById.get(state.selectedPlazaId)
    : undefined
  const selectedPlace = state.selectedPlaceId
    ? catalog.placeById.get(state.selectedPlaceId)
    : undefined

  // Lista que se ve al navegar (plaza o resultados). Con texto de búsqueda manda la relevancia; sin él,
  // el orden personal (gustos + descubrimiento, ver features/ranking).
  const browsing = useMemo(
    () =>
      selectedPlaza && !hasQuery
        ? filtersActive
          ? matching.filter((place) => place.plazaId === selectedPlaza.id)
          : (catalog.placesByPlaza.get(selectedPlaza.id) ?? [])
        : matching,
    [catalog, selectedPlaza, hasQuery, filtersActive, matching],
  )
  const personal = usePersonalOrder(
    browsing,
    catalog,
    `${selectedPlaza?.id ?? ''}|${state.activeCategoryId ?? ''}|${state.favoritesOnly}|${hasQuery}`,
  )
  const listed = hasQuery ? browsing : personal

  // Cada ficha abierta alimenta el orden personal (solo en este dispositivo).
  useEffect(() => {
    if (selectedPlace) preferences.recordOpen(selectedPlace.id)
  }, [selectedPlace])

  const panel: PanelMode = useMemo(() => {
    if (selectedPlace) {
      const plaza = catalog.plazaById.get(selectedPlace.plazaId)
      if (plaza)
        return {
          kind: 'place',
          place: selectedPlace,
          plaza,
          fromResults: state.placeOrigin === 'results',
        }
    }
    // Buscando, los resultados mandan aunque haya una plaza abierta (vienen de todo Zibatá).
    if (selectedPlaza && !hasQuery)
      return { kind: 'plaza', plaza: selectedPlaza, places: [...listed] }
    if (filtersActive) return { kind: 'results', places: [...listed] }
    if (state.listOpen) return { kind: 'explore' }
    return { kind: 'idle' }
  }, [
    catalog,
    selectedPlace,
    selectedPlaza,
    hasQuery,
    filtersActive,
    listed,
    state.listOpen,
    state.placeOrigin,
  ])

  return {
    state,
    favorites,
    filtersActive,
    /** Lo que hay en la lista con el ámbito actual (plaza abierta o no) y los filtros aplicados. */
    visibleCount: browsing.length,
    matching,
    matchCounts,
    placeCounts,
    categoryCounts,
    openNowCount,
    totalCount,
    visibleCategories,
    panel,
    activePlazas: catalog.plazas.filter((plaza) => plaza.active),
  }
}
