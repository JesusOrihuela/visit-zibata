// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { catalogFixture } from '../test/fixtures.ts'
import { encabezadoDe } from './encabezado.ts'

const catalogo = catalogFixture()
const vacio = {
  infoTopic: null,
  selectedPlaceId: null,
  selectedPlazaId: null,
  activeCategoryId: null,
}
const lugar = catalogo.places[0]
const zona = catalogo.plazas[0]
const categoria = catalogo.categories[0]

describe('el h1 de la página', () => {
  it('sin nada elegido es el nombre y el lema de la guía', () => {
    expect(encabezadoDe(vacio, catalogo)).toMatch(/^Visit Zibatá · /)
  })

  it('una ficha, el nombre del local, aunque haya zona y categoría', () => {
    expect(
      encabezadoDe(
        {
          ...vacio,
          selectedPlaceId: lugar?.id ?? null,
          selectedPlazaId: zona?.id ?? null,
          activeCategoryId: categoria?.id ?? null,
        },
        catalogo,
      ),
    ).toBe(lugar?.name)
  })

  it('una zona, su nombre, también con un filtro de categoría dentro', () => {
    expect(encabezadoDe({ ...vacio, selectedPlazaId: zona?.id ?? null }, catalogo)).toBe(zona?.name)
    expect(
      encabezadoDe(
        { ...vacio, selectedPlazaId: zona?.id ?? null, activeCategoryId: categoria?.id ?? null },
        catalogo,
      ),
    ).toBe(zona?.name)
  })

  it('una categoría sola, su página: "{categoría} en Zibatá"', () => {
    expect(encabezadoDe({ ...vacio, activeCategoryId: categoria?.id ?? null }, catalogo)).toBe(
      `${categoria?.label.es} en Zibatá`,
    )
  })

  it('una página de información manda sobre lo que haya debajo', () => {
    expect(
      encabezadoDe(
        { ...vacio, infoTopic: 'privacidad', selectedPlaceId: lugar?.id ?? null },
        catalogo,
      ),
    ).toBe('Privacidad y términos')
  })
})
