/**
 * La API de la guía. Hoy solo da identidad; los datos vienen después (ver docs/CUENTAS.md).
 *
 * Todo lo que sale de aquí es `Cache-Control: no-store`: son respuestas de una persona concreta y no
 * tienen nada que hacer en una caché compartida.
 *
 * Dos cosas que no hay y que conviene que se note: no hay endpoint de lectura de nada ajeno, y no
 * hay cookies. La identidad viaja en una cabecera que el navegador manda a propósito, no en algo que
 * se adjunte solo a cada petición.
 */
import { base64url, cumpleLaPrueba, digestDe } from '../src/lib/prueba-de-trabajo.ts'
import { ALTA, type Base, huella, nuevaCuenta, RESOLVER, secretoDe } from './cuenta.ts'
import {
  ANADIR,
  CUANTOS_TIENE,
  cambioDe,
  EDAD_MINIMA_MS,
  MAXIMO_POR_CUENTA,
  MIOS,
  QUITAR,
} from './favoritos.ts'
import {
  calificacionesDe,
  MARCAR_VISITA,
  MIS_NOTAS,
  MIS_VISITAS,
  OLVIDAR_VISITAS,
  PONER_NOTA,
  QUITAR_NOTA,
  visitasDe,
} from './marcas.ts'
import {
  CONTEO_CORAZONES,
  CONTEO_NOTAS,
  type FilaCorazones,
  type FilaNotas,
  senalesDe,
} from './senales.ts'

export interface EntornoApi {
  ANALITICA?: Base
}

/** El cuerpo como JSON, o `undefined` si no lo es. Quien llama ya rechaza lo que no reconoce. */
async function cuerpoDe(peticion: Request): Promise<unknown> {
  try {
    return await peticion.json()
  } catch {
    return undefined
  }
}

const json = (datos: unknown, estado = 200, cache = 'no-store'): Response =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  })

/** La cuenta de quien hace esta petición, o `null` si no trae una credencial que exista. */
export async function cuentaDe(peticion: Request, base: Base): Promise<string | null> {
  const secreto = secretoDe(peticion.headers)
  if (!secreto) return null
  const fila = await base
    .prepare(RESOLVER)
    .bind('dispositivo', await huella(secreto))
    .first<{ cuenta_id: string }>()
  return fila?.cuenta_id ?? null
}

/**
 * Atiende `/api/*`, o devuelve `null` si la ruta no es suya (y entonces se sirve el archivo).
 *
 * Devolver `null` en vez de un 404 es lo que deja convivir la API con los 232 archivos del sitio sin
 * que ninguna de las dos tenga que saber de la otra.
 */
