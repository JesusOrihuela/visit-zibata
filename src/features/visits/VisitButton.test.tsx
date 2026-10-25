// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarVisita, today, visitsStore } from './useVisits.ts'
import { VisitButton } from './VisitButton.tsx'

const stored = () => JSON.parse(window.localStorage.getItem('zibata:visitas') ?? '{}')

describe('VisitButton', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: 'zibata:visitas' }))
  })
  afterEach(() => {
    vi.useRealTimers()
    visitsStore.write(new Map())
  })

  it('sin visitas, invita a registrar la primera', () => {
    render(<VisitButton placeId="cafe-aurora" placeName="Café Aurora" />)
    expect(screen.getByText('Registra tu primera visita')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar visita a Café Aurora/ })).toBeVisible()
  })

  it('cuenta las visitas y dice cuándo fue la última', () => {
    registrarVisita('cafe-aurora', '2026-09-24')
    registrarVisita('cafe-aurora', '2026-10-12')
    render(<VisitButton placeId="cafe-aurora" placeName="Café Aurora" />)
    expect(screen.getByText(/Has venido 2 veces/)).toBeInTheDocument()
    expect(screen.getByText(/12 de octubre de 2026/)).toBeInTheDocument()
  })

  it('el historial se abre y cada fecha se puede quitar', async () => {
    registrarVisita('cafe-aurora', '2026-09-24')
    registrarVisita('cafe-aurora', '2026-10-12')
    render(<VisitButton placeId="cafe-aurora" placeName="Café Aurora" />)

    await userEvent.click(screen.getByRole('button', { name: 'Ver todas' }))
    const fechas = screen.getAllByRole('listitem').map((item) => item.textContent)
    // De la más reciente a la más antigua.
    expect(fechas[0]).toContain('12/Oct/2026')

    await userEvent.click(screen.getByRole('button', { name: /Quitar la visita del 12/ }))
    expect(stored()).toEqual({ 'cafe-aurora': ['2026-09-24'] })
  })

  it('cualquier día se registra, y el mismo día dos veces cuenta una', () => {
    registrarVisita('cafe-aurora', '2026-09-25')
    registrarVisita('cafe-aurora', '2026-09-24')
    registrarVisita('cafe-aurora', '2026-09-25')
    // Ordenadas y sin repetir: el orden personal lee la última como la más reciente.
    expect(stored()).toEqual({ 'cafe-aurora': ['2026-09-24', '2026-09-25'] })
  })

  it('"hoy" es el día de la persona, no el de UTC', () => {
    vi.useFakeTimers()
    // 23:30 en México (UTC-6) es el día siguiente en UTC: la visita cuenta como del día local.
    vi.setSystemTime(new Date('2026-09-26T05:30:00Z'))
    const local = new Date('2026-09-26T05:30:00Z')
    const expected = new Date(local.getTime() - local.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10)
    expect(today()).toBe(expected)
  })
})
