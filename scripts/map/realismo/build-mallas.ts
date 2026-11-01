/**
 * npm run map:build:mallas
 *
 * Genera las mallas 3D que dibuja la capa de realismo, solo para lo que queda dentro del contorno:
 *  - edificios.bin: volúmenes de azotea plana. Por vértice: posición (3 float), normal (3 bytes con signo)
 *    más un byte con el grupo de paleta y la semilla del edificio, y color de familia más oclusión
 *    ambiental horneada entre vecinos.
 *  - arboles.bin: una fila por planta (x, y, base de copa, altura, radio, variante, azar, tipo), donde tipo 1 es arbusto y no lleva tronco.
 *
 * Parte de las huellas y los árboles tal como entran a las teselas (los deja `map:build`), de la
 * imagen de Sentinel-2 (color por edificio) y de Open Buildings 2.5D (altura). Alturas estimadas:
 * no hay medidas en datos abiertos para Zibatá; se documentan como tales.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import * as turf from '@turf/turf'
import earcut from 'earcut'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import sharp from 'sharp'
import { paths, readJson } from '../lib/paths.ts'
import type { SentinelMeta } from './lib.ts'
import {
  aLocal,
  anotarManifiesto,
  CELDA_M,
  cabeceraBin,
  celdasDe,
  hash32,
  ORIGEN,
  realismo,
  toUtm,
} from './lib.ts'

type Rgb = [number, number, number]
type Punto = [number, number]

interface Huella {
  id: number
  inside: boolean
  alturaEstimada: number
  /** Altura de Open Buildings 2.5D (máximo de las celdas que tocan la huella ampliada 2 m). */
  h2: number | null
  anillo: Punto[]
  area: number
  perimetro: number
  cx: number
  cy: number
  x0: number
  x1: number
  y0: number
  y1: number
  rgb: Rgb
  color: Rgb
  altura: number
  paleta: number
  semilla: number
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))
const mediana = (valores: number[]): number =>
  [...valores].sort((a, b) => a - b)[valores.length >> 1] as number
const hex = (c: string): Rgb => [
  Number.parseInt(c.slice(1, 3), 16),
  Number.parseInt(c.slice(3, 5), 16),
  Number.parseInt(c.slice(5, 7), 16),
]

const extent = readJson<{ boundary: Polygon }>(paths.extent)
const sentinel = readJson<SentinelMeta>(paths.rawSentinelMeta)
const salida = paths.realismoDir

// ── Imagen de Sentinel-2: color por edificio (muestra bilineal en el centroide) ────────────────────
const v10 = sentinel.zibata
const { data: pixeles } = await sharp(paths.rawSentinelZibata)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const pixel = (x: number, y: number): Rgb => {
  const i = (clamp(y, 0, v10.height - 1) * v10.width + clamp(x, 0, v10.width - 1)) * 3
  return [pixeles[i] ?? 0, pixeles[i + 1] ?? 0, pixeles[i + 2] ?? 0]
}
function muestraSentinel(lng: number, lat: number): Rgb {
  const [ux, uy] = toUtm(lng, lat)
  const fx = (ux - v10.x0) / v10.rx - 0.5
  const fy = (uy - v10.y0) / v10.ry - 0.5
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = fx - ix
  const ty = fy - iy
  const c: Rgb = [0, 0, 0]
  for (const [dx, dy, w] of [
    [0, 0, (1 - tx) * (1 - ty)],
    [1, 0, tx * (1 - ty)],
    [0, 1, (1 - tx) * ty],
    [1, 1, tx * ty],
  ] as const) {
    const p = pixel(ix + dx, iy + dy)
    for (const k of [0, 1, 2] as const) c[k] += p[k] * w
  }
  return c
}

