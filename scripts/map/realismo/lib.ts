import proj4 from 'proj4'
import { loadConfig } from '../lib/paths.ts'

export const config = loadConfig()
export const realismo = config.realismo

/** Ventana de píxeles de una imagen de Sentinel-2 en metros UTM: esquina superior izquierda y paso. */
export interface Ventana {
  x0: number
  y0: number
  rx: number
  ry: number
  width: number
  height: number
}

export interface SentinelMeta {
  escena: string
  tif: string
  anio: number
  obtenidoEl: string
  zibata: Ventana
  region: Ventana
}

export const toUtm = (lng: number, lat: number): [number, number] =>
  proj4('EPSG:4326', realismo.sentinel.utm, [lng, lat]) as [number, number]

export const fromUtm = (x: number, y: number): [number, number] =>
  proj4(realismo.sentinel.utm, 'EPSG:4326', [x, y]) as [number, number]

/** Coordenadas de una esquina de teselas XYZ (x, y pueden ser fraccionarios) en longitud y latitud. */
export const tileLng = (x: number, z: number): number => (x / 2 ** z) * 360 - 180
export const tileLat = (y: number, z: number): number =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

/** Esquinas de la región de relieve [NO, NE, SE, SO] en longitud y latitud (el orden de un ImageSource de MapLibre). */
export function regionCorners(): [number, number][] {
  const { zoom: z, x, y } = realismo.relieve
  const [x0, x1, y0, y1] = [x[0], x[1] + 1, y[0], y[1] + 1]
  return [
    [tileLng(x0, z), tileLat(y0, z)],
    [tileLng(x1, z), tileLat(y0, z)],
    [tileLng(x1, z), tileLat(y1, z)],
    [tileLng(x0, z), tileLat(y1, z)],
  ]
}
