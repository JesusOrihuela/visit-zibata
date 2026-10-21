/**
 * Qué se cuenta de lo que la gente hace dentro de la guía, y qué no. Sin plataforma, como
 * `analitica.ts`: solo texto y listas, para poder probarlo entero.
 *
 * Es la misma promesa que el contador de visitas, aplicada a más cosas: **un contador por día**, nunca
 * un registro por evento. La tabla guarda "el 5 de octubre, la ficha de tomassa se abrió 12 veces
 * desde la aplicación, en español", y no existe ninguna fila que diga "alguien hizo algo".
 *
 * ## Por qué es un vocabulario cerrado
 *
 *  - **El tipo es una lista fija** y el destino es un identificador que existe en el catálogo (un
 *    lugar, una zona o una categoría) o una de un puñado de palabras. Todo lo demás se descarta.
 *  - **No hay texto libre.** De una búsqueda solo se sabe si dio resultados o no, nunca qué se
 *    escribió: un texto libre puede ser un nombre, un teléfono o cualquier cosa.
 *  - **Así la tabla tiene un tamaño máximo conocido** y nadie puede llenarla de basura: con 101
 *    lugares, 15 zonas y 18 categorías, el universo de filas por día cabe en unos miles.
 *
 * Tampoco hay identificador de ningún tipo: ni cuenta, ni cookie, ni IP, ni user agent. El envío no
 * lleva la credencial de la cuenta anónima y el Worker no mira de quién viene.
 *
 * Los clics de salida (WhatsApp, teléfono, Maps…) son **intención**, no visita al local: se sabe que
 * se pulsó, no que se llamó, se escribió o se llegó.
 */
import categorias from '../data/commercial/categories.json' with { type: 'json' }
import lugares from '../data/commercial/places.json' with { type: 'json' }
import zonas from '../data/commercial/plazas.json' with { type: 'json' }

export const TIPOS = [
  'ficha',
  'salida',
  'compartir',
  'busqueda',
  'filtro',
  'mapa',
  'idioma',
] as const
export type Tipo = (typeof TIPOS)[number]

/** A dónde puede salir una persona desde una ficha. `maps` es "Cómo llegar". */
export const SALIDAS = [
  'maps',
  'web',
  'instagram',
  'facebook',
  'tiktok',
  'whatsapp',
  'telefono',
  'rappi',
  'uber',
  'didi',
] as const

export const RESULTADOS = ['con-resultados', 'sin-resultados'] as const
const IDIOMAS = ['es', 'en'] as const

/** Cuántos eventos caben en un envío: el cliente manda por lotes y esto es el tope de seguridad. */
export const MAXIMO_POR_ENVIO = 20
/** Un envío real pesa unos cientos de bytes; más que esto no es la aplicación. */
export const MAXIMO_BYTES = 4096

/** Lo que se guarda de un evento. */
export interface Evento {
  tipo: Tipo
  /** Un identificador del catálogo o una palabra de la lista cerrada de su tipo. */
  destino: string
  /** Solo lo usa `salida` (a dónde sale). Vacío en el resto. */
  detalle: string
}

export interface Envio {
  idioma: 'es' | 'en'
  eventos: Evento[]
}

const idsDe = (lista: readonly { id: string }[]): Set<string> =>
  new Set(lista.map((elemento) => elemento.id))

const LUGARES = idsDe(lugares.places)
const ZONAS = idsDe(zonas.plazas)
const CATEGORIAS = idsDe(categorias.categories)

/** Los destinos que acepta cada tipo. Si no está aquí, no se guarda. */
const aceptado: Record<Tipo, (destino: string) => boolean> = {
  ficha: (destino) => LUGARES.has(destino),
  salida: (destino) => LUGARES.has(destino) || ZONAS.has(destino),
  compartir: (destino) => LUGARES.has(destino),
  busqueda: (destino) => (RESULTADOS as readonly string[]).includes(destino),
  filtro: (destino) => CATEGORIAS.has(destino) || ZONAS.has(destino) || destino === 'abierto-ahora',
  mapa: (destino) => ZONAS.has(destino) || destino === 'explora',
  idioma: (destino) => (IDIOMAS as readonly string[]).includes(destino),
}

const esTipo = (valor: unknown): valor is Tipo => (TIPOS as readonly unknown[]).includes(valor)

/**
 * Un evento válido, o `null`. Se mira cada cosa por separado y no se corrige ni se recorta nada: un
 * valor que no está en la lista no es "casi bueno", es otra cosa.
 */
export function eventoDe(crudo: unknown): Evento | null {
  if (typeof crudo !== 'object' || crudo === null) return null
  const { tipo, destino, detalle } = crudo as Record<string, unknown>
  if (!esTipo(tipo) || typeof destino !== 'string' || !aceptado[tipo](destino)) return null
  if (tipo === 'salida') {
    return typeof detalle === 'string' && (SALIDAS as readonly string[]).includes(detalle)
      ? { tipo, destino, detalle }
      : null
  }
  // Fuera de `salida` el detalle no existe: si alguien lo manda, no se guarda.
  return { tipo, destino, detalle: '' }
}

