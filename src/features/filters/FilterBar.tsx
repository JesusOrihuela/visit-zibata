/** FilterBar: categorías, zona y las dos condiciones, cada familia con su propia forma. */
import { ChevronDown, Clock, Heart } from 'lucide-react'
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
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
  categoryHref: (categoryId: string | null) => string
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
  categoryHref,
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
  const listaId = useId()
  const botonRef = useRef<HTMLButtonElement>(null)
  const cajaRef = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
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

  /*
   * La lista la dibuja la app y no el navegador.
   *
   * El desplegable nativo se ancla a la caja del `select`, que empieza después del alfiler y no mide
   * lo mismo que el texto: abría corrido a la derecha, se redimensionaba al aparecer y solo
   * respondía a los clics sobre su propio texto. Con una lista propia, el botón es toda la cápsula y
   * el ancho lo decide el CSS.
   */
  const opciones = useMemo(
    () => [
      { id: null, nombre: t('filters.allPlazas') },
      ...plazas.map((plaza) => ({ id: plaza.id, nombre: plaza.name })),
    ],
    [plazas],
  )
  const indiceElegido = Math.max(
    0,
    opciones.findIndex((opcion) => opcion.id === selectedPlazaId),
  )
  const etiquetaZona = opciones[indiceElegido]?.nombre ?? t('filters.allPlazas')

  const abrir = (): void => {
    setActivo(indiceElegido)
    setAbierto(true)
  }
  const cerrar = (): void => {
    setAbierto(false)
    botonRef.current?.focus()
  }
  const elegir = (indice: number): void => {
    onPlazaChange(opciones[indice]?.id ?? null)
    setAbierto(false)
    botonRef.current?.focus()
  }

  // Un clic fuera cierra la lista; el foco no se mueve porque no lo tenía.
  useEffect(() => {
    if (!abierto) return
    const fuera = (event: PointerEvent): void => {
      if (!cajaRef.current?.contains(event.target as Node)) setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  const alTeclear = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const total = opciones.length
    if (event.key === 'Escape') {
      if (abierto) {
        event.preventDefault()
        cerrar()
      }
      return
    }
    if (event.key === 'Tab') {
      setAbierto(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!abierto) {
        abrir()
        return
      }
      const paso = event.key === 'ArrowDown' ? 1 : -1
      setActivo((actual) => (actual + paso + total) % total)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      if (!abierto) return
      event.preventDefault()
      setActivo(event.key === 'Home' ? 0 : total - 1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (abierto) elegir(activo)
      else abrir()
    }
  }

  return (
    <div className={styles.bar}>
      <CategoryChips
        categories={categories}
        counts={categoryCounts}
        totalCount={totalCount}
        activeId={activeCategoryId}
        onChange={onCategoryChange}
        hrefFor={categoryHref}
        label={t('filters.categories')}
        variant="floating"
      />
      <div className={styles.row}>
        {/*
         * La zona: un campo, y dentro el mismo alfiler que marca esa zona en el mapa, en miniatura y
         * con su color. No un icono de ubicación de catálogo: la pieza que vas a buscar con los ojos.
         */}
        <div className={styles.zonaCaja}>
          <button
            type="button"
            ref={botonRef}
            className={styles.zone}
            data-active={selectedPlazaId !== null}
            style={tonoDeZona ? ({ '--plaza-accent': tonoDeZona } as CSSProperties) : undefined}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={abierto}
            aria-controls={listaId}
            aria-activedescendant={abierto ? `${listaId}-${activo}` : undefined}
            aria-label={t('filters.plaza')}
            onClick={() => (abierto ? cerrar() : abrir())}
            onKeyDown={alTeclear}
          >
            <span className={styles.mini} aria-hidden="true" />
            <span className={styles.valor}>{etiquetaZona}</span>
            <ChevronDown aria-hidden="true" className={styles.chevron} />
          </button>
          {abierto && (
            <div
              id={listaId}
              role="listbox"
              tabIndex={-1}
              className={styles.lista}
              aria-label={t('filters.plaza')}
            >
              {opciones.map((opcion, indice) => (
                <div
                  key={opcion.id ?? 'todas'}
                  id={`${listaId}-${indice}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={opcion.id === selectedPlazaId}
                  data-activo={indice === activo}
                  className={styles.opcion}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    elegir(indice)
                  }}
                  onMouseEnter={() => setActivo(indice)}
                >
                  {opcion.nombre}
                </div>
              ))}
            </div>
          )}
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
