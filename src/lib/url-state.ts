/**
 * Estado compartible en la ruta, con un árbol por idioma.
 *
 *   /                                 inicio
 *   /zona/paseo-zibata                zona seleccionada
 *   /lugar/tomassa                    ficha de un lugar (su plaza se deduce)
 *   /categoria/italiana               una categoría sola: su propia página
 *   /zona/paseo-zibata?categoria=italiana   una categoría dentro de una zona: un filtro
 *   /info/privacidad                  una página de información
 *
 *   /en/                              lo mismo en inglés, con los segmentos traducidos
 *   /en/area/paseo-zibata
 *   /en/place/tomassa
 *   /en/category/italian
 *   /en/area/paseo-zibata?category=italian
 *   /en/info/privacy
 *
 * Hasta la v4.6.0 todo esto vivía en el hash (`#/lugar/tomassa`), porque GitHub Pages no sabe
 * reescribir rutas. Ya no: el sitio lo sirve un Worker con un archivo por ruta. El cambio no es
 * cosmético, es el requisito del SEO: **lo que va después de `#` nunca se envía al servidor**, así
 * que el robot de WhatsApp o de Google solo veía la portada y toda vista previa salía genérica.
 *
 * Este módulo es puro a propósito: no sabe de catálogo ni de React, recibe y devuelve texto. Por
 * eso trabaja con el **slug** de la categoría y no con su id: traducir uno en otro necesita el
 * catálogo, y eso es trabajo de `useUrlSync`.
 */
import type { Locale } from '../i18n/index.ts'

export const INFO_TOPICS = ['acerca', 'privacidad', 'sugerir', 'tutorial'] as const
export type InfoTopic = (typeof INFO_TOPICS)[number]

/**
 * Los temas que son una página de texto. El tutorial también tiene ruta, para que se comparta y
 * para que el botón atrás lo cierre como a los otros tres, pero no es texto que leer: es la ventana
 * de cuatro pasos sobre gestos del mapa, y la dibuja otro componente.
 */
export type InfoPagina = Exclude<InfoTopic, 'tutorial'>

/**
 * Los segmentos de ruta por idioma. El tema de información se guarda siempre con su clave en
 * español (es el identificador interno) y se escribe traducido.
 */
const SEGMENTS = {
  es: { place: 'lugar', plaza: 'zona', info: 'info', category: 'categoria' },
  en: { place: 'place', plaza: 'area', info: 'info', category: 'category' },
} as const satisfies Record<Locale, Record<string, string>>

const INFO_SLUGS = {
  es: { acerca: 'acerca', privacidad: 'privacidad', sugerir: 'sugerir', tutorial: 'tutorial' },
  en: { acerca: 'about', privacidad: 'privacy', sugerir: 'suggest', tutorial: 'tutorial' },
} as const satisfies Record<Locale, Record<InfoTopic, string>>

/** Prefijo de ruta de cada idioma. El español no lleva: es el idioma por omisión del sitio. */
const PREFIX: Record<Locale, string> = { es: '', en: 'en' }

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Las rutas que la aplicación sirve, sin la base. La usa el servidor de desarrollo para entregar
 * `index.html`: en producción existe un archivo por ruta, pero en desarrollo no hay prerenderizado
 * y Vite va en modo `mpa` a propósito, sin reserva, para que un camino inventado dé 404 de verdad.
 * Acotarla a estas rutas conserva esa propiedad también mientras se desarrolla.
 */
export const APP_ROUTE =
  /^(?:en\/?)?(?:(?:lugar|zona|categoria|place|area|category|info)\/[a-z0-9-]+)?$/

export interface UrlState {
  locale: Locale
  plazaSlug: string | null
  placeSlug: string | null
  /** El slug de la categoría en el idioma de la URL, no su id. */
  categorySlug: string | null
  infoTopic: InfoTopic | null
}

