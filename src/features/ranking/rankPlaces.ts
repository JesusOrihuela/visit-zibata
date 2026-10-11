/**
 * Orden personal de una lista de lugares. Función pura: recibe las señales de la persona y devuelve la
 * lista ordenada, así que puede correr igual en el navegador (hoy) o en un servidor (el día que haya
 * cuentas y base de datos).
 *
 * 1. Gusto: cada lugar que la persona marcó (favorito, calificación, visitas marcadas a mano y veces
 *    que abrió la ficha, con más peso lo reciente) suma afinidad a cada uno de sus giros, a su
 *    categoría y, un poco, a su zona. Un lugar
 *    puntúa por lo que la persona hizo con él y por lo que le gusta de lugares parecidos. Una
 *    calificación baja resta.
 * 2. Comunidad (opcional): un empuje de 0 a 1 que calcula el servidor con los corazones y las notas
 *    de todo el mundo, ya calibrado contra el propio catálogo. Pesa un poco, siempre por debajo de lo
 *    que dice esta persona, y solo puede subir. La media de estrellas no llega hasta aquí: el
 *    servidor manda el empuje ya hecho, así que la interfaz no puede enseñarla ni queriendo (ver
 *    worker/senales.ts).
 * 3. Descubrimiento y segundas oportunidades: una de cada `exploreEvery` posiciones se reserva a un
 *    lugar que no ha abierto nunca (o que no abre desde hace meses), con una rotación diaria entre
 *    ellos. Así lo nuevo tiene sitio y lo que descartó hace tiempo puede volver a aparecer.
 * 4. Sin ninguna señal se respeta el orden curado de la guía: el orden personal se gana, no se inventa.
 */
import type { Place } from '../../types/domain.ts'
import { allGiroIds } from '../places/placeIcon.ts'

export interface PlaceInteraction {
  /** Veces que abrió la ficha. */
  opens: number
  /** Última vez (epoch ms). */
  lastOpenedAt: number
}

export interface PreferenceSignals {
  favorites: ReadonlySet<string>
  ratings: ReadonlyMap<string, number>
  interactions: ReadonlyMap<string, PlaceInteraction>
  /** Fechas (AAAA-MM-DD) en que la persona marcó que estuvo ahí. Pesa más que abrir la ficha. */
  visits: ReadonlyMap<string, readonly string[]>
}

/** Lo que dice el resto de la gente de un lugar. Lo calcula el servidor (ver worker/senales.ts). */
export interface CommunitySignal {
  /** Personas que lo tienen guardado, o `null` mientras son pocas para publicar el número. */
  favorites: number | null
  /**
   * De 0 a 1, con los corazones y las notas de todos ya mezclados y calibrados. Solo sube: por
   * debajo de la media del catálogo vale cero, para que una brigada de votos no pueda hundir a un
   * negocio que no puede verlo ni rebatirlo.
   */
  empuje: number
}

export interface RankOptions {
  /** Epoch ms: fija el decaimiento y la rotación diaria (determinista en pruebas). */
  now: number
  /** Busca un lugar por id (las señales pueden venir de lugares fuera de la lista actual). */
  placeById: (id: string) => Place | undefined
  /** La categoría de un giro: la afinidad se aprende por giro y se agrega por categoría. */
  categoryOfGiro: (giroId: string) => string | undefined
  /** Cada cuántas posiciones entra un lugar sin explorar. */
  exploreEvery?: number
  /** Señales de la comunidad, si las hay (hoy no: la guía es estática y sin cuentas). */
  community?: (placeId: string) => CommunitySignal | null
}

const DAY_MS = 86_400_000
/** En 30 días una visita pesa la mitad: los gustos cambian. */
const HALF_LIFE_DAYS = 30
/** Un lugar que no se abre desde hace tanto vuelve a entrar en las posiciones de descubrimiento. */
const SECOND_CHANCE_DAYS = 60
const WEIGHT = {
  favorite: 3,
  ratingPerStar: 1.2,
  /** Haber ido pesa más que haber mirado: lo marca la persona a propósito. */
  visit: 2.2,
  place: 1,
  giro: 0.45,
  category: 0.6,
  plaza: 0.15,
  /** La comunidad orienta, nunca manda sobre el gusto propio. */
  community: 0.3,
}

/*
 * Antes la aritmética de la comunidad vivía aquí, con tres constantes escritas a mano: dividir los
 * corazones entre 25, dar confianza a los 20 votos y centrar las notas en 3,5 estrellas. Las tres
 * fallaban en los dos extremos (con cincuenta personas la señal valía cero; con cinco mil, todo se
 * saturaba) y el 3,5 además ignoraba que las notas de consumo se amontonan en 4 y 5.
 *
 * Ahora la calcula el servidor contra el propio catálogo y llega hecha. Aquí solo queda el peso:
 * cuánto importa lo que dicen los demás frente a lo que dice esta persona, que sí es una decisión
 * de esta guía y no del tamaño de su comunidad.
 */