// ── Open Buildings 2.5D: rejilla de 4 m en UTM ─────────────────────────────────────────────────────
const metaOb = readJson<{
  xmin: number
  ymax: number
  resolucionM: number
  width: number
  height: number
}>(paths.rawAlturasMeta)
const bufOb = readFileSync(paths.rawAlturasOpenBuildings)
const rejillaOb = new Float32Array(bufOb.buffer, bufOb.byteOffset, bufOb.byteLength / 4)
const celdaOb = (gx: number, gy: number): number => {
  if (gx < 0 || gx >= metaOb.width || gy < 0 || gy >= metaOb.height) return Number.NaN
  const v = rejillaOb[gy * metaOb.width + gx] ?? Number.NaN
  return Number.isFinite(v) && v > -90 ? v : Number.NaN
}

// ── Huellas ────────────────────────────────────────────────────────────────────────────────────────
const entrada = readJson<
  FeatureCollection<Polygon, { id: number; height: number; inside: boolean }>
>(paths.rawEdificiosBase)
const huellas: (Huella | null)[] = entrada.features.map((f) => {
  const anilloLngLat = (f.geometry.coordinates[0] ?? []).slice(0, -1)
  const anillo = anilloLngLat.map(([lng, lat]) => aLocal(lng ?? 0, lat ?? 0))
  const doble = anillo.reduce((s, p, i) => {
    const q = anillo[(i + 1) % anillo.length] as Punto
    return s + (p[0] * q[1] - q[0] * p[1])
  }, 0)
  if (anillo.length < 3 || Math.abs(doble / 2) < 4) return null
  if (doble < 0) anillo.reverse() // antihorario: la normal exterior de cada lado sale a la derecha
  let perimetro = 0
  for (let k = 0; k < anillo.length; k++) {
    const a = anillo[k] as Punto
    const b = anillo[(k + 1) % anillo.length] as Punto
    perimetro += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  const xs = anillo.map((p) => p[0])
  const ys = anillo.map((p) => p[1])
  // El color y la altura de datos se toman sobre la huella en lng/lat y en UTM, como en el prototipo.
  const cLng = anilloLngLat.reduce((s, p) => s + (p[0] ?? 0), 0) / anilloLngLat.length
  const cLat = anilloLngLat.reduce((s, p) => s + (p[1] ?? 0), 0) / anilloLngLat.length
  const utm = anilloLngLat.map(([lng, lat]) => toUtm(lng ?? 0, lat ?? 0))
  const ux = utm.map((p) => p[0])
  const uy = utm.map((p) => p[1])
  let h2 = Number.NEGATIVE_INFINITY
  const res = metaOb.resolucionM
  for (let x = Math.min(...ux) - 2; x <= Math.max(...ux) + 2; x += res / 2) {
    for (let y = Math.min(...uy) - 2; y <= Math.max(...uy) + 2; y += res / 2) {
      const v = celdaOb(Math.floor((x - metaOb.xmin) / res), Math.floor((metaOb.ymax - y) / res))
      if (Number.isFinite(v) && v > h2) h2 = v
    }
  }
  return {
    id: f.properties.id,
    inside: f.properties.inside,
    alturaEstimada: f.properties.height,
    h2: Number.isFinite(h2) && h2 > 0 ? Math.round(h2 * 10) / 10 : null,
    anillo,
    area: Math.abs(doble / 2),
    perimetro,
    cx: xs.reduce((s, v) => s + v, 0) / xs.length,
    cy: ys.reduce((s, v) => s + v, 0) / ys.length,
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
    rgb: muestraSentinel(cLng, cLat),
    color: [0, 0, 0],
    altura: 0,
    paleta: 0,
    semilla: 0,
  }
})
const B = huellas.filter((h): h is Huella => h !== null)

// ── Color por familia: k-means (k = 5) sobre el color de satélite, de oscuro a claro ───────────────
{
  const K = 5
  const luz = (c: Rgb): number => (c[0] + c[1] + c[2]) / 3
  const orden = [...B].sort((p, q) => luz(p.rgb) - luz(q.rgb))
  let centros = Array.from({ length: K }, (_, i) => [
    ...(orden[Math.floor(((i + 0.5) / K) * orden.length)] as Huella).rgb,
  ]) as Rgb[]
  const grupo = new Array<number>(B.length).fill(0)
  for (let it = 0; it < 15; it++) {
    B.forEach((h, i) => {
      let mejor = 0
      let d0 = Number.POSITIVE_INFINITY
      centros.forEach((c, k) => {
        const d = (h.rgb[0] - c[0]) ** 2 + (h.rgb[1] - c[1]) ** 2 + (h.rgb[2] - c[2]) ** 2
        if (d < d0) {
          d0 = d
          mejor = k
        }
      })
      grupo[i] = mejor
    })
    centros = centros.map((c, k) => {
      const miembros = B.filter((_, i) => grupo[i] === k)
      if (!miembros.length) return c
      return [0, 1, 2].map(
        (j) => miembros.reduce((s, h) => s + h.rgb[j as 0 | 1 | 2], 0) / miembros.length,
      ) as Rgb
    })
  }
  // De oscuro a claro: teja oscura, teja, arena rosada, crema y blanco.
  const paleta = ['#b8a283', '#d6a78a', '#e6c6ab', '#f0e1ce', '#fbf8f2']
  const rango = centros
    .map((c, k) => [luz(c), k] as const)
    .sort((p, q) => p[0] - q[0])
    .map(([, k]) => k)
  B.forEach((h, i) => {
    const base = hex(paleta[rango.indexOf(grupo[i] as number)] as string)
    // Una variación mínima por altura para que dos techos vecinos del mismo grupo no sean idénticos.
    const jitter = ((Math.round(h.alturaEstimada * 10) % 5) - 2) * 0.012
    h.color = base.map((v) => clamp(Math.round(v * (1 + jitter)), 0, 255)) as Rgb
  })
}

// ── Altura híbrida: gemelas con la mediana de sus datos, pisos enteros de 3 m ──────────────────────
const celdas80 = new Map<string, Huella[]>()
const clave80 = (x: number, y: number): string => `${Math.floor(x / 80)},${Math.floor(y / 80)}`
for (const h of B) {
  const k = clave80(h.cx, h.cy)
  celdas80.set(k, [...(celdas80.get(k) ?? []), h])
}
for (const h of B) {
  const gx = Math.floor(h.cx / 80)
  const gy = Math.floor(h.cy / 80)
  const gemelas: number[] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const o of celdas80.get(`${gx + dx},${gy + dy}`) ?? []) {
        if (
          Math.hypot(o.cx - h.cx, o.cy - h.cy) <= 80 &&
          o.area > 40 &&
          Math.abs(o.area - h.area) / h.area < 0.03 &&
          Math.abs(o.perimetro - h.perimetro) / h.perimetro < 0.03 &&
          o.h2 !== null
        ) {
          gemelas.push(o.h2)
        }
      }
    }
  }
  let metros: number
  if (h.area < 40) metros = 3
  else if (h.h2 === null) metros = h.alturaEstimada
  else if (gemelas.length >= 3) metros = mediana(gemelas)
  else if (h.area >= 150) metros = h.h2
  else metros = 0.5 * h.h2 + 0.5 * h.alturaEstimada
  h.altura = Math.max(1, Math.min(13, Math.round(metros / 3))) * 3
}

