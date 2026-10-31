/**
 * npm run map:build
 *
 * Procesa los datos crudos (data/geographic/raw, ver `npm run map:fetch`) y genera los assets
 * estáticos del mapa. Todo el trabajo GIS pesado ocurre aquí, nunca en el navegador.
 *
 * Salidas:
 *  - public/map/zibata.pmtiles            capas: boundary, landuse, water, waterway, roads, buildings, labels
 *  - public/map/plaza-buildings.geojson   edificios de plazas (interactivos), con plazaId
 *  - data/geographic/extent.json          contorno, bbox y centro de Zibatá (lo usa la app)
 *  - data/geographic/manifest.json        procedencia, licencias, fechas, conteos y huellas de archivos
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as turf from '@turf/turf'
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson'
import { PlazasFileSchema } from '../../src/data/schemas.ts'
import { normalizeText } from '../../src/lib/text.ts'
import {
  type BuildingType,
  classifyLabel,
  classifyLanduse,
  classifyRoad,
  displayName,
  estimateHeight,
  isWaterArea,
  isWaterway,
} from './lib/classify.ts'
import { polygonsOf, roundPositions } from './lib/geo.ts'
import { type OverpassResponse, overpassToFeatures } from './lib/osm.ts'
import { loadConfig, paths, readJson, writeJson } from './lib/paths.ts'
import { Compression, TileType, writePmtiles } from './lib/pmtiles-writer.ts'
import { buildVectorTiles, type LayerInput } from './lib/tiles.ts'
import { MEZCLA_ARBUSTO, MEZCLA_NATIVA, MEZCLA_URBANA, placeTrees } from './lib/trees.ts'

const started = Date.now()
const log = (message: string) =>
  console.log(`[${((Date.now() - started) / 1000).toFixed(1)} s] ${message}`)

for (const [file, command] of [
  [paths.rawOsm, 'npm run map:fetch:osm'],
  [paths.rawBuildings, 'npm run map:fetch:buildings'],
] as const) {
  if (!existsSync(file)) {
    console.error(`✗ Falta ${file}. Ejecuta primero: ${command}`)
    process.exit(1)
  }
}

const config = loadConfig()
const bbox = config.area.bbox
const [west, south, east, north] = bbox
const inBbox = ([lng, lat]: Position) =>
  lng !== undefined &&
  lat !== undefined &&
  lng >= west &&
  lng <= east &&
  lat >= south &&
  lat <= north

const osmMeta = readJson<{ fetchedAt: string; osmBaseTimestamp: string | null }>(paths.rawOsmMeta)
const buildingsMeta = readJson<{ fetchedAt: string; release: string; upstream: string[] }>(
  paths.rawBuildingsMeta,
)

// ── 1. OSM → GeoJSON ────────────────────────────────────────────────────────────────────────────
const osmFeatures = overpassToFeatures(readJson<OverpassResponse>(paths.rawOsm))
log(`${osmFeatures.length} elementos OSM convertidos`)

function clipPolygonFeature<P extends object>(
  feature: Feature<Polygon | MultiPolygon>,
  properties: P,
): Feature<Polygon | MultiPolygon, P> | null {
  const clipped = turf.bboxClip(feature, bbox)
  const rings = clipped.geometry.coordinates
  if (rings.length === 0 || turf.area(clipped) < 1) return null
  const rewound = turf.rewind(clipped, { mutate: false }) as Feature<Polygon | MultiPolygon>
  return { type: 'Feature', properties, geometry: rewound.geometry }
}

// ── 2. Vialidades, usos de suelo y agua ─────────────────────────────────────────────────────────
const roads: Feature[] = []
const landuse: Feature<Polygon | MultiPolygon, { class: string }>[] = []
const water: Feature[] = []
const waterways: Feature[] = []

for (const feature of osmFeatures) {
  const tags = feature.properties
  const { geometry } = feature
  if (geometry.type === 'LineString') {
    const line = feature as Feature<LineString>
    const road = classifyRoad(tags)
    if (road) {
      const clipped = turf.bboxClip(line, bbox)
      if (clipped.geometry.coordinates.length > 0) {
        roads.push({ type: 'Feature', properties: road, geometry: clipped.geometry })
      }
    } else if (isWaterway(tags)) {
      const clipped = turf.bboxClip(line, bbox)
      if (clipped.geometry.coordinates.length > 0) {
        waterways.push({
          type: 'Feature',
          properties: { class: tags.waterway },
          geometry: clipped.geometry,
        })
      }
    }
    continue
  }
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue
  const polygon = feature as Feature<Polygon | MultiPolygon>
  if (isWaterArea(tags)) {
    const clipped = clipPolygonFeature(polygon, {
      class: 'water',
      ...(tags.name ? { name: displayName(tags.name) } : {}),
    })
    if (clipped) water.push(clipped)
    continue
  }
  const landuseClass = classifyLanduse(tags)
  if (landuseClass) {
    const clipped = clipPolygonFeature(polygon, { class: landuseClass })
    if (clipped) landuse.push(clipped)
  }
}
// Las áreas grandes primero: las pequeñas (parques dentro de residenciales) se dibujan encima.
landuse.sort((a, b) => turf.area(b) - turf.area(a))
log(
  `${roads.length} vialidades · ${landuse.length} usos de suelo · ${water.length} cuerpos de agua`,
)

// ── 3. Contorno de Zibatá (envolvente cóncava de su red vial dentro del polígono semilla) ───────
const seed = turf.polygon([config.zibataSeedPolygon])
const vertexKeys = new Set<string>()
const vertices: Feature<Point>[] = []
for (const road of roads) {
  const roadClass = (road.properties as { class: string }).class
  if (roadClass === 'highway' || roadClass === 'path') continue
  const coordinates = turf.coordAll(road)
  for (const position of coordinates) {
    const key = `${position[0]?.toFixed(4)},${position[1]?.toFixed(4)}`
    if (vertexKeys.has(key) || !turf.booleanPointInPolygon(position, seed)) continue
    vertexKeys.add(key)
    vertices.push(turf.point(position))
  }
}
const hull =
  turf.concave(turf.featureCollection(vertices), { maxEdge: 0.35, units: 'kilometers' }) ?? seed
const buffered = turf.buffer(hull, 70, { units: 'meters' }) as Feature<Polygon | MultiPolygon>
// Suelo planeado sin calles todavía (Master Plan): se suma al contorno para que el mapa lo cubra. El
// polígono se guarda exacto (solo el suelo nuevo), así que se ensancha unos metros al unirlo: si solo
// se tocaran por el borde, la unión devolvería dos piezas sueltas y la ampliación se perdería.
const extended = config.boundaryExtensions.reduce<Feature<Polygon | MultiPolygon>>(
  (shape, extension) =>
    (turf.union(
      turf.featureCollection([
        shape,
        turf.buffer(turf.polygon([extension.polygon]), 10, { units: 'meters' }) as Feature<Polygon>,
      ]),
    ) ?? shape) as Feature<Polygon | MultiPolygon>,
  buffered,
)
const largest = polygonsOf(extended).sort((a, b) => turf.area(b) - turf.area(a))[0]
if (!largest) throw new Error('No se pudo calcular el contorno de Zibatá')
const boundary = turf.simplify(turf.feature(largest), {
  tolerance: 0.00012,
  highQuality: true,
}) as Feature<Polygon>
boundary.geometry.coordinates = [roundPositions(boundary.geometry.coordinates[0] ?? [], 5)]
boundary.properties = { name: 'Zibatá' }
log(
  `Contorno de Zibatá: ${(turf.area(boundary) / 1e6).toFixed(2)} km² (${vertices.length} vértices viales)`,
)

// ── 4. Plazas ───────────────────────────────────────────────────────────────────────────────────
const plazas = PlazasFileSchema.parse(readJson(paths.plazas)).plazas
const plazaShapes = plazas.map((plaza) => ({ plaza, shape: turf.feature(plaza.geometry) }))
// Una plaza no puede atravesar una calle: pasa cuando su huella aproximada se centra en el punto de un
// enlace de Maps que cae sobre la vía (Xënica, 2026-09). Se avisa para rehacerla con map:suggest-plaza.
const THROUGH_ROADS = new Set(['highway', 'primary', 'tertiary', 'street'])
for (const { plaza, shape } of plazaShapes) {
  const crossed = roads.filter(
    (road) =>
      THROUGH_ROADS.has((road.properties as { class: string }).class) &&
      turf
        .flatten(road as Feature<LineString | MultiLineString>)
        .features.some((line) => turf.booleanCrosses(line, shape)),
  )
  if (crossed.length > 0)
    console.warn(
      `⚠ La plaza ${plaza.id} cruza ${crossed.length} vía(s): revisa su geometría (npm run map:suggest-plaza).`,
    )
}
const educationAreas = landuse.filter((f) => f.properties.class === 'education')
const commercialAreas = landuse.filter((f) => f.properties.class === 'commercial')

// ── 5. Edificios ────────────────────────────────────────────────────────────────────────────────
interface OvertureBuilding {
  id: string
  height: number | null
  num_floors: number | null
  min_height: number | null
  src: string | null
}
const rawBuildings = readJson<FeatureCollection<Polygon | MultiPolygon, OvertureBuilding>>(
  paths.rawBuildings,
)
rawBuildings.features.sort((a, b) => a.properties.id.localeCompare(b.properties.id))

const SOURCE_CODE: Record<string, string> = {
  OpenStreetMap: 'osm',
  'Microsoft ML Buildings': 'microsoft',
  'Google Open Buildings': 'google',
}

type BuildingProps = {
  id: number
  height: number
  minHeight?: number
  type: BuildingType
  src: string
  /** Dentro del contorno de Zibatá: el estilo atenúa el contexto exterior. */
  inside: boolean
}
const baseBuildings: Feature<Polygon, BuildingProps>[] = []
/** Superficie de cada edificio base (no se publica en las teselas; solo decide qué entra en z13). */
const buildingArea = new Map<Feature<Polygon, BuildingProps>, number>()
const plazaBuildings = new Map<string, Feature<Polygon, BuildingProps & { plazaId: string }>[]>()
let nextId = 1