export async function atenderApi(peticion: Request, entorno: EntornoApi): Promise<Response | null> {
  const ruta = new URL(peticion.url).pathname
  if (!ruta.startsWith('/api/')) return null

  // Sin base no hay identidad posible. Se dice, en vez de fallar de una forma rara.
  if (!entorno.ANALITICA) return json({ error: 'sin base de datos' }, 503)

  /*
   * El alta. El secreto lo trae el navegador, no lo reparte el servidor, porque es él quien tuvo que
   * buscarlo hasta que su huella empezó por ceros (ver src/lib/prueba-de-trabajo.ts). Aquí solo se
   * comprueba, que es un hash.
   *
   * Que cada prueba valga una sola vez sale gratis: la huella es la clave primaria de `credencial`,
   * así que repetir un secreto ya usado choca contra el índice y no crea nada. Sin tabla de sellos,
   * sin caducidades y sin limpieza periódica.
   */
  if (ruta === '/api/cuenta' && peticion.method === 'POST') {
    const secreto = secretoDe(peticion.headers)
    if (!secreto) return json({ error: 'falta el secreto' }, 400)
    const digest = await digestDe(secreto)
    if (!cumpleLaPrueba(digest)) return json({ error: 'prueba de trabajo no válida' }, 403)
    const sujeto = base64url(digest)
    const id = nuevaCuenta()
    const ahora = new Date().toISOString()
    try {
      await entorno.ANALITICA.batch([
        entorno.ANALITICA.prepare(ALTA[0]).bind(id, ahora),
        entorno.ANALITICA.prepare(ALTA[1]).bind('dispositivo', sujeto, id, ahora),
      ])
    } catch {
      // Casi siempre es la huella repetida, que es la prueba reutilizada. No se distingue a propósito:
      // decir cuál de los dos fue solo le sirve a quien lo está intentando.
      return json({ error: 'no se pudo crear la cuenta' }, 409)
    }
    return json({ ok: true }, 201)
  }

  if (ruta === '/api/cuenta' && peticion.method === 'GET') {
    const cuenta = await cuentaDe(peticion, entorno.ANALITICA)
    return cuenta ? json({ cuenta }) : json({ error: 'sin cuenta' }, 401)
  }

  /*
   * El conteo público. Es lo único de esta API que no lleva identidad y lo único que se cachea: lo
   * pide cada visita y cambia despacio, así que cinco minutos de caché en el navegador ahorran casi
   * todas las consultas sin que nadie note el retraso.
   *
   * Sin `caches.default`: es una extensión de Cloudflare que obligaría a traer sus tipos enteros, y
   * a esta escala una consulta por visita a D1 no se nota (el plan gratuito da millones al día).
   */
  if (ruta === '/api/senales' && peticion.method === 'GET') {
    const limite = new Date(Date.now() - EDAD_MINIMA_MS).toISOString()
    const [corazones, notas] = await Promise.all([
      entorno.ANALITICA.prepare(CONTEO_CORAZONES).bind(limite).all<FilaCorazones>(),
      entorno.ANALITICA.prepare(CONTEO_NOTAS).bind(limite).all<FilaNotas>(),
    ])
    return json(senalesDe(corazones.results ?? [], notas.results ?? []), 200, 'public, max-age=300')
  }

  // A partir de aquí hace falta cuenta.
  const cuenta = await cuentaDe(peticion, entorno.ANALITICA)

  if (ruta === '/api/favoritos' && peticion.method === 'GET') {
    if (!cuenta) return json({ lugares: [] })
    const filas = await entorno.ANALITICA.prepare(MIOS).bind(cuenta).all<{ lugar_id: string }>()
    return json({ lugares: (filas.results ?? []).map((fila) => fila.lugar_id) })
  }

  if (ruta === '/api/favoritos' && peticion.method === 'POST') {
    if (!cuenta) return json({ error: 'sin cuenta' }, 401)
    const cambio = cambioDe(await cuerpoDe(peticion))
    if (!cambio) return json({ error: 'cambio no válido' }, 400)

    if (cambio.anadir.length > 0) {
      const tiene = await entorno.ANALITICA.prepare(CUANTOS_TIENE)
        .bind(cuenta)
        .first<{ total: number }>()
      if ((tiene?.total ?? 0) + cambio.anadir.length > MAXIMO_POR_CUENTA) {
        return json({ error: 'demasiados favoritos' }, 409)
      }
    }

    const ahora = new Date().toISOString()
    try {
      await entorno.ANALITICA.batch([
        ...cambio.anadir.map((lugar) =>
          (entorno.ANALITICA as Base).prepare(ANADIR).bind(cuenta, lugar, ahora),
        ),
        ...cambio.quitar.map((lugar) =>
          (entorno.ANALITICA as Base).prepare(QUITAR).bind(cuenta, lugar),
        ),
      ])
    } catch {
      return json({ error: 'no se pudo guardar' }, 500)
    }
    return json({ ok: true })
  }

  /*
   * Las estrellas. Mismo patrón que los favoritos y misma promesa: lo que entra aquí alimenta el
   * orden de todos a través del empuje, y la media no vuelve a salir por ninguna ruta de esta API.
   */
  if (ruta === '/api/calificaciones' && peticion.method === 'GET') {
    if (!cuenta) return json({ notas: {} })
    const filas = await entorno.ANALITICA.prepare(MIS_NOTAS)
      .bind(cuenta)
      .all<{ lugar_id: string; estrellas: number }>()
    const notas: Record<string, number> = {}
    for (const fila of filas.results ?? []) notas[fila.lugar_id] = fila.estrellas
    return json({ notas })
  }

  if (ruta === '/api/calificaciones' && peticion.method === 'POST') {
    if (!cuenta) return json({ error: 'sin cuenta' }, 401)
    const cambio = calificacionesDe(await cuerpoDe(peticion))
    if (!cambio) return json({ error: 'cambio no válido' }, 400)
    const ahora = new Date().toISOString()
    try {
      await entorno.ANALITICA.batch(
        Object.entries(cambio.notas).map(([lugar, estrellas]) =>
          estrellas === null
            ? (entorno.ANALITICA as Base).prepare(QUITAR_NOTA).bind(cuenta, lugar)
            : (entorno.ANALITICA as Base).prepare(PONER_NOTA).bind(cuenta, lugar, estrellas, ahora),
        ),
      )
    } catch {
      return json({ error: 'no se pudo guardar' }, 500)
    }
    return json({ ok: true })
  }

  /*
   * Las visitas. No alimentan ninguna señal pública: están para que el historial propio sobreviva a
   * un cambio de dispositivo. Se manda la lista entera de cada lugar y no un incremento, porque así
   * no hay nada que conciliar cuando dos dispositivos han marcado días distintos.
   */
  if (ruta === '/api/visitas' && peticion.method === 'GET') {
    if (!cuenta) return json({ fechas: {} })
    const filas = await entorno.ANALITICA.prepare(MIS_VISITAS)
      .bind(cuenta)
      .all<{ lugar_id: string; fecha: string }>()
    const fechas: Record<string, string[]> = {}
    for (const fila of filas.results ?? []) {
      const lista = fechas[fila.lugar_id] ?? []
      lista.push(fila.fecha)
      fechas[fila.lugar_id] = lista
    }
    for (const lista of Object.values(fechas)) lista.sort()
    return json({ fechas })
  }

  if (ruta === '/api/visitas' && peticion.method === 'POST') {
    if (!cuenta) return json({ error: 'sin cuenta' }, 401)
    const cambio = visitasDe(await cuerpoDe(peticion))
    if (!cambio) return json({ error: 'cambio no válido' }, 400)
    try {
      await entorno.ANALITICA.batch(
        Object.entries(cambio.fechas).flatMap(([lugar, fechas]) => [
          // Se reemplaza el lugar entero: desmarcar el mismo día tiene que poder borrar una fecha.
          (entorno.ANALITICA as Base).prepare(OLVIDAR_VISITAS).bind(cuenta, lugar),
          ...fechas.map((fecha) =>
            (entorno.ANALITICA as Base).prepare(MARCAR_VISITA).bind(cuenta, lugar, fecha),
          ),
        ]),
      )
    } catch {
      return json({ error: 'no se pudo guardar' }, 500)
    }
    return json({ ok: true })
  }

  return json({ error: 'no existe' }, 404)
}
