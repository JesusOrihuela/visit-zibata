/**
 * Sincroniza plaza, lugar, categoría e idioma con la ruta (enlaces compartibles, botón atrás).
 *
 * Es el **único** sitio que escribe la URL. Tenerlo centralizado es lo que evita que el cambio de
 * idioma, la selección y el filtro se pisen entre sí, y lo que hace que cambiar de idioma sea
 * simplemente "cambia el idioma y la URL se recalcula sola" en vez de una navegación aparte.
 *
 * Aquí vive también la traducción entre el **slug** que viaja en la URL y el **id** que usa el
 * estado: `url-state` es puro y no conoce el catálogo, así que no puede hacerla.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import { type Locale, setLocale, useLocale } from '../i18n/index.ts'
import {
  buildPath,
  localeFromPath,
  parsePath,
  pathFromLegacyHash,
  type UrlState,
  vistaDe,
} from '../lib/url-state.ts'
import type { Catalog, Category } from '../types/domain.ts'
import { useAppDispatch, useAppState } from './AppStateContext.tsx'

const BASE = import.meta.env.BASE_URL

const categoryBySlug = (catalog: Catalog, locale: Locale, slug: string): Category | undefined =>
  catalog.categories.find((category) => category.slug[locale] === slug)

const currentUrl = () => `${window.location.pathname}${window.location.search}`

export function useUrlSync(catalog: Catalog): void {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const locale = useLocale()
  /** Última ruta derivada del estado; `null` hasta el primer render (en el que manda la URL). */
  const lastPath = useRef<string | null>(null)
  /** El idioma vigente, para que el efecto de abajo no tenga que depender de él al leer la URL. */
  const localeRef = useRef(locale)
  localeRef.current = locale

  // URL → estado: al cargar y con atrás/adelante del navegador. Antes de pintar (layout effect): si
  // fuera un efecto normal, una selección hecha en cuanto aparece la interfaz (dispositivo lento o un
  // toque rápido) quedaría pisada por esta sincronización inicial.
  useLayoutEffect(() => {
    const replace = (url: string) => window.history.replaceState(null, '', url)

    const syncFromLocation = (inicial: boolean) => {
      // Un enlace antiguo con hash sigue llevando a donde prometía: se traduce a su ruta y se
      // reescribe, de modo que a partir de ahí todo funciona con el formato nuevo.
      if (inicial && window.location.hash) {
        replace(pathFromLegacyHash(window.location.hash, BASE) ?? currentUrl())
      }

      const explicit = localeFromPath(window.location.pathname, BASE)
      const parsed = parsePath(window.location.pathname, window.location.search, BASE)
      const active = localeRef.current

      const place = parsed.placeSlug ? catalog.placeBySlug.get(parsed.placeSlug) : undefined
      const plaza = place
        ? catalog.plazaById.get(place.plazaId)
        : parsed.plazaSlug
          ? catalog.plazaBySlug.get(parsed.plazaSlug)
          : undefined
      const category = parsed.categorySlug
        ? categoryBySlug(catalog, parsed.locale, parsed.categorySlug)
        : undefined

      if (explicit) {
        // La URL dice el idioma y manda: también al volver atrás desde el otro árbol.
        if (explicit !== active) void setLocale(explicit)
      } else if (inicial && active !== parsed.locale) {
        // Portada española con el inglés recordado en este dispositivo: se lleva a su árbol sin
        // perder la página. Solo al cargar; si lo hiciera también con atrás, pelearía con el
        // botón atrás y no se podría volver al árbol español. Un rastreador no tiene preferencia
        // guardada, así que nunca pasa por aquí y `/` sigue siendo español de forma determinista.
        replace(
          buildPath(
            {
              locale: active,
              plazaSlug: parsed.plazaSlug,
              placeSlug: parsed.placeSlug,
              categorySlug: category?.slug[active] ?? null,
              infoTopic: parsed.infoTopic,
            },
            BASE,
          ),
        )
      } else if (active !== parsed.locale) {
        // Atrás hasta el árbol sin prefijo: vuelve el español.
        void setLocale(parsed.locale)
      }

      // Un enlace a un lugar o plaza que ya no se publica: se avisa y se limpia la URL para no compartirlo.
      const missingLink =
        (parsed.placeSlug !== null && !place) || (parsed.plazaSlug !== null && !plaza?.active)
      if (missingLink) {
        replace(
          buildPath(
            {
              locale: localeRef.current,
              plazaSlug: null,
              placeSlug: null,
              categorySlug: category?.slug[localeRef.current] ?? null,
              infoTopic: null,
            },
            BASE,
          ),
        )
      }
      // El enlace antiguo `/?categoria=x` se lleva a la dirección de la categoría, que es su página.
      // Solo al cargar: con atrás, reescribirla pelearía con el historial.
      if (inicial && parsed.categorySlug && category && !place && !plaza && !parsed.infoTopic) {
        const canonica = buildPath(
          {
            locale: localeRef.current,
            plazaSlug: null,
            placeSlug: null,
            categorySlug: category.slug[localeRef.current],
            infoTopic: null,
          },
          BASE,
        )
        if (canonica !== currentUrl()) replace(canonica)
      }
      dispatch({
        type: 'syncFromUrl',
        plazaId: plaza?.active ? plaza.id : null,
        placeId: place?.id ?? null,
        categoryId: category?.id ?? null,
        missingLink,
        infoTopic: parsed.infoTopic,
      })
    }

    syncFromLocation(true)
    const onPopState = () => syncFromLocation(false)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [catalog, dispatch])

  // Estado → URL: solo cuando el estado cambia, nunca en el primer render. Esto último no es un
  // detalle: en el primer render el efecto de arriba ya despachó lo que dice la URL, pero el estado
  // todavía no lo refleja, así que escribir aquí borraría el enlace que acaba de abrirse.
  //
  // El idioma entra en las dependencias porque cambiarlo mueve la página al otro árbol, y eso es
  // una escritura de URL como cualquier otra: así cambiar de idioma no necesita navegar por su
  // cuenta y sigue habiendo un único escritor.
  useEffect(() => {
    const plaza = state.selectedPlazaId ? catalog.plazaById.get(state.selectedPlazaId) : undefined
    const place = state.selectedPlaceId ? catalog.placeById.get(state.selectedPlaceId) : undefined
    const category = state.activeCategoryId
      ? catalog.categoryById.get(state.activeCategoryId)
      : undefined
    const next: UrlState = {
      locale,
      plazaSlug: plaza?.slug ?? null,
      placeSlug: place?.slug ?? null,
      categorySlug: category?.slug[locale] ?? null,
      infoTopic: state.infoTopic,
    }
    const path = buildPath(next, BASE)
    const previous = lastPath.current
    lastPath.current = path
    if (previous === null || path === currentUrl()) return

    // Cambiar de plaza, de lugar o de idioma crea una entrada de historial (atrás la deshace); el
    // filtro de categoría no, porque es un ajuste de la misma vista: pasar de `/` a
    // `/categoria/x` es filtrar la portada, y atrás no debe recorrer las cápsulas una a una.
    const sameView = vistaDe(path) === vistaDe(previous)
    if (sameView) window.history.replaceState(null, '', path)
    else window.history.pushState(null, '', path)
  }, [
    catalog,
    locale,
    state.selectedPlazaId,
    state.selectedPlaceId,
    state.activeCategoryId,
    state.infoTopic,
  ])
}
