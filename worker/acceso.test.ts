import { afterEach, describe, expect, it, vi } from 'vitest'
import { CABECERA_ACCESS, cargaValida, olvidarClaves, puedeVerElPanel } from './acceso.ts'

const TEAM = 'zibata.cloudflareaccess.com'
const AUD = 'aud-de-la-aplicacion'
const AHORA = Date.UTC(2026, 9, 11, 12, 0, 0)

const carga = (extra: Record<string, unknown> = {}) => ({
  iss: `https://${TEAM}`,
  aud: [AUD],
  exp: Math.floor(AHORA / 1000) + 3600,
  ...extra,
})

const entorno = { ACCESS_TEAM: TEAM, ACCESS_AUD: AUD }
const con = (cabeceras: Record<string, string> = {}) =>
  new Request('https://visitzibata.com/api/panel', { headers: cabeceras })

afterEach(() => {
  olvidarClaves()
  vi.unstubAllGlobals()
})

describe('lo que dice el testigo, aparte de su firma', () => {
  it('acepta uno en regla', () => {
    expect(cargaValida(carga(), TEAM, AUD, AHORA)).toBe(true)
  })

  it('rechaza uno de otro equipo', () => {
    expect(cargaValida(carga({ iss: 'https://otro.cloudflareaccess.com' }), TEAM, AUD, AHORA)).toBe(
      false,
    )
  })

  it('rechaza uno para otra aplicación, aunque esté bien firmado', () => {
    // El fallo clásico de verificar solo la firma: cualquier aplicación del mismo equipo sirve.
    expect(cargaValida(carga({ aud: ['otra-aplicacion'] }), TEAM, AUD, AHORA)).toBe(false)
  })

  it('rechaza uno caducado o que todavía no vale', () => {
    expect(cargaValida(carga({ exp: Math.floor(AHORA / 1000) - 1 }), TEAM, AUD, AHORA)).toBe(false)
    expect(cargaValida(carga({ nbf: Math.floor(AHORA / 1000) + 60 }), TEAM, AUD, AHORA)).toBe(false)
  })

  it('rechaza uno sin caducidad, que no caducaría nunca', () => {
    const sinExp = carga()
    delete (sinExp as { exp?: number }).exp
    expect(cargaValida(sinExp, TEAM, AUD, AHORA)).toBe(false)
  })

  it('rechaza cualquier cosa que no sea una carga', () => {
    for (const malo of [null, 'texto', 42, []]) {
      expect(cargaValida(malo, TEAM, AUD, AHORA)).toBe(false)
    }
  })
})

describe('la puerta, de punta a punta', () => {
  it('sin configuración de Access no entra nadie', async () => {
    // Un despliegue a medias deja el panel cerrado, no abierto.
    expect(await puedeVerElPanel(con({ [CABECERA_ACCESS]: 'loquesea' }), {}, AHORA)).toBe(false)
    expect(
      await puedeVerElPanel(con({ [CABECERA_ACCESS]: 'x' }), { ACCESS_TEAM: TEAM }, AHORA),
    ).toBe(false)
  })

  it('sin cabecera no entra nadie', async () => {
    expect(await puedeVerElPanel(con(), entorno, AHORA)).toBe(false)
  })

  it('una cabecera inventada ya no vale, que era el agujero', async () => {
    // Antes bastaba con que la cabecera existiera. Si Access no cubre esta ruta exacta, o si el
    // Worker se sirve en workers.dev, quien hace la petición la escribe él mismo.
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await puedeVerElPanel(con({ [CABECERA_ACCESS]: 'inventado' }), entorno, AHORA)).toBe(
      false,
    )
    // Ni siquiera se molesta en pedir el JWKS: no tiene tres partes.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza un algoritmo que no sea RS256, sin pedir las claves', async () => {
    // "alg: none" y el cambio a HMAC son los dos agujeros de libro: quien manda el testigo elegiría
    // cómo se comprueba.
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const trozo = (valor: unknown) =>
      btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    for (const alg of ['none', 'HS256']) {
      const testigo = `${trozo({ alg, kid: 'k1' })}.${trozo(carga())}.firma`
      expect(await puedeVerElPanel(con({ [CABECERA_ACCESS]: testigo }), entorno, AHORA)).toBe(false)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('si el JWKS no responde, no se abre la puerta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))
    const trozo = (valor: unknown) =>
      btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const testigo = `${trozo({ alg: 'RS256', kid: 'k1' })}.${trozo(carga())}.firma`
    expect(await puedeVerElPanel(con({ [CABECERA_ACCESS]: testigo }), entorno, AHORA)).toBe(false)
  })

  it('la salida de desarrollo es una variable explícita, no el nombre de host', async () => {
    // Antes era `hostname === 'localhost'`, que depende de qué nombre llega al Worker. Ahora hay que
    // pedirlo a mano, y en producción esa variable no existe.
    expect(await puedeVerElPanel(con(), { PANEL_ABIERTO: 'si' }, AHORA)).toBe(true)
    expect(await puedeVerElPanel(con(), { PANEL_ABIERTO: 'no' }, AHORA)).toBe(false)
  })
})

describe('un testigo firmado de verdad', () => {
  it('pasa con su clave, y no pasa si se le toca un bit', async () => {
    const par = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )
    const jwk = await crypto.subtle.exportKey('jwk', par.publicKey)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ keys: [{ ...jwk, kid: 'k1' }] }) }),
    )
    const trozo = (valor: unknown) =>
      btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const sinFirmar = `${trozo({ alg: 'RS256', kid: 'k1' })}.${trozo(carga())}`
    const firma = new Uint8Array(
      await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        par.privateKey,
        new TextEncoder().encode(sinFirmar),
      ),
    )
    const enBase64url = btoa(String.fromCharCode(...firma))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    expect(
      await puedeVerElPanel(
        con({ [CABECERA_ACCESS]: `${sinFirmar}.${enBase64url}` }),
        entorno,
        AHORA,
      ),
    ).toBe(true)

    olvidarClaves()
    const rota = `${enBase64url.slice(0, -4)}AAAA`
    expect(
      await puedeVerElPanel(con({ [CABECERA_ACCESS]: `${sinFirmar}.${rota}` }), entorno, AHORA),
    ).toBe(false)
  })
})
