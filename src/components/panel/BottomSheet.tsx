/**
 * BottomSheet (móvil): dos estados, colapsado y expandido. Se arrastra desde la cabecera o se
 * alterna con el botón (accesible por teclado). Nunca cubre todo el mapa: expandido deja una franja
 * superior visible y colapsado solo ocupa la parte baja.
 */
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/index.ts'
import styles from './BottomSheet.module.css'

export type SheetPeek = 'small' | 'medium'

interface BottomSheetProps {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  peek: SheetPeek
  /** Alto que debe quedar libre arriba (barra medida + franja de mapa); ver `collapsedHeightFor`. */
  topReserved?: number
  contentKey: string
  children: ReactNode
}

const EXPANDED_RATIO = 0.86
/** Expandida deja visibles la búsqueda, los filtros y una franja de mapa (~165 px de barra + 27 px). */
const EXPANDED_TOP_RESERVED = 192
const SMALL_PEEK = 104
/** Barra superior (búsqueda y filtros, ~160 px) más una franja mínima de mapa que debe seguir visible. */
const TOP_RESERVED = 256

/**
 * Altura del estado colapsado. Es una función pura para que el layout pueda calcular el espacio que
 * ocupa la hoja en el mismo render que cambia su contenido (y la cámara no reciba dos órdenes).
 * En pantallas bajas (móvil en horizontal) cede altura para no tapar el mapa por completo.
 */
export function collapsedHeightFor(
  peek: SheetPeek,
  viewport: number,
  topReserved = TOP_RESERVED,
): number {
  if (peek === 'small') return SMALL_PEEK
  const preferred = Math.min(Math.max(viewport * 0.44, 280), 420)
  const reserved = Math.max(TOP_RESERVED, topReserved)
  return Math.round(Math.max(SMALL_PEEK, Math.min(preferred, viewport - reserved)))
}

/**
 * Altura expandida: no tapa la barra superior salvo en pantallas muy bajas (móvil en horizontal), donde
 * reservarla dejaría la hoja demasiado pequeña para leer.
 */
export function expandedHeightFor(viewport: number): number {
  const belowTopbar = viewport - EXPANDED_TOP_RESERVED
  const ratio = viewport * EXPANDED_RATIO
  return Math.round(belowTopbar >= viewport * 0.6 ? Math.min(ratio, belowTopbar) : ratio)
}

export function useViewportHeight(): number {
  const [viewport, setViewport] = useState(() => window.innerHeight)
  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return viewport
}

export function BottomSheet({
  expanded,
  onExpandedChange,
  peek,
  topReserved,
  contentKey,
  children,
}: BottomSheetProps) {
  const viewport = useViewportHeight()
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  /*
   * El primer render no anima el alto. La ruta se aplica en un layout effect y puede pasar la hoja
   * de colapsada a expandida antes de pintar; si la transición estuviera activa, el navegador
   * animaría ese primer cambio y Lighthouse lo contaría como layout shift.
   */
  const [initial, setInitial] = useState(true)
  useEffect(() => setInitial(false), [])
  const drag = useRef<{
    startY: number
    startHeight: number
    lastY: number
    lastT: number
    velocity: number
  } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  /** Un arrastre acaba también en "click" sobre el asa: se ignora para no deshacer el gesto. */
  const justDragged = useRef(false)

  const collapsed = collapsedHeightFor(peek, viewport, topReserved)
  const full = expandedHeightFor(viewport)
  const height = dragHeight ?? (expanded ? full : collapsed)

  // biome-ignore lint/correctness/useExhaustiveDependencies: se reinicia el scroll cuando cambia el contenido.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [contentKey])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    drag.current = {
      startY: event.clientY,
      startHeight: height,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    const dt = Math.max(event.timeStamp - state.lastT, 1)
    state.velocity = (event.clientY - state.lastY) / dt
    state.lastY = event.clientY
    state.lastT = event.timeStamp
    if (Math.abs(event.clientY - state.startY) <= 4) return
    // La captura empieza solo al arrastrar, para que un toque simple siga siendo un clic en el botón.
    if (!event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.setPointerCapture(event.pointerId)
    const next = state.startHeight - (event.clientY - state.startY)
    setDragHeight(Math.min(Math.max(next, 96), full))
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    drag.current = null
    if (!state) return
    const moved = Math.abs(event.clientY - state.startY)
    if (moved <= 4) {
      setDragHeight(null)
      return
    }
    justDragged.current = true
    const current = state.startHeight - (event.clientY - state.startY)
    // Un gesto rápido decide por dirección; uno lento, por la posición más cercana.
    const shouldExpand =
      Math.abs(state.velocity) > 0.5 ? state.velocity < 0 : current > (collapsed + full) / 2
    setDragHeight(null)
    onExpandedChange(shouldExpand)
  }

  return (
    <section
      className={styles.sheet}
      data-panel=""
      data-expanded={expanded}
      data-dragging={dragHeight !== null}
      data-initial={initial}
      data-peek={peek}
      style={{ height }}
      aria-label={t('panel.label')}
    >
      <div
        className={styles.grabArea}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null
          setDragHeight(null)
        }}
      >
        <button
          type="button"
          className={styles.handle}
          aria-expanded={expanded}
          aria-label={expanded ? t('panel.collapse') : t('panel.expand')}
          onClick={() => {
            if (justDragged.current) {
              justDragged.current = false
              return
            }
            onExpandedChange(!expanded)
          }}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      <div ref={scrollRef} className={styles.content}>
        {children}
      </div>
    </section>
  )
}