/** Quita la base de despliegue (`/` o `/subdirectorio/`) y deja los segmentos limpios. */
function segmentsOf(pathname: string, base: string): string[] {
  const root = base.endsWith('/') ? base : `${base}/`
  const relative = pathname.startsWith(root) ? pathname.slice(root.length) : pathname
  return relative.split('/').filter(Boolean)
}

/**
 * El idioma que pide la URL. Se usa antes de que exista el estado de la aplicación, en el arranque
 * de i18n, para que un enlace a `/en/place/x` mande sobre la preferencia guardada del dispositivo.
 */
export function localeFromPath(pathname: string, base: string): Locale | null {
  return segmentsOf(pathname, base)[0] === PREFIX.en ? 'en' : null
}

export function parsePath(pathname: string, search: string, base: string): UrlState {
  const segments = segmentsOf(pathname, base)
  const locale: Locale = segments[0] === PREFIX.en ? 'en' : 'es'
  if (locale === 'en') segments.shift()

  const words = SEGMENTS[locale]
  const params = new URLSearchParams(search)
  const category = params.get(words.category)
  const state: UrlState = {
    locale,
    plazaSlug: null,
    placeSlug: null,
    categorySlug: category && SLUG.test(category) ? category : null,
    infoTopic: null,
  }

  const [kind, slug] = segments
  if (slug && SLUG.test(slug)) {
    if (kind === words.plaza) state.plazaSlug = slug
    if (kind === words.place) state.placeSlug = slug
    // Una categoría sola es una página, con su ruta. Dentro de una zona sigue siendo `?categoria=`.
    if (kind === words.category) state.categorySlug = slug
    if (kind === words.info) {
      const topic = INFO_TOPICS.find((candidate) => INFO_SLUGS[locale][candidate] === slug)
      if (topic) state.infoTopic = topic
    }
  }
  return state
}

export function buildPath(state: UrlState, base: string): string {
  const { locale } = state
  const words = SEGMENTS[locale]
  const root = base.endsWith('/') ? base : `${base}/`
  // El prefijo del idioma va SIN barra final: cada ruta es un archivo `.html` plano, y así se
  // sirve tal cual en vez de redirigir al índice de una carpeta. La portada española es la raíz,
  // que sí la lleva por definición.
  const prefix = PREFIX[locale] ? `${root}${PREFIX[locale]}` : root
  const inner = PREFIX[locale] ? `${prefix}/` : prefix

  // Una página de información es su propia ruta: al cerrarla se vuelve a la plaza o ficha que sigue
  // en el estado, y el enlace se puede compartir tal cual.
  if (state.infoTopic) return `${inner}${words.info}/${INFO_SLUGS[locale][state.infoTopic]}`

  let path = prefix
  if (state.placeSlug) path = `${inner}${words.place}/${state.placeSlug}`
  else if (state.plazaSlug) path = `${inner}${words.plaza}/${state.plazaSlug}`
  // Una categoría sola tiene una única dirección: su página. `?categoria=` se queda para el filtro de
  // una zona, que no es una página y cuyo canónico es el de la zona.
  else if (state.categorySlug) return `${inner}${words.category}/${state.categorySlug}`
  return state.categorySlug ? `${path}?${words.category}=${state.categorySlug}` : path
}

/**
 * La vista a la que pertenece una ruta, sin la categoría que la filtra. Sirve para decidir si un
 * cambio de dirección es otra pantalla (una entrada de historial) o un ajuste de la misma: pasar de
 * `/` a `/categoria/italiana` es filtrar la portada, y atrás no debe recorrer las cápsulas.
 */
export function vistaDe(path: string): string {
  const sinConsulta = path.split('?')[0] ?? path
  const sinCategoria = sinConsulta.replace(/\/(?:categoria|category)\/[a-z0-9-]+$/, '')
  // Sin barra final, salvo la raíz: `/en` y `/en/` son la misma vista.
  return sinCategoria.replace(/\/+$/, '') || '/'
}