// ── Grupo de paleta: casas del mismo modelo comparten tono; el resto, por manzana de 120 m ─────────
{
  const clave = (h: Huella): string =>
    `${Math.floor(h.cx / 80)}|${Math.floor(h.cy / 80)}|${Math.round(Math.log(h.area) / 0.06)}|${Math.round(Math.log(h.perimetro) / 0.06)}`
  const cuenta = new Map<string, number>()
  for (const h of B) cuenta.set(clave(h), (cuenta.get(clave(h)) ?? 0) + 1)
  for (const h of B) {
    const k =
      (cuenta.get(clave(h)) ?? 0) >= 3
        ? clave(h)
        : `m${Math.floor(h.cx / 120)}|${Math.floor(h.cy / 120)}`
    h.paleta = hash32([...k].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7)) % 8
    h.semilla = hash32(h.id * 97 + 13) & 15
  }
}

// ── Malla de edificios (solo los de dentro del contorno) ───────────────────────────────────────────
const emitidos = B.filter((h) => h.inside)
const cuadricula = new Map<string, Huella[]>()
for (const h of emitidos) {
  for (let i = Math.floor(h.x0 / 40); i <= Math.floor(h.x1 / 40); i++) {
    for (let j = Math.floor(h.y0 / 40); j <= Math.floor(h.y1 / 40); j++) {
      cuadricula.set(`${i},${j}`, [...(cuadricula.get(`${i},${j}`) ?? []), h])
    }
  }
}
const R_AO = 7
/** Primer lado de otro edificio que corta un rayo corto desde la pared: da la oclusión entre vecinos. */
function rayo(
  ox: number,
  oy: number,
  nx: number,
  ny: number,
  propio: Huella,
): { d: number; hn: number } | null {
  let mejor: { d: number; hn: number } | null = null
  const minx = Math.min(ox, ox + nx * R_AO)
  const maxx = Math.max(ox, ox + nx * R_AO)
  const miny = Math.min(oy, oy + ny * R_AO)
  const maxy = Math.max(oy, oy + ny * R_AO)
  const vistos = new Set<Huella>()
  for (let i = Math.floor(minx / 40); i <= Math.floor(maxx / 40); i++) {
    for (let j = Math.floor(miny / 40); j <= Math.floor(maxy / 40); j++) {
      for (const o of cuadricula.get(`${i},${j}`) ?? []) {
        if (o === propio || vistos.has(o)) continue
        vistos.add(o)
        if (o.x1 < minx || o.x0 > maxx || o.y1 < miny || o.y0 > maxy) continue
        for (let k = 0; k < o.anillo.length; k++) {
          const p = o.anillo[k] as Punto
          const q = o.anillo[(k + 1) % o.anillo.length] as Punto
          const rx = q[0] - p[0]
          const ry = q[1] - p[1]
          const den = nx * ry - ny * rx
          if (Math.abs(den) < 1e-9) continue
          const t = ((p[0] - ox) * ry - (p[1] - oy) * rx) / den
          const s = ((p[0] - ox) * ny - (p[1] - oy) * nx) / den
          if (t > 0 && t <= R_AO && s >= 0 && s <= 1 && (!mejor || t < mejor.d))
            mejor = { d: t, hn: o.altura }
        }
      }
    }
  }
  return mejor
}

