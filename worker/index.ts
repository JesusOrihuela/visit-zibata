/**
 * El Worker del sitio. Sirve los mismos archivos de `dist/` que antes y, de paso, cuenta la visita.
 *
 * Hasta la v4.7.0 aquí no había código: era un Worker solo de assets. Esto es lo primero que se
 * ejecuta en el servidor en toda la vida del proyecto, así que conviene dejar escrito lo que **no**
 * hace: no lee el cuerpo de la petición, no pone cookies, no mira la IP, no toca el user agent salvo
 * para descartar robots, y no guarda nada de nadie. Lo único que ocurre es que un contador sube.
 *
 * Desde la medición de eventos hay una excepción, la única: se lee la cabecera `Referer` para saber
 * si la entrada vino de un buscador, de una red, de un mensaje, de ningún sitio o de otro, y de ella
 * solo se apunta esa clase (ver `origenDe` en worker/eventos.ts). La dirección de la que se vino no
 * se guarda ni se registra.
 *
 * Y la regla que manda sobre todas: **contar jamás puede romper la página**. La respuesta se obtiene
 * primero y se devuelve igual aunque la base no exista, esté caída o falle a mitad. Por eso el
 * apunte va en `waitUntil`, fuera del camino de la respuesta, y envuelto en un `try`.
 *
 * Solo se ejecuta en las rutas de página (ver `run_worker_first` en wrangler.jsonc). Las teselas,
 * los assets y las imágenes se sirven sin pasar por aquí: así no cuestan invocación ni se cuentan
 * como visitas.
 */

import type { EntornoAcceso } from './acceso.ts'
import { APUNTE, APUNTE_COMPARTICION, comparticionDe, visitaDe } from './analitica.ts'
import { atenderApi } from './api.ts'
import type { Base } from './cuenta.ts'
import { APUNTE_EVENTO, origenDe, pideNoSerMedido } from './eventos.ts'

/** Lo mínimo de la plataforma que este Worker usa. */
interface Entorno extends EntornoAcceso {
  ASSETS: { fetch(request: Request): Promise<Response> }
  /**
   * La base. Puede no estar (en desarrollo, o antes de crearla): entonces no se cuenta y la API
   * responde que no hay base, pero el sitio se sirve igual.
   */
  ANALITICA?: Base
}

interface Contexto {
  waitUntil(promesa: Promise<unknown>): void
}

async function contar(peticion: Request, respuesta: Response, entorno: Entorno): Promise<void> {
  if (!entorno.ANALITICA) return
  const observada = {
    url: peticion.url,
    metodo: peticion.method,
    estado: respuesta.status,
    tipoDeContenido: respuesta.headers.get('content-type'),
    userAgent: peticion.headers.get('user-agent'),
    ahora: new Date(),
  }
  // Una petición es una cosa o la otra, nunca las dos: la vista previa de una app de mensajería no
  // es una visita, y una visita no es una compartición.
  const visita = visitaDe(observada)
  const comparticion = visita ? null : comparticionDe(observada)
  if (!visita && !comparticion) return
  try {
    if (visita) {
      await entorno.ANALITICA.prepare(APUNTE).bind(visita.fecha, visita.ruta, visita.idioma).run()
      // De dónde llegó, en una de cinco clases. El `Referer` se clasifica y se tira: solo se guarda
      // la clase (ver `origenDe`). Si la entrada viene de la propia guía no se apunta nada.
      const origen = pideNoSerMedido(peticion.headers)
        ? null
        : origenDe(peticion.headers.get('referer'), new URL(peticion.url).hostname)
      if (origen) {
        await entorno.ANALITICA.prepare(APUNTE_EVENTO)
          .bind(visita.fecha, 'origen', origen, '', visita.idioma)
          .run()
      }
    } else if (comparticion) {
      await entorno.ANALITICA.prepare(APUNTE_COMPARTICION)
        .bind(comparticion.fecha, comparticion.ruta)
        .run()
    }
  } catch (error) {
    // Un contador perdido no le importa a nadie; una página caída sí. Queda en el registro del
    // Worker por si algún día los números no cuadran.
    console.error('[analitica]', error)
  }
}

export default {
  async fetch(peticion: Request, entorno: Entorno, contexto: Contexto): Promise<Response> {
    // La API primero: si la ruta es suya responde, y si no devuelve null y se sirve el archivo.
    // Así las 232 páginas y la API conviven sin que ninguna sepa de la otra.
    const api = await atenderApi(peticion, entorno)
    if (api) return api

    const respuesta = await entorno.ASSETS.fetch(peticion)
    contexto.waitUntil(contar(peticion, respuesta, entorno))
    return respuesta
  },
}
