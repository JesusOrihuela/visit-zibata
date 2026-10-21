/** PlazaPanel: nombre, descripción, nº de lugares, categorías y lista de establecimientos. */
import { ArrowUpRight, MapPin, SearchX, X } from 'lucide-react'
import { type CSSProperties, useEffect, useRef } from 'react'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { DEFAULT_PLAZA_TONE, plazaTones } from '../../config/palette.ts'
import { useCatalog } from '../../data/CatalogContext.tsx'
import { localized, t } from '../../i18n/index.ts'
import { registrar } from '../../lib/eventos.ts'
import { focusPanelHeading } from '../../lib/focus.ts'
import { plazaDirectionsUrl } from '../../lib/maps-url.ts'
import type { Place, Plaza } from '../../types/domain.ts'
import { PlaceList } from '../places/PlaceList.tsx'
import { CategoryChips } from './CategoryChips.tsx'
import styles from './Panel.module.css'

interface PlazaPanelProps {
  plaza: Plaza
  /** Lugares de la plaza que cumplen los filtros actuales. */
  places: readonly Place[]
  /** Lugares de la plaza por categoría con búsqueda y favoritos aplicados (los mismos que la barra superior). */
  categoryCounts: ReadonlyMap<string, number>
  filtersActive: boolean
  activeCategoryId: string | null
  onCategoryChange: (categoryId: string | null) => void
  onClearFilters: () => void
  onOpenPlace: (place: Place) => void
  onClose: () => void
}

export function PlazaPanel({
  plaza,
  places,
  categoryCounts,
  filtersActive,
  activeCategoryId,
  onCategoryChange,
  onClearFilters,
  onOpenPlace,
  onClose,
}: PlazaPanelProps) {
  const catalog = useCatalog()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const allPlaces = catalog.placesByPlaza.get(plaza.id) ?? []
  // El mismo color que la plaza tiene en el mapa: al abrir el panel se reconoce de dónde viene.
  const tone =
    plazaTones(catalog.plazas.filter((item) => item.active).map((item) => item.id)).get(plaza.id) ??
    DEFAULT_PLAZA_TONE
  const categories = plaza.categories
    .map((id) => catalog.categoryById.get(id))
    .filter((category) => category !== undefined)

  // biome-ignore lint/correctness/useExhaustiveDependencies: el foco se mueve al título cada vez que cambia la plaza mostrada.
  useEffect(() => {
    focusPanelHeading(headingRef.current)
  }, [plaza.id])

  return (
    <section
      className={styles.panel}
      style={{ '--plaza-accent': tone.accent } as CSSProperties}
      aria-labelledby="plaza-panel-title"
    >
      <header className={styles.header} data-sello="plaza">
        {/*
         * El matasellos: decoración de fondo, no un dato. Lleva el nombre de la zona en el color de
         * esa zona, al 14 %, y el texto le pasa por encima sin apartarse. Es lo único de la guía que
         * está ahí solo por carácter, y por eso aparece una vez por panel y nunca en una fila.
         */}
        <span className={styles.sello} aria-hidden="true">
          {plaza.name}
        </span>
        <div className={styles.topline}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            {t('plaza.label')} · {t('places.count', { count: allPlaces.length })}
          </p>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t('panel.close')}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <h2 id="plaza-panel-title" ref={headingRef} tabIndex={-1} className={styles.title}>
          {plaza.name}
        </h2>
        {plaza.description && <p className={styles.lead}>{localized(plaza.description)}</p>}
        <p className={styles.address}>
          {plaza.address && (
            <span className={styles.addressText}>
              <MapPin aria-hidden="true" />
              {plaza.address}
            </span>
          )}
          {/* `data-nosnippet` no vale en un `<a>`: se envuelve, y el envoltorio no genera caja. */}
          <span className={styles.sinFragmento} data-nosnippet="">
            <a
              className={styles.inlineLink}
              href={plazaDirectionsUrl(plaza)}
              onClick={() => registrar('salida', plaza.id, 'maps')}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('plaza.directions')}
              <ArrowUpRight aria-hidden="true" />
            </a>
          </span>
        </p>
      </header>

      {categories.length > 1 && (
        <CategoryChips
          categories={categories}
          counts={categoryCounts}
          totalCount={places.length}
          activeId={activeCategoryId}
          onChange={onCategoryChange}
          label={t('filters.categories')}
        />
      )}

      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{t('plaza.places')}</h3>
        <span className={styles.count}>
          {filtersActive
            ? t('filters.results', { count: places.length })
            : t('places.count', { count: places.length })}
        </span>
      </div>

      {allPlaces.length === 0 ? (
        <p className={styles.note}>{t('plaza.empty')}</p>
      ) : places.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title={t('results.empty.title')}
          action={
            <button type="button" className={styles.textButton} onClick={onClearFilters}>
              {t('plaza.showAll')}
            </button>
          }
        >
          {t('plaza.filteredEmpty')}
        </EmptyState>
      ) : (
        <>
          <PlaceList places={places} onOpen={onOpenPlace} label={t('plaza.places')} byOpenNow />
          {filtersActive && (
            <button type="button" className={styles.textButton} onClick={onClearFilters}>
              {t('plaza.showAll')}
            </button>
          )}
        </>
      )}
    </section>
  )
}
