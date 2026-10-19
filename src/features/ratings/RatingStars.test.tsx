// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { localProfileSnapshot } from '../favorites/socialStats.ts'
import { RatingStars } from './RatingStars.tsx'

const stored = () => JSON.parse(window.localStorage.getItem('zibata:calificaciones') ?? '{}')

describe('RatingStars', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // El almacén cachea en memoria: se fuerza una relectura entre pruebas.
    window.dispatchEvent(new StorageEvent('storage', { key: 'zibata:calificaciones' }))
  })

  it('guarda la calificación en este dispositivo', async () => {
    render(<RatingStars placeId="cafe-aurora" placeName="Café Aurora" />)
    expect(screen.getByText('Califica este lugar')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('radio', { name: 'Calificar Café Aurora con 4 estrellas' }),
    )
    expect(stored()).toEqual({ 'cafe-aurora': 4 })
    expect(screen.getByText('Calificado con 4 estrellas')).toBeInTheDocument()
  })

  it('la mitad izquierda de una estrella pone el medio punto', async () => {
    render(<RatingStars placeId="cafe-aurora" placeName="Café Aurora" />)
    await userEvent.click(
      screen.getByRole('radio', { name: 'Calificar Café Aurora con 3,5 estrellas' }),
    )
    expect(stored()).toEqual({ 'cafe-aurora': 3.5 })
  })

  it('al enfocar un valor se ve qué nota caería, sin guardarla', async () => {
    render(<RatingStars placeId="cafe-aurora" placeName="Café Aurora" />)
    act(() => {
      screen.getByRole('radio', { name: 'Calificar Café Aurora con 2,5 estrellas' }).focus()
    })
    expect(screen.getByText('Calificar con 2,5 estrellas')).toBeInTheDocument()
    expect(stored()).toEqual({})
  })

  it('volver a pulsar la misma nota la quita', async () => {
    render(<RatingStars placeId="cafe-aurora" placeName="Café Aurora" />)
    const half = screen.getByRole('radio', { name: 'Calificar Café Aurora con 0,5 estrellas' })
    await userEvent.click(half)
    expect(stored()).toEqual({ 'cafe-aurora': 0.5 })
    await userEvent.click(half)
    expect(stored()).toEqual({})
  })

  it('la foto local incluye favoritos, calificaciones y visitas para una futura cuenta', async () => {
    render(<RatingStars placeId="cafe-aurora" placeName="Café Aurora" />)
    await userEvent.click(
      screen.getByRole('radio', { name: 'Calificar Café Aurora con 5 estrellas' }),
    )
    expect(localProfileSnapshot()).toEqual({
      favorites: [],
      ratings: { 'cafe-aurora': 5 },
      interactions: {},
      visits: {},
    })
  })
})
