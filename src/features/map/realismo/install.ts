/**
 * Monta las capas propias de edificios y árboles sobre el mapa, con respaldo por falla: las extrusiones
 * nativas se ocultan solo cuando la capa propia terminó de cargar, y si una falla al montarse o al dibujar
 * se quita y la nativa vuelve. El estado queda en `data-realismo` del contenedor del mapa:
 *   cargando · completo (las dos capas) · degradado (una sola) · respaldo (ninguna: el mapa de siempre).
 */
import type { Map as MapLibreMap } from 'maplibre-gl'
import { createBuildingsLayer, type LayerHooks } from './buildingsLayer.ts'
import { stencilReset } from './internals.ts'
import { createQuality, type Quality } from './quality.ts'
import { createTreesLayer } from './treesLayer.ts'

export type RealismState = 'cargando' | 'completo' | 'degradado' | 'respaldo'

/** Capas nativas que cada capa propia sustituye, y la capa nativa antes de la que se inserta. */
const PARTS = {
  edificios: { native: ['buildings'], before: 'plaza-buildings-inactive' },
  arboles: { native: ['trees', 'tree-trunks'], before: 'buildings' },
} as const

type Part = keyof typeof PARTS

export function installRealism(map: MapLibreMap, baseUrl: string): { quality: Quality } {
  const quality = createQuality()
  const container = map.getContainer()
  const ready = new Set<Part>()
  const broken = new Set<Part>()

  const publish = (): void => {
    const state: RealismState =
      broken.size === 2
        ? 'respaldo'
        : broken.size === 1
          ? 'degradado'
          : ready.size === 2
            ? 'completo'
            : 'cargando'
    container.dataset.realismo = state
  }
  const setVisibility = (layers: readonly string[], visible: boolean): void => {
    for (const id of layers) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }

  const hooksFor = (part: Part, id: string): LayerHooks => ({
    quality,
    resetStencil: stencilReset(map),
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
      publish()
      // Se quita fuera del ciclo de dibujo: una capa no puede borrarse a sí misma mientras pinta.
      setTimeout(() => {
        try {
          if (map.getLayer(id)) map.removeLayer(id)
        } catch {
          // la capa ya no estaba
        }
        setVisibility(PARTS[part].native, true)
        if (part === 'edificios') setVisibility(['buildings-outside'], true)
        map.triggerRepaint()
      }, 0)
    },
  })

  container.dataset.realismo = 'cargando'
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
    broken.add('arboles').add('edificios')
    setVisibility(['buildings-outside'], true)
    publish()
  }
  return { quality }
}
