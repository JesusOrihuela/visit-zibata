/** FilterBar: categoría + plaza (combinables), favoritos, nº de resultados y limpiar filtros. */
import { ChevronDown, Clock, Heart, MapPin } from 'lucide-react'
import { type CSSProperties, useId } from 'react'
import { plazaTones } from '../../config/palette.ts'
import { t } from '../../i18n/index.ts'
import type { Category, Plaza } from '../../types/domain.ts'
import { CategoryChips } from '../plazas/CategoryChips.tsx'
import styles from './FilterBar.module.css'

interface FilterBarProps {
  categories: readonly Category[]
  categoryCounts: ReadonlyMap<string, number>
  totalCount: number
  activeCategoryId: string | null
  onCategoryChange: (categoryId: string | null) => void
  plazas: readonly Plaza[]
  selectedPlazaId: string | null
  onPlazaChange: (plazaId: string | null) => void
  favoritesCount: number
  favoritesOnly: boolean
  onToggleFavorites: () => void
  /** Cuántos están abiertos en este momento, con los demás filtros ya aplicados. */
  openNowCount: number
  openNowOnly: boolean
  onToggleOpenNow: () => void
  filtersActive: boolean
  resultCount: number
  onClear: () => void
}

export function FilterBar({
  categories,
  categoryCounts,
  totalCount,
  activeCategoryId,
  onCategoryChange,
  plazas,
  selectedPlazaId,
  onPlazaChange,
  favoritesCount,
  favoritesOnly,
  onToggleFavorites,
  openNowCount,
  openNowOnly,
  onToggleOpenNow,
  filtersActive,
  resultCount,
  onClear,
}: FilterBarProps) {
  const selectId = useId()
  const hasSelection = filtersActive || selectedPlazaId !== null
  /*
   * El tono de la zona elegida, para que el selector se pinte de su color. `plazaTones` reparte por
   * posición, así que la lista tiene que ser la misma que usan el mapa y los paneles: las plazas
   * activas del catálogo, que es exactamente lo que llega en `plazas`.
   */
  const tonoDeZona =
    selectedPlazaId === null
      ? null
      : (plazaTones(plazas.map((plaza) => plaza.id)).get(selectedPlazaId)?.accent ?? null)

  return (
    <div className={styles.bar}>
      <CategoryChips
        categories={categories}
        counts={categoryCounts}
        totalCount={totalCount}
        activeId={activeCategoryId}
        onChange={onCategoryChange}
        label={t('filters.categories')}
        variant="floating"
      />
      <div className={styles.row}>
        <div
          className={styles.select}
          data-active={selectedPlazaId !== null}
          style={tonoDeZona ? ({ '--plaza-accent': tonoDeZona } as CSSProperties) : undefined}
        >
          <MapPin aria-hidden="true" />
          <label htmlFor={selectId} className="visually-hidden">
            {t('filters.plaza')}
          </label>
          <select
            id={selectId}
            value={selectedPlazaId ?? ''}
            onChange={(event) => onPlazaChange(event.target.value || null)}
          >
            <option value="">{t('filters.allPlazas')}</option>
            {plazas.map((plaza) => (
              <option key={plaza.id} value={plaza.id}>
                {plaza.name}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className={styles.chevron} />
        </div>

        {/*
         * Los dos interruptores viven en una sola superficie, separados por un filete.
         *
         * Antes eran dos pastillas sueltas e iguales a todo lo demás, y la fila entera se leía como
         * una hilera de cápsulas sin jerarquía: el selector de zona, los dos interruptores y el
         * resumen tenían la misma forma siendo cuatro cosas distintas. Agrupados se leen como lo que
         * son, un par de llaves que se encienden y se apagan, y de paso la fila pasa de cuatro
         * objetos a tres.
         *
         * Cada uno solo aparece si puede dar resultados: a las cuatro de la mañana no hay abiertos y
         * el grupo se queda con una sola llave, que sigue leyéndose bien.
         */}
        {(openNowCount > 0 || openNowOnly || favoritesCount > 0 || favoritesOnly) && (
          <fieldset className={styles.switches} aria-label={t('filters.switches')}>
            {(openNowCount > 0 || openNowOnly) && (
              <button
                type="button"
                className={styles.toggle}
                data-abierto="si"
                aria-pressed={openNowOnly}
                onClick={onToggleOpenNow}
              >
                <Clock aria-hidden="true" />
                {t('filters.openNow')}
                <span className={styles.badge}>{openNowCount}</span>
              </button>
            )}

            {(favoritesCount > 0 || favoritesOnly) && (
              <button
                type="button"
                className={styles.toggle}
                aria-pressed={favoritesOnly}
                onClick={onToggleFavorites}
              >
                <Heart aria-hidden="true" fill={favoritesOnly ? 'currentColor' : 'none'} />
                {t('favorites.filter')}
                <span className={styles.badge}>{favoritesCount}</span>
              </button>
            )}
          </fieldset>
        )}

        {hasSelection && (
          <p className={styles.summary}>
            {/* Elegir plaza también acota la lista: el conteo aparece igual que con los demás filtros. */}
            <span className={styles.results}>{t('filters.results', { count: resultCount })}</span>
            <button type="button" className={styles.clear} onClick={onClear}>
              {t('filters.clear')}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
