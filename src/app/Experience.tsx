/**
 * Composición de la experiencia: el mapa ocupa toda la pantalla y la interfaz flota encima.
 * Escritorio: panel lateral derecho. Móvil: hoja inferior. Misma lógica y componentes en ambos.
 */
import { AlertTriangle, List, WifiOff, X } from 'lucide-react'
import type { Map as MapLibreMap, PaddingOptions } from 'maplibre-gl'
import {
  type CSSProperties,
  lazy,
  type ReactNode,
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Brand } from '../components/brand/Brand.tsx'
import {
  BottomSheet,
  collapsedHeightFor,
  useViewportHeight,
} from '../components/panel/BottomSheet.tsx'
import { DesktopSidePanel } from '../components/panel/DesktopSidePanel.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { useCatalogState } from '../data/CatalogContext.tsx'
import { GuideBar } from '../features/about/GuideBar.tsx'
import { LocaleSwitch } from '../features/about/LocaleSwitch.tsx'
import { FilterBar } from '../features/filters/FilterBar.tsx'
import { MapErrorBoundary } from '../features/map/MapErrorBoundary.tsx'
import { realismoActivo } from '../features/map/realismo/modo.ts'
import type { MapStatus } from '../features/map/types.ts'
import { hasSeenOnboarding } from '../features/onboarding/seen.ts'
import { ExplorePanel } from '../features/plazas/ExplorePanel.tsx'
import { PlazaPanel } from '../features/plazas/PlazaPanel.tsx'
import { ResultsPanel } from '../features/plazas/ResultsPanel.tsx'
import { ProfileButton } from '../features/profile/ProfileButton.tsx'
import { SearchBar } from '../features/search/SearchBar.tsx'
import { useElementBottom } from '../hooks/useElementBottom.ts'
import { useIsDesktop, useMediaQuery } from '../hooks/useMediaQuery.ts'
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts'
import { t, useLocale } from '../i18n/index.ts'
import { type InfoTopic, parsePath, rutaDeCategoria } from '../lib/url-state.ts'
import type { Catalog, Place } from '../types/domain.ts'
import { useAppDispatch } from './AppStateContext.tsx'
import styles from './Experience.module.css'
import { encabezadoDe } from './encabezado.ts'
import { useExperience } from './useExperience.ts'
import { useUrlSync } from './useUrlSync.ts'

// MapLibre vive en un chunk aparte; su descarga empieza ya, en paralelo a la de los datos. Si falla, lo
// gestiona MapErrorBoundary al renderizar (aquí solo se evita el aviso de promesa sin capturar).
const mapViewModule =
  typeof window !== 'undefined' ? import('../features/map/MapView.tsx') : undefined
mapViewModule?.catch(() => {})
const MapView = lazy(() => mapViewModule ?? import('../features/map/MapView.tsx'))
// La depuración del mapa solo existe en desarrollo: el build de producción ni la incluye ni lee `?debug`.
const MapDebugPanel = import.meta.env.DEV
  ? lazy(() => import('../features/map/debug/MapDebugPanel.tsx'))
  : null
/** El tutorial solo se ve en la primera visita: no tiene por qué pesar en el arranque. */
/*
 * Las tres páginas de texto pesan 7 KB de fuente más toda su prosa, y la mayoría de las visitas no
 * abren ninguna. Viajan en su propio trozo: el paquete inicial estaba a 0,1 KB de su límite y lo
 * que toca cuando eso pasa es partir, no subir el número (ver scripts/perf/check-bundle.ts).
 */
/*
 * La ficha de un lugar, diferida.
 *
 * No se ve hasta que alguien abre un lugar, y arrastra consigo las estrellas, el registro de
 * visitas, la tabla de horarios y el botón de compartir: todo eso viajaba en la primera carga para
 * una pantalla que no es la primera. El paquete inicial estaba en 122,0 de 122 KB, o sea sin
 * margen, y la regla del presupuesto dice que cuando eso pasa toca partir y no renumerar.
 *
 * La portada ya pinta la lista; lo que se aplaza es el detalle, que llega mientras se abre el
 * panel.
 */
