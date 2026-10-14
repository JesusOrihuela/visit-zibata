/**
 * Marcadores HTML de plazas: botones accesibles (teclado y lector de pantalla) anclados al mapa.
 * Muestran nombre y número de lugares. Nunca se superponen: los de menor prioridad prueban a desplazar
 * la etiqueta a un lado o a elevarla con un tallo más largo, o se reducen a la cifra. Solo si aun así
 * no caben se ocultan hasta que el usuario se acerca.
 * Prioridad: plaza seleccionada y luego más lugares.
 */
import { type Map as MapLibreMap, Marker } from 'maplibre-gl'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_PLAZA_TONE, plazaTones } from '../../config/palette.ts'
import { t } from '../../i18n/index.ts'
import type { Plaza } from '../../types/domain.ts'
import styles from './PlazaMarkers.module.css'

interface PlazaMarkersProps {
  map: MapLibreMap
  plazas: readonly Plaza[]
  placeCounts: ReadonlyMap<string, number>
  matchCounts: ReadonlyMap<string, number> | null
  selectedPlazaId: string | null
  hoveredPlazaId: string | null
  onHover: (plazaId: string | null) => void
  onSelect: (plazaId: string) => void
}

type Mode = 'full' | 'left' | 'right' | 'compact' | 'dot' | 'hidden'
/** Niveles de elevación de la etiqueta (0 = junto al punto; cada nivel alarga el tallo). */
type Lift = 0 | 1 | 2
interface Placement {
  mode: Mode
  lift: Lift
}
interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

/** Por debajo de este zoom todas las plazas muestran solo la cifra. */
const COMPACT_BELOW_ZOOM = 14.3
const MARKER_HEIGHT = 44
const COMPACT_WIDTH = 34
/** Último recurso: un punto pulsable (24 px, el mínimo táctil) que mantiene la plaza en el mapa. */
const DOT_SIZE = 24
const GAP = 4
/** Lo que sube la etiqueta por nivel de elevación (debe coincidir con PlazaMarkers.module.css). */
const LIFT_STEP = MARKER_HEIGHT + GAP
/** Cuánto sobresale una etiqueta desplazada hacia el lado del tallo (≈1.1rem). */
const SHIFT_OVERHANG = 17.6
const EDGE_RESERVED_RIGHT = 64

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right + GAP &&
  a.right > b.left - GAP &&
  a.top < b.bottom + GAP &&
  a.bottom > b.top - GAP

