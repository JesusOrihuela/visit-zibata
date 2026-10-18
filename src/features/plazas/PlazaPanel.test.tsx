// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { catalogFixture, placesFixture, plazasFixture } from '../../test/fixtures.ts'
import { renderWithCatalog } from '../../test/render.tsx'
import { countByCategory } from '../filters/filters.ts'
import { PlazaPanel } from './PlazaPanel.tsx'

const catalog = catalogFixture()
const plaza = plazasFixture[0] as (typeof plazasFixture)[number]
const plazaPlaces = placesFixture.filter((place) => place.plazaId === plaza.id && place.active)

async function setup(overrides: Partial<Parameters<typeof PlazaPanel>[0]> = {}) {
  const props = {
    plaza,
    places: plazaPlaces,
    categoryCounts: countByCategory(plazaPlaces, catalog),
    filtersActive: false,
    activeCategoryId: null,
    onCategoryChange: vi.fn(),
    onClearFilters: vi.fn(),
    onOpenPlace: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  await renderWithCatalog(<PlazaPanel {...props} />)
  return props
}

describe('PlazaPanel', () => {
  it('muestra nombre, descripción, número de lugares, categorías y lista', async () => {
    await setup()
    expect(screen.getByRole('heading', { level: 2, name: 'Plaza Norte' })).toBeInTheDocument()
    expect(screen.getByText('Plaza de prueba')).toBeInTheDocument()
    expect(screen.getByText(/Zona · 3 lugares/)).toBeInTheDocument()
    const categories = screen.getByRole('list', { name: 'Categorías' })
    expect(within(categories).getAllByRole('button')).toHaveLength(4)
    // El índice es una sola lista: el horario ordena pero ya no parte. Lo que se fija aquí es que
    // estén los tres lugares, en el orden en que queden.
    const indice = screen.getByRole('list', { name: /lugares/i })
    expect(within(indice).getAllByRole('listitem')).toHaveLength(3)
  })

  it('mueve el foco al título para lectores de pantalla', async () => {
    await setup()
    // El foco se mueve en un efecto, así que hay que esperarlo: comprobarlo a secas pasa aquí y
    // falla en una máquina cargada, que es exactamente lo que hizo en CI.
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toHaveFocus())
  })

  it('las pastillas anuncian los conteos con los filtros vigentes, no el total de la plaza', async () => {
    // Búsqueda activa que solo deja un lugar de tacos en la plaza.
    const tacos = plazaPlaces.filter((place) => place.giros.includes('taqueria'))
    await setup({
      places: tacos,
      categoryCounts: countByCategory(tacos, catalog),
      filtersActive: true,
    })
    const chips = within(screen.getByRole('list', { name: 'Categorías' }))
    expect(chips.getByRole('button', { name: /^Todo/ })).toHaveTextContent('Todo1')
    expect(chips.getByRole('button', { name: /Tacos y antojitos/ })).toHaveTextContent(/1$/)
    expect(chips.getByRole('button', { name: /Pizza/ })).not.toHaveTextContent(/\d$/)
  })

  it('filtra por categoría dentro de la plaza', async () => {
    const props = await setup()
    await userEvent.click(screen.getByRole('button', { name: /Tacos y antojitos/ }))
    expect(props.onCategoryChange).toHaveBeenCalledWith('tacos-y-antojitos')
  })

  it('abre la ficha de un lugar', async () => {
    const props = await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalles de Café Aurora' }))
    expect(props.onOpenPlace).toHaveBeenCalledWith(expect.objectContaining({ id: 'cafe-aurora' }))
  })

  it('muestra un estado vacío cuando los filtros no dejan resultados', async () => {
    const props = await setup({ places: [], filtersActive: true })
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver todos los lugares de la zona' }))
    expect(props.onClearFilters).toHaveBeenCalled()
  })

  it('ofrece cómo llegar a la plaza y cerrar el panel', async () => {
    const props = await setup()
    const link = screen.getByRole('link', { name: /Cómo llegar a la zona/ })
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.google.com/maps/dir/?api=1'),
    )
    expect(link).toHaveAttribute('target', '_blank')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar panel' }))
    expect(props.onClose).toHaveBeenCalled()
  })
})