for (const building of rawBuildings.features) {
  for (const polygon of polygonsOf(building)) {
    const areaM2 = turf.area(polygon)
    if (areaM2 < config.buildings.minAreaM2) continue
    const center = turf.centroid(polygon).geometry.coordinates
    if (!inBbox(center)) continue

    const inside = (area: Feature<Polygon | MultiPolygon>) =>
      turf.booleanPointInPolygon(center, area)
    const plaza = plazaShapes.find(({ shape }) => inside(shape))?.plaza
    let type: BuildingType = 'residential'
    if (plaza || commercialAreas.some(inside)) type = 'commercial'
    else if (educationAreas.some(inside)) type = 'education'
    else if (areaM2 > 1500) type = 'other'

    const props: BuildingProps = {
      id: nextId++,
      height: estimateHeight(
        {
          id: building.properties.id,
          areaM2,
          height: building.properties.height,
          levels: building.properties.num_floors,
          type,
        },
        config.buildings.defaultLevelHeight,
      ),
      type,
      src: SOURCE_CODE[(building.properties.src ?? '').split(',')[0] ?? ''] ?? 'other',
      inside: turf.booleanPointInPolygon(center, boundary),
    }
    if (building.properties.min_height) props.minHeight = building.properties.min_height
    const geometry = turf.rewind(polygon) as Polygon

    if (plaza) {
      const list = plazaBuildings.get(plaza.id) ?? []
      list.push({ type: 'Feature', properties: { ...props, plazaId: plaza.id }, geometry })
      plazaBuildings.set(plaza.id, list)
    } else {
      const feature: Feature<Polygon, BuildingProps> = {
        type: 'Feature',
        properties: props,
        geometry,
      }
      baseBuildings.push(feature)
      buildingArea.set(feature, areaM2)
    }
  }
}

