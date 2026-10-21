import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { type Local, MAX_VECINOS, repartirVecinos } from './vecinos.ts'

/*
 * Con el dataset real: las zonas grandes (Xentric Anáhuac 25, Paseo Zibatá 24, Anáhuac Querétaro 12,
 * Plaza Zielo 10) son las únicas donde el bloque "Más en {zona}" no cabía entero, y 37 de las 101
 * fichas tenían un único enlace entrante. Las pequeñas deben quedar exactamente como estaban.
 */

interface Dato {
  id: string
  plazaId: string
  giros: string[]
  secundarios: string[]
}
const leer = <T>(archivo: string): T =>
  JSON.parse(readFileSync(`data/commercial/${archivo}`, 'utf8')) as T
const places = leer<{ places: Dato[] }>('places.json').places
const categorias = leer<{ categories: { id: string; giros: { id: string }[] }[] }>(
  'categories.json',
).categories
const deGiro = new Map(categorias.flatMap((c) => c.giros.map((giro) => [giro.id, c.id] as const)))

const locales: Local[] = places.map((place) => ({
  id: place.id,
  plazaId: place.plazaId,
  categorias: [
    ...new Set(
      [...place.giros, ...place.secundarios].flatMap((giro) => {
        const categoria = deGiro.get(giro)
        return categoria ? [categoria] : []
      }),
    ),
  ],
}))
const vecinos = repartirVecinos(locales)
const zonas = new Map<string, Local[]>()
for (const local of locales) zonas.set(local.plazaId, [...(zonas.get(local.plazaId) ?? []), local])

describe('el reparto de vecinos con el dataset real', () => {
  it('toda ficha tiene vecinos solo de su zona, sin sí misma y sin repetir', () => {
    for (const local of locales) {
      const lista = vecinos.get(local.id) ?? []
      expect(lista).not.toContain(local.id)
      expect(new Set(lista).size).toBe(lista.length)
      for (const id of lista) {
        expect(locales.find((otro) => otro.id === id)?.plazaId, `${local.id} -> ${id}`).toBe(
          local.plazaId,
        )
      }
      expect(lista.length).toBe(Math.min(MAX_VECINOS, (zonas.get(local.plazaId)?.length ?? 1) - 1))
    }
  })

  it('en las zonas donde caben todos (hasta 9 locales), enlaza a todos y en el orden de siempre', () => {
    for (const zona of zonas.values()) {
      if (zona.length - 1 > MAX_VECINOS) continue
      for (const local of zona) {
        const esperado = zona.filter((otro) => otro.id !== local.id).map((otro) => otro.id)
        expect(vecinos.get(local.id), local.id).toEqual(esperado)
      }
    }
  })

  it('en las zonas grandes, ya no enlazan todas a los mismos ocho', () => {
    const grandes = [...zonas.values()].filter((zona) => zona.length - 1 > MAX_VECINOS)
    expect(grandes.length).toBeGreaterThanOrEqual(4)
    for (const zona of grandes) {
      const entrantes = new Map(zona.map((local) => [local.id, 0]))
      for (const local of zona) {
        for (const id of vecinos.get(local.id) ?? [])
          entrantes.set(id, (entrantes.get(id) ?? 0) + 1)
      }
      const cuentas = [...entrantes.values()]
      // Reparto parejo: dos de diferencia como mucho. Un local no puede elegirse a sí mismo, así que
      // los últimos de la ronda tienen menos entre lo que repartir.
      expect(
        Math.max(...cuentas) - Math.min(...cuentas),
        `zona de ${zona.length}`,
      ).toBeLessThanOrEqual(2)
      // Y todos reciben alguno: antes los ocho primeros recibían los de todos y el resto, ninguno.
      expect(Math.min(...cuentas)).toBeGreaterThan(0)
    }
  })

  it('es determinista', () => {
    expect(repartirVecinos(locales)).toEqual(vecinos)
    expect(repartirVecinos([...locales])).toEqual(vecinos)
  })

  it('a igualdad de enlaces recibidos, prefiere al vecino de su categoría', () => {
    // Diez locales en una zona: cada uno tiene nueve vecinos posibles y cabe elegir ocho.
    const zona: Local[] = Array.from({ length: 10 }, (_, i) => ({
      id: `l${i}`,
      plazaId: 'z',
      categorias: [i % 2 === 0 ? 'cafe' : 'tacos'],
    }))
    const lista = repartirVecinos(zona).get('l0') ?? []
    // El primero en elegir aún no tiene criterio de reparto (todos van a 0): elige por categoría.
    expect(lista.slice(0, 4).every((id) => Number(id.slice(1)) % 2 === 0)).toBe(true)
  })

  it('deja a un local sin vecinos si está solo en su zona', () => {
    expect(repartirVecinos([{ id: 'a', plazaId: 'z', categorias: [] }]).get('a')).toEqual([])
  })
})
