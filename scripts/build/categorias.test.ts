import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Category, Place } from '../../src/types/domain.ts'
import { categoriasDe, conCantidad, girosDeCategoria, lugaresPorCategoria } from './categorias.ts'

const leer = <T>(archivo: string): T =>
  JSON.parse(readFileSync(`data/commercial/${archivo}`, 'utf8')) as T
const categorias = leer<{ categories: Category[] }>('categories.json').categories
const lugares = leer<{ places: Place[] }>('places.json').places
const deGiro = new Map(categorias.flatMap((c) => c.giros.map((g) => [g.id, c] as const)))
const rapida = categorias.find((c) => c.slug.es === 'hamburguesas') as Category
const porCategoria = lugaresPorCategoria(lugares, deGiro)

describe('los giros que nombran una categoría', () => {
  it('Comida Rápida se nombra por lo que la gente busca: hamburguesas y alitas', () => {
    expect(girosDeCategoria(rapida, porCategoria.get(rapida.id) ?? [], 'es').slice(0, 2)).toEqual([
      'hamburguesas',
      'alitas',
    ])
  })

  it('no repite lo que la etiqueta ya dice, con o sin acentos ni mayúsculas', () => {
    const cafe = categorias.find((c) => c.slug.es === 'desayunos-y-cafe') as Category
    const giros = girosDeCategoria(cafe, porCategoria.get(cafe.id) ?? [], 'es')
    expect(giros).not.toContain('café')
    expect(giros).not.toContain('desayunos')
  })

  it('no nombra un giro que tiene un solo local', () => {
    for (const categoria of categorias) {
      const giros = girosDeCategoria(categoria, porCategoria.get(categoria.id) ?? [], 'es')
      for (const giro of giros) {
        const id = categoria.giros.find((g) => g.label.es.toLowerCase() === giro)?.id
        const n = lugares.filter((p) =>
          [...p.giros, ...(p.secundarios ?? [])].includes(id ?? ''),
        ).length
        expect(n, `${categoria.id}: ${giro}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('una categoría sin locales no tiene giros que nombrar', () => {
    const vacia = categorias.find((c) => !porCategoria.has(c.id)) as Category
    expect(girosDeCategoria(vacia, [], 'es')).toEqual([])
  })
})

describe('la pertenencia a una categoría', () => {
  it('un local con un giro secundario también está en esa categoría, sin repetirse', () => {
    const conSecundario = lugares.find((p) =>
      (p.secundarios ?? []).some((g) => deGiro.get(g)?.id !== deGiro.get(p.giros[0] ?? '')?.id),
    ) as Place
    const ids = categoriasDe(conSecundario, deGiro).map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThan(1)
  })
})

describe('las cantidades', () => {
  it('usan el singular y el plural del idioma', () => {
    const mensaje = { one: '{count} lugar', other: '{count} lugares' }
    expect(conCantidad(mensaje, 1, 'es')).toBe('1 lugar')
    expect(conCantidad(mensaje, 26, 'es')).toBe('26 lugares')
  })
})