// Plazas sin huellas (o con huellas incompletas): volumen generado a partir de su geometría.
const synthesized: string[] = []
/** Por qué cada plaza lleva volumen generado (para docs/MAPA.md y la auditoría). */
const synthesisDetail: { plazaId: string; replacedFootprints: number; reason: string }[] = []
for (const { plaza, shape } of plazaShapes) {
  const rule = {
    ...config.buildings.plazaSynthetic.default,
    ...config.buildings.plazaSynthetic.plazas[plaza.id],
  }
  const existing = plazaBuildings.get(plaza.id) ?? []
  if (existing.length > 0 && !rule.replaceExisting) continue
  const scaled = turf.transformScale(shape, rule.scale, { origin: 'centroid' })
  const geometry = turf.rewind(
    polygonsOf(scaled as Feature<Polygon | MultiPolygon>)[0] as Polygon,
  ) as Polygon
  plazaBuildings.set(plaza.id, [
    {
      type: 'Feature',
      properties: {
        id: nextId++,
        height: rule.height,
        type: 'commercial',
        src: 'synthetic',
        inside: true,
        plazaId: plaza.id,
      },
      geometry,
    },
  ])
  synthesized.push(plaza.id)
  synthesisDetail.push({
    plazaId: plaza.id,
    replacedFootprints: existing.length,
    reason:
      existing.length === 0
        ? 'Sin huellas de edificio abiertas (Overture: OSM, Microsoft, Google) dentro de la plaza'
        : 'Huellas abiertas incompletas o que no representan el conjunto comercial (replaceExisting en config.json)',
  })
}
log(
  `Alturas: ${new Set(baseBuildings.map((f) => f.properties.height)).size} valores distintos entre ${baseBuildings.length} edificios base`,
)
const plazaBuildingCount = [...plazaBuildings.values()].reduce((sum, list) => sum + list.length, 0)
log(
  `${baseBuildings.length} edificios base · ${plazaBuildingCount} de plazas (generados: ${synthesized.join(', ') || 'ninguno'})`,
)

