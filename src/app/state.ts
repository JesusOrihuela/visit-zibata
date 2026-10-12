/**
 * Estado global de la experiencia. Deliberadamente simple (useReducer + Context, sin librerías).
 * Correspondencia con el brief: selectedPlaza = plaza seleccionada (y filtro de plaza activo),
 * selectedPlace, activeCategory, searchQuery, tutorialVisible, mapLoaded (mapStatus).
 */

import type { MapStatus } from '../features/map/types.ts'
import type { InfoTopic } from '../lib/url-state.ts'

export interface AppState {
  selectedPlazaId: string | null
  selectedPlaceId: string | null
  activeCategoryId: string | null
  searchQuery: string
  favoritesOnly: boolean
  /** Solo lo abierto en este momento. */
  openNowOnly: boolean
  tutorialVisible: boolean
  mapStatus: MapStatus
  /** Lista de plazas abierta sin selección (escritorio) / hoja expandida (móvil). */
  listOpen: boolean
  sheetExpanded: boolean
  /** Desde dónde se abrió la ficha del lugar, para que "Volver" regrese ahí. */
  placeOrigin: 'plaza' | 'results'
  /** Aviso temporal: el enlace abierto apunta a un lugar o plaza que ya no está en la guía. */
  missingLinkNotice: boolean
  /** Página de información abierta (acerca, privacidad, corregir): cada una tiene su propia ruta. */
  infoTopic: InfoTopic | null
}

export const initialAppState: AppState = {
  selectedPlazaId: null,
  selectedPlaceId: null,
  activeCategoryId: null,
  searchQuery: '',
  favoritesOnly: false,
  openNowOnly: false,
  tutorialVisible: false,
  mapStatus: { state: 'loading' },
  listOpen: false,
  sheetExpanded: false,
  placeOrigin: 'plaza',
  missingLinkNotice: false,
  infoTopic: null,
}

export type AppAction =
  | { type: 'selectPlaza'; plazaId: string | null }
  | { type: 'selectPlace'; placeId: string; plazaId: string; origin: 'plaza' | 'results' }
  | { type: 'closePlace' }
  | { type: 'closePanel' }
  | { type: 'setCategory'; categoryId: string | null }
  | { type: 'setQuery'; query: string }
  | { type: 'toggleFavoritesOnly' }
  | { type: 'clearFilters' }
  | { type: 'openList' }
  | { type: 'setSheetExpanded'; expanded: boolean }
  | { type: 'toggleOpenNow' }
  | { type: 'showTutorial' }
  | { type: 'dismissTutorial' }
  | { type: 'mapStatusChanged'; status: MapStatus }
  | { type: 'dismissNotice' }
  | { type: 'openInfo'; topic: InfoTopic }
  | { type: 'closeInfo' }
  | {
      type: 'syncFromUrl'
      plazaId: string | null
      placeId: string | null
      categoryId: string | null
      missingLink: boolean
      infoTopic: InfoTopic | null
    }

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'selectPlaza':
      return {
        ...state,
        selectedPlazaId: action.plazaId,
        selectedPlaceId: null,
        listOpen: action.plazaId === null ? state.listOpen : false,
        sheetExpanded: action.plazaId === null ? state.sheetExpanded : false,
      }
    case 'selectPlace':
      return {
        ...state,
        selectedPlazaId: action.plazaId,
        selectedPlaceId: action.placeId,
        listOpen: false,
        sheetExpanded: true,
        placeOrigin: action.origin,
      }
    case 'closePlace':
      return {
        ...state,
        selectedPlaceId: null,
        selectedPlazaId: state.placeOrigin === 'results' ? null : state.selectedPlazaId,
      }
    case 'closePanel':
      return {
        ...state,
        selectedPlazaId: null,
        selectedPlaceId: null,
        listOpen: false,
        sheetExpanded: false,
      }
    case 'setCategory':
      return { ...state, activeCategoryId: action.categoryId, selectedPlaceId: null }
    case 'setQuery':
      return {
        ...state,
        searchQuery: action.query,
        selectedPlaceId: action.query ? null : state.selectedPlaceId,
      }
    case 'toggleFavoritesOnly':
      return { ...state, favoritesOnly: !state.favoritesOnly, selectedPlaceId: null }
    case 'toggleOpenNow':
      return { ...state, openNowOnly: !state.openNowOnly, selectedPlaceId: null }
    case 'clearFilters':
      return {
        ...state,
        activeCategoryId: null,
        searchQuery: '',
        favoritesOnly: false,
        openNowOnly: false,
      }
    case 'openList':
      return { ...state, listOpen: true, sheetExpanded: true }
    case 'setSheetExpanded':
      return { ...state, sheetExpanded: action.expanded }
    case 'showTutorial':
      return { ...state, tutorialVisible: true }
    case 'dismissTutorial':
      return { ...state, tutorialVisible: false }
    case 'mapStatusChanged':
      return { ...state, mapStatus: action.status }
    case 'dismissNotice':
      return { ...state, missingLinkNotice: false }
    case 'openInfo':
      return { ...state, infoTopic: action.topic }
    case 'closeInfo':
      return { ...state, infoTopic: null }
    case 'syncFromUrl':
      // Una ruta de información no cambia lo que hay debajo: al cerrarla se vuelve a esa vista.
      if (action.infoTopic) return { ...state, infoTopic: action.infoTopic }
      return {
        ...state,
        selectedPlazaId: action.plazaId,
        selectedPlaceId: action.placeId,
        activeCategoryId: action.categoryId,
        sheetExpanded: action.placeId !== null,
        missingLinkNotice: action.missingLink,
        infoTopic: null,
      }
  }
}
