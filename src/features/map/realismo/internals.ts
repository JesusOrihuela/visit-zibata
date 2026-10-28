/**
 * Único sitio que toca campos internos de MapLibre (`map.painter`, fijado en 6.10.0). Si una versión
 * futura los cambia, estas funciones devuelven `null` y el realismo se monta sin lo que dependía de
 * ellos, en vez de romper el mapa.
 */
import type { Map as MapLibreMap } from 'maplibre-gl'

interface PainterLike {
  currentStencilSource?: unknown
}

const painterOf = (map: MapLibreMap): PainterLike | null =>
  (map as unknown as { painter?: PainterLike }).painter ?? null

/**
 * La pasada de sombras usa el estarcido del contexto, y MapLibre recuerda qué máscara dejó puesta. Tras
 * la pasada hay que olvidarla para que vuelva a pintar las suyas. Devuelve esa acción, o `null` si
 * este MapLibre no tiene el campo (entonces no se dibujan sombras en vivo).
 */
export function stencilReset(map: MapLibreMap): (() => void) | null {
  const painter = painterOf(map)
  if (!painter || !('currentStencilSource' in painter)) return null
  return () => {
    painter.currentStencilSource = undefined
  }
}
