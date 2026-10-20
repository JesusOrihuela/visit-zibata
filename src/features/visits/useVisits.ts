/**
 * Visitas a un lugar, marcadas a mano y guardadas solo en este dispositivo (localStorage), igual que
 * los favoritos y las calificaciones.
 *
 * La regla es la de una libreta: marcas el día que vas y la cuenta sube. Si te equivocas, el mismo día
 * puedes desmarcar y la visita se borra; al día siguiente ya no, porque esa visita ya ocurrió. Por eso
 * se guardan las fechas y no un número suelto: con ellas se sabe cuántas veces fuiste, cuándo fue la
 * última y si la de hoy se puede deshacer.
 *
 * Desde la v4.13 también viajan a la cuenta, con el mismo patrón que los favoritos y las notas: el
 * gesto es local e instantáneo y el envío va detrás. **No alimentan ninguna señal pública**: se
 * inflan recargando y repiten con más ruido lo que ya dice el corazón. Están en el servidor para que
 * el historial propio no se pierda al cambiar de dispositivo, y para nada más.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { locale } from '../../i18n/index.ts'
import { hayCuenta } from '../../lib/cuenta.ts'
import { createLocalStore } from '../../lib/localStore.ts'
import { enviar } from '../../lib/sincronizar.ts'

/** Fechas (AAAA-MM-DD, hora local) en las que se marcó una visita, de la más antigua a la última. */
export type VisitDates = readonly string[]

/** Tope por lugar: una visita al día durante dos años es más de lo que nadie necesita recordar. */
const MAX_DATES = 730
/** Tope de lugares recordados, como en las fichas abiertas: lo más antiguo se olvida primero. */
const MAX_PLACES = 300

const EMPTY: ReadonlyMap<string, VisitDates> = new Map()
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Hoy en el calendario de la persona (no en UTC): marcar a las 23:00 cuenta como hoy, no como mañana. */
export function today(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/**
 * "24/Sept/2026" a partir de la fecha guardada (AAAA-MM-DD, hora local). El mes va abreviado y en el
 * idioma activo, con inicial mayúscula y sin el punto que añaden algunos idiomas, para que la fecha
 * se lea de un vistazo y ocupe lo mismo en enero que en septiembre.
 */
export function formatVisitDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  const short = new Intl.DateTimeFormat(locale, { month: 'short' })
    .format(new Date(year, month - 1, day))
    .replace('.', '')
  return `${day}/${short.charAt(0).toUpperCase()}${short.slice(1)}/${year}`
}

/** "12 de octubre de 2026": la frase de la ficha se lee, no se consulta como una tabla. */
export function formatVisitDateLong(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, day),
  )
}

const isDateList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((date) => typeof date === 'string' && DATE_PATTERN.test(date))

export const visitsStore = createLocalStore<ReadonlyMap<string, VisitDates>>(
  'zibata:visitas',
  (raw) =>
    new Map(
      Object.entries((raw ?? {}) as Record<string, unknown>)
        .filter((entry): entry is [string, string[]] => isDateList(entry[1]) && entry[1].length > 0)
        .map(([id, dates]) => [id, dates.slice(-MAX_DATES)]),
    ),
  (value) => Object.fromEntries(value),
  EMPTY,
)

/**
 * Guarda la lista de fechas de un lugar y la manda al servidor. Ordenada y sin repetidos.
 *
 * Ordenada porque desde que se puede registrar cualquier día, el último elemento ya no es
 * necesariamente el más reciente, y hay dos sitios que cuentan con que lo sea: el orden personal
 * (que mide hace cuánto fue la última visita) y la frase que la ficha enseña debajo del control.
 */
function guardar(placeId: string, dates: readonly string[]): VisitDates {
  // Lo que ya había antes de las cuentas sube con el primer gesto, no al entrar.
  subirLasQueYaHabia()
  const next = new Map(visitsStore.read())
  const limpias = [...new Set(dates)].sort()
  next.delete(placeId)
  if (limpias.length > 0) next.set(placeId, limpias.slice(-MAX_DATES))
  // Map conserva el orden de inserción: el primero es el lugar que hace más que no se visita.
  while (next.size > MAX_PLACES) next.delete(next.keys().next().value as string)
  visitsStore.write(next)
  // Se manda la lista entera del lugar y no un incremento: así desmarcar también viaja, y dos
  // dispositivos que marcaron días distintos no dejan nada que conciliar.
  enviar('/api/visitas', { fechas: { [placeId]: next.get(placeId) ?? [] } })
  return next.get(placeId) ?? []
}

/** Registra un día concreto. Repetir el mismo día no hace nada: una visita por día y por lugar. */
export function registrarVisita(placeId: string, day: string): VisitDates {
  return guardar(placeId, [...(visitsStore.read().get(placeId) ?? []), day])
}

/** Quita un día del historial de un lugar. */
export function quitarVisita(placeId: string, day: string): VisitDates {
  return guardar(
    placeId,
    (visitsStore.read().get(placeId) ?? []).filter((fecha) => fecha !== day),
  )
}

/** Sube de una vez las visitas que ya estaban en este dispositivo. Solo antes de que haya cuenta. */
function subirLasQueYaHabia(): void {
  if (hayCuenta()) return
  const fechas = Object.fromEntries(visitsStore.read())
  if (Object.keys(fechas).length === 0) return
  enviar('/api/visitas', { fechas })
}

export function useVisits() {
  const visits = useSyncExternalStore(
    visitsStore.subscribe,
    visitsStore.read,
    () => visitsStore.empty,
  )
  const registrar = useCallback((placeId: string, day: string) => registrarVisita(placeId, day), [])
  const quitar = useCallback((placeId: string, day: string) => quitarVisita(placeId, day), [])
  const datesOf = (placeId: string): VisitDates => visits.get(placeId) ?? []
  return {
    visits,
    registrar,
    quitar,
    datesOf,
    countOf: (placeId: string) => datesOf(placeId).length,
    visitedToday: (placeId: string) => datesOf(placeId).includes(today()),
    /** Lugares distintos visitados y visitas en total. */
    totals: () => ({
      places: visits.size,
      visits: [...visits.values()].reduce((sum, dates) => sum + dates.length, 0),
    }),
  }
}
