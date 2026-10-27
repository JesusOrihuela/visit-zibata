/**
 * npm run map:fetch:realismo
 *
 * Descarga una sola vez lo que necesitan las capas de realismo, para que la app publicada no consulte
 * nunca un servidor externo:
 *  - teselas de relieve z12 (Copernicus GLO-30 vía Mapterhorn) → public/map/realismo/relieve
 *  - imagen de Sentinel-2 (ventana de Zibatá a 10 m y región a 20 m, por peticiones de rango) → raw
 *  - calles principales de la región (OpenStreetMap vía Overpass) → raw
 *
 * Datos © OpenStreetMap contributors (ODbL 1.0). Contains modified Copernicus Sentinel data.
 * Copernicus DEM GLO-30 © DLR e.V. y Airbus Defence and Space, provisto por la Unión Europea y la ESA.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fromUrl } from 'geotiff'
import { FetchSource, PMTiles } from 'pmtiles'
import sharp from 'sharp'
import { paths, writeJson } from '../lib/paths.ts'
import type { SentinelMeta, Ventana } from './lib.ts'
import { config, realismo, regionCorners, toUtm } from './lib.ts'

async function fetchRelieve(): Promise<void> {
  const { fuente, zoom, x, y } = realismo.relieve
  const archivo = new PMTiles(new FetchSource(fuente))
  let nuevas = 0
  for (let tx = x[0]; tx <= x[1]; tx++) {
    for (let ty = y[0]; ty <= y[1]; ty++) {
      const file = `${paths.relieveDir}/${zoom}/${tx}/${ty}.webp`
      if (existsSync(file)) continue
      const tile = await archivo.getZxy(zoom, tx, ty)
      if (!tile) throw new Error(`Mapterhorn no tiene la tesela ${zoom}/${tx}/${ty}`)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, Buffer.from(tile.data))
      nuevas++
    }
  }
  console.log(`✓ relieve: ${nuevas} teselas nuevas en ${paths.relieveDir}`)
}

/** Lee del COG la ventana que cubre las esquinas dadas (en lng, lat) al nivel de resumen `factor` (1 = 10 m). */
async function leerVentana(
  tiff: Awaited<ReturnType<typeof fromUrl>>,
  esquinas: [number, number][],
  factor: number,
  destino: string,
): Promise<Ventana> {
  const base = await tiff.getImage(0)
  const [ox = 0, oy = 0] = base.getOrigin()
  const [rx0 = 0, ry0 = 0] = base.getResolution()
  let imagen = base
  if (factor !== 1) {
    const total = await tiff.getImageCount()
    for (let k = 1; k < total; k++) {
      const candidata = await tiff.getImage(k)
      if (Math.abs(base.getWidth() / candidata.getWidth() - factor) < 0.05) {
        imagen = candidata
        break
      }
    }
    if (imagen === base) throw new Error(`El COG no tiene un nivel de resumen ${factor}x`)
  }
  const rx = rx0 * factor
  const ry = ry0 * factor
  const utm = esquinas.map(([lng, lat]) => toUtm(lng, lat))
  const xs = utm.map((p) => p[0])
  const ys = utm.map((p) => p[1])
  const px0 = Math.max(0, Math.floor((Math.min(...xs) - ox) / rx))
  const px1 = Math.min(imagen.getWidth(), Math.ceil((Math.max(...xs) - ox) / rx))
  const py0 = Math.max(0, Math.floor((Math.max(...ys) - oy) / ry))
  const py1 = Math.min(imagen.getHeight(), Math.ceil((Math.min(...ys) - oy) / ry))
  const width = px1 - px0
  const height = py1 - py0
  const datos = (await imagen.readRasters({
    window: [px0, py0, px1, py1],
    interleave: true,
  })) as Uint8Array
  const rgb = Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength)
  mkdirSync(dirname(destino), { recursive: true })
  await sharp(rgb, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(destino)
  return { x0: ox + px0 * rx, y0: oy + py0 * ry, rx, ry, width, height }
}

async function fetchSentinel(): Promise<void> {
  const { escena, tif, anio } = realismo.sentinel
  const [oeste, sur, este, norte] = config.area.bbox
  const tiff = await fromUrl(tif, { maxRanges: 4 })
  const zibata = await leerVentana(
    tiff,
    [
      [oeste, norte],
      [este, norte],
      [este, sur],
      [oeste, sur],
    ],
    1,
    paths.rawSentinelZibata,
  )
  const region = await leerVentana(tiff, regionCorners(), 2, paths.rawSentinelRegion)
  const meta: SentinelMeta = {
    escena,
    tif,
    anio,
    obtenidoEl: new Date().toISOString(),
    zibata,
    region,
  }
  writeJson(paths.rawSentinelMeta, meta)
  console.log(
    `✓ Sentinel-2 ${escena}: ventana ${zibata.width}x${zibata.height} (10 m) y región ${region.width}x${region.height} (20 m)`,
  )
}

interface ViasOverpass {
  elements: unknown[]
  osm3s?: { timestamp_osm_base?: string }
}

async function fetchVias(): Promise<void> {
  const esquinas = regionCorners()
  const lngs = esquinas.map((p) => p[0])
  const lats = esquinas.map((p) => p[1])
  const bbox = `${Math.min(...lats)},${Math.min(...lngs)},${Math.max(...lats)},${Math.max(...lngs)}`
  const clases = Object.values(realismo.vias.clases).flat().join('|')
  const query = `[out:json][timeout:180][maxsize:268435456];
way["highway"~"^(${clases})$"](${bbox});
out geom;`
  /** Los espejos de Overpass pueden ir meses atrasados: se acepta uno con datos de ≤ 7 días. */
  const maxEdadMs = 7 * 24 * 60 * 60 * 1000
  let mejor: { data: ViasOverpass; endpoint: string; base: number } | null = null
  for (const endpoint of config.sources.overpassEndpoints) {
    try {
      console.log(`→ Overpass: ${endpoint}`)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'visit-zibata/map-pipeline (preparación de datos estáticos)',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(280_000),
      })
      const body = await response.text()
      if (!response.ok || !body.trimStart().startsWith('{')) {
        console.warn(`  respuesta ${response.status}; se intenta el siguiente servidor`)
        continue
      }
      const data = JSON.parse(body) as ViasOverpass
      const base = Date.parse(data.osm3s?.timestamp_osm_base ?? '') || 0
      console.log(`  datos OSM al ${data.osm3s?.timestamp_osm_base ?? 'desconocido'}`)
      if (!mejor || base > mejor.base) mejor = { data, endpoint, base }
      if (Date.now() - base <= maxEdadMs) break
    } catch (error) {
      console.warn(`  error: ${(error as Error).message}`)
    }
  }
  if (!mejor) throw new Error('No fue posible descargar las calles de la región de Overpass.')
  if (Date.now() - mejor.base > maxEdadMs)
    console.warn('⚠ Ningún servidor tenía datos de la última semana; se usa el más reciente.')
  writeJson(paths.rawViasContexto, mejor.data, false)
  console.log(`✓ ${mejor.data.elements.length} tramos de calles principales (${mejor.endpoint})`)
}

// Sin argumentos baja todo; con uno (relieve, sentinel o vias) repite solo ese paso.
const paso = process.argv[2]
if (!paso || paso === 'relieve') await fetchRelieve()
if (!paso || paso === 'sentinel') await fetchSentinel()
if (!paso || paso === 'vias') await fetchVias()
