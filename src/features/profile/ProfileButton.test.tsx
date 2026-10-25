// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithCatalog } from '../../test/render.tsx'
import { favoritesStore } from '../favorites/useFavorites.ts'
import { interactionsStore } from '../ranking/preferences.ts'
import { ratingsStore } from '../ratings/useRatings.ts'
import { today, visitsStore } from '../visits/useVisits.ts'
import { ProfileButton } from './ProfileButton.tsx'

afterEach(() => {
  favoritesStore.write(new Set())
  ratingsStore.write(new Map())
  interactionsStore.write(new Map())
  visitsStore.write(new Map())
})

/** La hoja viaja en su propio trozo de JS: se espera a que cargue, como en el navegador. */
const openSheet = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Tu Zibatá' }))
  return screen.findByRole('dialog', { name: 'Tu Zibatá' })
}

describe('ProfileButton', () => {
  it('sin nada hecho invita a empezar y no inventa cifras ni antojos', async () => {
    // Abrir fichas no es haber ido: con solo eso, la hoja sigue vacía.
    interactionsStore.write(new Map([['cafe-aurora', { opens: 4, lastOpenedAt: Date.now() }]]))
    await renderWithCatalog(<ProfileButton onOpenInfo={vi.fn()} onOpenPlace={vi.fn()} />)
    const sheet = await openSheet()
    expect(within(sheet).getByText(/aquí verás tu paso por Zibatá/)).toBeInTheDocument()
    expect(within(sheet).queryByText('Tu paso por Zibatá')).not.toBeInTheDocument()
    expect(within(sheet).queryByText('Lo que más se te antoja')).not.toBeInTheDocument()
  })

  it('resume el paso por Zibatá y marca las zonas estrenadas, sin convertirlas en botones', async () => {
    visitsStore.write(
      new Map([
        ['cafe-aurora', ['2026-09-20', today()]],
        ['tacos-el-farol', [today()]],
      ]),
    )
    await renderWithCatalog(<ProfileButton onOpenInfo={vi.fn()} onOpenPlace={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Tu Zibatá' })).toHaveAttribute('data-active', 'true')
    const sheet = await openSheet()
    // Las dos visitas son de Plaza Norte: queda Plaza Sur por estrenar.
    expect(
      within(sheet).getByText('Has visitado 2 lugares de Zibatá, en 1 de sus 2 zonas.'),
    ).toBeInTheDocument()
    const zonas = within(sheet).getByRole('list', { name: 'Zonas de Zibatá' })
    const marcadas = within(zonas)
      .getAllByRole('listitem')
      .map((item) => [item.textContent, item.dataset.visited])
    expect(marcadas).toEqual([
      ['Norte, estrenada', 'true'],
      ['Sur', 'false'],
    ])
    expect(within(zonas).queryAllByRole('button')).toHaveLength(0)
  })

  it('elige tus tres sin enseñar el criterio que los ordena', async () => {
    ratingsStore.write(
      new Map([
        ['panaderia-trigo', 5],
        ['cafe-aurora', 3],
      ]),
    )
    visitsStore.write(new Map([['tacos-el-farol', ['2026-09-01', '2026-09-02']]]))
    favoritesStore.write(new Set(['pizza-norte']))
    await renderWithCatalog(<ProfileButton onOpenInfo={vi.fn()} onOpenPlace={vi.fn()} />)
    const sheet = await openSheet()

    const bloque = within(sheet)
      .getByRole('heading', { name: 'Tus tres de siempre' })
      .closest('section') as HTMLElement
    // `link` y no `button`: cada columna del podio lleva a la ficha de ese lugar, que tiene
    // dirección propia, así que es un enlace de verdad y se anuncia como tal.
    const filas = within(bloque).getAllByRole('link')
    // Primero las notas (5 y 3), luego las visitas; el favorito sin nota ni visitas se queda fuera.
    expect(filas).toHaveLength(3)
    expect(filas[0]).toHaveAccessibleName('Puesto 1. Ver detalles de Trigo')
    expect(filas[1]).toHaveAccessibleName('Puesto 2. Ver detalles de Café Aurora')
    expect(filas[2]).toHaveAccessibleName('Puesto 3. Ver detalles de Tacos El Farol')
    // Lo que se ve es el lugar, sus giros y el puesto: ni notas, ni visitas, ni la plaza.
    expect(filas[0]).toHaveTextContent('Trigo')
    expect(filas[0]).toHaveTextContent('Panadería')
    expect(bloque).not.toHaveTextContent('2 visitas')
    expect(bloque).not.toHaveTextContent('Plaza Sur')
  })

  it('un lugar de la hoja abre su ficha, y los enlaces llevan a las páginas de la guía', async () => {
    favoritesStore.write(new Set(['cafe-aurora']))
    const onOpenPlace = vi.fn()
    const onOpenInfo = vi.fn()
    await renderWithCatalog(<ProfileButton onOpenInfo={onOpenInfo} onOpenPlace={onOpenPlace} />)
    const sheet = await openSheet()

    await userEvent.click(
      within(sheet).getByRole('link', { name: 'Puesto 1. Ver detalles de Café Aurora' }),
    )
    expect(onOpenPlace).toHaveBeenCalledWith(expect.objectContaining({ id: 'cafe-aurora' }))

    await openSheet()
    await userEvent.click(screen.getByRole('link', { name: 'Sugiere o contacta' }))
    expect(onOpenInfo).toHaveBeenCalledWith('sugerir')
  })
})