/** Cuánto dice la persona de un lugar concreto (puede ser negativo: una calificación de 1 o 2). */
function directSignal(id: string, signals: PreferenceSignals, now: number): number {
  let score = signals.favorites.has(id) ? WEIGHT.favorite : 0
  const rating = signals.ratings.get(id)
  if (rating !== undefined) score += (rating - 3) * WEIGHT.ratingPerStar
  const visits = signals.visits.get(id)
  if (visits && visits.length > 0) {
    const last = Date.parse(`${visits[visits.length - 1]}T12:00:00`)
    const ageDays = Number.isNaN(last) ? 0 : Math.max(0, now - last) / DAY_MS
    score += Math.log2(1 + visits.length) * WEIGHT.visit * 0.5 ** (ageDays / HALF_LIFE_DAYS)
  }
  const visit = signals.interactions.get(id)
  if (visit && visit.opens > 0) {
    const ageDays = Math.max(0, now - visit.lastOpenedAt) / DAY_MS
    score += Math.log2(1 + visit.opens) * 0.5 ** (ageDays / HALF_LIFE_DAYS)
  }
  return score
}

/** Pseudoaleatorio estable en [0, 1): mismo lugar y mismo día → mismo valor. */
function dailyUnit(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x1_0000_0000
}

export function hasSignals(signals: PreferenceSignals): boolean {
  return (
    signals.favorites.size +
      signals.ratings.size +
      signals.interactions.size +
      signals.visits.size >
    0
  )
}

/**
 * Afinidad de la persona con cada categoría, de −1 a 1. La usan las pastillas de filtro para ponerse
 * en el orden en que esta persona suele elegir.
 */
export function categoryAffinity(
  signals: PreferenceSignals,
  placeById: (id: string) => Place | undefined,
  now: number,
  categoryOfGiro: (giroId: string) => string | undefined,
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const id of new Set([
    ...signals.favorites,
    ...signals.ratings.keys(),
    ...signals.interactions.keys(),
    ...signals.visits.keys(),
  ])) {
    const place = placeById(id)
    if (!place) continue
    const signal = directSignal(id, signals, now)
    for (const category of new Set(allGiroIds(place).map(categoryOfGiro))) {
      if (category) totals.set(category, (totals.get(category) ?? 0) + signal)
    }
  }
  return new Map([...totals].map(([category, value]) => [category, Math.tanh(value / 4)]))
}

export function rankPlaces(
  places: readonly Place[],
  signals: PreferenceSignals,
  { now, placeById, categoryOfGiro, exploreEvery = 4, community }: RankOptions,
): Place[] {
  if (places.length < 2 || !hasSignals(signals)) return [...places]

  // Afinidad aprendida de todo lo que la persona ha marcado, no solo de esta lista.
  const affinity = new Map<string, number>()
  const add = (key: string, value: number) => affinity.set(key, (affinity.get(key) ?? 0) + value)
  const known = new Set([
    ...signals.favorites,
    ...signals.ratings.keys(),
    ...signals.interactions.keys(),
  ])
  for (const id of known) {
    const place = placeById(id)
    if (!place) continue
    const signal = directSignal(id, signals, now)
    // Los giros pesan por sí mismos y, a través de ellos, su categoría: quien marca pizzerías
    // aprende a que le gusten las pizzas, y de paso lo italiano. Los secundarios cuentan igual:
    // que el ramen de Castore sea su tercer renglón no lo hace menos cierto.
    for (const giro of allGiroIds(place)) {
      add(`g:${giro}`, signal)
      const category = categoryOfGiro(giro)
      if (category) add(`c:${category}`, signal)
    }
    add(`p:${place.plazaId}`, signal)
  }
  const soft = (value: number, scale: number) => Math.tanh(value / scale)

  const day = new Date(now).toISOString().slice(0, 10)
  const scored = places.map((place, index) => {
    const direct = directSignal(place.id, signals, now)
    const score =
      WEIGHT.place * soft(direct, 3) +
      WEIGHT.category *
        soft(
          Math.max(
            ...allGiroIds(place).map(
              (giro) => affinity.get(`c:${categoryOfGiro(giro) ?? ''}`) ?? 0,
            ),
            0,
          ),
          4,
        ) +
      WEIGHT.giro *
        soft(Math.max(...allGiroIds(place).map((giro) => affinity.get(`g:${giro}`) ?? 0), 0), 3) +
      WEIGHT.plaza * soft(affinity.get(`p:${place.plazaId}`) ?? 0, 4) +
      WEIGHT.community * (community?.(place.id)?.empuje ?? 0) +
      // A igualdad de gusto manda el orden curado de la guía.
      0.05 * (1 - index / places.length)
    const visit = signals.interactions.get(place.id)
    const staleDays = visit ? (now - visit.lastOpenedAt) / DAY_MS : Number.POSITIVE_INFINITY
    // Nunca abierto, o sin abrir desde hace meses: entra en las posiciones de descubrimiento.
    const deserveChance = !known.has(place.id) || staleDays > SECOND_CHANCE_DAYS
    return {
      place,
      score,
      deserveChance,
      explore: score + 0.35 * dailyUnit(`${day}:${place.id}`),
    }
  })

  const byScore = [...scored].sort((a, b) => b.score - a.score)
  const unexplored = scored
    .filter((entry) => entry.deserveChance)
    .sort((a, b) => b.explore - a.explore)
  const result: Place[] = []
  const used = new Set<string>()
  let cursor = 0
  while (result.length < places.length) {
    const slot = result.length + 1
    const discovery =
      slot % exploreEvery === 0 ? unexplored.find((e) => !used.has(e.place.id)) : undefined
    let next = discovery
    while (!next) {
      const candidate = byScore[cursor++]
      if (candidate && !used.has(candidate.place.id)) next = candidate
    }
    used.add(next.place.id)
    result.push(next.place)
  }
  return result
}
