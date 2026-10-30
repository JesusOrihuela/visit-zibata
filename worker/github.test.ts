import { afterEach, describe, expect, it, vi } from 'vitest'
import { leerArchivo, prAbierta, publicar } from './github.ts'

const REPO = 'aurariola-studio/visit-zibata'
const entorno = {
  GITHUB_REPO: REPO,
  // Un valor de mentira, no un testigo: que no parezca una credencial ni en el escaneo de secretos.
  GITHUB_TOKEN: 'testigo-falso',
  GITHUB_RAMA: 'panel-contenido',
}

interface Llamada {
  metodo: string
  ruta: string
  cuerpo?: Record<string, unknown>
  autorizacion?: string | null
}

const respuesta = (datos: unknown, estado = 200): Response =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  })

/** Un GitHub de mentira que contesta lo justo y apunta las llamadas. */
function montar(opciones: { rama?: boolean; pr?: boolean } = {}) {
  const llamadas: Llamada[] = []
  let blobs = 0

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const ruta = String(url).replace(`https://api.github.com/repos/${REPO}`, '')
      const metodo = init?.method ?? 'GET'
      const cuerpo = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined
      llamadas.push({
        metodo,
        ruta,
        cuerpo,
        autorizacion: new Headers(init?.headers).get('authorization'),
      })

      if (metodo === 'GET' && ruta === '/git/ref/heads/main') {
        return respuesta({ object: { sha: 'main-sha' } })
      }
      if (metodo === 'GET' && ruta === '/git/ref/heads/panel-contenido') {
        return opciones.rama
          ? respuesta({ object: { sha: 'rama-sha' } })
          : respuesta({ message: 'Not Found' }, 404)
      }
      if (metodo === 'GET' && ruta.startsWith('/pulls?state=open')) {
        return respuesta(
          opciones.pr ? [{ number: 74, html_url: 'https://github.com/x/y/pull/74' }] : [],
        )
      }
      if (metodo === 'GET' && ruta === '/git/commits/main-sha') {
        return respuesta({ tree: { sha: 'arbol-main' } })
      }
      if (metodo === 'GET' && ruta === '/git/commits/rama-sha') {
        return respuesta({ tree: { sha: 'arbol-rama' } })
      }
      if (metodo === 'GET' && ruta.startsWith('/contents/')) {
        return respuesta({ content: Buffer.from('hola').toString('base64'), encoding: 'base64' })
      }
      if (metodo === 'POST' && ruta === '/git/blobs') {
        blobs += 1
        return respuesta({ sha: `blob-${blobs}` })
      }
      if (metodo === 'POST' && ruta === '/git/trees') return respuesta({ sha: 'arbol-nuevo' })
      if (metodo === 'POST' && ruta === '/git/commits') return respuesta({ sha: 'commit-nuevo' })
      if (metodo === 'PATCH' && ruta === '/git/refs/heads/panel-contenido') {
        return respuesta({ object: { sha: 'x' } })
      }
      if (metodo === 'POST' && ruta === '/git/refs') return respuesta({ ref: 'x' }, 201)
      if (metodo === 'POST' && ruta === '/pulls') {
        return respuesta({ number: 74, html_url: 'https://github.com/a/b/pull/74' }, 201)
      }
      return respuesta({ message: `sin ruta ${metodo} ${ruta}` }, 500)
    }),
  )

  return { llamadas }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('publicar', () => {
  it('abre la rama, commitea los dos archivos y crea la PR', async () => {
    const { llamadas } = montar()
    const resultado = await publicar(
      entorno,
      [
        { ruta: 'data/commercial/places.json', contenido: '{}' },
        { ruta: 'data/commercial/plazas.json', contenido: '{}' },
      ],
      'Panel: nuevo negocio "Prueba"',
    )

    expect(resultado).toEqual({
      url: 'https://github.com/a/b/pull/74',
      numero: 74,
      creada: true,
    })
    expect(llamadas.filter((llamada) => llamada.ruta === '/git/blobs')).toHaveLength(2)
    expect(
      llamadas.some((llamada) => llamada.metodo === 'POST' && llamada.ruta === '/git/refs'),
    ).toBe(true)
    expect(llamadas.some((llamada) => llamada.metodo === 'POST' && llamada.ruta === '/pulls')).toBe(
      true,
    )
    expect(llamadas[0]?.autorizacion).toBe('Bearer testigo-falso')
  })

  it('si ya hay PR abierta, añade el commit y no abre otra', async () => {
    const { llamadas } = montar({ rama: true, pr: true })
    const resultado = await publicar(
      entorno,
      [{ ruta: 'a.json', contenido: '{}' }],
      'Panel: editar',
    )

    expect(resultado.creada).toBe(false)
    expect(resultado.numero).toBe(74)
    expect(llamadas.some((llamada) => llamada.metodo === 'POST' && llamada.ruta === '/pulls')).toBe(
      false,
    )
    expect(
      llamadas.some(
        (llamada) =>
          llamada.metodo === 'PATCH' && llamada.ruta === '/git/refs/heads/panel-contenido',
      ),
    ).toBe(true)
  })

  it('si la rama quedó de una PR cerrada, la reinicia desde main antes de commitear', async () => {
    const { llamadas } = montar({ rama: true, pr: false })
    const resultado = await publicar(
      entorno,
      [{ ruta: 'a.json', contenido: '{}' }],
      'Panel: editar',
    )

    expect(resultado.creada).toBe(true)
    const parches = llamadas.filter(
      (llamada) => llamada.metodo === 'PATCH' && llamada.ruta === '/git/refs/heads/panel-contenido',
    )
    expect(parches).toHaveLength(2)
    expect(parches[0]?.cuerpo).toEqual({ sha: 'main-sha', force: true })
    expect(parches[1]?.cuerpo).toEqual({ sha: 'commit-nuevo', force: true })
  })
})

describe('leer el contenido', () => {
  it('decodifica el base64 que devuelve GitHub', async () => {
    montar()
    await expect(leerArchivo(entorno, 'data/commercial/places.json', 'main')).resolves.toBe('hola')
  })

  it('sin PR abierta no hay nada que devolver', async () => {
    montar({ pr: false })
    await expect(prAbierta(entorno)).resolves.toBeNull()
  })

  it('con PR abierta devuelve su enlace y su número', async () => {
    montar({ pr: true })
    await expect(prAbierta(entorno)).resolves.toEqual({
      url: 'https://github.com/x/y/pull/74',
      numero: 74,
      creada: false,
    })
  })
})
