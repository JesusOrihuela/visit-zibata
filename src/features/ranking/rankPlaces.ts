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
 * 3. Abierto ahora: un local cerrado no sirve para decidir dónde ir en este momento, así que estar
 *    abierto sube. Pesa mucho (0,8) pero no manda: un lugar que esta persona adora y está cerrado
 *    puede seguir por delante de uno indiferente que está abierto, que es lo que querría ver quien
 *    está planeando y no saliendo ya. Quien quiere solo lo abierto tiene el filtro.
 * 4. Descubrimiento y segundas oportunidades: una de cada `exploreEvery` posiciones se reserva a un
 *    lugar que no ha abierto nunca (o que no abre desde hace meses), con una rotación diaria entre
 *    ellos. Así lo nuevo tiene sitio y lo que descartó hace tiempo puede volver a aparecer.
 * 5. Sin ninguna señal se respeta el orden curado de la guía: el orden personal se gana, no se inventa.
 */
import { estadoDe } from '../../lib/estado.ts'
import { getZonedMoment } from '../../lib/hours.ts'
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
  /**
   * Estar abierto ahora. Pesa más que la comunidad y que el giro, porque de todo lo que esta
   * función sabe es lo único que decide si el resultado **sirve** en este momento.
   *
   * 0,5 y no más: un favorito aporta `tanh(3/3) = 0,76` por la vía directa, así que con 0,8 un
   * local cualquiera que estuviera abierto le ganaba a uno que esta persona guardó a propósito.
   * Eso es justo lo que no debe pasar, y lo cazó una prueba de este archivo. Quien quiera solo lo
   * abierto tiene el filtro; el orden sigue siendo suyo.
   */
  openNow: 0.5,
}

/**
 * Cuánto suma el estado del lugar.
 *
 * Los once locales sin horario publicado quedan en medio y no en el suelo: no sabemos si están
 * abiertos, y hundirlos sería castigar al negocio por un hueco de la guía, no por estar cerrado.
 *
 * El cierre temporal es el único valor negativo de toda la tabla, y por eso baja de verdad en vez
 * de solo no subir. Un local cerrado a esta hora abre mañana; uno en obra no abre en semanas, y
 * enseñarlo arriba es gastarle a alguien un viaje. Sigue en la lista, porque quien lo busque por su
 * nombre tiene que encontrarlo y leer por qué está cerrado.
 */
const APERTURA = { open: 1, unknown: 0.35, closed: 0, temporal: -1 } as const

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
  if (places.length < 2) return [...places]

  // Un solo cálculo de la hora local para toda la lista: `getZonedMoment` monta un Intl.DateTimeFormat
  // y hacerlo por lugar cuesta más que todo lo demás junto.
  const momento = getZonedMoment(new Date(now))
  const apertura = (place: Place) => APERTURA[estadoDe(place, momento)]

  /*
   * Sin nada que esta persona haya marcado, el orden sigue siendo el curado de la guía y lo único
   * que se mueve es que lo abierto ahora sube, conservando el orden dentro de cada grupo.
   *
   * Es un camino aparte y no el mismo de abajo a propósito: estar abierto no es una señal personal,
   * es una propiedad del mundo, así que no hace falta haber marcado nada para que valga. Pero el
   * resto de la maquinaria (afinidades, descubrimiento, rotación diaria) sí depende de haber
   * marcado algo, y meter a quien llega por primera vez en las posiciones de descubrimiento le
   * barajaría la guía cada día sin que hubiera pedido nada.
   */
  if (!hasSignals(signals)) {
    const conApertura = places.map((place, index) => ({ place, index, abierto: apertura(place) }))
    if (conApertura.every((x) => x.abierto === conApertura[0]?.abierto)) return [...places]
    return conApertura
      .sort((a, b) => b.abierto - a.abierto || a.index - b.index)
      .map((x) => x.place)
  }

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
      WEIGHT.openNow * apertura(place) +
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
