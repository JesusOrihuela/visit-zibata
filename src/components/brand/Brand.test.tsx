// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Brand } from './Brand.tsx'

describe('Brand', () => {
  it('separa el nombre del lema para los lectores de pantalla', () => {
    render(<Brand />)
    // Sin la coma oculta, NVDA leía el nombre y el lema pegados, de corrido.
    expect(screen.getByText(/Zibatá/).closest('p')?.textContent).toBe('Visit Zibatá, La guía local')
  })

  it('en modo compacto solo muestra el símbolo', () => {
    // Es el modo que se usa sobre el mapa: ahí el nombre lo lleva el <h1> oculto.
    render(<Brand compact />)
    expect(screen.queryByText(/La guía local/)).toBeNull()
    expect(screen.queryByText(/Visit Zibatá/)).toBeNull()
  })
})
