/** Resultados de búsqueda / filtros agrupados por plaza, con estado vacío claro. */
import { SearchX, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { DEFAULT_PLAZA_TONE, plazaTones } from '../../config/palette.ts'
import { useCatalog } from '../../data/CatalogContext.tsx'
import { t, useLocale } from '../../i18n/index.ts'
import { alPulsarEnlace } from '../../lib/navegacion.ts'
import { rutaDeZona } from '../../lib/url-state.ts'
import type { Place } from '../../types/domain.ts'
import { groupByPlaza } from '../filters/filters.ts'
import { PlaceList } from '../places/PlaceList.tsx'
import styles from './Panel.module.css'

interface ResultsPanelProps {
  places: readonly Place[]
  onOpenPlace: (place: Place) => void
  onSelectPlaza: (plazaId: string) => void
  onClearFilters: () => void
}

export function ResultsPanel({
  places,
  onOpenPlace,
  onSelectPlaza,
  onClearFilters,
}: ResultsPanelProps) {
  const catalog = useCatalog()
  const idioma = useLocale()
  const tones = plazaTones(catalog.plazas.filter((plaza) => plaza.active).map((plaza) => plaza.id))
  const groups = groupByPlaza(places)

  return (
    <section className={styles.panel} aria-labelledby="results-title">
      <header className={styles.header}>
        <div className={styles.topline}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            <span>{t('filters.results', { count: places.length })}</span>
          </p>
          <button
            type="button"
            className={styles.close}
            onClick={onClearFilters}
            aria-label={t('filters.clear')}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <h2 id="results-title" className={styles.title}>
          {t('results.title')}
        </h2>
      </header>

      {places.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title={t('results.empty.title')}
          action={
            <button type="button" className={styles.textButton} onClick={onClearFilters}>
              {t('filters.clear')}
            </button>
          }
        >
          {t('results.empty.body')}
        </EmptyState>
      ) : (
        groups.map(([plazaId, groupPlaces]) => {
          const plaza = catalog.plazaById.get(plazaId)
          if (!plaza) return null
          return (
            /*
             * El color de la plaza se pone aquí, en el grupo, y lo heredan por CSS el encabezado y
             * las fotos de sus tarjetas. Una búsqueda que mezcla zonas se lee de un vistazo: cada
             * grupo trae el color con el que esa plaza se ve en el mapa.
             */
            <div
              key={plazaId}
              className={styles.group}
              style={
                {
                  '--plaza-accent': (tones.get(plazaId) ?? DEFAULT_PLAZA_TONE).accent,
                } as CSSProperties
              }
            >
              {/* La cabecera es el enlace a esa zona: la zona tiene dirección propia. */}
              <a
                className={styles.groupHeader}
                href={rutaDeZona(plaza.slug, idioma, import.meta.env.BASE_URL)}
                onClick={alPulsarEnlace(() => onSelectPlaza(plazaId))}
              >
                <span className={styles.groupName}>{plaza.name}</span>
                <span className={styles.count}>
                  {t('places.matching', { count: groupPlaces.length })}
                </span>
              </a>
              <PlaceList places={groupPlaces} onOpen={onOpenPlace} label={plaza.name} />
            </div>
          )
        })
      )}
    </section>
  )
}
