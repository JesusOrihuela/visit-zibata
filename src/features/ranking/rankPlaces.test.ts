import { describe, expect, it } from 'vitest'
import { makePlace } from '../../test/fixtures.ts'
import type { Place } from '../../types/domain.ts'
import { categoryAffinity, type PreferenceSignals, rankPlaces } from './rankPlaces.ts'

const NOW = Date.parse('2026-09-21T12:00:00Z')
const DAY = 86_400_000

// Lista curada ficticia: dos cafés, dos taquerías, dos sushis y dos pizzerías.
const places: Place[] = [
  makePlace({ id: 'pizza-a', plazaId: 'p1', giros: ['pizza'] }),
  makePlace({ id: 'cafe-a', plazaId: 'p1', giros: ['panaderia'] }),
  makePlace({ id: 'tacos-a', plazaId: 'p1', giros: ['taqueria'] }),
  makePlace({ id: 'sushi-a', plazaId: 'p1', giros: ['sushi'] }),
  makePlace({ id: 'pizza-b', plazaId: 'p1', giros: ['pizza'] }),
  makePlace({ id: 'cafe-b', plazaId: 'p1', giros: ['panaderia'] }),
  makePlace({ id: 'tacos-b', plazaId: 'p1', giros: ['taqueria'] }),
  makePlace({ id: 'sushi-b', plazaId: 'p2', giros: ['sushi'] }),
]
const byId = new Map(places.map((place) => [place.id, place]))
/** El estante de cada giro de la lista: el sushi cuelga de asiática, el pan del café. */
const CATEGORIA: Record<string, string> = {
  pizza: 'pizza',
  panaderia: 'cafe',
  taqueria: 'tacos',
  sushi: 'asiatica',
}
const categoryOfGiro = (giro: string) => CATEGORIA[giro]
const options = { now: NOW, placeById: (id: string) => byId.get(id), categoryOfGiro }
const none: PreferenceSignals = {
  favorites: new Set(),
  ratings: new Map(),
  interactions: new Map(),
  visits: new Map(),
}
const ids = (list: Place[]) => list.map((place) => place.id)

