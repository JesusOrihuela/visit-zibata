// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SocialStats } from './SocialStats.tsx'
import { setSocialStatsSource } from './socialStats.ts'

afterEach(() => setSocialStatsSource(null))

describe('SocialStats', () => {
  it('sin fuente registrada no dibuja nada (la guía estática de hoy)', () => {
    const { container } = render(<SocialStats placeId="cafe-aurora" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra los corazones, nunca una nota', () => {
    setSocialStatsSource({
      get: (placeId) => (placeId === 'cafe-aurora' ? { favorites: 12, empuje: 0.8 } : null),
    })
    render(<SocialStats placeId="cafe-aurora" />)
    expect(screen.getByText('12 personas lo guardaron')).toBeInTheDocument()
    // El empuje ordena, pero no es un número que se enseñe, y la media ni siquiera llega aquí.
    expect(screen.queryByText(/0\.8|4\.6|valoraciones/)).not.toBeInTheDocument()
  })

  it('no dibuja nada mientras el conteo no pase el umbral del servidor', () => {
    setSocialStatsSource({ get: () => ({ favorites: null, empuje: 0.3 }) })
    const { container } = render(<SocialStats placeId="cafe-aurora" />)
    expect(container).toBeEmptyDOMElement()
  })
})