// ── 6. Etiquetas de lugares (parques, golf, agua, residenciales, escuelas) ──────────────────────
const LABEL_CLEARANCE_M = 130
const activePlazaPoints = plazas
  .filter((plaza) => plaza.active)
  .map((plaza) => turf.point([plaza.coordinates.lng, plaza.coordinates.lat]))
const labelsNearPlazas = new Set<string>()
const nearActivePlaza = (point: Position) =>
  activePlazaPoints.some(
    (plazaPoint) => turf.distance(point, plazaPoint, { units: 'meters' }) < LABEL_CLEARANCE_M,
  )
const labelRegion = turf.buffer(boundary, 400, { units: 'meters' }) as Feature<Polygon>
const labelsByName = new Map<string, { feature: Feature<Point>; area: number }>()
for (const feature of osmFeatures) {
  const labelClass = classifyLabel(feature.properties)
  const name = feature.properties.name ? displayName(feature.properties.name) : undefined
  if (!labelClass || !name) continue
  const area = feature.geometry.type === 'Point' ? 0 : turf.area(feature)
  if (labelClass === 'park' && area > 0 && area < 1500) continue
  const point =
    feature.geometry.type === 'Point'
      ? (feature.geometry.coordinates as Position)
      : turf.pointOnFeature(feature).geometry.coordinates
  if (!turf.booleanPointInPolygon(point, labelRegion)) continue
  /*
   * Un rótulo junto a una plaza activa queda bajo su marcador (P4-UX-019): la plaza ya se nombra ahí.
   * El residencial es la excepción: su nombre es el del área entera, no el de un punto, y el punto que
   * devuelve `pointOnFeature` puede caer cerca de una plaza sin que el área lo esté. Descartarlo por
   * eso borraba residenciales que OSM sí tiene.
   */
  if (labelClass !== 'district' && nearActivePlaza(point)) {
    labelsNearPlazas.add(name)
    continue
  }
  const key = normalizeText(name)
  const previous = labelsByName.get(key)
  if (previous && previous.area >= area) continue
  const rank =
    labelClass === 'golf' || labelClass === 'education' ? 1 : labelClass === 'district' ? 3 : 2
  labelsByName.set(key, {
    area,
    feature: {
      type: 'Feature',
      properties: { name, class: labelClass, rank },
      geometry: { type: 'Point', coordinates: roundPositions(point) },
    },
  })
}
const labels = [...labelsByName.values()].map((entry) => entry.feature)
const porClase = new Map<string, number>()
for (const etiqueta of labels) {
  const clase = String(etiqueta.properties?.class)
  porClase.set(clase, (porClase.get(clase) ?? 0) + 1)
}
const desglose = [...porClase].sort(([a], [b]) => a.localeCompare(b)).map(([c, n]) => `${c}: ${n}`)
log(
  `${labels.length} etiquetas de lugares (${desglose.join(', ')}). Omitidas junto a plazas: ${[...labelsNearPlazas].join(', ') || 'ninguna'}`,
)

