/**
 * El `robots.txt` del sitio.
 *
 * Permite rastrear todo, salvo una cosa: el filtro de categoría **dentro de una zona**
 * (`/zona/x?categoria=y`, `/en/area/x?category=y`). Ahí la categoría no es una página sino un estado de la
 * zona, con el canónico de la zona, y las cápsulas de la interfaz enlazan a esas direcciones: sin esta
 * regla un rastreador que ejecuta JavaScript las sigue todas (unas cien casi idénticas a su zona).
 * Google dice que `robots.txt` es el método principal para esto y que el canónico solo lo reduce con el
 * tiempo (https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation).
 *
 * No toca lo que sí es una página: las zonas, las fichas y `/categoria/x` (`/en/category/x`). Tampoco la
 * portada con `?categoria=`, que el Worker redirige y que un rastreador tiene que poder seguir.
 */
export function robotsTxt(base: string, sitemapUrl?: string): string {
  const raiz = base.endsWith('/') ? base : `${base}/`
  return [
    'User-agent: *',
    'Allow: /',
    `Disallow: ${raiz}zona/*?categoria=`,
    `Disallow: ${raiz}en/area/*?category=`,
    ...(sitemapUrl ? [`Sitemap: ${sitemapUrl}`] : []),
    '',
  ].join('\n')
}

/** Escapa lo que en una expresión regular tiene significado propio. */
const literal = (texto: string): string => texto.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

/**
 * Si una regla `Disallow` bloquea una ruta, con la semántica de Google: prefijo, `*` por cualquier
 * secuencia y `$` por el final. Solo para las pruebas.
 */
export function bloquea(regla: string, rutaConConsulta: string): boolean {
  const final = regla.endsWith('$')
  const cuerpo = final ? regla.slice(0, -1) : regla
  const patron = cuerpo.split('*').map(literal).join('.*')
  return new RegExp(`^${patron}${final ? '$' : ''}`).test(rutaConConsulta)
}
