/**
 * Calidad adaptable de las capas propias. Tres niveles:
 *   3 todo (razón de píxeles hasta 2), 2 sin sombras proyectadas (hasta 1,5), 1 además con los árboles solo
 *   en puntos (hasta 1,25).
 * Todos arrancan en 3: solo se baja con una medición del propio equipo, nunca por suposición sobre él.
 * El nivel no se guarda entre sesiones: un tirón al cargar teselas no debe degradar para siempre.
 * Y una bajada que no mejora nada se deshace: si el límite lo pone el sistema (el modo de bajo consumo de iOS
 * fija 24 a 30 cuadros por segundo en cualquier nivel) bajar solo dejaría el mapa más borroso.
 */
import type { Map as MapLibreMap } from 'maplibre-gl'

export type QualityLevel = 1 | 2 | 3

export interface Quality {
  level: QualityLevel
  /** Con la medición en marcha el gobernador no toca el nivel. */
  frozen: boolean
}

export const createQuality = (): Quality => ({ level: 3, frozen: false })

const PIXEL_RATIO_CAP: Record<QualityLevel, number> = { 3: 2, 2: 1.5, 1: 1.25 }
const SLOW_FRAME_MS = 36
const MIN_SAMPLES = 45
const CHECK_EVERY_MS = 1000
const SLOW_CHECKS_TO_DROP = 2
/** Lo que tiene que bajar la mediana del intervalo (a lo sumo 0,9 de la anterior) para dar por buena una bajada. */
const MIN_GAIN = 0.9

/** ¿Mejoró lo bastante la mediana del intervalo entre cuadros tras bajar un nivel? */
export const bajadaAyudo = (antes: number, despues: number): boolean => despues <= antes * MIN_GAIN

/** Fija el nivel y la razón de píxeles que le corresponde (la nativa si es menor que el tope). */
export function applyLevel(map: MapLibreMap, quality: Quality, level: QualityLevel): void {
  quality.level = level
  map.getContainer().dataset.realismoNivel = String(level)
  const ratio = Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP[level])
  if (ratio !== map.getPixelRatio()) map.setPixelRatio(ratio)
  map.triggerRepaint()
}

/**
 * Baja un nivel si, con el mapa en movimiento y las teselas cargadas, la mediana del intervalo entre
 * cuadros supera 36 ms en dos lecturas seguidas. Si con el nivel nuevo la mediana no baja lo suficiente,
 * vuelve al anterior y deja de ajustar (el límite no es el dibujo). Devuelve la función que lo detiene.
 */
export function startGovernor(map: MapLibreMap, quality: Quality): () => void {
  let intervals: number[] = []
  let last = 0
  let slowChecks = 0
  let probe: { from: QualityLevel; median: number } | null = null
  let settled = false
  const onRender = (): void => {
    const now = performance.now()
    // Con el mapa quieto o descargando teselas el intervalo no mide el costo de dibujar.
    if (!map.isMoving() || !map.areTilesLoaded()) {
      last = 0
      return
    }
    if (last) {
      intervals.push(now - last)
      if (intervals.length > 90) intervals.shift()
    }
    last = now
  }
  map.on('render', onRender)
  const timer = window.setInterval(() => {
    if (settled || quality.frozen || intervals.length < MIN_SAMPLES) return
    const median = [...intervals].sort((a, b) => a - b)[intervals.length >> 1] ?? 0
    if (probe) {
      const { from, median: before } = probe
      probe = null
      if (!bajadaAyudo(before, median)) {
        applyLevel(map, quality, from)
        intervals = []
        settled = true
        return
      }
    }
    if (quality.level === 1) return
    slowChecks = median > SLOW_FRAME_MS ? slowChecks + 1 : 0
    if (slowChecks >= SLOW_CHECKS_TO_DROP) {
      probe = { from: quality.level, median }
      applyLevel(map, quality, (quality.level - 1) as QualityLevel)
      intervals = []
      slowChecks = 0
    }
  }, CHECK_EVERY_MS)
  return () => {
    map.off('render', onRender)
    window.clearInterval(timer)
  }
}
