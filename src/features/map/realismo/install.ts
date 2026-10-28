/**
 * Monta las capas propias de edificios y árboles sobre el mapa, con respaldo por falla: las extrusiones
 * nativas se ocultan solo cuando la capa propia terminó de cargar, y si una falla al montarse o al dibujar
 * se quita y la nativa vuelve.
 *
 * El estado queda en `data-realismo` del contenedor del mapa y se calcula de lo que de verdad está
 * visible, no de lo que se pretendía: una capa cuenta como propia si cargó y sus nativas están ocultas,
 * y como nativa si falló y sus nativas volvieron. Así una restauración rota no pasa por buena.
 *   cargando · completo (las dos propias) · degradado (una propia, una nativa) · respaldo (el mapa de siempre).
 * `data-realismo-sombras` dice si las sombras en vivo de los edificios están disponibles (si/no).
 */
import type { Polygon } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { createBuildingsLayer, type LayerHooks } from './buildingsLayer.ts'
import { installCameraLimits } from './camera.ts'
import { stencilReset } from './internals.ts'
import { applyLevel, createQuality, type Quality, startGovernor } from './quality.ts'
import { createTreesLayer } from './treesLayer.ts'

export type RealismState = 'cargando' | 'completo' | 'degradado' | 'respaldo'

/** Capas nativas que cada capa propia sustituye, y la capa nativa antes de la que se inserta. */
const PARTS = {
  edificios: { native: ['buildings', 'buildings-outside'], before: 'plaza-buildings-inactive' },
  arboles: { native: ['trees', 'tree-trunks'], before: 'buildings' },
} as const

type Part = keyof typeof PARTS
type Status = 'cargando' | 'propia' | 'nativa' | 'incoherente'

export interface RealismOptions {
  /** Contorno de Zibatá: de él sale el límite de alejamiento. */
  boundary: Polygon
  /** Medición en el dispositivo (?medir): 'si' o 'corto' para probar la herramienta. */
  benchmark?: 'si' | 'corto'
}

export function installRealism(
  map: MapLibreMap,
  baseUrl: string,
  options: RealismOptions,
): { quality: Quality } {
  const quality = createQuality()
  const container = map.getContainer()
  const ready = new Set<Part>()
  const broken = new Set<Part>()
  const resetStencil = stencilReset(map)

  const isVisible = (id: string): boolean =>
    map.getLayer(id) !== undefined && map.getLayoutProperty(id, 'visibility') !== 'none'

  const statusOf = (part: Part): Status => {
    const native = PARTS[part].native
    if (broken.has(part)) return native.every(isVisible) ? 'nativa' : 'incoherente'
    if (ready.has(part)) return native.some(isVisible) ? 'incoherente' : 'propia'
    return 'cargando'
  }

  const publish = (): void => {
    const statuses = (Object.keys(PARTS) as Part[]).map(statusOf)
    // Mientras algo carga o una restauración no terminó, no se afirma nada.
    const state: RealismState = statuses.some((s) => s === 'cargando' || s === 'incoherente')
      ? 'cargando'
      : statuses.every((s) => s === 'propia')
        ? 'completo'
        : statuses.every((s) => s === 'nativa')
          ? 'respaldo'
          : 'degradado'
    container.dataset.realismo = state
  }

  const setVisibility = (layers: readonly string[], visible: boolean): void => {
    for (const id of layers) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }

  /** Quita la capa propia y devuelve las nativas; solo entonces el estado puede decir que hay respaldo. */
  const restore = (part: Part, id: string): void => {
    try {
      if (map.getLayer(id)) map.removeLayer(id)
    } catch {
      // la capa ya no estaba
    }
    setVisibility(PARTS[part].native, true)
    map.triggerRepaint()
    publish()
  }

  const hooksFor = (part: Part, id: string): LayerHooks => ({
    quality,
    resetStencil,
    onReady: () => {
      if (broken.has(part)) return
      ready.add(part)
      setVisibility(PARTS[part].native, false)
      publish()
    },
    onFail: (error) => {
      console.error(`realismo: la capa ${id} falló y se vuelve a las extrusiones nativas`, error)
      broken.add(part)
      ready.delete(part)
      // Fuera del ciclo de dibujo: una capa no puede borrarse a sí misma mientras pinta.
      setTimeout(() => restore(part, id), 0)
    },
  })

  container.dataset.realismo = 'cargando'
  container.dataset.realismoSombras = resetStencil ? 'si' : 'no'
  // Fuera del contorno no se dibuja ningún edificio propio ni nativo: lo ocupa la imagen de contexto.
  setVisibility(['buildings-outside'], false)
  try {
    map.addLayer(
      createTreesLayer(
        'realismo-arboles',
        `${baseUrl}arboles.bin`,
        hooksFor('arboles', 'realismo-arboles'),
      ),
      PARTS.arboles.before,
    )
    map.addLayer(
      createBuildingsLayer(
        'realismo-edificios',
        `${baseUrl}edificios.bin`,
        hooksFor('edificios', 'realismo-edificios'),
      ),
      PARTS.edificios.before,
    )
  } catch (error) {
    console.error('realismo: no se pudieron montar las capas propias', error)
    for (const part of Object.keys(PARTS) as Part[]) {
      broken.add(part)
      restore(part, `realismo-${part}`)
    }
  }

  // Calidad: arranca en 3 (con la razón de píxeles topada a 2) y baja sola si el mapa en movimiento va lento.
  applyLevel(map, quality, 3)
  const stopGovernor = startGovernor(map, quality)
  // Alejamiento, inclinación y recentrado que cuidan que no se vea el borde de la imagen de contexto.
  const stopCamera = installCameraLimits(map, options.boundary)

  // Si el contexto WebGL se pierde (sobre todo en móviles al cambiar de app), las capas propias dejan de
  // servir: se vuelve a las extrusiones nativas, que MapLibre repinta cuando recupera el contexto.
  map.getCanvas().addEventListener('webglcontextlost', () => {
    stopGovernor()
    for (const part of Object.keys(PARTS) as Part[]) {
      broken.add(part)
      ready.delete(part)
      restore(part, `realismo-${part}`)
    }
  })
  map.once('remove', () => {
    stopGovernor()
    stopCamera()
  })

  if (options.benchmark) {
    const short = options.benchmark === 'corto'
    map.once('idle', () => {
      void import('./benchmark.ts')
        .then(({ runBenchmark }) => runBenchmark(map, quality, { short }))
        .catch((error) => console.error('[realismo] medición:', error))
    })
  }
  return { quality }
}
