// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { categoriesFixture, plazasFixture } from '../../test/fixtures.ts'
import { FilterBar } from './FilterBar.tsx'

function setup(overrides: Partial<ComponentProps<typeof FilterBar>> = {}) {
  const props: ComponentProps<typeof FilterBar> = {
    categories: categoriesFixture,
    categoryCounts: new Map([
      ['desayunos-y-cafe', 2],
      ['tacos-y-antojitos', 1],
      ['pizza', 1],
    ]),
    totalCount: 4,
    activeCategoryId: null,
    onCategoryChange: vi.fn(),
    categoryHref: (id) => (id ? `/categoria/${id}` : '/'),
    plazas: plazasFixture,
    selectedPlazaId: null,
    onPlazaChange: vi.fn(),
    favoritesCount: 0,
    favoritesOnly: false,
    onToggleFavorites: vi.fn(),
    openNowCount: 0,
    openNowOnly: false,
    onToggleOpenNow: vi.fn(),
    filtersActive: false,
    onClear: vi.fn(),
    ...overrides,
  }
  render(<FilterBar {...props} />)
  return props
}

describe('FilterBar', () => {
  it('muestra categorías con su conteo y "Todo" activo por defecto', () => {
    setup()
    const chips = screen.getByRole('list', { name: 'Categorías' })
    expect(chips).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Todo/ })).toHaveAttribute('aria-current', 'true')
    /*
     * La cuenta va en el nombre del control, no dentro de él. En la pantalla se quitó por el mismo
     * motivo que en los interruptores: diecinueve cifras repetidas no dicen más que una, y el
     * número de lo que estás viendo ya lo dice la cabecera del panel, junto a la lista que cuenta.
     * Quien no ve la fila sí la necesita, porque no puede mirar cuál está llena.
     */
    const desayunos = screen.getByRole('link', { name: /Desayunos y café/ })
    expect(desayunos).toHaveAccessibleName('Desayunos y café 2')
    expect(desayunos).not.toHaveTextContent('2')
  })

  it('selecciona una categoría y al volver a pulsarla la quita', async () => {
    const props = setup()
    const enlace = screen.getByRole('link', { name: /Pizza/ })
    // Es un enlace de verdad: tiene su dirección, y un clic normal filtra sin recargar.
    expect(enlace).toHaveAttribute('href', '/categoria/pizza')
    await userEvent.click(enlace)
    expect(props.onCategoryChange).toHaveBeenCalledWith('pizza')

    const active = setup({ activeCategoryId: 'pizza' })
    const [, pizzaActive] = screen.getAllByRole('link', { name: /Pizza/ })
    expect(pizzaActive).toHaveAttribute('aria-current', 'true')
    // La elegida apunta a la vista sin categoría: pulsarla la quita.
    expect(pizzaActive).toHaveAttribute('href', '/')
    await userEvent.click(pizzaActive as HTMLElement)
    expect(active.onCategoryChange).toHaveBeenCalledWith(null)
  })

  it('filtra por plaza con la lista de zonas', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por zona' }))
    await userEvent.click(screen.getByRole('option', { name: 'Plaza Sur' }))
    expect(props.onPlazaChange).toHaveBeenCalledWith('plaza-sur')
  })

  it('la lista de zonas se recorre con el teclado', async () => {
    const props = setup({ selectedPlazaId: 'plaza-sur' })
    const boton = screen.getByRole('combobox', { name: 'Filtrar por zona' })
    expect(boton).toHaveAccessibleName('Filtrar por zona')
    expect(boton).toHaveTextContent('Plaza Sur')
    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(props.onPlazaChange).not.toHaveBeenCalled()
  })

  it('con una plaza elegida ofrece la salida', async () => {
    // Elegir plaza acota la lista igual que un filtro, así que tiene que poder deshacerse.
    setup({ selectedPlazaId: 'plaza-sur' })
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument()
  })

  it('la barra no repite el conteo de resultados', () => {
    // La cifra vive en la cabecera del panel, al lado de la lista que cuenta. Aquí estaba lejos de
    // su contenido y era la tercera copia del mismo número.
    setup({ filtersActive: true, activeCategoryId: 'pizza' })
    expect(screen.queryByText(/resultados?$/)).not.toBeInTheDocument()
  })

  it('con filtros activos permite limpiarlos', async () => {
    const props = setup({ filtersActive: true, activeCategoryId: 'pizza' })
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(props.onClear).toHaveBeenCalled()
  })

  it('oculta "Limpiar filtros" y favoritos cuando no aplican', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /Favoritos/ })).not.toBeInTheDocument()
  })

  it('muestra el filtro de favoritos cuando hay alguno guardado', async () => {
    const props = setup({ favoritesCount: 2 })
    await userEvent.click(screen.getByRole('switch', { name: /Favoritos/ }))
    expect(props.onToggleFavorites).toHaveBeenCalled()
  })
})

describe('el filtro de abiertos', () => {
  it('no se dibuja cuando no hay nada abierto', () => {
    // Una pastilla que no puede dar resultados estorba más de lo que ayuda. A las cuatro de la
    // mañana desaparece sola.
    setup({ openNowCount: 0 })
    expect(screen.queryByRole('switch', { name: /Abierto ahora/ })).not.toBeInTheDocument()
  })

  it('anuncia cuántos hay abiertos y se puede pulsar', async () => {
    const onToggleOpenNow = vi.fn()
    setup({ openNowCount: 7, onToggleOpenNow })
    /*
     * `switch` y no `button`: los dos síes o noes de la fila son ajustes que quedan puestos, no
     * botones que se quedan hundidos, y el papel que se anuncia tiene que decir cuál de las dos
     * cosas es.
     */
    const interruptor = screen.getByRole('switch', { name: /Abierto ahora/ })
    /*
     * La cuenta va en el nombre del control, y en ningún sitio más. El interruptor se quedó desnudo
     * (sin caja, sin rótulo y sin cifra): de un filtro lo que importa es si está puesto, y el
     * número de resultados se ve en la fila de abajo. Quien no ve la pantalla sí la recibe.
     */
    expect(interruptor).toHaveAccessibleName('Abierto ahora, 7')
    expect(interruptor).not.toHaveTextContent('7')
    expect(screen.queryByText('7')).not.toBeInTheDocument()
    expect(interruptor).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(interruptor)
    expect(onToggleOpenNow).toHaveBeenCalled()
  })

  it('sigue a la vista cuando está puesto, aunque el conteo baje a cero', () => {
    // Si desapareciera al cerrar el último local, no habría forma de quitarlo y la lista se
    // quedaría vacía sin explicación.
    setup({ openNowCount: 0, openNowOnly: true })
    expect(screen.getByRole('switch', { name: /Abierto ahora/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
