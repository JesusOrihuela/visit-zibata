import { describe, expect, it } from 'vitest'
import { buildCatalog } from '../../data/catalog.ts'
import { catalogFixture, categoriesFixture, makePlace, plazasFixture } from '../../test/fixtures.ts'
import { createSearchIndex } from '../search/searchIndex.ts'
import {
  applyFilters,
  categoriesOf,
  countByCategory,
  countByPlaza,
  EMPTY_FILTERS,
  groupByPlaza,
  hasActiveFilters,
} from './filters.ts'

const catalog = catalogFixture()
const index = createSearchIndex(catalog)
const ids = (places: { id: string }[]) => places.map((place) => place.id)

describe('applyFilters', () => {
  it('sin filtros devuelve todos los lugares activos', () => {
    expect(ids(applyFilters(catalog, index, EMPTY_FILTERS))).toEqual([
      'cafe-aurora',
      'tacos-el-farol',
      'pizza-norte',
      'panaderia-trigo',
    ])
  })

  it('filtra por categoría', () => {
    const result = applyFilters(catalog, index, {
      ...EMPTY_FILTERS,
      categoryId: 'desayunos-y-cafe',
    })
    expect(ids(result)).toEqual(['cafe-aurora', 'panaderia-trigo'])
  })

  it('combina plaza y categoría', () => {
    const result = applyFilters(catalog, index, {
      ...EMPTY_FILTERS,
      categoryId: 'desayunos-y-cafe',
      plazaId: 'plaza-sur',
    })
    expect(ids(result)).toEqual(['panaderia-trigo'])
  })

  it('combina búsqueda y categoría', () => {
    const result = applyFilters(catalog, index, {
      ...EMPTY_FILTERS,
      query: 'norte',
      categoryId: 'pizza',
    })
    expect(ids(result)).toEqual(['pizza-norte'])
  })

  it('filtra por favoritos', () => {
    const result = applyFilters(
      catalog,
      index,
      { ...EMPTY_FILTERS, favoritesOnly: true },
      new Set(['trigo', 'tacos-el-farol']),
    )
    expect(ids(result)).toEqual(['tacos-el-farol'])
  })

  it('devuelve lista vacía cuando nada coincide', () => {
    expect(applyFilters(catalog, index, { ...EMPTY_FILTERS, query: 'sushi' })).toEqual([])
  })
})

describe('utilidades de filtros', () => {
  it('detecta filtros activos (la plaza no cuenta)', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: 'a' })).toBe(false)
    // Coherente con la búsqueda: varias letras sueltas no filtran, así que no cuentan como filtro.
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: 'a b' })).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: 'ta' })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, categoryId: 'pizza' })).toBe(true)
  })

  it('un giro secundario también lleva al local a su estante', () => {
    // El nivel es peso visual, no visibilidad: si la panadería también hace tacos, sale al
    // filtrar tacos aunque lo suyo sea el pan.
    const pan = makePlace({
      id: 'pan-con-tacos',
      plazaId: 'plaza-sur',
      giros: ['panaderia'],
      secundarios: ['taqueria'],
    })
    expect(categoriesOf(pan, catalog)).toEqual(['desayunos-y-cafe', 'tacos-y-antojitos'])
  })

  it('cuenta y agrupa por plaza y categoría', () => {
    const all = applyFilters(catalog, index, EMPTY_FILTERS)
    expect(countByPlaza(all)).toEqual(
      new Map([
        ['plaza-norte', 3],
        ['plaza-sur', 1],
      ]),
    )
    expect(groupByPlaza(all).map(([plazaId, places]) => [plazaId, places.length])).toEqual([
      ['plaza-norte', 3],
      ['plaza-sur', 1],
    ])
    expect(countByCategory(all, catalog).get('desayunos-y-cafe')).toBe(2)
  })
})

describe('abierto ahora', () => {
  const LUNES_6 = { day: 'mon', minutes: 6 * 60 } as const
  const conHorario = (id: string, franjas: string[]) =>
    makePlace({
      id,
      plazaId: 'plaza-norte',
      giros: ['pizza'],
      hours: { mon: franjas, tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    })
  const propio = buildCatalog(categoriesFixture, plazasFixture, [
    conHorario('abre-temprano', ['06:00-22:00']),
    conHorario('abre-tarde', ['14:00-22:00']),
    makePlace({ id: 'sin-horario', plazaId: 'plaza-norte', giros: ['pizza'] }),
  ])
  const indicePropio = createSearchIndex(propio)

  it('deja solo lo que está abierto en ese momento', () => {
    const r = applyFilters(
      propio,
      indicePropio,
      { ...EMPTY_FILTERS, openNowOnly: true },
      new Set(),
      LUNES_6,
    )
    expect(ids(r)).toEqual(['abre-temprano'])
  })

  it('deja fuera los que no publican horario, porque de esos no se sabe', () => {
    const r = applyFilters(
      propio,
      indicePropio,
      { ...EMPTY_FILTERS, openNowOnly: true },
      new Set(),
      LUNES_6,
    )
    expect(ids(r)).not.toContain('sin-horario')
  })

  it('sin el filtro puesto, el horario no quita a nadie', () => {
    const r = applyFilters(propio, indicePropio, EMPTY_FILTERS, new Set(), LUNES_6)
    expect(ids(r)).toHaveLength(3)
  })

  it('sin saber la hora no se afirma que algo esté abierto', () => {
    // Si quien llama no pasa el momento, el filtro no puede decidir y no deja pasar a nadie. Es
    // preferible una lista vacía a una lista que afirma algo que no se comprobó.
    const r = applyFilters(propio, indicePropio, { ...EMPTY_FILTERS, openNowOnly: true })
    expect(ids(r)).toEqual([])
  })

  it('cuenta como filtro activo, así que aparece el resumen y el botón de limpiar', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, openNowOnly: true })).toBe(true)
  })
})
