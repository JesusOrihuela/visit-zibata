/**
 * Calificación en estrellas que da esta persona a un lugar, de media en media (0,5 a 5), guardada solo
 * en este dispositivo (localStorage), igual que los favoritos. Sin cuentas ni servidor.
 *
 * Las notas enteras de antes siguen siendo válidas: la escala nueva las incluye.
 *
 * Desde la v4.13 también viajan a la cuenta: el gesto sigue siendo local e instantáneo y el envío va
 * detrás, sin bloquearlo y sin anunciar fallos (ver lib/sincronizar.ts). Lo que ganan es sobrevivir a
 * un cambio de dispositivo, y alimentar el orden de todos a través del empuje que calcula el
 * servidor. La media no vuelve nunca al navegador: ver worker/senales.ts.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { hayCuenta } from '../../lib/cuenta.ts'
import { createLocalStore } from '../../lib/localStore.ts'
import { enviar } from '../../lib/sincronizar.ts'

export const RATING_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const
export type RatingValue = (typeof RATING_VALUES)[number]

const isRating = (value: unknown): value is RatingValue =>
  typeof value === 'number' && RATING_VALUES.some((allowed) => allowed === value)

const EMPTY: ReadonlyMap<string, RatingValue> = new Map()

export const ratingsStore = createLocalStore<ReadonlyMap<string, RatingValue>>(
  'zibata:calificaciones',
  (raw) =>
    new Map(
      Object.entries((raw ?? {}) as Record<string, unknown>).filter(
        (entry): entry is [string, RatingValue] => isRating(entry[1]),
      ),
    ),
  (value) => Object.fromEntries(value),
  EMPTY,
)

export function useRatings() {
  const ratings = useSyncExternalStore(
    ratingsStore.subscribe,
    ratingsStore.read,
    () => ratingsStore.empty,
  )
  /** Volver a pulsar la misma nota la quita: se puede deshacer sin borrar nada más. */
  const rate = useCallback((placeId: string, value: RatingValue) => {
    const next = new Map(ratingsStore.read())
    const quita = next.get(placeId) === value
    // Lo que ya había antes de las cuentas sube con el primer gesto, no al entrar: quien solo mira
    // la guía no genera cuenta, y quien llevaba meses calificando no empieza de cero.
    subirLasQueYaHabia()
    if (quita) next.delete(placeId)
    else next.set(placeId, value)
    ratingsStore.write(next)
    enviar('/api/calificaciones', { notas: { [placeId]: quita ? null : value } })
  }, [])
  return { ratings, rate, ratingOf: (placeId: string) => ratings.get(placeId) ?? null }
}

/** Sube de una vez las notas que ya estaban en este dispositivo. Solo antes de que haya cuenta. */
function subirLasQueYaHabia(): void {
  if (hayCuenta()) return
  const notas = Object.fromEntries(ratingsStore.read())
  if (Object.keys(notas).length === 0) return
  enviar('/api/calificaciones', { notas })
}
