/**
 * Señales sociales de un lugar: cuántas personas lo han guardado y cuánto lo empuja la comunidad.
 *
 * Sin fuente registrada no existen: el proveedor por defecto devuelve `null` y la interfaz no dibuja
 * nada (nunca un "0 corazones" ni estrellas vacías). La fuente de verdad la registra
 * `features/favorites/senales.ts` al arrancar.
 *
 * Aquí no hay medias ni votos **a propósito**, y no es un olvido: el servidor manda el empuje ya
 * calculado justamente para que la media no llegue nunca al navegador. Lo que no se recibe no se
 * puede enseñar por descuido (ver worker/senales.ts).
 */
import { useSyncExternalStore } from 'react'
import { interactionsStore } from '../ranking/preferences.ts'
import type { PlaceInteraction } from '../ranking/rankPlaces.ts'
import { ratingsStore } from '../ratings/useRatings.ts'
import { visitsStore } from '../visits/useVisits.ts'
import { favoritesStore } from './useFavorites.ts'

export interface PlaceSocialStats {
  /** Personas que han guardado el lugar, o `null` mientras son pocas para publicar el número. */
  favorites: number | null
  /** Lo que la comunidad empuja este lugar, de 0 a 1. Lo usa el orden personal, no la interfaz. */
  empuje: number
}

/**
 * Lo que esta persona lleva marcado en este dispositivo. Es exactamente lo que habría que subir una
 * sola vez el día que existan cuentas, para que no pierda lo que ya había guardado o calificado.
 */
export interface LocalProfile {
  favorites: string[]
  ratings: Record<string, number>
  /** Fichas abiertas (para el orden personal): viajan también para no empezar de cero. */
  interactions: Record<string, PlaceInteraction>
  /** Fechas de las visitas marcadas a mano, lo más parecido a un historial propio. */
  visits: Record<string, readonly string[]>
}

export function localProfileSnapshot(): LocalProfile {
  return {
    favorites: [...favoritesStore.read()],
    ratings: Object.fromEntries(ratingsStore.read()),
    interactions: Object.fromEntries(interactionsStore.read()),
    visits: Object.fromEntries(visitsStore.read()),
  }
}

export interface SocialStatsSource {
  get: (placeId: string) => PlaceSocialStats | null
  /** Avisa de cambios (p. ej. al llegar datos nuevos); devuelve la función para dejar de escuchar. */
  subscribe?: (listener: () => void) => () => void
}

const NONE: SocialStatsSource = { get: () => null }
let source: SocialStatsSource = NONE
/**
 * Última foto de cada lugar. `useSyncExternalStore` compara por identidad: si la fuente construye un
 * objeto nuevo en cada lectura (lo normal), sin esta caché React re-renderizaría sin parar.
 */
const snapshots = new Map<string, PlaceSocialStats | null>()

/** Registra la fuente de señales sociales. Sin llamarla, la guía funciona exactamente igual que hoy. */
export function setSocialStatsSource(next: SocialStatsSource | null): void {
  source = next ?? NONE
  snapshots.clear()
}

const same = (a: PlaceSocialStats | null, b: PlaceSocialStats | null) =>
  a === b || (a !== null && b !== null && a.favorites === b.favorites && a.empuje === b.empuje)

function snapshotOf(placeId: string): PlaceSocialStats | null {
  const next = source.get(placeId)
  const previous = snapshots.get(placeId)
  if (previous !== undefined && same(previous, next)) return previous
  snapshots.set(placeId, next)
  return next
}

/** Señales de un lugar sin pasar por React: las usa el orden personal (features/ranking). */
export function placeSocialStats(placeId: string): PlaceSocialStats | null {
  return snapshotOf(placeId)
}

const noSubscription = () => () => {}

export function usePlaceSocialStats(placeId: string): PlaceSocialStats | null {
  return useSyncExternalStore(
    source.subscribe ?? noSubscription,
    () => snapshotOf(placeId),
    () => null,
  )
}