const PlaceDetail = lazy(() =>
  import('../features/places/PlaceDetail.tsx').then((module) => ({ default: module.PlaceDetail })),
)

const InfoDialog = lazy(() =>
  import('../features/about/InfoDialog.tsx').then((module) => ({ default: module.InfoDialog })),
)

const OnboardingModal = lazy(() =>
  import('../features/onboarding/OnboardingModal.tsx').then((module) => ({
    default: module.OnboardingModal,
  })),
)

const appTitle = `${t('app.name')} · ${t('app.tagline')}`

export function Experience() {
  // Suscribe la interfaz al idioma activo: al cambiarlo, todo vuelve a renderizarse con sus textos.
  useLocale()
  const { state } = useCatalogState()
  if (state.status === 'error') {
    return (
      <main className={styles.fullscreenState}>
        <h1 className="visually-hidden">{appTitle}</h1>
        <Brand />
        <EmptyState
          tone="error"
          icon={<AlertTriangle />}
          title={t('data.error.title')}
          action={
            // Recargar es lo más fiable en un sitio estático: los navegadores recuerdan un import() fallido.
            <button type="button" className={styles.retry} onClick={() => window.location.reload()}>
              {t('data.retry')}
            </button>
          }
        >
          {t('data.error.body')}
        </EmptyState>
      </main>
    )
  }
  if (state.status === 'loading') {
    return (
      <main className={styles.fullscreenState} aria-busy="true">
        <h1 className="visually-hidden">{appTitle}</h1>
        <Brand />
        <p className={styles.loadingText} role="status">
          {t('data.loading')}
        </p>
      </main>
    )
  }
  return <ReadyExperience catalog={state.catalog} />
}

const panelWidthFor = (viewport: number) =>
  Math.round(Math.min(440, Math.max(360, viewport * 0.28)))

