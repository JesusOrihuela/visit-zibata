// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SuggestForm } from './SuggestForm.tsx'

/*
 * La prueba de trabajo se simula: con el módulo de verdad, cada envío buscaría un sello a base de
 * hashes y la suite tardaría minutos. Que el sello sea válido y valga una sola vez se comprueba en
 * worker/sugerencias.test.ts y en src/lib/prueba-de-trabajo.test.ts.
 */
const SELLO = 'sello-de-prueba-que-no-vale-nada-aaaaaaaaaa'
vi.mock('../../lib/prueba-de-trabajo.ts', () => ({ secretoConPrueba: async () => SELLO }))

describe('SuggestForm', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('envía a nuestro propio servidor, sin salir del origen', async () => {
    // Desde la v4.18 no hay tercero: usar la guía entera no hace ni una petición fuera.
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    render(<SuggestForm />)

    // Escribe quien sea: aquí, el propio negocio, y eso viaja con el mensaje.
    await userEvent.click(screen.getByRole('radio', { name: 'Negocio' }))
    await userEvent.type(screen.getByLabelText(/Lugar o zona/), 'Tomassa')
    await userEvent.type(screen.getByLabelText(/Tu mensaje/), 'Cambió el horario')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/sugerencia')
    expect(url).not.toMatch(/^https?:/)
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      quien: 'negocio',
      lugar: 'Tomassa',
      mensaje: 'Cambió el horario',
      sello: SELLO,
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/Gracias/)
  })

  it('no manda ninguna clave de terceros', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    render(<SuggestForm />)
    await userEvent.type(screen.getByLabelText(/Tu mensaje/), 'Hola')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(init.body)).not.toContain('access_key')
  })

  it('el campo trampa existe, no lo alcanza ninguna persona y descarta el envío', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { container } = render(<SuggestForm />)

    const trampa = container.querySelector<HTMLInputElement>('input[name="botcheck"]')
    expect(trampa).not.toBeNull()
    // Fuera del tabulador, y con etiqueta propia: quien lo encuentre sabe que debe dejarlo en blanco.
    expect(trampa?.tabIndex).toBe(-1)
    expect(screen.getByLabelText('No rellenes este campo')).toBe(trampa)

    // Un robot que rellena todos los campos también rellena este, y entonces no se envía nada.
    await userEvent.type(screen.getByLabelText(/Tu mensaje/), 'Compra seguidores baratos')
    await userEvent.type(trampa as HTMLInputElement, 'http://spam.example')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(fetchMock).not.toHaveBeenCalled()
    // Ve el mismo acuse que si hubiera funcionado: no aprende que se le descartó.
    expect(await screen.findByRole('status')).toHaveTextContent(/Gracias/)
  })

  it('no envía nada sin decir qué cambia', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<SuggestForm />)

    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('Escribe tu mensaje.')).toBeInTheDocument()
  })

  it('si el servidor falla, lo dice y no finge que se envió', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    render(<SuggestForm />)
    await userEvent.type(screen.getByLabelText(/Tu mensaje/), 'Hola')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