const pos: number[] = []
const nrm: number[] = []
const col: number[] = []
let wByte = 0
type V3 = [number, number, number]
const tri = (
  a: V3,
  b: V3,
  c: V3,
  color: Rgb,
  arriba: boolean,
  ao?: [number, number, number],
): void => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as V3
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as V3
  const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const largo = Math.hypot(...n) || 1
  const normal: V3 = arriba ? [0, 0, 127] : (n.map((x) => Math.round((x / largo) * 127)) as V3)
  const P = [a, b, c]
  for (let i = 0; i < 3; i++) {
    const p = P[i] as V3
    pos.push(p[0], p[1], p[2])
    nrm.push(...normal, wByte)
    col.push(color[0], color[1], color[2], ao ? (ao[i] as number) : 255)
  }
}
const rangos: { i: number; j: number; v0: number; v1: number }[] = []
for (const h of emitidos) {
  const { anillo, altura: H } = h
  wByte = (h.paleta << 4) | h.semilla
  const v0 = pos.length / 3
  const n = anillo.length
  for (let k = 0; k < n; k++) {
    const a = anillo[k] as Punto
    const c = anillo[(k + 1) % n] as Punto
    const dx = c[0] - a[0]
    const dy = c[1] - a[1]
    const largo = Math.hypot(dx, dy) || 1
    const nx = dy / largo
    const ny = -dx / largo // normal exterior de un anillo antihorario
    let occ = 0
    let occTop = 0
    for (const t of [0.2, 0.5, 0.8]) {
      const golpe = rayo(a[0] + dx * t + nx * 0.05, a[1] + dy * t + ny * 0.05, nx, ny, h)
      if (golpe) {
        const o = (1 - golpe.d / R_AO) * clamp(golpe.hn / 3, 0, 1)
        occ += o
        occTop += o * (golpe.hn >= H ? 0.8 : (golpe.hn / H) * 0.5)
      }
    }
    const aoB = Math.round(255 * (1 - 0.6 * (occ / 3)))
    const aoT = Math.round(255 * (1 - 0.6 * (occTop / 3)))
    const A0: V3 = [a[0], a[1], 0]
    const B0: V3 = [c[0], c[1], 0]
    const B1: V3 = [c[0], c[1], H]
    const A1: V3 = [a[0], a[1], H]
    tri(A0, B0, B1, h.color, false, [aoB, aoB, aoT])
    tri(A0, B1, A1, h.color, false, [aoB, aoT, aoT])
  }
  const planos = earcut(anillo.flat())
  for (let k = 0; k < planos.length; k += 3) {
    const p = anillo[planos[k] as number] as Punto
    const q = anillo[planos[k + 1] as number] as Punto
    const r = anillo[planos[k + 2] as number] as Punto
    tri([p[0], p[1], H], [q[0], q[1], H], [r[0], r[1], H], h.color, true)
  }
  rangos.push({
    i: Math.floor(h.cx / CELDA_M),
    j: Math.floor(h.cy / CELDA_M),
    v0,
    v1: pos.length / 3,
  })
}
rangos.sort((a, b) => a.i - b.i || a.j - b.j)
const P = new Float32Array(pos.length)
const N = new Int8Array(nrm.length)
const C = new Uint8Array(col.length)
const celdas: { i: number; j: number; start: number; count: number }[] = []
let w = 0
for (const g of rangos) {
  const cuantos = g.v1 - g.v0
  P.set(pos.slice(g.v0 * 3, g.v1 * 3), w * 3)
  N.set(nrm.slice(g.v0 * 4, g.v1 * 4), w * 4)
  C.set(col.slice(g.v0 * 4, g.v1 * 4), w * 4)
  const ultima = celdas.at(-1)
  if (ultima && ultima.i === g.i && ultima.j === g.j) ultima.count += cuantos
  else celdas.push({ i: g.i, j: g.j, start: w, count: cuantos })
  w += cuantos
}
writeFileSync(
  `${salida}/edificios.bin`,
  Buffer.concat([
    cabeceraBin({ lng0: ORIGEN.lng, lat0: ORIGEN.lat, vertices: w, celda: CELDA_M, celdas }),
    Buffer.from(P.buffer),
    Buffer.from(N.buffer),
    Buffer.from(C.buffer),
  ]),
)

