/**
 * El título de una página de categoría, en un solo sitio.
 *
 * Lo usan el HTML servido (`scripts/build/prerender.ts`) y la pestaña del navegador cuando se navega
 * sin recargar. Tenerlo dos veces garantizaba que acabaran diciendo cosas distintas.
 */
import type { Locale } from '../i18n/index.ts'
import type { Category, Place } from '../types/domain.ts'
import { girosDeCategoria, lista } from './categorias.ts'

/** Por encima de este largo, el buscador corta el título. */
export const TOPE_TITULO = 65

type Clave = 'seo.title' | 'seo.category.title' | 'seo.category.name'

/** Traduce con los mensajes del idioma de la página; el HTML y la app pasan el suyo. */
export type Traductor = (clave: Clave, vars?: Record<string, string>) => string

export function tituloDeCategoria(
  categoria: Category,
  lugares: readonly Place[],
  idioma: Locale,
  traducir: Traductor,
): string {
  const etiqueta = categoria.label[idioma] ?? categoria.label.es
  const giros = girosDeCategoria(categoria, lugares, idioma).slice(0, 2)
  const conGiros = traducir('seo.title', {
    name: traducir('seo.category.title', { label: etiqueta, giros: lista(giros, idioma) }),
  })
  const sinGiros = traducir('seo.title', {
    name: traducir('seo.category.name', { label: etiqueta }),
  })
  // Solo si caben: cortado a media palabra sería peor que corto.
  return giros.length >= 2 && conGiros.length <= TOPE_TITULO ? conGiros : sinGiros
}