// ── 6b. Árboles: solo donde la cobertura arbórea real (ESA WorldCover vía Overture) dice que hay ──────
const TREE_MARGIN_M = 150
const treeCover = existsSync(paths.rawTreeCover)
  ? readJson<FeatureCollection<Polygon | MultiPolygon>>(paths.rawTreeCover)
  : null
if (!treeCover)
  console.warn(
    '⚠ Sin cobertura arbórea: ejecuta `npm run map:fetch:trees`. El mapa sale sin árboles.',
  )
const treeArea = turf.buffer(boundary, TREE_MARGIN_M, { units: 'meters' }) as Feature<Polygon>
const canopy = (treeCover?.features ?? []).flatMap((feature) => {
  const clipped = turf.intersect(turf.featureCollection([feature, treeArea]))
  return clipped ? [clipped as Feature<Polygon | MultiPolygon>] : []
})
const obstacles = {
  roads,
  buildings: [...baseBuildings, ...[...plazaBuildings.values()].flat()],
}
// Las áreas verdes de OSM (parques, jardines, pasto y golf) también están arboladas en Zibatá, con
// menos densidad que una cañada: la clasificación satelital de 10 m no distingue un árbol suelto.
const GREEN_CLASSES = new Set(['park', 'garden', 'grass', 'golf', 'wood'])
const greenFeatures = landuse.filter((feature) => GREEN_CLASSES.has(feature.properties.class))
const greenAreas = greenFeatures
  .flatMap((feature) => polygonsOf(feature as Feature<Polygon | MultiPolygon>))
  .map((polygon) => turf.feature(polygon) as Feature<Polygon>)
// El matorral bajo va donde se pisa y se mira: parques, jardines y arbolado. El green del golf y
// los prados abiertos se quedan con su árbol, sin un arbusto cada metro que además no se ve.
const SHRUB_CLASSES = new Set(['park', 'garden', 'wood'])
const shrubAreas = greenFeatures
  .filter((feature) => SHRUB_CLASSES.has(feature.properties.class))
  .flatMap((feature) => polygonsOf(feature as Feature<Polygon | MultiPolygon>))
  .map((polygon) => turf.feature(polygon) as Feature<Polygon>)
const trees = [
  ...placeTrees(canopy, obstacles, { ...config.trees, especies: MEZCLA_NATIVA }),
  ...placeTrees(greenAreas, obstacles, {
    ...config.trees,
    spacingM: config.trees.greenSpacingM,
    especies: MEZCLA_URBANA,
  }),
  // El arbusto va aparte y más tupido: un volumen bajo por planta, y solo entra en z16.
  ...placeTrees(shrubAreas, obstacles, {
    ...config.trees,
    spacingM: config.trees.shrubSpacingM,
    forma: 'arbusto',
    especies: MEZCLA_ARBUSTO,
  }),
]
const copas = trees.filter((tree) => tree.properties.part === 'crown').length
const arbustos = trees.filter((tree) => tree.properties.part === 'shrub').length
log(
  `${copas} árboles y ${arbustos} arbustos: ${(canopy.reduce((sum, area) => sum + turf.area(area), 0) / 1e6).toFixed(2)} km² de copa arbórea + ${greenAreas.length} áreas verdes (${shrubAreas.length} con matorral)`,
)

