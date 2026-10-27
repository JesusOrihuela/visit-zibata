/**
 * npm run map:build:realismo
 *
 * Con lo que bajó `map:fetch:realismo` genera las capas de realismo que sirve la app:
 *  - suelo.webp: imagen de Sentinel-2 recortada al contorno de Zibatá, con borde suave
 *  - contexto.webp: imagen de la región, desaturada y teñida, con el sombreado de laderas y el tinte por
 *    altitud horneados; transparente dentro del anillo alrededor del contorno
 *  - vias.geojson: calles principales de la región, solo fuera del contorno
 *  - descriptor.json: esquinas de cada imagen (lo importa el estilo del mapa)
 *
 * Sentinel-2: contains modified Copernicus Sentinel data. Relieve: Copernicus DEM GLO-30.
 * Calles: © OpenStreetMap contributors (ODbL 1.0).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import * as turf from '@turf/turf'
import type { Feature, LineString, Polygon, Position } from 'geojson'
import sharp from 'sharp'
import { paths, ROOT, readJson, writeJson } from '../lib/paths.ts'
import type { SentinelMeta, Ventana } from './lib.ts'
import { fromUtm, realismo, regionCorners, tileLat, tileLng, toUtm } from './lib.ts'

const extent = readJson<{ bbox: [number, number, number, number]; boundary: Polygon }>(paths.extent)
const sentinel = readJson<SentinelMeta>(paths.rawSentinelMeta)
const salida = paths.realismoDir
const DESCRIPTOR = `${ROOT}src/features/map/realismo/descriptor.json`
mkdirSync(salida, { recursive: true })

const redondear = (valor: number, decimales = 6): number =>
  Math.round(valor * 10 ** decimales) / 10 ** decimales
const esquinasLngLat = (
  v: Ventana,
  px: number,
  py: number,
  w: number,
  h: number,
): [number, number][] =>
  (
    [
      [px, py],
      [px + w, py],
      [px + w, py + h],
      [px, py + h],
    ] as const
  ).map(([i, j]) => {
    const [lng, lat] = fromUtm(v.x0 + i * v.rx, v.y0 + j * v.ry)
    return [redondear(lng), redondear(lat)]
  })

/** Máscara en escala de grises (blanco = dentro) de un polígono dibujado en píxeles de una imagen. */
async function mascara(
  width: number,
  height: number,
  anillo: [number, number][],
  desenfoque: number,
  invertida = false,
): Promise<Buffer> {
  const [fondo, relleno] = invertida ? ['white', 'black'] : ['black', 'white']
  const puntos = anillo.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fondo}"/><polygon points="${puntos}" fill="${relleno}"/></svg>`
  return sharp(Buffer.from(svg)).blur(desenfoque).greyscale().raw().toBuffer()
}

/** Imagen de suelo: Sentinel-2 a 10 m dentro de la caja del contorno, con alfa suave en el borde. */
async function construirSuelo(): Promise<{ coordenadas: [number, number][]; bytes: number }> {
  const v = sentinel.zibata
  const esquinas = (
    [
      [extent.bbox[0], extent.bbox[3]],
      [extent.bbox[2], extent.bbox[3]],
      [extent.bbox[2], extent.bbox[1]],
      [extent.bbox[0], extent.bbox[1]],
    ] as [number, number][]
  ).map(([lng, lat]) => toUtm(lng, lat))
  const margen = 2
  const px0 = Math.floor((Math.min(...esquinas.map((p) => p[0])) - v.x0) / v.rx) - margen
  const px1 = Math.ceil((Math.max(...esquinas.map((p) => p[0])) - v.x0) / v.rx) + margen
  const py0 = Math.floor((Math.max(...esquinas.map((p) => p[1])) - v.y0) / v.ry) - margen
  const py1 = Math.ceil((Math.min(...esquinas.map((p) => p[1])) - v.y0) / v.ry) + margen
  const width = px1 - px0
  const height = py1 - py0
  const anillo = (extent.boundary.coordinates[0] ?? []).map((p) => {
    const [x, y] = toUtm(p[0] ?? 0, p[1] ?? 0)
    return [(x - v.x0) / v.rx - px0, (y - v.y0) / v.ry - py0] as [number, number]
  })
  const alfa = await mascara(width, height, anillo, 2)
  const rgb = await sharp(paths.rawSentinelZibata)
    .extract({ left: px0, top: py0, width, height })
    .removeAlpha()
    .raw()
    .toBuffer()
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = rgb[i * 3] ?? 0
    rgba[i * 4 + 1] = rgb[i * 3 + 1] ?? 0
    rgba[i * 4 + 2] = rgb[i * 3 + 2] ?? 0
    rgba[i * 4 + 3] = alfa[i] ?? 0
  }
  const webp = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .webp({ quality: 82, alphaQuality: 80 })
    .toBuffer()
  writeFileSync(`${salida}/suelo.webp`, webp)
  return { coordenadas: esquinasLngLat(v, px0, py0, width, height), bytes: webp.length }
}

