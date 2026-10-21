/**
 * Qué se cuenta de una visita, y qué no. Sin plataforma: aquí solo hay texto y fechas, para que se
 * pueda probar entero sin levantar un Worker.
 *
 * La guía cuenta **páginas, no personas**. Lo que se guarda es un contador por día y por ruta, y
 * punto: "el 5 de octubre, /lugar/tomassa se abrió 12 veces, en español". No hay identificador, ni
 * cookie, ni IP, ni user agent, ni nada que permita seguir a nadie entre dos visitas, porque nada de
 * eso llega a la base. No es que se anonimice después: es que no se recoge.
 *
 * Desde la v4.13 hay un segundo contador, el de **comparticiones**: las veces que una app de
 * mensajería pidió una página para dibujar la tarjetita de un enlace. No es tráfico y por eso no se
 * mezcla con las visitas, pero dice que alguien pegó ese enlace en algún sitio.
 *
 * Eso tiene un costo que conviene saber: **no se puede saber cuántas personas distintas** hubo, solo
 * cuántas veces se abrió cada página. Es la mitad del dato a cambio de no tener que prometer nada
 * sobre el otro medio, y para decidir qué locales interesan alcanza de sobra.
 */

/** Lo que se guarda de una visita. Tres columnas y un contador, nada más. */
export interface Visita {
  /** Fecha local de Querétaro, no UTC: "las visitas del martes" tienen que ser las del martes de aquí. */
  fecha: string
  /** La ruta tal como se pidió, sin parámetros: `/lugar/tomassa`. */
  ruta: string
  /** `es` o `en`, deducido del prefijo de la ruta. */
  idioma: string
}

export interface PeticionObservada {
  url: string
  metodo: string
  estado: number
  tipoDeContenido: string | null
  userAgent: string | null
  /** El instante de la visita. Se pasa para poder probar el cambio de día. */
  ahora: Date
}

/**
 * Las apps de mensajería cuando dibujan la tarjetita de un enlace.
 *
 * No son una visita: la petición la hace el servidor de WhatsApp (o de Telegram, o de Slack) para
 * componer la vista previa, y la hace aunque nadie toque el enlace nunca. Contarla como visita
 * inflaría el número con peticiones que nadie vio.
 *
 * Pero dicen algo que hasta ahora se tiraba: **que alguien pegó ese enlace en algún sitio**. Eso es
 * compartir, no tráfico, y va a su propio contador (ver `comparticiones` en worker/esquema.sql).
 */
const VISTAS_PREVIAS =
  /facebookexternalhit|whatsapp|telegram|slackbot|discordbot|twitterbot|linkedinbot|skypeuripreview|embedly|redditbot|pinterest|preview/i

/**
 * Robots conocidos. No es una defensa, es higiene: sin esto, el rastreador de Google inflaría los
 * conteos de las 234 páginas y el dato dejaría de significar "alguien la abrió". Lo que se cuele
 * ensucia un contador, nunca filtra nada, porque no hay nada personal que filtrar.
 */
const ROBOTS =
  /bot|crawl|spider|slurp|headless|lighthouse|monitor|curl|wget|python-requests|probe|scanner/i

/** La zona horaria de Zibatá. El día se corta aquí, no en Greenwich. */
const ZONA = 'America/Mexico_City'

/** `sv-SE` porque su formato de fecha es exactamente `AAAA-MM-DD`, que es como se ordena solo. */
export const fechaLocal = (ahora: Date): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA }).format(ahora)

/**
 * La visita que hay que apuntar, o `null` si no hay que apuntar nada.
 *
 * Devuelve `null` y no lanza: contar es lo accesorio, y nada de lo que pase aquí puede estropear la
 * respuesta que ya va camino del navegador.
 */
/** La ruta normalizada de una petición a una página entregada, o `null` si no lo es. */
function paginaDe(peticion: PeticionObservada): string | null {
  if (peticion.metodo !== 'GET') return null
  // Solo páginas que se entregaron de verdad: un 404 no es una visita a nada, y un 304 es una
  // página que el navegador ya tenía en caché.
  if (peticion.estado !== 200) return null
  if (!peticion.tipoDeContenido?.includes('text/html')) return null

  let ruta: string
  try {
    ruta = new URL(peticion.url).pathname
  } catch {
    return null
  }
  // Sin barra final salvo la portada, para que `/lugar/x` y `/lugar/x/` no sean dos filas.
  if (ruta.length > 1 && ruta.endsWith('/')) ruta = ruta.slice(0, -1)
  return ruta === '' ? '/' : ruta
}

export function visitaDe(peticion: PeticionObservada): Visita | null {
  const ruta = paginaDe(peticion)
  if (ruta === null) return null
  const agente = peticion.userAgent ?? ''
  // El orden importa: una vista previa de WhatsApp no es un robot cualquiera, pero tampoco es una
  // visita. Se descarta aquí y se cuenta en `comparticionDe`.
  if (agente && (VISTAS_PREVIAS.test(agente) || ROBOTS.test(agente))) return null

  const segmentos = ruta.split('/').filter(Boolean)
  return { fecha: fechaLocal(peticion.ahora), ruta, idioma: segmentos[0] === 'en' ? 'en' : 'es' }
}

/**
 * La compartición que hay que apuntar, o `null`.
 *
 * Es un piso y no una cuenta: algunas apps repiten la petición, otras no previsualizan, y cada una
 * se identifica a su manera. Dice la tendencia ("este mes se pegó el enlace de la taquería más que
 * el de nadie"), no la cifra exacta. Tampoco dice quién compartió ni con quién: se guardan fecha y
 * ruta, lo mismo que en una visita.
 */
export function comparticionDe(
  peticion: PeticionObservada,
): { fecha: string; ruta: string } | null {
  const ruta = paginaDe(peticion)
  if (ruta === null) return null
  if (!peticion.userAgent || !VISTAS_PREVIAS.test(peticion.userAgent)) return null
  return { fecha: fechaLocal(peticion.ahora), ruta }
}

/**
 * El apunte: una fila por día, ruta e idioma, con un contador que sube.
 *
 * Es un `UPSERT` y no un registro por visita a propósito. Con una fila por visita la tabla crece sin
 * fin y hay que acordarse de purgarla; así se queda en unos cientos de filas al mes para siempre, y
 * no existe ningún momento en el que la base haya guardado un evento individual.
 */
export const APUNTE = `
INSERT INTO visitas (fecha, ruta, idioma, cuenta) VALUES (?, ?, ?, 1)
ON CONFLICT(fecha, ruta, idioma) DO UPDATE SET cuenta = cuenta + 1
`.trim()

/** El mismo apunte para las comparticiones, en su propia tabla y sin idioma. */
export const APUNTE_COMPARTICION = `
INSERT INTO comparticiones (fecha, ruta, cuenta) VALUES (?, ?, 1)
ON CONFLICT(fecha, ruta) DO UPDATE SET cuenta = cuenta + 1
`.trim()