// ── 7. Teselas vectoriales → PMTiles ───────────────────────────────────────────────────────────
const { minZoom, maxZoom, buildingsMinZoom, buildingsLowZoomMinAreaM2 } = config.tiles
const lowZoomBuildings = baseBuildings.filter(
  (feature) => (buildingArea.get(feature) ?? 0) >= buildingsLowZoomMinAreaM2,
)
log(
  `z${buildingsMinZoom}: ${lowZoomBuildings.length}/${baseBuildings.length} edificios (≥ ${buildingsLowZoomMinAreaM2} m²)`,
)
const layers: LayerInput[] = [
  { name: 'boundary', features: [boundary], minZoom, maxZoom },
  { name: 'landuse', features: landuse, minZoom, maxZoom },
  { name: 'water', features: water, minZoom, maxZoom },
  { name: 'waterway', features: waterways, minZoom: 13, maxZoom },
  { name: 'roads', features: roads, minZoom, maxZoom },
  {
    name: 'buildings',
    features: lowZoomBuildings,
    minZoom: buildingsMinZoom,
    maxZoom: buildingsMinZoom,
  },
  { name: 'buildings', features: baseBuildings, minZoom: buildingsMinZoom + 1, maxZoom },
  { name: 'labels', features: labels, minZoom, maxZoom },
  /*
   * Los árboles entran en z14 y no en z13.
   *
   * La tesela se dibuja sobre una rejilla de 4096 unidades, así que en z13 cada unidad mide ~1,2 m
   * y una copa de 3 m de radio ocupa dos unidades y media: casi todos sus vértices caen en la misma
   * coordenada entera y el polígono se guarda entero para no pintar nada. Son bytes que viajan en
   * la tesela que más se pide (z13 es la vista inicial en móvil) sin llegar nunca a verse.
   *
   * De lejos basta la copa baja; el segundo piso entra en z15 y el tronco en z16. El arbusto solo
   * entra en z16, que es cuando su altura se distingue del suelo.
   */
  {
    name: 'trees',
    features: trees.filter(
      (tree) => tree.properties.part !== 'shrub' && tree.properties.part === 'crown',
    ),
    minZoom: buildingsMinZoom + 1,
    maxZoom: 14,
  },
  {
    name: 'trees',
    features: trees.filter(
      (tree) => tree.properties.part !== 'shrub' && tree.properties.part !== 'trunk',
    ),
    minZoom: 15,
    maxZoom: 15,
  },
  {
    name: 'trees',
    features: trees.filter((tree) => tree.properties.part !== 'shrub'),
    minZoom: 16,
    maxZoom,
  },
  {
    // Capa propia: geojson-vt guarda una sola capa por nombre y zooms solapados se pisarían.
    name: 'shrubs',
    features: trees.filter((tree) => tree.properties.part === 'shrub'),
    minZoom: 16,
    maxZoom,
  },
]
const { tiles, bytesByZoom, largestTile } = buildVectorTiles(layers, {
  minZoom,
  maxZoom,
  bounds: bbox,
})

const fieldsOf = (features: Feature[]) => {
  const fields: Record<string, string> = {}
  for (const feature of features) {
    for (const [key, value] of Object.entries(feature.properties ?? {})) {
      fields[key] =
        typeof value === 'number' ? 'Number' : typeof value === 'boolean' ? 'Boolean' : 'String'
    }
  }
  return fields
}

// Las mallas 3D de realismo (scripts/map/realismo/build-mallas.ts) parten de las mismas huellas y árboles que las teselas.
writeJson(paths.rawEdificiosBase, turf.featureCollection(baseBuildings), false)
writeJson(paths.rawArbolesBase, turf.featureCollection(trees), false)

