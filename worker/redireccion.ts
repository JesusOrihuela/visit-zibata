/**
 * Los enlaces antiguos de categoría.
 *
 * Hasta que cada categoría tuvo página, filtrar la portada escribía `/?categoria=italiana`. Ahora
 * una categoría sola tiene su dirección (`/categoria/italiana`, `/en/category/italian`), y la forma
 * con parámetro queda solo como filtro dentro de una zona. Los enlaces que ya circulan siguen
 * llevando a donde prometían: se redirigen aquí, en el servidor y con un 301, porque así un
 * buscador ve la redirección y no tiene que adivinarla ejecutando JavaScript.
 *
 * Solo la portada, y solo si el parámetro es el único y nombra una categoría que existe. Cualquier
 * otra cosa se sirve como siempre: la zona con su filtro no se toca, y un parámetro inventado no
 * produce una redirección a una página que no existe.
 */
import categorias from '../data/commercial/categories.json' with { type: 'json' }

/** El slug de cada categoría, por idioma. */
const SLUGS = {
  es: new Set(categorias.categories.map((categoria) => categoria.slug.es)),
  en: new Set(categorias.categories.map((categoria) => categoria.slug.en)),
}

/** La dirección a la que mandar esta petición, o `null` si no hay que redirigirla. */
export function redireccionDeCategoria(url: URL): string | null {
  const ruta = url.pathname.replace(/\/+$/, '') || '/'
  const idioma = ruta === '/en' ? 'en' : ruta === '/' ? 'es' : null
  if (!idioma) return null

  const parametro = idioma === 'en' ? 'category' : 'categoria'
  const claves = [...url.searchParams.keys()]
  if (claves.length !== 1 || claves[0] !== parametro) return null

  const slug = url.searchParams.get(parametro) ?? ''
  if (!SLUGS[idioma].has(slug)) return null
  return idioma === 'en' ? `/en/category/${slug}` : `/categoria/${slug}`
}
