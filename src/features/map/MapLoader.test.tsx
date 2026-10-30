// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MapLoader } from './MapLoader.tsx'

/**
 * La espera del mapa no puede ser un parpadeo: si el mapa llega antes de 400 ms, el indicador no se
 * enseña. Y lo que se anuncia a quien escucha es el estado, una vez, no la frase que va cambiando.
 */
describe('MapLoader', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('no se enseña en el primer parpadeo', () => {
    const { container } = render(<MapLoader visible />)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('aparece pasados 400 ms con el estado para quien escucha', () => {
    render(<MapLoader visible />)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const estado = screen.getByRole('status')
    expect(estado.textContent).toContain('Cargando Zibatá')
  })

  it('la frase que cambia no se anuncia', () => {
    const { container } = render(<MapLoader visible />)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(container.querySelector('p')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('si el mapa no llegó a cargar, nunca se enseña', () => {
    const { container } = render(<MapLoader visible={false} />)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(container.querySelector('[role="status"]')).toBeNull()
  })
})