const boundaryCenter = turf.centroid(boundary).geometry.coordinates as [number, number]
const attribution = '© OpenStreetMap contributors · Overture Maps Foundation'
const archive = writePmtiles(tiles, {
  tileType: TileType.Mvt,
  tileCompression: Compression.Gzip,
  minZoom,
  maxZoom,
  bounds: bbox,
  center: [boundaryCenter[0], boundaryCenter[1], 15],
  metadata: {
    name: 'Zibatá: capas base',
    description: 'Vialidades, usos de suelo, agua, edificios y etiquetas de Zibatá (Querétaro).',
    attribution,
    version: '1',
    type: 'overlay',
    format: 'pbf',
    vector_layers: [...new Set(layers.map((layer) => layer.name))].map((name) => {
      const parts = layers.filter((layer) => layer.name === name)
      return {
        id: name,
        minzoom: Math.min(...parts.map((layer) => layer.minZoom)),
        maxzoom: Math.max(...parts.map((layer) => layer.maxZoom)),
        fields: fieldsOf(parts.flatMap((layer) => layer.features)),
      }
    }),
    osm_data_timestamp: osmMeta.osmBaseTimestamp,
    overture_release: buildingsMeta.release,
  },
})
mkdirSync(paths.publicMap, { recursive: true })
writeFileSync(paths.pmtiles, archive)
log(`PMTiles: ${tiles.length} teselas, ${(archive.byteLength / 1024).toFixed(0)} KB`)

const plazaCollection: FeatureCollection = {
  type: 'FeatureCollection',
  features: [...plazaBuildings.values()].flat().map((feature) => ({
    ...feature,
    properties: { ...feature.properties, interactive: true },
    geometry: { ...feature.geometry, coordinates: roundPositions(feature.geometry.coordinates) },
  })),
}
writeFileSync(paths.plazaBuildings, JSON.stringify(plazaCollection))

// ── 8. Extensión (para la app) y manifiesto de procedencia ─────────────────────────────────────
const boundaryBbox = turf.bbox(boundary).map((v) => Number(v.toFixed(5)))
writeJson(paths.extent, {
  name: 'Zibatá',
  areaBbox: bbox,
  bbox: boundaryBbox,
  center: roundPositions(boundaryCenter, 5),
  boundary: boundary.geometry,
})

const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
const bytes = (file: string) => readFileSync(file).byteLength
const count = (name: string) =>
  Math.max(
    0,
    ...layers.filter((layer) => layer.name === name).map((layer) => layer.features.length),
  )

// La sección de realismo la escribe map:build:realismo; regenerar el mapa no debe borrarla.
const realismoManifest = existsSync(paths.manifest)
  ? readJson<{ realismo?: unknown }>(paths.manifest).realismo
  : undefined