/**
 * Traduce un enlace antiguo con hash a su ruta equivalente, o `null` si no lo es.
 *
 * El formato viejo era `#/lugar/x`, `#/plaza/x` o `#/info/x`: siempre en español, con `plaza` donde
 * ahora va `zona` y con el filtro en `?categoria=` **dentro** del hash. Los enlaces que ya circulan
 * tienen que seguir llevando a donde prometían, y esto es más barato que mantener dos formatos vivos.
 */
export function pathFromLegacyHash(hash: string, base: string): string | null {
  const raw = hash.replace(/^#/, '')
  if (!raw.startsWith('/')) return null
  const [path = '', query = ''] = raw.split('?')
  const [kind, slug] = path.split('/').filter(Boolean)
  if (!kind || !slug || !SLUG.test(slug)) return null

  const category = new URLSearchParams(query).get('categoria')
  const state: UrlState = {
    locale: 'es',
    plazaSlug: kind === 'plaza' ? slug : null,
    placeSlug: kind === 'lugar' ? slug : null,
    categorySlug: category && SLUG.test(category) ? category : null,
    infoTopic: INFO_TOPICS.find((topic) => kind === 'info' && topic === slug) ?? null,
  }
  if (!state.plazaSlug && !state.placeSlug && !state.infoTopic) return null
  return buildPath(state, base)
}

/**
 * La dirección de un lugar o de una zona, para ponerla en un enlace de verdad.
 *
 * Abrir un lugar es navegar: la ruta existe, se puede compartir y funciona sin JavaScript porque
 * la guía la pinta también en el servidor. Mientras eso se abría con un botón, el navegador no
 * podía ofrecer lo que ofrece con cualquier enlace (abrir en otra pestaña, copiar la dirección,
 * ver el destino antes de pulsar) y un lector de pantalla anunciaba "botón" donde tocaba "enlace".
 *
 * El W3C lo dice sin rodeos: añadir el rol de enlace a otro elemento no hace que el navegador
 * añada el comportamiento de un enlace, y entonces proveerlo es responsabilidad de quien escribe.
 * Sale más barato usar el elemento que lo trae puesto.
 */
export const rutaDeLugar = (slug: string, locale: Locale, base: string): string =>
  buildPath({ locale, placeSlug: slug, plazaSlug: null, categorySlug: null, infoTopic: null }, base)

/**
 * La dirección tras elegir una categoría desde donde se está: sola, es su página; dentro de una zona,
 * el filtro de esa zona. Sin categoría es la vista a secas (zona o portada), que es lo que apunta la
 * cápsula elegida y "Todo".
 */
export const rutaDeCategoria = (
  categorySlug: string | null,
  plazaSlug: string | null,
  locale: Locale,
  base: string,
): string => buildPath({ locale, placeSlug: null, plazaSlug, categorySlug, infoTopic: null }, base)

export const rutaDeZona = (slug: string, locale: Locale, base: string): string =>
  buildPath({ locale, placeSlug: null, plazaSlug: slug, categorySlug: null, infoTopic: null }, base)

/**
 * Y la de una página de información, que también es una dirección de verdad.
 *
 * "Acerca", "Privacidad" y "Sugiere un cambio" se abrían con un botón teniendo cada una su ruta
 * (`/info/privacidad` y las suyas), así que pasaba lo mismo: no se podían abrir aparte ni copiar,
 * y un buscador no encontraba ninguna.
 *
 * El tutorial entra igual que las otras tres. Se dibuja como una capa encima de lo que estés
 * viendo, pero tiene su propia ruta y se abre directamente desde ella, así que el enlace que lleva
 * a él es un enlace como los demás.
 */
export const rutaDeInfo = (topic: InfoTopic, locale: Locale, base: string): string =>
  buildPath(
    { locale, placeSlug: null, plazaSlug: null, categorySlug: null, infoTopic: topic },
    base,
  )
