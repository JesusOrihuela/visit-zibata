import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

export const paths = {
  config: `${ROOT}data/geographic/config.json`,
  rawDir: `${ROOT}data/geographic/raw`,
  rawOsm: `${ROOT}data/geographic/raw/osm.json`,
  rawOsmMeta: `${ROOT}data/geographic/raw/osm.meta.json`,
  rawBuildings: `${ROOT}data/geographic/raw/overture-buildings.geojson`,
  rawBuildingsMeta: `${ROOT}data/geographic/raw/overture-buildings.meta.json`,
  rawTreeCover: `${ROOT}data/geographic/raw/overture-tree-cover.geojson`,
  rawTreeCoverMeta: `${ROOT}data/geographic/raw/overture-tree-cover.meta.json`,
  extent: `${ROOT}data/geographic/extent.json`,
  manifest: `${ROOT}data/geographic/manifest.json`,
  plazas: `${ROOT}data/commercial/plazas.json`,
  publicMap: `${ROOT}public/map`,
  pmtiles: `${ROOT}public/map/zibata.pmtiles`,
  plazaBuildings: `${ROOT}public/map/plaza-buildings.geojson`,
  planoSource: `${ROOT}data/geographic/reference/plano-zibata.png`,
  planoGeoref: `${ROOT}data/geographic/reference/plano-zibata.georef.json`,
  planoPublic: `${ROOT}public/map/reference/plano-zibata.webp`,
  realismoDir: `${ROOT}public/map/realismo`,
  relieveDir: `${ROOT}public/map/realismo/relieve`,
  rawSentinelZibata: `${ROOT}data/geographic/raw/sentinel-zibata.png`,
  rawSentinelRegion: `${ROOT}data/geographic/raw/sentinel-region.png`,
  rawSentinelMeta: `${ROOT}data/geographic/raw/sentinel.meta.json`,
  rawViasContexto: `${ROOT}data/geographic/raw/osm-vias-contexto.json`,
}

export interface GeoConfig {
  area: { name: string; bbox: [number, number, number, number] }
  zibataSeedPolygon: [number, number][]
  /** Suelo ya planeado que aún no tiene calles: se suma al contorno calculado. */
  boundaryExtensions: { name: string; source: string; polygon: [number, number][] }[]
  sources: { overpassEndpoints: string[]; overtureRelease: string }
  /** Árboles generados dentro de la cobertura arbórea real (scripts/map/lib/trees.ts). */
  trees: {
    spacingM: number
    greenSpacingM: number
    roadClearanceM: Record<string, number>
  }
  tiles: {
    minZoom: number
    maxZoom: number
    buildingsMinZoom: number
    buildingsLowZoomMinAreaM2: number
  }
  buildings: {
    defaultLevelHeight: number
    minAreaM2: number
    plazaSynthetic: {
      default: PlazaSyntheticRule
      plazas: Record<string, Partial<PlazaSyntheticRule>>
    }
  }
  realismo: {
    sentinel: { escena: string; tif: string; utm: string; anio: number }
    /** Bloque de teselas z12 de relieve (Copernicus GLO-30 vía Mapterhorn), ambos extremos incluidos. */
    relieve: { fuente: string; zoom: number; x: [number, number]; y: [number, number] }
    contexto: { pixeles: number; anilloM: number; difuminadoOrilla: number }
    vias: { clases: Record<string, string[]> }
  }
}

export interface PlazaSyntheticRule {
  height: number
  scale: number
  replaceExisting: boolean
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

export function writeJson(file: string, value: unknown, pretty = true): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`)
}

export function loadConfig(): GeoConfig {
  return readJson<GeoConfig>(paths.config)
}