writeJson(paths.manifest, {
  $comment: 'Generado por scripts/map/build-map.ts. No editar a mano.',
  crs: 'Datos en EPSG:4326 (WGS84); teselas vectoriales en EPSG:3857 (Web Mercator)',
  area: config.area,
  sources: [
    {
      id: 'osm',
      name: 'OpenStreetMap',
      layers: ['boundary', 'roads', 'landuse', 'water', 'waterway', 'labels'],
      license: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/copyright',
      method: 'Overpass API (scripts/map/fetch-osm.ts)',
      extractedAt: osmMeta.fetchedAt,
      dataTimestamp: osmMeta.osmBaseTimestamp,
    },
    {
      id: 'overture-buildings',
      name: 'Overture Maps Foundation: buildings',
      layers: ['buildings', 'plaza-buildings'],
      license: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors, Overture Maps Foundation',
      url: 'https://docs.overturemaps.org/attribution/',
      method: `GeoParquet ${buildingsMeta.release} vía DuckDB (scripts/map/fetch-overture.ts)`,
      upstream: buildingsMeta.upstream,
      extractedAt: buildingsMeta.fetchedAt,
    },
    ...(treeCover
      ? [
          {
            id: 'overture-tree-cover',
            name: 'Overture Maps Foundation: land_cover (forest), derivado de ESA WorldCover 10 m',
            layers: ['trees'],
            license: 'CC-BY-4.0',
            attribution: '© ESA WorldCover, Overture Maps Foundation',
            url: 'https://docs.overturemaps.org/attribution/',
            method: 'GeoParquet vía DuckDB (scripts/map/fetch-landcover.ts)',
            extractedAt: readJson<{ fetchedAt: string }>(paths.rawTreeCoverMeta).fetchedAt,
          },
        ]
      : []),
    {
      id: 'plazas',
      name: 'Geometría de plazas (data/commercial/plazas.json)',
      layers: ['plaza-buildings'],
      method:
        'Ubicación a partir de POIs abiertos y referencias públicas; geometría con npm run map:suggest-plaza. Ver locationSource de cada plaza.',
    },
  ],
  processing: [
    'Conversión Overpass → GeoJSON con ensamblado de multipolígonos',
    'Clasificación de vialidades, usos de suelo, agua y etiquetas (scripts/map/lib/classify.ts)',
    'Recorte al área configurada (config.json → area.bbox)',
    'Contorno de Zibatá: envolvente cóncava (maxEdge 350 m) de la red vial dentro del polígono semilla + margen de 70 m, simplificada',
    config.boundaryExtensions.length > 0
      ? `Contorno ampliado con suelo planeado sin calles: ${config.boundaryExtensions.map((extension) => `${extension.name} (${extension.source})`).join('; ')}`
      : 'Sin ampliaciones de contorno configuradas (config.json → boundaryExtensions)',
    'Edificios: descarte de huellas < minAreaM2; alturas medidas, por niveles o estimadas por tipo y superficie (en esta extracción de Overture ninguna huella trae altura medida: todas son estimadas, con variación determinista por id)',
    `Edificios en z${buildingsMinZoom}: solo huellas ≥ ${buildingsLowZoomMinAreaM2} m² (peso de la vista inicial en móvil)`,
    `Etiquetas: se omiten las que quedan a menos de ${LABEL_CLEARANCE_M} m de una plaza activa (irían bajo su marcador)`,
    'Asociación edificio → plaza por centroide dentro de la geometría de la plaza; volumen generado si faltan huellas',
    `Árboles y arbustos: retícula de ~${config.trees.spacingM} m (cobertura arbórea ESA WorldCover 10 m, a ≤ ${TREE_MARGIN_M} m del contorno), ~${config.trees.greenSpacingM} m (árboles de áreas verdes de OSM) y ~${config.trees.shrubSpacingM} m (arbustos de esas mismas áreas), con desplazamiento determinista, sin invadir vías (despeje por clase) ni edificios. Cada árbol es tronco + dos pisos de copa; cada arbusto, un volumen bajo. La especie es una mezcla orientativa por zona; la posición de cada planta es aproximada y la del arbolado, real`,
    `Teselado MVT z${minZoom}–z${maxZoom} (geojson-vt, extent 4096, tolerancia 3) + gzip, empaquetado PMTiles v3`,
  ],
  outputs: {
    'public/map/zibata.pmtiles': {
      bytes: archive.byteLength,
      sha256: sha256(paths.pmtiles),
      tiles: tiles.length,
      bytesByZoom,
      largestTile,
      features: {
        roads: count('roads'),
        landuse: count('landuse'),
        water: count('water'),
        waterway: count('waterway'),
        buildings: count('buildings'),
        labels: count('labels'),
        trees: count('trees'),
        shrubs: count('shrubs'),
      },
    },
    'public/map/plaza-buildings.geojson': {
      bytes: bytes(paths.plazaBuildings),
      sha256: sha256(paths.plazaBuildings),
      features: plazaBuildingCount,
      synthesizedFor: synthesized,
      synthesisDetail,
    },
    'data/geographic/extent.json': {
      bbox: boundaryBbox,
      areaKm2: Number((turf.area(boundary) / 1e6).toFixed(2)),
    },
  },
  ...(realismoManifest ? { realismo: realismoManifest } : {}),
})
log('✓ Mapa generado')
