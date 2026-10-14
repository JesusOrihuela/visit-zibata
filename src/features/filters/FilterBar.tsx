/** FilterBar: categorías, zona y las dos condiciones, cada familia con su propia forma. */
import { ChevronDown, Clock, Heart } from 'lucide-react'
import { type CSSProperties, useId } from 'react'
import { plazaTones } from '../../config/palette.ts'
import { t } from '../../i18n/index.ts'
import type { Category, Plaza } from '../../types/domain.ts'
import { CategoryChips } from '../plazas/CategoryChips.tsx'
import styles from './FilterBar.module.css'

/**
 * El embudo tachado de "quitar filtros", dibujado aquí porque no existe en el juego de iconos.
 *
 * El lado derecho del embudo se corta a media altura en vez de bajar hasta la boca: así el redondel
 * de la cruz ocupa ese hueco en lugar de montarse encima, y el conjunto se lee como un dibujo y no
 * como dos iconos pegados. Va a 19 px y no a los 15 del resto: son tres figuras y la más pequeña es
 * una cuarta parte del total, así que a 15 el redondel se cierra y la cruz queda en una mancha.
 */
function QuitarFiltros() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.9 3h18.2l-7.3 10.9" />
      <path d="M2.9 3 10 13.9v6.4l2.3 1.2" />
      <circle cx="17.3" cy="18.7" r="4" />
      <path d="m15.8 17.2 3 3M18.8 17.2l-3 3" />
    </svg>
  )
}

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
  onClear,
}: FilterBarProps) {
  const selectId = useId()
  const hasSelection = filtersActive || selectedPlazaId !== null
  /*
   * El tono de la zona elegida, para el alfiler en miniatura. `plazaTones` reparte por posición, así
   * que la lista tiene que ser la misma que usan el mapa y los paneles: las plazas activas del
   * catálogo, que es exactamente lo que llega en `plazas`.
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
        {/*
         * La zona: un campo, y dentro el mismo alfiler que marca esa zona en el mapa, en miniatura y
         * con su color. No un icono de ubicación de catálogo: la pieza que vas a buscar con los ojos.
         */}
        <div
          className={styles.zone}
          data-active={selectedPlazaId !== null}
          style={tonoDeZona ? ({ '--plaza-accent': tonoDeZona } as CSSProperties) : undefined}
        >
          <span className={styles.mini} aria-hidden="true" />
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
         * Las dos condiciones: interruptores, no pastillas.
         *
         * El nombre va oculto a la vista y presente para quien escucha, así que el nombre accesible
         * sigue siendo "Abierto ahora 8". A la vista queda el icono dentro de la perilla y la cifra
         * en el hueco que la perilla deja libre: cero texto, 62 px por control.
         *
         * Cada uno solo aparece si puede dar resultados: a las cuatro de la mañana no hay abiertos y
         * la fila se queda con una sola condición, que sigue leyéndose bien.
         */}
        {(openNowCount > 0 || openNowOnly) && (
          <button
            type="button"
            className={styles.toggle}
            data-tono="abierto"
            aria-pressed={openNowOnly}
            onClick={onToggleOpenNow}
          >
            <span className="visually-hidden">{t('filters.openNow')}</span>
            <span className={styles.track}>
              <span className={styles.knob}>
                <Clock aria-hidden="true" />
              </span>
              <span className={styles.count}>{openNowCount}</span>
            </span>
          </button>
        )}

        {(favoritesCount > 0 || favoritesOnly) && (
          <button
            type="button"
            className={styles.toggle}
            data-tono="favorito"
            aria-pressed={favoritesOnly}
            onClick={onToggleFavorites}
          >
            <span className="visually-hidden">{t('favorites.filter')}</span>
            <span className={styles.track}>
              <span className={styles.knob}>
                <Heart aria-hidden="true" fill={favoritesOnly ? 'currentColor' : 'none'} />
              </span>
              <span className={styles.count}>{favoritesCount}</span>
            </span>
          </button>
        )}

        {/*
         * La salida: lo único de la fila que ejecuta, y por eso lo único en tinta.
         *
         * Sin cifra. La llevó una versión y no se entendía: contaba filtros puestos, pero el control
         * no dice en ningún momento que cuente filtros, y con el embudo tachado el dibujo ya dice lo
         * que hace. Además los filtros puestos se ven en la misma fila, a dos centímetros.
         */}
        {hasSelection && (
          <button type="button" className={styles.clear} onClick={onClear}>
            <span className="visually-hidden">{t('filters.clear')}</span>
            <QuitarFiltros />
          </button>
        )}
      </div>
    </div>
  )
}