const TESELA = 512
type Rgb = [number, number, number]
type Parada = [number, Rgb]
const BG: Rgb = [217, 205, 182]
/** Tinte por altitud (m): del crema claro de la meseta al pardo de las lomas. */
const RAMPA: Parada[] = [
  [1900, [239, 230, 210]],
  [2060, [227, 214, 184]],
  [2200, [205, 191, 154]],
  [2400, [179, 164, 131]],
  [3400, [143, 130, 103]],
]
const tinte = (altitud: number): Rgb => {
  if (altitud <= (RAMPA[0] as Parada)[0]) return (RAMPA[0] as Parada)[1]
  for (let k = 1; k < RAMPA.length; k++) {
    const [h0, c0] = RAMPA[k - 1] as Parada
    const [h1, c1] = RAMPA[k] as Parada
    if (altitud <= h1) {
      const t = (altitud - h0) / (h1 - h0)
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t]
    }
  }
  return (RAMPA.at(-1) as Parada)[1]
}

/** Altitud en metros de toda la región, decodificada de las teselas (codificación terrarium). */
async function leerRelieve(n: number, tilesX: number): Promise<Float32Array> {
  const { zoom, x, y } = realismo.relieve
  const elevacion = new Float32Array(n * n)
  for (let tx = 0; tx < tilesX; tx++) {
    for (let ty = 0; ty < tilesX; ty++) {
      const { data, info } = await sharp(
        `${paths.relieveDir}/${zoom}/${x[0] + tx}/${y[0] + ty}.webp`,
      )
        .raw()
        .toBuffer({ resolveWithObject: true })
      for (let j = 0; j < TESELA; j++) {
        for (let i = 0; i < TESELA; i++) {
          const o = (j * TESELA + i) * info.channels
          elevacion[(ty * TESELA + j) * n + tx * TESELA + i] =
            (data[o] ?? 0) * 256 + (data[o + 1] ?? 0) + (data[o + 2] ?? 0) / 256 - 32768
        }
      }
    }
  }
  return elevacion
}

/** Sombreado de laderas (luz del suroeste, 40° de altura) sobre el relieve exagerado. */
function sombrear(elevacion: Float32Array, n: number): Float32Array {
  const { zoom } = realismo.relieve
  const metrosPorPixel = (40075016.686 * Math.cos((20.68 * Math.PI) / 180)) / (TESELA * 2 ** zoom)
  const exageracion = 2.2
  const acimut = (225 * Math.PI) / 180
  const altura = (40 * Math.PI) / 180
  const sombra = new Float32Array(n * n)
  for (let j = 1; j < n - 1; j++) {
    for (let i = 1; i < n - 1; i++) {
      const e = (a: number, b: number): number =>
        (elevacion[(j + b) * n + i + a] ?? 0) * exageracion
      const dzdx =
        (e(1, -1) + 2 * e(1, 0) + e(1, 1) - (e(-1, -1) + 2 * e(-1, 0) + e(-1, 1))) /
        (8 * metrosPorPixel)
      const dzdy =
        (e(-1, 1) + 2 * e(0, 1) + e(1, 1) - (e(-1, -1) + 2 * e(0, -1) + e(1, -1))) /
        (8 * metrosPorPixel)
      const pendiente = Math.atan(Math.hypot(dzdx, dzdy))
      const aspecto = Math.atan2(dzdy, -dzdx)
      const hs =
        Math.cos(Math.PI / 2 - altura) * Math.cos(pendiente) +
        Math.sin(Math.PI / 2 - altura) *
          Math.sin(pendiente) *
          Math.cos(Math.PI * 2 - acimut + Math.PI / 2 - aspecto)
      sombra[j * n + i] = Math.max(0, hs)
    }
  }
  return sombra
}

