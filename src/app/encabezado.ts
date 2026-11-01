/**
 * El `h1` de la página, que es el nombre de lo que se está viendo.
 *
 * El HTML que se sirve ya lleva ese nombre como `h1` (el del local, el de la zona, el de la categoría
 * o el de la página de información). Cuando React toma el control y sustituye ese cuerpo, el `h1`
 * tiene que seguir diciendo lo mismo: Google indexa el DOM renderizado, y un `h1` que pasaba a ser el
 * lema de la marca en las 270 páginas le decía que todas trataban de lo mismo.
 *
 * Se calcula con los mismos datos con los que `buildPath` escribe la dirección, no con el tipo de
 * panel abierto: así, para cualquier dirección, el `h1` renderizado es el del archivo servido. Es
 * texto escondido a la vista (`visually-hidden`), así que no cambia nada de lo que se ve.
 */
import { localized, t } from '../i18n/index.ts'
import type { InfoTopic } from '../lib/url-state.ts'
import type { Catalog } from '../types/domain.ts'
import type { AppState } from './state.ts'

/** El título de cada página de información, el mismo que usa el HTML servido (prerender.ts). */
const TITULO_INFO = {
  acerca: 'about.title',
  privacidad: 'about.privacyTitle',
  sugerir: 'about.contribute',
  tutorial: 'about.tutorialTitle',
} as const satisfies Record<InfoTopic, Parameters<typeof t>[0]>

export function encabezadoDe(
  state: Pick<AppState, 'infoTopic' | 'selectedPlaceId' | 'selectedPlazaId' | 'activeCategoryId'>,
  catalog: Catalog,
): string {
  if (state.infoTopic) return t(TITULO_INFO[state.infoTopic])
  const lugar = state.selectedPlaceId ? catalog.placeById.get(state.selectedPlaceId) : undefined
  if (lugar) return lugar.name
  const zona = state.selectedPlazaId ? catalog.plazaById.get(state.selectedPlazaId) : undefined
  if (zona) return zona.name
  const categoria = state.activeCategoryId
    ? catalog.categoryById.get(state.activeCategoryId)
    : undefined
  if (categoria) return t('seo.category.name', { label: localized(categoria.label) })
  return `${t('app.name')} · ${t('app.tagline')}`
}

/**
 * El título de la pestaña, para las navegaciones que hace la app sin recargar.
 *
 * El HTML servido ya trae el título de cada dirección, pero al movernos por dentro no hay recarga y
 * el navegador conserva el de la página de donde veníamos: una búsqueda borrada dejaba en la
 * pestaña el nombre de la categoría que se había abierto. Se recalcula con los mismos textos que
 * `buildPath` escribe en el archivo, para que la pestaña diga lo que diría al recargar.
 */
export function tituloDe(
  state: Pick<AppState, 'infoTopic' | 'selectedPlaceId' | 'selectedPlazaId' | 'activeCategoryId'>,
  catalog: Catalog,
): string {
  if (state.infoTopic) return t('seo.title', { name: t(TITULO_INFO[state.infoTopic]) })
  const lugar = state.selectedPlaceId ? catalog.placeById.get(state.selectedPlaceId) : undefined
  if (lugar) return t('seo.title', { name: lugar.name })
  const zona = state.selectedPlazaId ? catalog.plazaById.get(state.selectedPlazaId) : undefined
  if (zona) return t('seo.title', { name: zona.name })
  const categoria = state.activeCategoryId
    ? catalog.categoryById.get(state.activeCategoryId)
    : undefined
  if (categoria) {
    return t('seo.title', {
      name: t('seo.category.name', { label: localized(categoria.label) }),
    })
  }
  return t('seo.home.title')
}
