// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { _colaParaPruebas } from '../lib/eventos.ts'
import { medirAccion } from './medicion.ts'
import { initialAppState } from './state.ts'

beforeEach(() => {
  _colaParaPruebas().length = 0
})
const cola = () => _colaParaPruebas()

describe('qué acciones se cuentan', () => {
  it('abrir una ficha con un gesto', () => {
    medirAccion(
      { type: 'selectPlace', placeId: 'tomassa', plazaId: 'plaza-luna', origin: 'plaza' },
      initialAppState,
    )
    expect(cola()).toEqual([{ tipo: 'ficha', destino: 'tomassa' }])
  })

  it('la carga inicial y el botón atrás no se cuentan: ya los contó el servidor', () => {
    medirAccion(
      {
        type: 'syncFromUrl',
        plazaId: 'plaza-luna',
        placeId: 'tomassa',
        categoryId: 'bebidas',
        missingLink: false,
        infoTopic: null,
      },
      initialAppState,
    )
    expect(cola()).toHaveLength(0)
  })

  it('elegir una categoría o una zona, una vez', () => {
    medirAccion({ type: 'setCategory', categoryId: 'bebidas' }, initialAppState)
    medirAccion({ type: 'selectPlaza', plazaId: 'plaza-luna' }, initialAppState)
    expect(cola()).toEqual([
      { tipo: 'filtro', destino: 'bebidas' },
      { tipo: 'filtro', destino: 'plaza-luna' },
    ])
  })

  it('quitar un filtro o repetir el mismo no cuenta', () => {
    medirAccion({ type: 'setCategory', categoryId: null }, initialAppState)
    medirAccion({ type: 'selectPlaza', plazaId: null }, initialAppState)
    medirAccion(
      { type: 'setCategory', categoryId: 'bebidas' },
      { ...initialAppState, activeCategoryId: 'bebidas' },
    )
    medirAccion(
      { type: 'selectPlaza', plazaId: 'plaza-luna' },
      { ...initialAppState, selectedPlazaId: 'plaza-luna' },
    )
    expect(cola()).toHaveLength(0)
  })

  it('abierto ahora cuenta al encenderlo, no al apagarlo', () => {
    medirAccion({ type: 'toggleOpenNow' }, initialAppState)
    medirAccion({ type: 'toggleOpenNow' }, { ...initialAppState, openNowOnly: true })
    expect(cola()).toEqual([{ tipo: 'filtro', destino: 'abierto-ahora' }])
  })

  it('escribir en el buscador no se cuenta aquí, y nunca con el texto', () => {
    medirAccion({ type: 'setQuery', query: 'quiero una pizza' }, initialAppState)
    expect(cola()).toHaveLength(0)
  })
})