/** Imagen de contexto: satélite apagado, tinte por altitud y laderas, transparente dentro del anillo del contorno. */
async function construirContexto(): Promise<{ coordenadas: [number, number][]; bytes: number }> {
  const { zoom, x, y } = realismo.relieve
  const tilesX = x[1] - x[0] + 1
  const n = tilesX * TESELA
  const elevacion = await leerRelieve(n, tilesX)
  const sombra = sombrear(elevacion, n)
  const plano = Math.sin((40 * Math.PI) / 180)

  const v = sentinel.region
  const sat = await sharp(paths.rawSentinelRegion).removeAlpha().raw().toBuffer()
  const salida4 = Buffer.alloc(n * n * 4)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const [ux, uy] = toUtm(
        tileLng(x[0] + (i + 0.5) / TESELA, zoom),
        tileLat(y[0] + (j + 0.5) / TESELA, zoom),
      )
      const sx = Math.floor((ux - v.x0) / v.rx)
      const sy = Math.floor((uy - v.y0) / v.ry)
      const hay = sx >= 0 && sx < v.width && sy >= 0 && sy < v.height
      const so = hay ? (sy * v.width + sx) * 3 : 0
      const rgb: Rgb = hay ? [sat[so] ?? 0, sat[so + 1] ?? 0, sat[so + 2] ?? 0] : BG
      const gris = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
      const t = tinte(elevacion[j * n + i] ?? 0)
      const f = Math.max(0.93, Math.min(1.06, 1 + 0.6 * ((sombra[j * n + i] ?? 0) - plano)))
      const o = (j * n + i) * 4
      for (const k of [0, 1, 2] as const) {
        const apagado = BG[k] * 0.84 + (gris + (rgb[k] - gris) * 0.35) * 0.16
        salida4[o + k] = Math.min(255, (apagado * 0.8 + t[k] * 0.2) * f)
      }
      salida4[o + 3] = 255
    }
  }

  // Alfa: transparente dentro del anillo alrededor del contorno, y difuminado hacia el borde de la región.
  const anillo = turf.buffer(turf.feature(extent.boundary), realismo.contexto.anilloM / 1000, {
    units: 'kilometers',
    steps: 8,
  })
  const simple = turf.simplify(anillo as Feature<Polygon>, {
    tolerance: 0.00005,
    highQuality: true,
  })
  const coordenadasAnillo = simple.geometry.coordinates[0] ?? []
  const px = (lng: number): number => (((lng + 180) / 360) * 2 ** zoom - x[0]) * TESELA
  const py = (lat: number): number =>
    ((0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)) * 2 ** zoom -
      y[0]) *
    TESELA
  const alfa = await mascara(
    n,
    n,
    coordenadasAnillo.map((p) => [px(p[0] ?? 0), py(p[1] ?? 0)] as [number, number]),
    3,
    true,
  )
  const orilla = Math.round(n * realismo.contexto.difuminadoOrilla)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const t = Math.max(0, Math.min(1, Math.min(i, j, n - 1 - i, n - 1 - j) / orilla))
      salida4[(j * n + i) * 4 + 3] = Math.round((alfa[j * n + i] ?? 0) * t * t * (3 - 2 * t))
    }
  }
  const px2 = realismo.contexto.pixeles
  const webp = await sharp(salida4, { raw: { width: n, height: n, channels: 4 } })
    .resize(px2, px2, { kernel: 'lanczos3' })
    .webp({ quality: 74, alphaQuality: 70 })
    .toBuffer()
  writeFileSync(`${salida}/contexto.webp`, webp)
  return {
    coordenadas: regionCorners().map(([a, b]) => [redondear(a), redondear(b)]),
    bytes: webp.length,
  }
}

interface TramoOsm {
  tags?: { highway?: string }
  geometry?: { lat: number; lon: number }[]
}

/** Calles principales de la región, recortadas para que solo queden fuera del contorno. */
function construirVias(): { tramos: number; bytes: number } {
  const clasePorHighway = new Map<string, string>()
  for (const [clase, highways] of Object.entries(realismo.vias.clases)) {
    for (const h of highways) clasePorHighway.set(h, clase)
  }
  const dentro = turf.feature(extent.boundary)
  const { elements } = readJson<{ elements: TramoOsm[] }>(paths.rawViasContexto)
  const features: Feature<LineString>[] = []
  for (const el of elements) {
    const clase = clasePorHighway.get(el.tags?.highway ?? '')
    if (!clase || !el.geometry || el.geometry.length < 2) continue
    // A la escala del contexto (decenas de km) unos 4 m de tolerancia no se notan y quitan la mitad del peso.
    const linea = turf.simplify(
      turf.lineString(
        el.geometry.map((p) => [redondear(p.lon, 5), redondear(p.lat, 5)]),
        { clase },
      ),
      { tolerance: 0.00004 },
    )
    const partes = turf.lineSplit(linea, dentro)
    const piezas = partes.features.length ? partes.features : [linea]
    for (const pieza of piezas) {
      const [a, b] = pieza.geometry.coordinates as [Position, Position]
      const medio = turf.midpoint(turf.point(a), turf.point(b))
      if (!turf.booleanPointInPolygon(medio, dentro)) features.push(pieza as Feature<LineString>)
    }
  }
  const texto = JSON.stringify({ type: 'FeatureCollection', features })
  writeFileSync(`${salida}/vias.geojson`, texto)
  return { tramos: features.length, bytes: Buffer.byteLength(texto) }
}

const suelo = await construirSuelo()
const contexto = await construirContexto()
const vias = construirVias()
writeJson(DESCRIPTOR, {
  suelo: { coordenadas: suelo.coordenadas },
  contexto: { coordenadas: contexto.coordenadas },
  relieve: { zoom: realismo.relieve.zoom, x: realismo.relieve.x, y: realismo.relieve.y },
  creditos: { sentinel: sentinel.escena, anio: sentinel.anio },
})
console.log(
  `✓ suelo ${(suelo.bytes / 1024).toFixed(0)} KB · contexto ${(contexto.bytes / 1024).toFixed(0)} KB · ` +
    `${vias.tramos} tramos de calles (${(vias.bytes / 1024).toFixed(0)} KB) → ${salida}`,
)
