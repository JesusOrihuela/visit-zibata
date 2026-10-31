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
import { type EntornoAcceso, puedeVerElPanel } from './acceso.ts'
import { fechaLocal } from './analitica.ts'
import { guardarCategorias } from './categorias.ts'
import { contenido, guardarNegocio } from './contenido.ts'
import { ALTA, type Base, huella, nuevaCuenta, RESOLVER, secretoDe } from './cuenta.ts'
import { APUNTE_EVENTO, envioDe, MAXIMO_BYTES } from './eventos.ts'
import {
  ANADIR,
  CUANTOS_TIENE,
  cambioDe,
  EDAD_MINIMA_MS,
  MAXIMO_POR_CUENTA,
  MIOS,
  QUITAR,
} from './favoritos.ts'
import type { EntornoGitHub } from './github.ts'
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
  COMPARTIDAS,
  desdeHace,
  diasDe,
  MAS_CALIFICADOS,
  MAS_GUARDADOS,
  origenPropio,
  POR_DIA,
  POR_IDIOMA,
  POR_PAGINA,
  RESUMEN,
} from './panel.ts'
import {
  CONTEO_CORAZONES,
  CONTEO_NOTAS,
  type FilaCorazones,
  type FilaNotas,
  senalesDe,
} from './senales.ts'
import {
  ATENDER,
  GUARDAR,
  ID_DE_SUGERENCIA,
  SIN_ATENDER,
  sugerenciaDe,
  ULTIMAS,
} from './sugerencias.ts'

export interface EntornoApi extends EntornoAcceso, EntornoGitHub {
  ANALITICA?: Base
}

