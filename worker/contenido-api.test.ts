import { describe, expect, it } from 'vitest'
import { atenderApi, type EntornoApi } from './api.ts'
import type { Base } from './cuenta.ts'

/*
 * En desarrollo `PANEL_ABIERTO` salta Access y no hay testigo de GitHub, así que el contenido se
 * valida contra los datos del bundle y no se commitea. Es justo el camino que se puede probar sin
 * red ni credenciales.
 */
const entorno = { PANEL_ABIERTO: 'si', ANALITICA: {} as Base } as EntornoApi

const pedir = (ruta: string, init?: RequestInit) =>
  atenderApi(new Request(`https://visitzibata.com${ruta}`, init), entorno)

const negocio = {
  nombre: 'Panadería de prueba',
  plazaId: 'paseo-zibata',
  giros: ['cafeteria'],
  descripcionEs: 'Una panadería de prueba.',
  descripcionEn: 'A test bakery.',
  activo: true,
}

describe('la API de contenido', () => {
  it('devuelve el catálogo para el formulario', async () => {
    const respuesta = await pedir('/api/panel/contenido')
    expect(respuesta?.status).toBe(200)
    const datos = (await respuesta?.json()) as { seco: boolean; places: unknown[] }
    expect(datos.seco).toBe(true)
    expect(datos.places.length).toBeGreaterThan(0)
  })

  it('acepta un negocio válido y lo deja en seco en desarrollo', async () => {
    const respuesta = await pedir('/api/panel/contenido/negocio', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify(negocio),
    })
    expect(respuesta?.status).toBe(200)
    const datos = (await respuesta?.json()) as {
      ok: boolean
      seco: boolean
      negocio: { id: string }
    }
    expect(datos.ok).toBe(true)
    expect(datos.seco).toBe(true)
    expect(datos.negocio.id).toBe('panaderia-de-prueba')
  })

  it('rechaza un negocio inválido sin tocar GitHub', async () => {
    const respuesta = await pedir('/api/panel/contenido/negocio', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ ...negocio, giros: [] }),
    })
    expect(respuesta?.status).toBe(400)
  })

  it('la escritura exige que la petición salga del propio sitio', async () => {
    const respuesta = await pedir('/api/panel/contenido/negocio', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify(negocio),
    })
    expect(respuesta?.status).toBe(403)
  })

  it('sin la puerta de Access no se lee el contenido', async () => {
    const respuesta = await atenderApi(new Request('https://visitzibata.com/api/panel/contenido'), {
      ANALITICA: {} as Base,
    })
    expect(respuesta?.status).toBe(403)
  })
})

describe('la API de categorías', () => {
  const categorias = async () => {
    const respuesta = await pedir('/api/panel/contenido')
    const datos = (await respuesta?.json()) as { categories: Record<string, unknown>[] }
    return datos.categories
  }

  it('acepta una taxonomía válida y contesta con su impacto', async () => {
    const lista = await categorias()
    const respuesta = await pedir('/api/panel/contenido/categorias', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ categories: lista }),
    })
    expect(respuesta?.status).toBe(200)
    const datos = (await respuesta?.json()) as {
      ok: boolean
      seco: boolean
      afectados: { locales: number; plazas: number }
    }
    expect(datos.ok).toBe(true)
    expect(datos.seco).toBe(true)
    expect(datos.afectados).toEqual({ locales: 0, plazas: 0 })
  })

  it('rechaza una categoría sin tono', async () => {
    const lista = await categorias()
    const primera = lista.find((categoria) => categoria.id !== 'otros')
    if (!primera) throw new Error('sin categoría')
    primera.hue = null
    const respuesta = await pedir('/api/panel/contenido/categorias', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ categories: lista }),
    })
    expect(respuesta?.status).toBe(400)
  })

  it('la escritura exige que la petición salga del propio sitio', async () => {
    const respuesta = await pedir('/api/panel/contenido/categorias', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify({ categories: [] }),
    })
    expect(respuesta?.status).toBe(403)
  })
})
