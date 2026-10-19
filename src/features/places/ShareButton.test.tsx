// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareButton } from './ShareButton.tsx'

const LUGAR = {
  name: 'Tomassa',
  slug: 'tomassa',
  giros: 'Pizzería · Italiana',
  plazaName: 'Plaza Luna',
}

function conNavegador(parches: Record<string, unknown>) {
  for (const [clave, valor] of Object.entries(parches)) {
    Object.defineProperty(navigator, clave, { value: valor, configurable: true, writable: true })
  }
}

afterEach(() => {
  for (const clave of ['share', 'clipboard']) Reflect.deleteProperty(navigator, clave)
  vi.restoreAllMocks()
})

describe('ShareButton', () => {
  it('comparte el nombre, los giros y la zona, con la URL canónica del lugar', async () => {
    const hoja = vi.fn().mockResolvedValue(undefined)
    conNavegador({ share: hoja })
    render(<ShareButton {...LUGAR} />)

    await userEvent.click(screen.getByRole('button', { name: 'Compartir Tomassa' }))
    const carga = hoja.mock.calls[0]?.[0]
    expect(carga.text).toBe('Tomassa · Pizzería · Italiana · Plaza Luna')
    expect(carga.url).toMatch(/\/lugar\/tomassa$/)
    expect(carga.url).not.toContain('#')
  })

  it('sin hoja del sistema copia el enlace y lo acusa donde estaba el dedo', async () => {
    conNavegador({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    render(<ShareButton {...LUGAR} />)

    await userEvent.click(screen.getByRole('button', { name: 'Compartir Tomassa' }))
    // El acuse es el propio botón, y se anuncia sin robar el foco.
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Copiado')
  })

  it('no se dibuja si el navegador no puede ni compartir ni copiar', () => {
    const { container } = render(<ShareButton {...LUGAR} />)
    expect(container).toBeEmptyDOMElement()
  })
})
