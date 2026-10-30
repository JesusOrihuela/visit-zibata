/**
 * Las direcciones antiguas.
 *
 * Dos redirecciones, las dos con un 301 en el servidor: así un buscador ve el traslado y no tiene que
 * adivinarlo ejecutando JavaScript.
 *
 *  - **El español ahora lleva `/es`.** Hasta el 28 de octubre de 2026 era el idioma sin prefijo
 *    (`/lugar/tomassa`, `/`); ahora es `/es/lugar/tomassa` y `/es`. Todo lo que ya circula (el índice
 *    del buscador, los enlaces compartidos) sigue llevando a donde prometía, en un solo salto y con
 *    la consulta intacta.
 *  - **Los enlaces de categoría de la portada.** Hasta que cada categoría tuvo página, filtrar la
 *    portada escribía `/?categoria=italiana`. Una categoría sola tiene su dirección
 *    (`/es/categoria/italiana`, `/en/category/italian`), y la forma con parámetro queda solo como filtro
 *    dentro de una zona. Solo la portada, y solo si el parámetro es el único y nombra una categoría que
 *    existe: la zona con su filtro no se toca, y un parámetro inventado no produce una redirección a una
 *    página que no existe.
 *
 * Nunca según el idioma del navegador: un rastreador pide inglés y sería reenviado a un árbol que no es
 * el que se quiere indexar (ver `resolveLocale` en src/i18n/index.ts).
 */
import categorias from '../data/commercial/categories.json' with { type: 'json' }
import { PREFIX, SEGMENTS } from '../src/lib/url-state.ts'

/** El slug de cada categoría, por idioma. */
const SLUGS = {
  es: new Set(categorias.categories.map((categoria) => categoria.slug.es)),
  en: new Set(categorias.categories.map((categoria) => categoria.slug.en)),
}

/** Los segmentos con los que empezaban las rutas del español sin prefijo. */
const SEGMENTOS_ANTIGUOS: ReadonlySet<string> = new Set(Object.values(SEGMENTS.es))

/** La dirección de la categoría que pide una portada con `?categoria=`, o `null`. */
function redireccionDeCategoria(url: URL, idioma: 'es' | 'en'): string | null {
  const parametro = SEGMENTS[idioma].category
  const claves = [...url.searchParams.keys()]
  if (claves.length !== 1 || claves[0] !== parametro) return null

  const slug = url.searchParams.get(parametro) ?? ''
  if (!SLUGS[idioma].has(slug)) return null
  return `/${PREFIX[idioma]}/${SEGMENTS[idioma].category}/${slug}`
}

/** La dirección a la que mandar esta petición, o `null` si no hay que redirigirla. */
export function redireccionDe(url: URL): string | null {
  const ruta = url.pathname.replace(/\/+$/, '') || '/'
  // La barra final no añade nada: cada ruta es un archivo, no una carpeta.
  const sinBarra = ruta !== url.pathname ? `${ruta}${url.search}` : null

  if (ruta === '/en') return redireccionDeCategoria(url, 'en') ?? sinBarra
  if (ruta === '/es') return redireccionDeCategoria(url, 'es') ?? sinBarra

  const [primero = ''] = ruta.split('/').filter(Boolean)
  if (ruta === '/' || SEGMENTOS_ANTIGUOS.has(primero)) {
    // La portada con una categoría va directa a la página de la categoría, sin pasar por `/es`.
    if (ruta === '/') {
      const categoria = redireccionDeCategoria(url, 'es')
      if (categoria) return categoria
    }
    return `/es${ruta === '/' ? '' : ruta}${url.search}`
  }
  return sinBarra
}