function usePanelWidth(): number {
  const [width, setWidth] = useState(() => panelWidthFor(window.innerWidth))
  useEffect(() => {
    const onResize = () => setWidth(panelWidthFor(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

/**
 * Al cerrar el panel con teclado el botón pulsado desaparece: el foco vuelve al último control usado
 * fuera del panel (marcador, lista, búsqueda) o, si ya no existe, al buscador. Con ratón o dedo no se
 * mueve el foco (no hay foco que perder y no se abre el teclado virtual).
 */
function useReturnFocus(fallback: RefObject<HTMLElement | null>) {
  const lastOutside = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && !event.target.closest('[data-panel]')) {
        lastOutside.current = event.target
      }
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])
  return useCallback(
    (event?: { detail?: number }) => {
      // Un clic sintético de teclado (Enter/Espacio) tiene detail 0.
      if (event?.detail !== 0) return
      requestAnimationFrame(() => {
        const target = lastOutside.current
        const usable =
          target?.isConnected &&
          target.tabIndex >= 0 &&
          target.checkVisibility?.() !== false &&
          !target.closest('[aria-hidden="true"], [inert]')
        ;(usable ? target : fallback.current)?.focus()
      })
    },
    [fallback],
  )
}

function ReadyExperience({ catalog }: { catalog: Catalog }) {
  const dispatch = useAppDispatch()
  const isDesktop = useIsDesktop()
  const online = useOnlineStatus()
  // Tan estrecho que la atribución y la fila de controles no caben lado a lado.
  const veryNarrow = useMediaQuery('(max-width: 439px)')
  const experience = useExperience(catalog)
  const { state, panel, favorites, filtersActive } = experience
  const locale = useLocale()
  /*
   * A dónde lleva cada cápsula de categoría: la dirección del estado que resulta de pulsarla. Sola, la
   * categoría es su propia página; dentro de una zona, el filtro de esa zona. La cápsula elegida y
   * "Todo" apuntan a la vista sin categoría.
   */
  const categoryHref = useCallback(
    (categoryId: string | null) => {
      const category = categoryId ? catalog.categoryById.get(categoryId) : undefined
      const zona = state.selectedPlazaId ? catalog.plazaById.get(state.selectedPlazaId) : undefined
      return rutaDeCategoria(
        category?.slug[locale] ?? null,
        zona?.slug ?? null,
        locale,
        import.meta.env.BASE_URL,
      )
    },
    [catalog, locale, state.selectedPlazaId],
  )
  const panelWidth = usePanelWidth()
  const viewportHeight = useViewportHeight()
  const sheetPeek = panel.kind === 'idle' ? 'small' : 'medium'
  const topbarRef = useRef<HTMLElement>(null)
  // Estimación inicial (~168 px en escritorio, ~157 px en móvil) hasta medir la barra real.
  const topbarBottom = useElementBottom(topbarRef, isDesktop ? 168 : 157)
  // La hoja colapsada deja libre la barra medida más ~150 px de mapa (marcador, atribución y controles).
  // Si con esa hoja los controles no caben en columna, irán en fila sobre la hoja (y en pantallas muy
  // estrechas también la atribución): se reserva ese alto y se vuelve a decidir con la hoja resultante.
  const controlsFitColumn = (peekHeight: number) =>
    isDesktop || viewportHeight - peekHeight - 12 - topbarBottom - 12 >= 172
  // Solo en pantallas muy estrechas la fila de controles y la atribución ocupan todo el ancho sobre la
  // hoja; en horizontal quedan a los lados y los marcadores pueden usar el centro.
  const overSheetFor = (inRow: boolean) => (inRow && veryNarrow ? 104 : 0)
  const firstPeek = collapsedHeightFor(sheetPeek, viewportHeight, topbarBottom + 150)
  const sheetTopReserved = topbarBottom + 150 + overSheetFor(!controlsFitColumn(firstPeek))
  const sheetPeekHeight = collapsedHeightFor(sheetPeek, viewportHeight, sheetTopReserved)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [debugRequested] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug'),
  )
  // Se leen al montar: la sincronización de la URL descarta los parámetros que no conoce.
  const [medir] = useState<'si' | 'corto' | undefined>(() => {
    const value = new URLSearchParams(window.location.search).get('medir')
    return value === null ? undefined : value === 'corto' ? 'corto' : 'si'
  })
  // El mapa es el realista; solo se apaga donde no puede dibujarlo (ver realismo/modo.ts). Medir lo exige.
  const [realismo] = useState(() => medir !== undefined || realismoActivo())
  const searchInputRef = useRef<HTMLInputElement>(null)
  const returnFocus = useReturnFocus(searchInputRef)
  useUrlSync(catalog)

  useEffect(() => {
    // Al abrir la guía no hay ninguna plaza ni lugar seleccionados: se empieza por la vista de Zibatá.
    // Un enlace compartido sí abre su ficha, y entonces el tutorial no aparece encima de ella. Las
    // páginas de información cuentan igual: quien llega a /info/privacidad viene a leer eso.
    const target = parsePath(
      window.location.pathname,
      window.location.search,
      import.meta.env.BASE_URL,
    )
    const isDeepLink =
      target.plazaSlug !== null ||
      target.placeSlug !== null ||
      target.categorySlug !== null ||
      target.infoTopic !== null
    if (!isDeepLink && !hasSeenOnboarding()) dispatch({ type: 'showTutorial' })
  }, [dispatch])

  useEffect(() => {
    if (!state.missingLinkNotice) return
    const timer = window.setTimeout(() => dispatch({ type: 'dismissNotice' }), 8000)
    return () => window.clearTimeout(timer)
  }, [dispatch, state.missingLinkNotice])

  const openPlace = useCallback(
    (place: Place) =>
      dispatch({
        type: 'selectPlace',
        placeId: place.id,
        plazaId: place.plazaId,
        origin: panel.kind === 'results' ? 'results' : 'plaza',
      }),
    [dispatch, panel.kind],
  )
  const selectPlaza = useCallback(
    (plazaId: string | null) => dispatch({ type: 'selectPlaza', plazaId }),
    [dispatch],
  )
  const setCategory = useCallback(
    (categoryId: string | null) => dispatch({ type: 'setCategory', categoryId }),
    [dispatch],
  )
  const clearFilters = useCallback(() => dispatch({ type: 'clearFilters' }), [dispatch])
  const openInfo = useCallback(
    (topic: InfoTopic) => dispatch({ type: 'openInfo', topic }),
    [dispatch],
  )
  const closePanel = useCallback(
    (event?: { detail?: number }) => {
      dispatch({ type: 'closePanel' })
      returnFocus(event)
    },
    [dispatch, returnFocus],
  )
  const closeResults = useCallback(
    (event?: { detail?: number }) => {
      dispatch({ type: 'clearFilters' })
      returnFocus(event)
    },
    [dispatch, returnFocus],
  )
  // Escape cierra la ficha (vuelve a la plaza o a los resultados) y, si no hay ficha, el panel.
  // El buscador y el tutorial gestionan su propio Escape antes (preventDefault / <dialog>).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Con una hoja abierta (información, tutorial o tu perfil) manda ella: Escape la cierra a ella,
      // no al panel que hay debajo.
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        state.tutorialVisible ||
        state.infoTopic ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      )
        return
      if (panel.kind === 'place') {
        dispatch({ type: 'closePlace' })
        if (panel.fromResults) returnFocus({ detail: 0 })
      } else if (panel.kind === 'plaza' || panel.kind === 'explore') {
        closePanel({ detail: 0 })
      } else if (panel.kind === 'results') {
        closeResults({ detail: 0 })
      } else {
        return
      }
      event.preventDefault()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [
    dispatch,
    panel,
    state.tutorialVisible,
    state.infoTopic,
    closePanel,
    closeResults,
    returnFocus,
  ])

  const onMapStatus = useCallback(
    (status: MapStatus) => dispatch({ type: 'mapStatusChanged', status }),
    [dispatch],
  )
  const onMapCrash = useCallback(
    () => onMapStatus({ state: 'error', reason: 'generic' }),
    [onMapStatus],
  )

  const mapFailed = state.mapStatus.state === 'error'
  // Si el mapa 3D no está disponible, la lista de plazas mantiene la guía utilizable.
  const desktopPanelOpen = panel.kind !== 'idle' || mapFailed
  // Controles del mapa en columna (4 × 40 px + márgenes) solo si caben entre la barra y el borde inferior
  // libre; si no (móvil en horizontal, 320 px con filtros), en fila sobre la hoja.
  const controlsInRow = !controlsFitColumn(sheetPeekHeight)
  // En móvil, lo que queda sobre la hoja: la fila de controles y, si no caben lado a lado, la atribución.
  const overSheet = overSheetFor(controlsInRow)
  // top: borde inferior medido de la barra de búsqueda y filtros + margen.
  const padding: PaddingOptions = isDesktop
    ? {
        top: topbarBottom + 8,
        bottom: 40,
        left: 40,
        right: desktopPanelOpen ? panelWidth + 40 : 88,
      }
    : {
        top: topbarBottom + 8,
        bottom: sheetPeekHeight + 16 + overSheet,
        left: 16,
        // Los controles del mapa, cuando van en columna, ocupan el borde derecho: encuadrar una plaza
        // debajo de ellos la dejaría sin etiqueta (y sin poder pulsarla).
        right: controlsInRow ? 16 : 64,
      }

  // Lo que hay en la lista ahora mismo: con una plaza abierta, sus lugares; buscando, todo Zibatá.
  // No depende de si además hay una ficha abierta encima.
  //
  // Ya no se pinta en la barra de filtros (lo dicen las cabeceras de los paneles, junto a la lista
  // que cuentan), pero sigue anunciándose aquí: quien no ve la pantalla necesita oír que cambió.
  const resultCount = experience.visibleCount

  // Una sola región viva para toda la interfaz: avisos y número de resultados (no se duplican anuncios).
  const announcement = !online
    ? t('network.offline')
    : state.missingLinkNotice
      ? t('link.missing')
      : filtersActive
        ? t('filters.results', { count: resultCount })
        : ''
  const favoritesCount = [...favorites.ids].filter((id) => catalog.placeById.has(id)).length

  let content: ReactNode
  let contentKey: string = panel.kind
  switch (panel.kind) {
    case 'place':
      contentKey = `place-${panel.place.id}`
      content = (
        <Suspense fallback={null}>
          <PlaceDetail
            place={panel.place}
            plaza={panel.plaza}
            backLabel={
              panel.fromResults
                ? t('place.backToResults')
                : t('place.backToPlaza', { plaza: panel.plaza.name })
            }
            onBack={() => dispatch({ type: 'closePlace' })}
            onClose={closePanel}
          />
        </Suspense>
      )
      break
    case 'plaza':
      contentKey = `plaza-${panel.plaza.id}`
      content = (
        <PlazaPanel
          plaza={panel.plaza}
          places={panel.places}
          categoryCounts={experience.categoryCounts}
          filtersActive={filtersActive}
          activeCategoryId={state.activeCategoryId}
          onCategoryChange={setCategory}
          categoryHref={categoryHref}
          onClearFilters={clearFilters}
          onOpenPlace={openPlace}
          onClose={closePanel}
        />
      )
      break
    case 'results':
      content = (
        <ResultsPanel places={panel.places} onOpenPlace={openPlace} onClearFilters={closeResults} />
      )
      break
    case 'explore':
      content = (
        <ExplorePanel onSelectPlaza={selectPlaza} onClose={isDesktop ? closePanel : undefined} />
      )
      break
    case 'idle':
      content = (
        <ExplorePanel
          onSelectPlaza={selectPlaza}
          headerOnly={!isDesktop && !state.sheetExpanded}
          onExpand={() => dispatch({ type: 'setSheetExpanded', expanded: true })}
        />
      )
      break
  }

  const stageStyle = {
    '--controls-right': isDesktop && desktopPanelOpen ? `${panelWidth + 32}px` : undefined,
    '--controls-bottom': isDesktop ? undefined : `${sheetPeekHeight + 12}px`,
    // La atribución de OpenStreetMap debe verse: en móvil queda justo encima de la hoja.
    '--attribution-bottom': isDesktop
      ? undefined
      : `${sheetPeekHeight + 4 + (controlsInRow && veryNarrow ? 52 : 0)}px`,
  } as CSSProperties

  return (
    <div className={styles.app} data-layout={isDesktop ? 'desktop' : 'mobile'}>
      <button
        type="button"
        className={styles.skipLink}
        onClick={() => searchInputRef.current?.focus()}
      >
        {t('a11y.skipToSearch')}
      </button>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <main
        className={styles.stage}
        style={stageStyle}
        data-controls={controlsInRow ? 'row' : 'column'}
      >
        <h1 className="visually-hidden">{encabezadoDe(state, catalog)}</h1>
        <MapErrorBoundary onError={onMapCrash}>
          <Suspense
            fallback={
              <div className={styles.mapFallback} role="status">
                {t('map.loading')}
              </div>
            }
          >
            <MapView
              plazas={catalog.plazas}
              placeCounts={experience.placeCounts}
              matchCounts={experience.matchCounts}
              selectedPlazaId={state.selectedPlazaId}
              onSelectPlaza={selectPlaza}
              padding={padding}
              compact={!isDesktop}
              realismo={realismo}
              medir={medir}
              onStatusChange={onMapStatus}
              onMapInstance={setMap}
            />
          </Suspense>
        </MapErrorBoundary>

        <header
          ref={topbarRef}
          className={styles.topbar}
          style={isDesktop && desktopPanelOpen ? { right: `${panelWidth + 32}px` } : undefined}
        >
          <div className={styles.topRow}>
            <div className={styles.searchCard}>
              {/* Sobre el mapa, solo el símbolo: el nombre lo lleva el <h1> para quien
                  escucha, y la barra superior ya va justa de ancho con el buscador. */}
              <Brand compact />
              <SearchBar
                value={state.searchQuery}
                onChange={(query) => dispatch({ type: 'setQuery', query })}
                inputRef={searchInputRef}
              />
              {/* El idioma se cambia de un toque y desde cualquier vista, no escondido en una hoja. */}
              <LocaleSwitch />
              {isDesktop && !desktopPanelOpen && (
                <button
                  type="button"
                  className={styles.listButton}
                  onClick={() => dispatch({ type: 'openList' })}
                >
                  <List aria-hidden="true" />
                  {t('explore.openList')}
                </button>
              )}
            </div>
            {/* Tu rincón, fuera de la tarjeta y en la esquina donde se busca una cuenta. */}
            <ProfileButton onOpenInfo={openInfo} onOpenPlace={openPlace} />
          </div>
          {!online && (
            <div className={styles.notice} data-tone="offline">
              <WifiOff aria-hidden="true" className={styles.noticeIcon} />
              <p>{t('network.offline')}</p>
            </div>
          )}
          {state.missingLinkNotice && (
            <div className={styles.notice}>
              <p>{t('link.missing')}</p>
              <button
                type="button"
                className={styles.noticeClose}
                onClick={() => dispatch({ type: 'dismissNotice' })}
                aria-label={t('link.dismiss')}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          )}
          <FilterBar
            categories={experience.visibleCategories}
            categoryCounts={experience.categoryCounts}
            totalCount={experience.totalCount}
            activeCategoryId={state.activeCategoryId}
            onCategoryChange={setCategory}
            categoryHref={categoryHref}
            plazas={experience.activePlazas}
            selectedPlazaId={state.selectedPlazaId}
            onPlazaChange={selectPlaza}
            favoritesCount={favoritesCount}
            favoritesOnly={state.favoritesOnly}
            onToggleFavorites={() => dispatch({ type: 'toggleFavoritesOnly' })}
            openNowCount={experience.openNowCount}
            openNowOnly={state.openNowOnly}
            onToggleOpenNow={() => dispatch({ type: 'toggleOpenNow' })}
            filtersActive={filtersActive}
            onClear={(event?: { detail?: number }) => {
              clearFilters()
              selectPlaza(null)
              returnFocus(event)
            }}
          />
        </header>

        {/*
         * En escritorio la franja de la guía vive en el mapa, sobre la atribución. Va en un
         * <footer> y no en un <div>: es el pie de la guía (quién la hace y cómo corregirla) y,
         * dentro de <main>, no añade ningún punto de referencia extra para el lector de pantalla.
         * De paso le da al generador de la imagen social algo estable que ocultar, porque las
         * clases de los módulos CSS llevan un hash distinto en cada build.
         */}
        {isDesktop && (
          <footer className={styles.guideBar}>
            <GuideBar onOpen={openInfo} />
          </footer>
        )}
      </main>

      {isDesktop ? (
        <DesktopSidePanel open={desktopPanelOpen} contentKey={contentKey}>
          {content}
        </DesktopSidePanel>
      ) : (
        <BottomSheet
          expanded={state.sheetExpanded}
          onExpandedChange={(expanded) => dispatch({ type: 'setSheetExpanded', expanded })}
          peek={sheetPeek}
          topReserved={sheetTopReserved}
          contentKey={contentKey}
        >
          {content}
        </BottomSheet>
      )}

      {state.infoTopic && state.infoTopic !== 'tutorial' && (
        <Suspense fallback={null}>
          <InfoDialog
            topic={state.infoTopic}
            onClose={() => dispatch({ type: 'closeInfo' })}
            onGoTo={openInfo}
          />
        </Suspense>
      )}

      {/*
       * El tutorial se abre de dos maneras y se cierra de una. Solo en la primera visita sale sin
       * tocar la URL, porque cambiarla al entrar dejaría /info/tutorial como puerta de la guía y
       * como lo que se copia de la barra de direcciones. Abierto a propósito desde los enlaces sí
       * tiene ruta, y entonces el botón atrás lo cierra como a las otras tres ventanas.
       */}
      {(state.tutorialVisible || state.infoTopic === 'tutorial') && (
        <Suspense fallback={null}>
          <OnboardingModal
            open
            onClose={() => {
              dispatch({ type: 'dismissTutorial' })
              if (state.infoTopic === 'tutorial') dispatch({ type: 'closeInfo' })
            }}
          />
        </Suspense>
      )}

      {MapDebugPanel && debugRequested && map && (
        <Suspense fallback={null}>
          <MapDebugPanel map={map} />
        </Suspense>
      )}
    </div>
  )
}