/** Un fallo que no es del usuario sino de la configuración o de GitHub. */
function falloDeContenido(error: unknown): Response {
  const mensaje = error instanceof Error ? error.message : String(error)
  console.error('[contenido]', mensaje)
  if (mensaje.includes('GITHUB_TOKEN') || mensaje.includes('GITHUB_REPO')) {
    return json({ error: 'El panel no tiene configurado el acceso a GitHub.' }, 503)
  }
  return json({ error: 'No se pudo guardar el contenido. Revisa el registro.' }, 500)
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
   * Los eventos de uso (ver worker/eventos.ts). No piden cuenta ni miran quién los manda: ni la
   * credencial ni el user agent ni la IP entran en la cuenta, y lo que se guarda es un contador por
   * día. Responde 204 aunque no haya nada que guardar o la tabla no exista todavía: contar es lo
   * accesorio, y quien lo envía (un `sendBeacon`) ni siquiera lee la respuesta.
   */
  if (ruta === '/api/evento' && peticion.method === 'POST') {
    const declarado = Number(peticion.headers.get('content-length') ?? 0)
    if (declarado > MAXIMO_BYTES) return new Response(null, { status: 413 })
    const texto = await peticion.text()
    if (texto.length > MAXIMO_BYTES) return new Response(null, { status: 413 })
    let cuerpo: unknown
    try {
      cuerpo = JSON.parse(texto)
    } catch {
      return new Response(null, { status: 400 })
    }
    const envio = envioDe(cuerpo)
    if (!envio) return new Response(null, { status: 400 })
    if (envio.eventos.length > 0) {
      const fecha = fechaLocal(new Date())
      try {
        await entorno.ANALITICA.batch(
          envio.eventos.map((evento) =>
            (entorno.ANALITICA as Base)
              .prepare(APUNTE_EVENTO)
              .bind(fecha, evento.tipo, evento.destino, evento.detalle, envio.idioma),
          ),
        )
      } catch (error) {
        console.error('[eventos]', error)
      }
    }
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
  }

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

  /*
   * Las sugerencias. No piden cuenta: mandar un recado no es guardar algo tuyo, y pedir identidad
   * para avisar de un horario mal puesto seria pedir mas de lo que hace falta. Lo que las frena es
   * la prueba de trabajo del sello, y que el sello sea unico hace que cada una valga una vez.
   */
  if (ruta === '/api/sugerencia' && peticion.method === 'POST') {
    const sugerencia = sugerenciaDe(await cuerpoDe(peticion))
    if (!sugerencia) return json({ error: 'sugerencia no valida' }, 400)
    if (!cumpleLaPrueba(await digestDe(sugerencia.sello))) {
      return json({ error: 'prueba de trabajo no valida' }, 403)
    }
    try {
      await entorno.ANALITICA.prepare(GUARDAR)
        .bind(
          nuevaCuenta(),
          new Date().toISOString(),
          sugerencia.quien,
          sugerencia.lugar,
          sugerencia.mensaje,
          sugerencia.contacto,
          base64url(await digestDe(sugerencia.sello)),
        )
        .run()
    } catch {
      // Casi siempre es el sello repetido. No se distingue: decirlo solo le sirve a quien insiste.
      return json({ error: 'no se pudo guardar' }, 409)
    }
    return json({ ok: true }, 201)
  }

  /*
   * Marcar una sugerencia como atendida. Es la única escritura del panel, y por eso lleva dos cosas
   * que las lecturas no necesitan: la puerta de Access y la comprobación de que la petición salió de
   * esta misma página (ver `origenPropio`).
   */
  const atender = ruta.match(/^\/api\/panel\/sugerencias\/([A-Za-z0-9_-]+)$/)
  if (atender && peticion.method === 'POST') {
    if (!(await puedeVerElPanel(peticion, entorno))) return json({ error: 'sin permiso' }, 403)
    if (!origenPropio(peticion)) return json({ error: 'origen no permitido' }, 403)
    const id = atender[1] as string
    if (!ID_DE_SUGERENCIA.test(id)) return json({ error: 'identificador no válido' }, 400)
    try {
      await entorno.ANALITICA.prepare(ATENDER).bind(id).run()
    } catch (error) {
      console.error('[panel]', error)
      return json({ error: 'no se pudo guardar' }, 500)
    }
    const pendientes = await entorno.ANALITICA.prepare(SIN_ATENDER).first<{ total: number }>()
    return json({ ok: true, sinAtender: pendientes?.total ?? 0 })
  }

  /*
   * El contenido comercial. La lectura llena el formulario; la escritura valida y manda el cambio a
   * una rama con PR, nunca a producción. Las dos repiten las dos puertas del panel: Access y que la
   * petición salga de esta misma página.
   */
  if (ruta === '/api/panel/contenido' && peticion.method === 'GET') {
    if (!(await puedeVerElPanel(peticion, entorno))) return json({ error: 'sin permiso' }, 403)
    try {
      return json(await contenido(entorno))
    } catch (error) {
      return falloDeContenido(error)
    }
  }

  if (ruta === '/api/panel/contenido/negocio' && peticion.method === 'POST') {
    if (!(await puedeVerElPanel(peticion, entorno))) return json({ error: 'sin permiso' }, 403)
    if (!origenPropio(peticion)) return json({ error: 'origen no permitido' }, 403)
    try {
      const resultado = await guardarNegocio(entorno, await cuerpoDe(peticion))
      return json(resultado, resultado.ok ? 200 : 400)
    } catch (error) {
      return falloDeContenido(error)
    }
  }

  if (ruta === '/api/panel/contenido/categorias' && peticion.method === 'POST') {
    if (!(await puedeVerElPanel(peticion, entorno))) return json({ error: 'sin permiso' }, 403)
    if (!origenPropio(peticion)) return json({ error: 'origen no permitido' }, 403)
    try {
      const resultado = await guardarCategorias(entorno, await cuerpoDe(peticion))
      return json(resultado, resultado.ok ? 200 : 400)
    } catch (error) {
      return falloDeContenido(error)
    }
  }

  /*
   * El panel privado. Va antes de la identidad porque no la usa: quien entra aquí ya pasó por
   * Cloudflare Access, que es otra puerta y no la de las cuentas anónimas (ver worker/panel.ts).
   */
  if (ruta === '/api/panel' && peticion.method === 'GET') {
    if (!(await puedeVerElPanel(peticion, entorno))) return json({ error: 'sin permiso' }, 403)
    const url = new URL(peticion.url)
    const dias = diasDe(url)
    const desde = desdeHace(dias)
    const consulta = <T>(sql: string) =>
      (entorno.ANALITICA as Base).prepare(sql).bind(desde).all<T>()

    const [resumen, porDia, porPagina, porIdioma, compartidas, guardados, calificados] =
      await Promise.all([
        entorno.ANALITICA.prepare(RESUMEN).bind(desde).first<Record<string, number>>(),
        consulta<{ fecha: string; visitas: number }>(POR_DIA),
        consulta<{ ruta: string; idioma: string; visitas: number }>(POR_PAGINA),
        consulta<{ idioma: string; visitas: number }>(POR_IDIOMA),
        consulta<{ ruta: string; veces: number }>(COMPARTIDAS),
        entorno.ANALITICA.prepare(MAS_GUARDADOS).all<{ lugar: string; corazones: number }>(),
        entorno.ANALITICA.prepare(MAS_CALIFICADOS).all<{ lugar: string; notas: number }>(),
      ])
    const sugerencias = await entorno.ANALITICA.prepare(ULTIMAS).all<Record<string, unknown>>()
    const pendientes = await entorno.ANALITICA.prepare(SIN_ATENDER).first<{ total: number }>()

    return json({
      dias,
      desde,
      resumen: resumen ?? {},
      porDia: porDia.results ?? [],
      porPagina: porPagina.results ?? [],
      porIdioma: porIdioma.results ?? [],
      compartidas: compartidas.results ?? [],
      guardados: guardados.results ?? [],
      calificados: calificados.results ?? [],
      sugerencias: sugerencias.results ?? [],
      sinAtender: pendientes?.total ?? 0,
    })
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
