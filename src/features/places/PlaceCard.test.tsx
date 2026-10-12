// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePlace } from '../../test/fixtures.ts'
import { renderWithCatalog } from '../../test/render.tsx'
import { PlaceCard } from './PlaceCard.tsx'

const allDay = {
  mon: ['00:00-24:00'],
  tue: ['00:00-24:00'],
  wed: ['00:00-24:00'],
  thu: ['00:00-24:00'],
  fri: ['00:00-24:00'],
  sat: ['00:00-24:00'],
  sun: ['00:00-24:00'],
}

describe('PlaceCard', () => {
  beforeEach(() => window.localStorage.clear())

  it('muestra nombre y categoría, y deja el número de local para la ficha', async () => {
    const place = makePlace({
      id: 'trigo',
      plazaId: 'plaza-sur',
      name: 'Trigo',
      giros: ['cafeteria'],
    })
    await renderWithCatalog(<PlaceCard place={place} onOpen={vi.fn()} />)
    expect(screen.getByText('Trigo')).toBeInTheDocument()
    expect(screen.getByText('Cafetería')).toBeInTheDocument()
    // Solo una minoría de locales publica su número: en la lista dejaría filas desiguales.
    expect(screen.queryByText(/Local 12/)).not.toBeInTheDocument()
  })

  it('nombra todos sus giros, en orden, y la plaza cuando corresponde', async () => {
    const place = makePlace({
      id: 'trigo',
      plazaId: 'plaza-sur',
      name: 'Trigo',
      giros: ['panaderia', 'cafeteria'],
    })
    await renderWithCatalog(<PlaceCard place={place} onOpen={vi.fn()} showPlaza />)
    expect(screen.getByText('Panadería · Cafetería')).toBeInTheDocument()
    expect(screen.getByText(/Plaza Sur/)).toBeInTheDocument()
  })

  it('en la lista, el icono es de los principales y los secundarios solo se leen', async () => {
    const place = makePlace({
      id: 'trigo',
      plazaId: 'plaza-sur',
      name: 'Trigo',
      giros: ['panaderia'],
      secundarios: ['cafeteria'],
    })
    const { container } = await renderWithCatalog(<PlaceCard place={place} onOpen={vi.fn()} />)
    // Los dos se nombran...
    expect(screen.getByText('Panadería · Cafetería')).toBeInTheDocument()
    // ...pero solo el principal lleva dibujo junto al texto.
    expect(container.querySelectorAll('[class*="category"] svg')).toHaveLength(1)
  })

  it('nombra los giros que caben en la línea y cuenta el resto', async () => {
    // "Panadería · Cafetería · Taquería" son treinta y dos letras y no entran en una línea de
    // teléfono: se nombran las dos que caben y la tercera se cuenta. El title las lleva todas.
    const place = makePlace({
      id: 'trigo',
      plazaId: 'plaza-sur',
      name: 'Trigo',
      giros: ['panaderia', 'cafeteria'],
      secundarios: ['taqueria'],
    })
    await renderWithCatalog(<PlaceCard place={place} onOpen={vi.fn()} />)
    expect(screen.getByText('Panadería · Cafetería')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.getByTitle('Panadería · Cafetería · Taquería')).toBeInTheDocument()
  })

  it('no muestra el estado de horario en la lista, ni con horario ni sin él', async () => {
    const withoutHours = makePlace({ id: 'a', plazaId: 'plaza-norte', name: 'Sin horario' })
    const { unmount } = await renderWithCatalog(<PlaceCard place={withoutHours} onOpen={vi.fn()} />)
    expect(screen.queryByText('Abierto')).not.toBeInTheDocument()
    expect(screen.queryByText('Cerrado')).not.toBeInTheDocument()
    unmount()

    const withHours = makePlace({
      id: 'b',
      plazaId: 'plaza-norte',
      name: 'Con horario',
      hours: allDay,
    })
    await renderWithCatalog(<PlaceCard place={withHours} onOpen={vi.fn()} />)
    expect(screen.queryByText('Abierto')).not.toBeInTheDocument()
  })

  it('abre el detalle al pulsar la tarjeta', async () => {
    const onOpen = vi.fn()
    const place = makePlace({ id: 'x', plazaId: 'plaza-norte', name: 'Pizzería Norte' })
    await renderWithCatalog(<PlaceCard place={place} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalles de Pizzería Norte' }))
    expect(onOpen).toHaveBeenCalledWith(place)
  })

  it('guarda y quita favoritos en este dispositivo', async () => {
    const place = makePlace({ id: 'x', plazaId: 'plaza-norte', name: 'Pizzería Norte' })
    await renderWithCatalog(<PlaceCard place={place} onOpen={vi.fn()} />)
    const favorite = screen.getByRole('button', { name: /Guardar en favoritos: Pizzería Norte/ })
    expect(favorite).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(favorite)
    expect(screen.getByRole('button', { name: /Quitar de favoritos/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(JSON.parse(window.localStorage.getItem('zibata:favoritos') ?? '[]')).toEqual(['x'])
    await userEvent.click(screen.getByRole('button', { name: /Quitar de favoritos/ }))
    expect(JSON.parse(window.localStorage.getItem('zibata:favoritos') ?? '[]')).toEqual([])
  })
})

describe('la marca de abierto', () => {
  const nunca = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  }

  it('un local abierto lleva su punto, con texto para quien no lo ve', async () => {
    const place = makePlace({ id: 'abre', plazaId: 'plaza-sur', name: 'Abre', hours: allDay })
    await renderWithCatalog(<PlaceCard place={place} onOpen={vi.fn()} />)
    expect(screen.getByText('Abierto ahora: Abre')).toBeInTheDocument()
  })

  it('un local cerrado lleva el suyo, y no dice "abierto"', async () => {
    const place = makePlace({ id: 'cierra', plazaId: 'plaza-sur', name: 'Cierra', hours: nunca })
    await renderWithCatalog(<PlaceCard place={place} onOpen={vi.fn()} />)
    expect(screen.getByText('Cerrado ahora: Cierra')).toBeInTheDocument()
    expect(screen.queryByText(/Abierto ahora/)).not.toBeInTheDocument()
  })

  it('un local sin horario no se da por cerrado: dice que no se sabe', async () => {
    // Es la distinción que justifica el tercer estado. Pintar de gris a los once sin horario sería
    // afirmar que están cerrados, y la guía no lo sabe.
    const place = makePlace({ id: 'sin', plazaId: 'plaza-sur', name: 'Sin' })
    await renderWithCatalog(<PlaceCard place={place} onOpen={vi.fn()} />)
    expect(screen.getByText('Sin horario publicado: Sin')).toBeInTheDocument()
    expect(screen.queryByText(/Abierto ahora/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cerrado ahora/)).not.toBeInTheDocument()
  })
})
