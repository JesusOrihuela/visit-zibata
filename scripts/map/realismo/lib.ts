import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import proj4 from 'proj4'
import { loadConfig, paths, readJson, writeJson } from '../lib/paths.ts'

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

/** Origen de las mallas 3D: las posiciones van en metros desde aquí (la cabecera de cada .bin lo repite). */
export const ORIGEN = { lng: -100.3225, lat: 20.6805 } as const
export const CELDA_M = 250

const mercator = (lng: number, lat: number): [number, number] => [
  (lng + 180) / 360,
  0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI),
]
const [mx0, my0] = mercator(ORIGEN.lng, ORIGEN.lat)
const metrosPorUnidad = 1 / (40075016.686 * Math.cos((ORIGEN.lat * Math.PI) / 180))

/** Longitud y latitud a metros (este, norte) desde el origen, con la misma escala que usa MapLibre en el origen. */
export function aLocal(lng: number, lat: number): [number, number] {
  const [mx, my] = mercator(lng, lat)
  return [(mx - mx0) / metrosPorUnidad, -(my - my0) / metrosPorUnidad]
}

/** Hash entero estable, para variaciones deterministas por edificio o árbol. */
export function hash32(n: number): number {
  let h = (n * 2654435761) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 2246822519) >>> 0
  return (h ^ (h >>> 13)) >>> 0
}

/** Cabecera de un .bin: longitud (uint32 LE), JSON y relleno a 4 bytes; luego van los buffers. */
export function cabeceraBin(datos: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(datos))
  const largo = Buffer.alloc(4)
  largo.writeUInt32LE(json.length)
  return Buffer.concat([largo, json, Buffer.alloc((4 - ((4 + json.length) % 4)) % 4)])
}

/** Agrupa filas ya ordenadas por celda en [{i, j, start, count}]. */
export function celdasDe<T>(filas: T[], celda: (fila: T) => [number, number]) {
  const celdas: { i: number; j: number; start: number; count: number }[] = []
  filas.forEach((fila, k) => {
    const [i, j] = celda(fila)
    const ultima = celdas.at(-1)
    if (ultima && ultima.i === i && ultima.j === j) ultima.count++
    else celdas.push({ i, j, start: k, count: 1 })
  })
  return celdas
}

interface FuenteManifiesto {
  id: string
  [clave: string]: unknown
}

/**
 * Anota en la sección `realismo` del manifiesto las fuentes y los archivos de salida, sin tocar el resto.
 * Una fuente con el mismo `id` se reemplaza; cada archivo lleva su tamaño y su huella.
 * `map:build` conserva esta sección al regenerar el mapa.
 */
export function anotarManifiesto(fuentes: FuenteManifiesto[], archivos: string[]): void {
  const manifiesto = readJson<{ realismo?: { sources?: FuenteManifiesto[]; outputs?: object } }>(
    paths.manifest,
  )
  const previas = manifiesto.realismo?.sources ?? []
  const sources = [
    ...previas.filter((previa) => !fuentes.some((f) => f.id === previa.id)),
    ...fuentes,
  ]
  const outputs: Record<string, unknown> = { ...manifiesto.realismo?.outputs }
  for (const nombre of archivos) {
    const contenido = readFileSync(`${paths.realismoDir}/${nombre}`)
    outputs[`public/map/realismo/${nombre}`] = {
      bytes: contenido.byteLength,
      sha256: createHash('sha256').update(contenido).digest('hex'),
    }
  }
  writeJson(paths.manifest, { ...manifiesto, realismo: { sources, outputs } })
}
