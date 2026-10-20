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
         * Las dos condiciones: interruptores desnudos, y la cuenta como texto suelto al lado.
         *
         * El interruptor es la forma de un sí o no y se lee como tal sin que nadie lo explique: una
         * vía y una perilla que se mueve. Tuvo rótulo y pastilla, y las dos se van juntas, porque
         * eran la misma pieza: un interruptor con texto al lado necesita algo que los una, y ese
         * algo era la caja que este catálogo quita.
         *
         * El nombre no desaparece, cambia de sitio. Va en `aria-label` con la cuenta dentro, así que
         * un lector dice "Abierto ahora, 23, interruptor" aunque en pantalla solo haya un reloj. El
         * costo queda escrito en el catálogo: sin rótulo, el reloj y el corazón se sostienen solos.
         *
         * La cuenta tampoco se ve, y es deliberado. Estuvo al lado, suelta y sin fondo, y no decía
         * nada que hiciera falta: el selector de zona nunca la ha llevado y no se echa en falta,
         * porque lo que importa de un filtro es si está puesto, no cuántos deja. Lo que sí se ve,
         * en la fila de abajo, es el número de resultados.
         *
         * `role="switch"` y no `aria-pressed`: lo primero es un ajuste que queda puesto, que es lo
         * que esto es, y lo segundo es un botón que se queda hundido.
         *
         * Cada uno solo aparece si puede dar resultados: a las cuatro de la mañana no hay abiertos y
         * la fila se queda con una sola condición, que sigue leyéndose bien.
         */}
        {(openNowCount > 0 || openNowOnly) && (
          <button
            type="button"
            className={styles.interruptor}
            role="switch"
            aria-checked={openNowOnly}
            aria-label={`${t('filters.openNow')}, ${openNowCount}`}
            onClick={onToggleOpenNow}
          >
            <span className={styles.via}>
              <span className={styles.perilla}>
                <Clock aria-hidden="true" />
              </span>
            </span>
          </button>
        )}

        {(favoritesCount > 0 || favoritesOnly) && (
          <button
            type="button"
            className={styles.interruptor}
            role="switch"
            aria-checked={favoritesOnly}
            aria-label={`${t('favorites.filter')}, ${favoritesCount}`}
            onClick={onToggleFavorites}
          >
            <span className={styles.via}>
              <span className={styles.perilla}>
                <Heart aria-hidden="true" fill={favoritesOnly ? 'currentColor' : 'none'} />
              </span>
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