describe('rankPlaces', () => {
  it('sin señales respeta el orden curado de la guía', () => {
    expect(ids(rankPlaces(places, none, options))).toEqual(ids(places))
  })

  it('lo que la persona prefiere sube, y arrastra a los lugares del mismo giro', () => {
    const signals: PreferenceSignals = {
      ...none,
      favorites: new Set(['sushi-a']),
      interactions: new Map([['sushi-a', { opens: 5, lastOpenedAt: NOW - DAY }]]),
    }
    const ranked = ids(rankPlaces(places, signals, options))
    expect(ranked[0]).toBe('sushi-a')
    // Otro sushi, aunque nunca lo haya abierto, va antes que giros que no le interesan.
    expect(ranked.indexOf('sushi-b')).toBeLessThan(ranked.indexOf('pizza-a'))
  })

  it('un giro secundario arrastra igual que un principal', () => {
    // El nivel es peso visual, no visibilidad: a quien le gusta el sushi hay que subirle la
    // pizzería que además lo hace, aunque en la lista el dibujo sea el de la pizza.
    const conSecundario = [
      ...places,
      makePlace({ id: 'pizza-c', plazaId: 'p1', giros: ['pizza'], secundarios: ['sushi'] }),
    ]
    const porId = new Map(conSecundario.map((place) => [place.id, place]))
    const signals: PreferenceSignals = {
      ...none,
      favorites: new Set(['sushi-a']),
      interactions: new Map([['sushi-a', { opens: 5, lastOpenedAt: NOW - DAY }]]),
    }
    const ranked = ids(
      rankPlaces(conSecundario, signals, { ...options, placeById: (id) => porId.get(id) }),
    )
    expect(ranked.indexOf('pizza-c')).toBeLessThan(ranked.indexOf('pizza-a'))
  })

  it('una calificación baja hunde el lugar', () => {
    const signals: PreferenceSignals = { ...none, ratings: new Map([['pizza-a', 1]]) }
    const ranked = ids(rankPlaces(places, signals, options))
    expect(ranked.at(-1)).toBe('pizza-a')
  })

  it('una visita marcada pesa más que haber abierto la ficha', () => {
    const signals: PreferenceSignals = {
      ...none,
      interactions: new Map([['cafe-a', { opens: 1, lastOpenedAt: NOW - DAY }]]),
      visits: new Map([['tacos-a', ['2026-09-24']]]),
    }
    const ranked = ids(
      rankPlaces(places, signals, { ...options, now: Date.parse('2026-09-25T12:00:00Z') }),
    )
    expect(ranked.indexOf('tacos-a')).toBeLessThan(ranked.indexOf('cafe-a'))
  })

  it('lo reciente pesa más que lo de hace meses', () => {
    const signals: PreferenceSignals = {
      ...none,
      interactions: new Map([
        ['tacos-a', { opens: 3, lastOpenedAt: NOW - 180 * DAY }],
        ['cafe-a', { opens: 3, lastOpenedAt: NOW - DAY }],
      ]),
    }
    const ranked = ids(rankPlaces(places, signals, options))
    expect(ranked.indexOf('cafe-a')).toBeLessThan(ranked.indexOf('tacos-a'))
  })

  it('reserva posiciones para lugares que aún no ha abierto', () => {
    // Ha abierto muchas veces todos los lugares de café y tacos…
    const interactions = new Map(
      ['cafe-a', 'cafe-b', 'tacos-a', 'tacos-b'].map((id) => [id, { opens: 8, lastOpenedAt: NOW }]),
    )
    const ranked = ids(rankPlaces(places, { ...none, interactions }, options))
    // …y aun así la 4.ª posición es para algo que no conoce.
    expect(['pizza-a', 'pizza-b', 'sushi-a', 'sushi-b']).toContain(ranked[3])
    expect(new Set(ranked)).toEqual(new Set(ids(places)))
  })

  it('da una segunda oportunidad a lo que no abre desde hace meses', () => {
    const interactions = new Map(
      ['cafe-a', 'cafe-b', 'tacos-a', 'tacos-b'].map((id) => [id, { opens: 8, lastOpenedAt: NOW }]),
    )
    // Un lugar visto una vez hace medio año cuenta como pendiente, igual que uno nunca abierto.
    interactions.set('pizza-a', { opens: 1, lastOpenedAt: NOW - 200 * DAY })
    const ranked = ids(
      rankPlaces(places, { ...none, interactions }, { ...options, exploreEvery: 2 }),
    )
    const chances = [ranked[1], ranked[3], ranked[5]]
    expect(chances).toContain('pizza-a')
  })

  it('la comunidad orienta pero no manda sobre el gusto propio', () => {
    const community = (id: string) => (id === 'sushi-b' ? { favorites: 80, empuje: 0.9 } : null)
    const sinGusto = ids(
      rankPlaces(places, { ...none, favorites: new Set(['cafe-a']) }, { ...options, community }),
    )
    // Con muchos corazones y buena media sube, aunque nadie de esta casa lo haya abierto…
    expect(sinGusto.indexOf('sushi-b')).toBeLessThan(sinGusto.indexOf('sushi-a'))
    // …pero el favorito propio sigue mandando.
    expect(sinGusto[0]).toBe('cafe-a')
  })

  it('ordena las categorías por afinidad de la persona', () => {
    const signals = {
      ...none,
      favorites: new Set(['sushi-a']),
      ratings: new Map([['pizza-a', 1]]),
    }
    const affinity = categoryAffinity(signals, (id) => byId.get(id), NOW, categoryOfGiro)
    expect(affinity.get('asiatica')).toBeGreaterThan(0)
    expect(affinity.get('pizza')).toBeLessThan(0)
    expect(affinity.get('tacos')).toBeUndefined()
  })

  it('es estable dentro del mismo día y no pierde ni repite lugares', () => {
    const signals: PreferenceSignals = { ...none, favorites: new Set(['tacos-b']) }
    const first = ids(rankPlaces(places, signals, options))
    expect(ids(rankPlaces(places, signals, { ...options, now: NOW + 3_600_000 }))).toEqual(first)
    expect(first).toHaveLength(places.length)
    expect(new Set(first).size).toBe(places.length)
  })
})