export function PlazaMarkers({
  map,
  plazas,
  placeCounts,
  matchCounts,
  selectedPlazaId,
  hoveredPlazaId,
  onHover,
  onSelect,
}: PlazaMarkersProps) {
  const activePlazas = useMemo(() => plazas.filter((plaza) => plaza.active), [plazas])
  // Mismo reparto de tonos que el estilo del mapa (buildMapStyle): la etiqueta y su plaza combinan.
  const tones = useMemo(() => plazaTones(activePlazas.map((plaza) => plaza.id)), [activePlazas])
  const [elements, setElements] = useState<Map<string, HTMLElement>>(new Map())
  const [modes, setModes] = useState<ReadonlyMap<string, Placement>>(new Map())
  const [focusedPlazaId, setFocusedPlazaId] = useState<string | null>(null)
  /** La plaza bajo el cursor, para el orden de capas, sin rehacer la colocación al pasar por encima. */
  const hoveredIdRef = useRef(hoveredPlazaId)
  hoveredIdRef.current = hoveredPlazaId
  const fullWidths = useRef(new Map<string, number>())
  /**
   * Cuántos anchos reales de etiqueta se han aprendido. La pasada extra tras cambiar de modo solo tiene
   * sentido mientras aparezcan anchos nuevos; sin este contador, dos plazas podían turnarse la etiqueta
   * (una cabe con el ancho estimado pero no con el real, la otra al revés) y el mapa se quedaba
   * recolocando marcadores en bucle, que es lo que se veía como animación trabada.
   */
  const widthsVersion = useRef(0)
  const relayout = useRef(() => {})

  useEffect(() => {
    const created = new Map<string, HTMLElement>()
    const markers = activePlazas.map((plaza) => {
      const element = document.createElement('div')
      element.className = styles.anchor ?? ''
      created.set(plaza.id, element)
      return new Marker({ element, anchor: 'bottom', subpixelPositioning: true })
        .setLngLat([plaza.coordinates.lng, plaza.coordinates.lat])
        .addTo(map)
    })
    setElements(created)
    return () => {
      for (const marker of markers) marker.remove()
    }
  }, [map, activePlazas])

  // La colocación se recalcula al mover el mapa y también cuando cambian selección o conteos (búsqueda y
  // filtros cambian el ancho de las etiquetas y la prioridad).
  useEffect(() => {
    const count = (id: string) => matchCounts?.get(id) ?? placeCounts.get(id) ?? 0
    const priority = [...activePlazas]
      .sort((a, b) => {
        if (a.id === selectedPlazaId) return -1
        if (b.id === selectedPlazaId) return 1
        return count(b.id) - count(a.id)
      })
      .map((plaza) => plaza.id)
    let frame = 0
    const layout = () => {
      frame = 0
      const allCompact = map.getZoom() < COMPACT_BELOW_ZOOM
      const container = map.getContainer().getBoundingClientRect()
      // Margen derecho reservado a los controles del mapa; superior e inferior, a la barra de búsqueda y
      // filtros y a la hoja (el padding del mapa): una etiqueta tapada no se puede pulsar ni leer. Con el
      // zoom mínimo (móvil en horizontal) no todas las plazas caben entre ambas.
      const { top = 0, bottom = 0 } = map.getPadding()
      const topBar = container.top + top
      const bottomBar = container.bottom - bottom
      const insideView = (rect: Rect) =>
        rect.left >= container.left + 8 &&
        rect.right <= container.right - EDGE_RESERVED_RIGHT &&
        rect.top >= topBar &&
        rect.bottom <= bottomBar
      const placed = new Map<string, Rect>()
      /** Plazas reducidas a un punto: un punto puede rozar una etiqueta, pero no a otro punto. */
      const dots = new Set<string>()
      // Puntos colocados sin hueco limpio: van por delante para poder pulsarse.
      const forzados = new Set<string>()
      const next = new Map<string, Placement>()
      const collides = (rect: Rect, onlyDots = false) =>
        [...placed].some(([id, other]) => (!onlyDots || dots.has(id)) && overlaps(rect, other))
      /*
       * Un sitio está libre si cabe en la vista y no pisa a nadie. También el punto, que antes solo
       * se comparaba contra otros puntos.
       *
       * Esa excepción tenía un costo que se vio al crecer la barra de filtros: un punto podía quedar
       * bajo la insignia de la vecina y entonces no se podía pulsar, aunque se viera. Pero quitarla a
       * secas rompe algo más importante, que `map.spec.ts` fija: **todas las plazas activas tienen
       * que estar representadas en la vista inicial**.
       *
       * Así que se cumplen las dos: el punto prefiere un sitio limpio y, si no hay ninguno, se coloca
       * igual (`forzados`) y se dibuja por encima. Pierde 24 px de la etiqueta que tapa, que mide
       * mucho más y sigue pulsándose por el resto.
       */
      const free =
        (_kind: 'named' | 'compact' | 'dot') =>
        ([, rect]: [Placement, Rect]) =>
          insideView(rect) && !collides(rect)

      // Posibles colocaciones de cada marcador, según su punto en pantalla y el ancho de su etiqueta.
      const options = new Map<
        string,
        (kind: 'named' | 'compact' | 'dot', lift: Lift) => [Placement, Rect][]
      >()
      const anchors = new Map<string, { x: number; y: number }>()
      for (const id of priority) {
        const element = elements.get(id)
        const button = element?.firstElementChild as HTMLElement | null | undefined
        if (!element || !button) continue
        // El contenedor (botón + tallo) está anclado por su base al punto de la plaza.
        const box = element.getBoundingClientRect()
        const label = button.firstElementChild as HTMLElement | null
        const currentMode = button.dataset.mode
        if (
          label &&
          currentMode !== 'compact' &&
          currentMode !== 'dot' &&
          currentMode !== 'hidden'
        ) {
          const width = label.offsetWidth
          if (fullWidths.current.get(id) !== width) {
            fullWidths.current.set(id, width)
            widthsVersion.current += 1
          }
        }
        const anchorX = box.left + box.width / 2
        const anchorY = box.bottom
        anchors.set(id, { x: anchorX, y: anchorY })
        const name = activePlazas.find((plaza) => plaza.id === id)?.name ?? ''
        const width = fullWidths.current.get(id) ?? name.length * 7.6 + 58
        const rect = (left: number, right: number, lift: Lift): Rect => ({
          left,
          right,
          top: anchorY - MARKER_HEIGHT - lift * LIFT_STEP,
          bottom: anchorY - lift * LIFT_STEP,
        })
        options.set(id, (kind, lift) =>
          kind === 'dot'
            ? [
                [
                  // Centrado en el punto de la plaza (no encima, como la etiqueta): así cabe aunque el
                  // punto quede a un paso del borde superior de la franja libre.
                  { mode: 'dot', lift },
                  {
                    left: anchorX - DOT_SIZE / 2,
                    right: anchorX + DOT_SIZE / 2,
                    top: anchorY - lift * LIFT_STEP - DOT_SIZE / 2,
                    bottom: anchorY - lift * LIFT_STEP + DOT_SIZE / 2,
                  },
                ],
              ]
            : kind === 'compact'
              ? [
                  [
                    { mode: 'compact', lift },
                    rect(anchorX - COMPACT_WIDTH / 2, anchorX + COMPACT_WIDTH / 2, lift),
                  ],
                ]
              : [
                  [{ mode: 'full', lift }, rect(anchorX - width / 2, anchorX + width / 2, lift)],
                  [
                    { mode: 'left', lift },
                    rect(anchorX - width + SHIFT_OVERHANG, anchorX + SHIFT_OVERHANG, lift),
                  ],
                  [
                    { mode: 'right', lift },
                    rect(anchorX - SHIFT_OVERHANG, anchorX + width - SHIFT_OVERHANG, lift),
                  ],
                ],
        )
      }

      // Pasadas de mayor a menor calidad: que todas las plazas se vean pesa más que mostrar el nombre,
      // y ambas cosas más que mantener la etiqueta junto al punto. La última deja un punto pulsable:
      // ninguna plaza desaparece del mapa por falta de sitio.
      const passes: ['named' | 'compact' | 'dot', Lift[]][] = [
        ['named', [0]],
        ['compact', [0]],
        ['named', [1]],
        ['compact', [1, 2]],
        ['dot', [0, 1, 2]],
      ]
      for (const [kind, lifts] of passes) {
        for (const id of priority) {
          const optionsFor = options.get(id)
          if (!optionsFor || next.has(id)) continue
          const selected = id === selectedPlazaId
          // La plaza seleccionada siempre lleva su nombre; las demás, solo con zoom suficiente.
          if (kind === 'named' ? allCompact && !selected : selected) continue
          // Un punto tapado por la hoja no se señala con una etiqueta elevada: se agrupa con una visible.
          const covered = (anchors.get(id)?.y ?? 0) > bottomBar
          const fitting = covered
            ? undefined
            : lifts.flatMap((lift) => optionsFor(kind, lift)).find(free(kind))
          if (fitting) {
            next.set(id, fitting[0])
            placed.set(id, fitting[1])
            if (kind === 'dot') dots.add(id)
          } else if (kind === 'dot' && !covered) {
            // Última pasada y sin hueco limpio: entra igual, encima de lo que haya. Ninguna plaza se
            // queda fuera del mapa, y la que entra así se puede pulsar porque va delante.
            const [placement, rect] = optionsFor('dot', 0)[0] as [Placement, Rect]
            next.set(id, placement)
            placed.set(id, rect)
            dots.add(id)
            forzados.add(id)
          } else if (selected) {
            // Va primera: solo no cabe fuera de la vista; se coloca igualmente.
            const [placement, rect] = optionsFor('named', 0)[0] as [Placement, Rect]
            next.set(id, placement)
            placed.set(id, rect)
          }
        }
      }

      // Sin superponer botones (cada uno conserva su área táctil): lo que no cabe se oculta y se agrupa.
      for (const id of priority) {
        if (options.has(id) && !next.has(id)) next.set(id, { mode: 'hidden', lift: 0 })
      }

      // Quien está más abajo en pantalla está más cerca del observador: va por encima. Sin esto el tallo
      // de una plaza lejana podía cruzar por encima de la etiqueta de una plaza que tiene delante.
      for (const [id, anchor] of anchors) {
        const element = elements.get(id)
        if (!element) continue
        const front = id === selectedPlazaId || id === hoveredIdRef.current
        element.style.zIndex = String(
          Math.round(anchor.y) + (forzados.has(id) ? 5_000 : 0) + (front ? 10_000 : 0),
        )
      }

      setModes((previous) =>
        previous.size === next.size &&
        [...next].every(([id, placement]) => {
          const before = previous.get(id)
          return before?.mode === placement.mode && before.lift === placement.lift
        })
          ? previous
          : next,
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout)
    }
    schedule()
    relayout.current = schedule
    map.on('move', schedule)
    map.on('resize', schedule)
    return () => {
      relayout.current = () => {}
      map.off('move', schedule)
      map.off('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [map, elements, selectedPlazaId, activePlazas, matchCounts, placeCounts])

  // Tras un render que cambia modos, las etiquetas con nombre ya se pueden medir: otra pasada sustituye los
  // anchos estimados por los reales. Solo se repite mientras se aprendan anchos nuevos; en cuanto la pasada
  // no descubre ninguno, se para (si no, dos plazas pueden turnarse la etiqueta indefinidamente).
  const relayoutedAt = useRef(-1)
  // biome-ignore lint/correctness/useExhaustiveDependencies: se reacciona a cada cambio de modos.
  useEffect(() => {
    if (relayoutedAt.current === widthsVersion.current) return
    relayoutedAt.current = widthsVersion.current
    relayout.current()
  }, [modes])

  return (
    <>
      {activePlazas.map((plaza) => {
        const element = elements.get(plaza.id)
        if (!element) return null
        const total = placeCounts.get(plaza.id) ?? 0
        const count = matchCounts?.get(plaza.id) ?? (matchCounts ? 0 : total)
        const dimmed = matchCounts !== null && count === 0
        const selected = plaza.id === selectedPlazaId
        const state = selected
          ? 'selected'
          : plaza.id === hoveredPlazaId
            ? 'hover'
            : dimmed
              ? 'dimmed'
              : 'idle'
        const placement = modes.get(plaza.id)
        const layoutMode = placement?.mode
        // El marcador con foco de teclado nunca se oculta: lo perdería (p. ej. al devolverlo tras cerrar el
        // panel mientras la cámara se mueve) y el lector de pantalla quedaría sin contexto.
        const mode: Mode =
          selected && (layoutMode === 'compact' || layoutMode === 'hidden' || !layoutMode)
            ? 'full'
            : layoutMode === 'hidden' && plaza.id === focusedPlazaId
              ? 'dot'
              : (layoutMode ?? 'compact')
        const lift = mode === 'hidden' ? 0 : (placement?.lift ?? 0)
        const tone = tones.get(plaza.id) ?? DEFAULT_PLAZA_TONE
        const toneStyle = {
          '--plaza-accent': tone.accent,
          '--plaza-soft': tone.soft,
        } as CSSProperties
        return createPortal(
          <>
            <button
              type="button"
              className={styles.marker}
              style={toneStyle}
              data-state={state}
              data-mode={mode}
              data-lift={lift}
              tabIndex={mode === 'hidden' ? -1 : 0}
              aria-hidden={mode === 'hidden' ? true : undefined}
              aria-pressed={selected}
              aria-label={t('plaza.select', {
                name: plaza.name,
                places: t('places.count', { count }),
              })}
              onMouseEnter={() => onHover(plaza.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => {
                setFocusedPlazaId(plaza.id)
                onHover(plaza.id)
              }}
              onBlur={() => {
                setFocusedPlazaId(null)
                onHover(null)
              }}
              onClick={() => onSelect(plaza.id)}
            >
              <span className={styles.label}>
                <span className={styles.name}>{plaza.name}</span>
                <span className={styles.count}>{count}</span>
              </span>
            </button>
            {/* El tallo va fuera del botón: el área pulsable es solo la etiqueta. */}
            <span
              className={styles.stem}
              style={toneStyle}
              data-state={state}
              data-lift={lift}
              aria-hidden="true"
            />
          </>,
          element,
          plaza.id,
        )
      })}
    </>
  )
}