// ── Árboles (solo los de dentro del contorno) ──────────────────────────────────────────────────────
const arboles = readJson<
  FeatureCollection<Polygon, { part: string; height: number; base: number }>
>(paths.rawArbolesBase).features
const centro = (
  f: Feature<Polygon>,
): { x: number; y: number; lng: number; lat: number; rad: number } => {
  const anillo = f.geometry.coordinates[0] ?? []
  const lng = anillo.reduce((s, p) => s + (p[0] ?? 0), 0) / anillo.length
  const lat = anillo.reduce((s, p) => s + (p[1] ?? 0), 0) / anillo.length
  const [x, y] = aLocal(lng, lat)
  const rad =
    anillo.reduce((s, p) => {
      const [px, py] = aLocal(p[0] ?? 0, p[1] ?? 0)
      return s + Math.hypot(px - x, py - y)
    }, 0) / anillo.length
  return { x, y, lng, lat, rad }
}
const hashPar = (a: number, b: number): number => {
  let h = (a * 73856093) ^ (b * 19349663)
  h = (h ^ (h >>> 13)) * 1274126177
  return (h ^ (h >>> 16)) >>> 0
}
const contorno = turf.feature(extent.boundary)
const filas: number[][] = []
const varianteDe = (lng: number, lat: number) =>
  hashPar(Math.round(lng * 1e5), Math.round(lat * 1e5)) % 6
