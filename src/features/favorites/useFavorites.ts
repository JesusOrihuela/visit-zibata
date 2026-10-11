/**
 * Favoritos: en este dispositivo siempre, y en la cuenta cuando se puede.
 *
 * El gesto es local e instantáneo, como siempre: se escribe en `localStorage` y la interfaz
 * responde sin esperar a nadie. El aviso al servidor va detrás y nunca lo bloquea, porque lo que
 * aporta es que el corazón cuente para el número público, no que funcione. Si falla, el favorito
 * sigue puesto aquí y no se pierde nada de lo que esta persona ve.
 *
 * Si el almacenamiento no está disponible (modo privado), funciona en memoria.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { createLocalStore } from '../../lib/localStore.ts'
import { sincronizarCorazon, subirLoQueYaHabia } from './senales.ts'

const EMPTY: ReadonlySet<string> = new Set()

export const favoritesStore = createLocalStore<ReadonlySet<string>>(
  'zibata:favoritos',
  (raw) =>
    new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []),
  (value) => [...value],
  EMPTY,
)

export function useFavorites() {
  const ids = useSyncExternalStore(
    favoritesStore.subscribe,
    favoritesStore.read,
    () => favoritesStore.empty,
  )
  const toggle = useCallback((placeId: string) => {
    const next = new Set(favoritesStore.read())
    const puesto = !next.has(placeId)
    // Lo que ya había guardado antes de las cuentas sube con el primer gesto, no al entrar: así
    // quien solo mira la guía no genera cuenta, y quien lleva meses guardando no empieza de cero.
    subirLoQueYaHabia()
    if (puesto) next.add(placeId)
    else next.delete(placeId)
    favoritesStore.write(next)
    sincronizarCorazon(placeId, puesto)
  }, [])
  return { ids, toggle, has: (placeId: string) => ids.has(placeId) }
}
