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

  it('sin texto, el local que lleva la categoría de primer giro va antes', () => {
    // La pastilla de una categoría hace de consulta: el orden es el mismo que el de la búsqueda.
    const propio = buildCatalog(categoriesFixture, plazasFixture, [
      makePlace({ id: 'pan-segundo', plazaId: 'plaza-norte', giros: ['pizza', 'panaderia'] }),
      makePlace({ id: 'pan-primero', plazaId: 'plaza-norte', giros: ['panaderia', 'pizza'] }),
    ])
    const result = applyFilters(propio, createSearchIndex(propio), {
      ...EMPTY_FILTERS,
      categoryId: 'desayunos-y-cafe',
    })
    expect(ids(result)).toEqual(['pan-primero', 'pan-segundo'])
  })

  it('cuenta por plaza y por categoría', () => {
    const all = applyFilters(catalog, index, EMPTY_FILTERS)
    expect(countByPlaza(all)).toEqual(
      new Map([
        ['plaza-norte', 3],
        ['plaza-sur', 1],
      ]),
    )
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
    {
      ...conHorario('en-obra', ['06:00-22:00']),
      cierre: { motivo: 'remodelacion', desde: '2026-10-09' },
    },
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

  it('deja fuera un local en obra aunque su horario diga que abre', () => {
    // Es la razón de que el filtro pregunte por el estado del lugar y no por su horario a secas.
    const r = applyFilters(
      propio,
      indicePropio,
      { ...EMPTY_FILTERS, openNowOnly: true },
      new Set(),
      LUNES_6,
    )
    expect(ids(r)).not.toContain('en-obra')
  })

  it('sin el filtro puesto, el horario no quita a nadie, ni siquiera al que está en obra', () => {
    // Cerrado temporalmente no es estar dado de baja: quien lo busque por su nombre lo encuentra, y
    // al abrir la ficha lee por qué está cerrado.
    const r = applyFilters(propio, indicePropio, EMPTY_FILTERS, new Set(), LUNES_6)
    expect(ids(r)).toHaveLength(4)
    expect(ids(r)).toContain('en-obra')
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