const azarDe = (x: number, y: number) =>
  (hash32(Math.round(x * 10) * 7919 + Math.round(y * 10)) % 1000) / 1000
for (let i = 0; i < arboles.length; i++) {
  const copa = arboles[i]
  const punta = arboles[i + 1]
  // El arbusto entra como una fila más, con la marca de tipo en el último flotante. El tronco se salta
  // esa marca en el shader: el arbusto es un solo volumen bajo.
  if (copa?.properties.part === 'shrub') {
    const c = centro(copa)
    if (!turf.booleanPointInPolygon([c.lng, c.lat], contorno)) continue
    filas.push([
      c.x,
      c.y,
      0,
      copa.properties.height,
      c.rad,
      varianteDe(c.lng, c.lat),
      azarDe(c.x, c.y),
      1,
    ])
    continue
  }
  if (copa?.properties.part !== 'crown' || punta?.properties.part !== 'top') continue
  const c = centro(copa)
  if (!turf.booleanPointInPolygon([c.lng, c.lat], contorno)) continue
  filas.push([
    c.x,
    c.y,
    copa.properties.base,
    Math.max(copa.properties.height, punta.properties.height),
    c.rad,
    varianteDe(c.lng, c.lat),
    azarDe(c.x, c.y),
    0,
  ])
}
const celdaDe = (f: number[]): [number, number] => [
  Math.floor((f[0] as number) / CELDA_M),
  Math.floor((f[1] as number) / CELDA_M),
]
filas.sort((a, b) => {
  const [ai, aj] = celdaDe(a)
  const [bi, bj] = celdaDe(b)
  return ai - bi || aj - bj
})
writeFileSync(
  `${salida}/arboles.bin`,
  Buffer.concat([
    cabeceraBin({
      lng0: ORIGEN.lng,
      lat0: ORIGEN.lat,
      instancias: filas.length,
      celda: CELDA_M,
      celdas: celdasDe(filas, celdaDe),
    }),
    Buffer.from(new Float32Array(filas.flat()).buffer),
  ]),
)

anotarManifiesto(
  [
    {
      id: 'open-buildings-2-5d',
      name: 'Open Buildings 2.5D Temporal (Google Research, 2023, 4 m): altura de los edificios',
      layers: ['edificios'],
      license: 'CC-BY-4.0 u ODbL-1.0, a elegir',
      attribution:
        'Google Research, Open Buildings 2.5D Temporal (con datos de Copernicus Sentinel-2)',
      url: 'https://sites.research.google/gr/open-buildings/temporal/',
      method: `Mosaicos ${realismo.alturas.mosaicos.map((m) => m.archivo).join(', ')} (scripts/map/realismo/fetch-realismo.ts). Altura estimada: híbrida de datos y de superficie, en pisos de 3 m; sin validar con alturas medidas`,
    },
    {
      id: 'mallas-3d',
      name: 'Mallas 3D de edificios y árboles dentro del contorno',
      layers: ['edificios', 'arboles'],
      license: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors, Overture Maps Foundation',
      url: 'https://docs.overturemaps.org/attribution/',
      method:
        'Derivadas de las huellas de Overture y de OSM que entran a las teselas (scripts/map/realismo/build-mallas.ts); bases de datos derivadas bajo ODbL 1.0',
    },
  ],
  ['edificios.bin', 'arboles.bin'],
)
console.log(
  `✓ edificios.bin: ${emitidos.length} edificios, ${w} vértices (${B.filter((h) => h.h2 === null).length} sin altura de datos) · ` +
    `arboles.bin: ${filas.length} árboles`,
)
