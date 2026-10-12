/** FilterBar: categoría + plaza (combinables), favoritos, nº de resultados y limpiar filtros. */
import { ChevronDown, Clock, Heart, MapPin } from 'lucide-react'
import { useId } from 'react'
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
        <div className={styles.select} data-active={selectedPlazaId !== null}>
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
         * La pastilla solo aparece si hay algo abierto, igual que la de favoritos solo aparece si
         * hay favoritos: un filtro que no puede dar resultados estorba más de lo que ayuda. A las
         * cuatro de la mañana desaparece sola.
         */}
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
