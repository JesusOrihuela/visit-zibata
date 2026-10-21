// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _colaParaPruebas, medicionPermitida, registrar, vaciar } from './eventos.ts'

/** Lo que `sendBeacon` recibió, ya leído como texto. */
const enviados: { ruta: string; cuerpo: string }[] = []

beforeEach(() => {
  _colaParaPruebas().length = 0
  enviados.length = 0
  document.documentElement.lang = 'es'
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: vi.fn((ruta: string, datos: string) => {
      enviados.push({ ruta, cuerpo: datos })
      return true
    }),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined })
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: null })
})

describe('registrar', () => {
  it('acumula sin enviar nada hasta que se vacía', () => {
    registrar('ficha', 'tomassa')
    registrar('salida', 'tomassa', 'whatsapp')
    expect(_colaParaPruebas()).toEqual([
      { tipo: 'ficha', destino: 'tomassa' },
      { tipo: 'salida', destino: 'tomassa', detalle: 'whatsapp' },
    ])
    expect(navigator.sendBeacon).not.toHaveBeenCalled()
  })

  it('al vaciar manda un solo envío con el idioma, a la ruta propia y sin nada más', async () => {
    registrar('ficha', 'tomassa')
    registrar('filtro', 'abierto-ahora')
    vaciar()
    await vi.waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]?.ruta).toBe('/api/evento')
    expect(JSON.parse(enviados[0]?.cuerpo ?? '')).toEqual({
      idioma: 'es',
      eventos: [
        { tipo: 'ficha', destino: 'tomassa' },
        { tipo: 'filtro', destino: 'abierto-ahora' },
      ],
    })
    expect(_colaParaPruebas()).toHaveLength(0)
  })

  it('el idioma del envío es el del documento', async () => {
    document.documentElement.lang = 'en'
    registrar('idioma', 'en')
    vaciar()
    await vi.waitFor(() => expect(enviados).toHaveLength(1))
    expect(JSON.parse(enviados[0]?.cuerpo ?? '').idioma).toBe('en')
  })

  it('manda en cuanto se juntan veinte', async () => {
    for (let i = 0; i < 20; i++) registrar('ficha', 'tomassa')
    await vi.waitFor(() => expect(enviados).toHaveLength(1))
    expect(JSON.parse(enviados[0]?.cuerpo ?? '').eventos).toHaveLength(20)
  })

  it('si sendBeacon falla o lo rechaza, sigue con fetch', async () => {
    const llamadas: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (ruta: string) => {
        llamadas.push(ruta)
        return new Response(null, { status: 204 })
      }),
    )
    for (const sendBeacon of [
      () => false,
      () => {
        throw new Error('bloqueado')
      },
    ]) {
      llamadas.length = 0
      Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon })
      registrar('ficha', 'tomassa')
      vaciar()
      await vi.waitFor(() => expect(llamadas).toEqual(['/api/evento']))
    }
    vi.unstubAllGlobals()
  })

  it('no manda nada si no hay nada', () => {
    vaciar()
    expect(navigator.sendBeacon).not.toHaveBeenCalled()
  })

  it('un fallo al enviar no lanza', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: () => {
        throw new Error('bloqueado')
      },
    })
    registrar('ficha', 'tomassa')
    expect(() => vaciar()).not.toThrow()
  })

  it('no toca cookies ni almacenamiento', async () => {
    const antes = { cookie: document.cookie, local: window.localStorage.length }
    registrar('ficha', 'tomassa')
    vaciar()
    await vi.waitFor(() => expect(enviados).toHaveLength(1))
    expect(document.cookie).toBe(antes.cookie)
    expect(window.localStorage.length).toBe(antes.local)
  })
})

describe('la señal de privacidad del navegador', () => {
  it('con globalPrivacyControl no se encola ni se envía nada', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    expect(medicionPermitida()).toBe(false)
    registrar('ficha', 'tomassa')
    vaciar()
    expect(_colaParaPruebas()).toHaveLength(0)
    expect(navigator.sendBeacon).not.toHaveBeenCalled()
  })

  it('con No rastrear tampoco', () => {
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' })
    expect(medicionPermitida()).toBe(false)
    registrar('ficha', 'tomassa')
    expect(_colaParaPruebas()).toHaveLength(0)
  })

  it('sin señal, se mide', () => {
    expect(medicionPermitida()).toBe(true)
  })
})