/**
 * Lee un envío. Devuelve `null` si el cuerpo no tiene la forma (y entonces la respuesta es un error)
 * y, si la tiene, **solo los eventos válidos**: uno de más o de menos no estropea el resto.
 */
export function envioDe(cuerpo: unknown): Envio | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const { idioma, eventos } = cuerpo as Record<string, unknown>
  if (idioma !== 'es' && idioma !== 'en') return null
  if (!Array.isArray(eventos)) return null
  const validos = eventos
    .slice(0, MAXIMO_POR_ENVIO)
    .map(eventoDe)
    .filter((evento): evento is Evento => evento !== null)
  return { idioma, eventos: validos }
}

/** Un evento, un `UPSERT`: el mismo patrón que `visitas` y la misma garantía de que no crece. */
export const APUNTE_EVENTO = `
INSERT INTO eventos (fecha, tipo, destino, detalle, idioma, cuenta) VALUES (?, ?, ?, ?, ?, 1)
ON CONFLICT(fecha, tipo, destino, detalle, idioma) DO UPDATE SET cuenta = cuenta + 1
`.trim()

/**
 * De dónde llegó una entrada, en cinco clases. **Solo la clase se guarda**: el `Referer` se lee, se
 * clasifica y se tira, de modo que no queda ni el sitio exacto ni la página desde la que se vino.
 *
 * Devuelve `null` si el referente es la propia guía (una recarga o un enlace entre páginas cuenta como
 * moverse dentro del sitio, no como llegar), que es lo que evita llenar "otro" de visitas internas.
 */
export const ORIGENES = ['buscador', 'redes', 'mensajeria', 'directo', 'otro'] as const
export type Origen = (typeof ORIGENES)[number]

const BUSCADORES = [
  // google.com, google.com.mx, google.co.uk, google.es… pero no google.com.otra-cosa.example.
  /^google\.(com(\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/,
  /(^|\.)bing\.com$/,
  /(^|\.)duckduckgo\.com$/,
  /(^|\.)yahoo\.com$/,
  /(^|\.)ecosia\.org$/,
  /(^|\.)brave\.com$/,
  /(^|\.)yandex\.[a-z]+$/,
  /(^|\.)baidu\.com$/,
  /(^|\.)startpage\.com$/,
  /(^|\.)qwant\.com$/,
]
const REDES = [
  /(^|\.)facebook\.com$/,
  /(^|\.)fb\.com$/,
  /(^|\.)instagram\.com$/,
  /^t\.co$/,
  /(^|\.)twitter\.com$/,
  /^x\.com$/,
  /(^|\.)tiktok\.com$/,
  /(^|\.)linkedin\.com$/,
  /^lnkd\.in$/,
  /(^|\.)pinterest\.com$/,
  /(^|\.)reddit\.com$/,
  /(^|\.)youtube\.com$/,
  /^youtu\.be$/,
]
const MENSAJERIA = [
  /(^|\.)whatsapp\.com$/,
  /^wa\.me$/,
  /(^|\.)telegram\.org$/,
  /^t\.me$/,
  /(^|\.)messenger\.com$/,
  /(^|\.)slack\.com$/,
  /(^|\.)discord\.com$/,
]

/**
 * ¿Pide esta petición que no se la mida? Los navegadores mandan `Sec-GPC: 1` (Global Privacy Control)
 * o `DNT: 1`. La visita se sigue sumando, porque es un contador de páginas que no sabe de quién es,
 * pero de esa entrada no se lee el `Referer`.
 */
export const pideNoSerMedido = (cabeceras: Headers): boolean =>
  cabeceras.get('sec-gpc') === '1' || cabeceras.get('dnt') === '1'

/** La app de Google en Android manda como referente su paquete, no una web. */
const APP_DE_GOOGLE = 'com.google.android.googlequicksearchbox'

export function origenDe(referente: string | null, anfitrion: string): Origen | null {
  if (!referente) return 'directo'
  let url: URL
  try {
    url = new URL(referente)
  } catch {
    return 'otro'
  }
  const sitio = url.hostname.toLowerCase().replace(/^www\./, '')
  if (sitio === anfitrion.toLowerCase().replace(/^www\./, '')) return null
  if (url.protocol === 'android-app:') return sitio === APP_DE_GOOGLE ? 'buscador' : 'otro'
  const es = (lista: RegExp[]) => lista.some((patron) => patron.test(sitio))
  if (es(BUSCADORES)) return 'buscador'
  if (es(REDES)) return 'redes'
  if (es(MENSAJERIA)) return 'mensajeria'
  return 'otro'
}
