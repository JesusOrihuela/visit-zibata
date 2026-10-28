/**
 * Único sitio que toca campos internos de MapLibre (`map.painter`, fijado en 6.10.0). Si una versión
 * futura los cambia, estas funciones devuelven `null` y el realismo se monta sin lo que dependía de
 * ellos, en vez de romper el mapa.
 */
import type { LngLat, Map as MapLibreMap, PaddingOptions } from 'maplibre-gl'

/** Un punto de pantalla: lo que devuelve la transformación y lo que acepta para volver a coordenadas. */
export interface ScreenPoint {
  x: number
  y: number
}

/** Lo que usamos de la transformación interna de la cámara (copia suelta del mapa, no la del mapa). */
export interface TransformLike {
  clone(): TransformLike
  setMinZoom(zoom: number): void
  setMaxZoom(zoom: number): void
  setMinPitch(pitch: number): void
  setMaxPitch(pitch: number): void
  resize(width: number, height: number): void
  setPadding(padding: PaddingOptions): void
  setBearing(bearing: number): void
  setCenter(center: LngLat): void
  setZoom(zoom: number): void
  setPitch(pitch: number): void
  locationToScreenPoint(location: LngLat): ScreenPoint
  screenPointToLocation(point: ScreenPoint): { lng: number; lat: number }
}

interface PainterLike {
  currentStencilSource?: unknown
  transform?: Partial<TransformLike>
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

/**
 * Una copia de la transformación de la cámara: permite probar cámaras (zoom, inclinación, centro) sin
 * mover la del mapa ni disparar eventos. `null` si este MapLibre no la expone; entonces no se calcula
 * el límite de alejamiento.
 */
export function cameraTransform(map: MapLibreMap): TransformLike | null {
  const transform = painterOf(map)?.transform
  return typeof transform?.clone === 'function' ? (transform as TransformLike).clone() : null
}
