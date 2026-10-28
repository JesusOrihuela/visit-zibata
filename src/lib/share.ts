/**
 * Compartir un lugar: una sola URL por lugar, y el texto con los datos que ya publica la guía.
 *
 * La URL se arma a propósito **sin** el estado de la vista. La ruta de la aplicación arrastra la
 * categoría activa (`/lugar/tomassa?categoria=pizza`), así que compartir "lo que tengo en
 * pantalla" produciría una URL distinta por cada filtro desde el que alguien comparta el mismo
 * lugar. Que todos los enlaces entrantes apunten a la misma URL es lo que este botón aporta al SEO.
 *
 * Es siempre la del árbol español, también al compartir desde el inglés: es la URL `x-default`
 * del lugar, y la página a la que llega declara su `hreflang` en inglés, así que el buscador y
 * quien abra el enlace encuentran la versión que les toca sin partir los enlaces entrantes en dos.
 */
import { SITE_URL } from '../config/site.ts'

export interface SharePayload {
  title: string
  text: string
  url: string
}

/**
 * Resultado de intentar compartir. `cancelled` es que la persona cerró la hoja del sistema: no es
 * un fallo y no debe avisar de nada.
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unsupported'

/**
 * Raíz pública: la de compilación si la hay, y si no la del navegador, siempre con barra final.
 *
 * La base sale de `BASE_URL` y no de `window.location.pathname`: desde que el enrutado dejó el
 * hash, el camino de la página es `/es/lugar/tomassa` o `/en/place/tomassa`, así que leerlo
 * devolvería la ficha abierta como si fuera la raíz del sitio.
 */
function siteRoot(): string {
  const root = SITE_URL || `${window.location.origin}${import.meta.env.BASE_URL}`
  return root.replace(/\/?$/, '/')
}

/** La URL canónica de un lugar: la misma desde cualquier filtro, idioma o pantalla. */
export function placeUrl(slug: string): string {
  return `${siteRoot()}es/lugar/${slug}`
}

/**
 * Hay con qué compartir. Si el navegador no trae ni la hoja del sistema ni el portapapeles, el
 * botón no se dibuja: es preferible que no esté a que esté y no haga nada.
 */
export function canShare(): boolean {
  if (typeof navigator === 'undefined') return false
  return typeof navigator.share === 'function' || Boolean(navigator.clipboard)
}

/**
 * Hoja del sistema si la hay, y si no al portapapeles.
 *
 * Se llama directo desde el gesto que la dispara: `navigator.share` exige activación del usuario y
 * esperar cualquier otra cosa antes la invalidaría.
 */
export async function share(payload: SharePayload): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(payload)
      return 'shared'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
      // Cualquier otro fallo (un navegador que declara la API y no la implementa, o la niega por
      // permisos) cae al portapapeles en vez de dejar al usuario sin nada.
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(payload.url)
      return 'copied'
    } catch {
      return 'unsupported'
    }
  }
  return 'unsupported'
}
