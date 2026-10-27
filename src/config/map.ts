/**
 * Configuración de UI del mapa: estado inicial de cámara y límites. La extensión geográfica viene
 * del pipeline GIS (data/geographic/extent.json), así que crece con Zibatá sin tocar código.
 */
import type { Polygon } from 'geojson'
import extent from '../../data/geographic/extent.json'

export type Bbox = [number, number, number, number]

export const ZIBATA_EXTENT = {
  bbox: extent.bbox as Bbox,
  areaBbox: extent.areaBbox as Bbox,
  center: extent.center as [number, number],
  boundary: extent.boundary as Polygon,
}

export const MAP_ASSETS = {
  /*
   * El descriptor del juego de teselas, no el archivo PMTiles. Se sirven sueltas porque el hosting
   * no hace peticiones Range (ver scripts/build/map-tiles.ts), y el TileJSON es lo que MapLibre pide
   * primero: si falla, es un error de fuente y la guía puede avisar de que el mapa no cargó.
   */
  tiles: 'map/tiles.json',
  plazaBuildings: 'map/plaza-buildings.geojson',
  /** Carpeta de las capas de realismo (suelo, relieve y contexto); ver scripts/map/realismo. */
  realismo: 'map/realismo/',
}

export interface CameraState {
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
}

/** Ligeramente inclinada, lo bastante lejos para entender Zibatá y lo bastante cerca para ver volumen. */
export const INITIAL_CAMERA: CameraState = {
  // Ligeramente al este del centroide: ahí se concentran las plazas comerciales.
  center: [ZIBATA_EXTENT.center[0] + 0.0055, ZIBATA_EXTENT.center[1] + 0.0004],
  zoom: 14.65,
  pitch: 55,
  bearing: -10,
}

/**
 * Pantallas verticales: se gira el mapa para que el eje largo de Zibatá (oeste–este, ~96°) quede
 * vertical, con las plazas del oriente más cerca del observador. Así cabe con más detalle.
 */
export const INITIAL_CAMERA_COMPACT: CameraState = {
  ...INITIAL_CAMERA,
  zoom: 13.9,
  pitch: 50,
  bearing: -80,
}

/**
 * Margen alrededor del contorno de Zibatá (grados ≈ 440 m) hasta donde puede llegar el centro de la
 * pantalla. Se limita el centro y no el encuadre completo (`maxBounds`): con la cámara inclinada el
 * encuadre abarca mucho más terreno que el área de datos, y un `maxBounds` ajustado obligaba a MapLibre
 * a recentrar el mapa, lo que dejaba plazas fuera de la pantalla en los teléfonos.
 */
const CENTER_MARGIN = 0.004

export const MAP_LIMITS = {
  minZoom: 12.6,
  maxZoom: 19,
  maxPitch: 72,
  /** Hasta dónde puede llegar el centro de la pantalla: el contorno real de Zibatá con margen corto. */
  centerBounds: [
    ZIBATA_EXTENT.bbox[0] - CENTER_MARGIN,
    ZIBATA_EXTENT.bbox[1] - CENTER_MARGIN,
    ZIBATA_EXTENT.bbox[2] + CENTER_MARGIN,
    ZIBATA_EXTENT.bbox[3] + CENTER_MARGIN,
  ] as Bbox,
}

/** ¿Queda este punto dentro del área por la que se puede mover el mapa? */
export function insideCenterBounds(lng: number, lat: number): boolean {
  const [west, south, east, north] = MAP_LIMITS.centerBounds
  return lng >= west && lng <= east && lat >= south && lat <= north
}

/** El punto más cercano dentro del área: a donde vuelve la cámara si se sale. */
export function clampToCenterBounds(lng: number, lat: number): [number, number] {
  const [west, south, east, north] = MAP_LIMITS.centerBounds
  return [Math.min(Math.max(lng, west), east), Math.min(Math.max(lat, south), north)]
}

/** Zoom al que la cámara se acerca al seleccionar una plaza. */
export const PLAZA_FOCUS_ZOOM = 16.4
export const PLAZA_FOCUS_PITCH = 58

/**
 * Textos propios de MapLibre (atribución y ayuda de teclado) en español: por defecto llegan en inglés y un
 * lector de pantalla los mezclaría con la interfaz. Las claves son las de `maplibre-gl`.
 */
export const MAP_LOCALE: Record<string, string> = {
  'AttributionControl.ToggleAttribution': 'Mostrar u ocultar la atribución',
  'AttributionControl.MapFeedback': 'Comentarios sobre el mapa',
  'Map.Title': 'Mapa',
  'NavigationControl.ZoomIn': 'Acercar',
  'NavigationControl.ZoomOut': 'Alejar',
  'NavigationControl.ResetBearing': 'Orientar al norte',
  'GeolocateControl.FindMyLocation': 'Mostrar mi ubicación',
  'GeolocateControl.LocationNotAvailable': 'Ubicación no disponible',
}
