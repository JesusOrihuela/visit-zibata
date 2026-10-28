// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { ZIBATA_EXTENT } from '../../../config/map.ts'
import { buildMapStyle } from './buildMapStyle.ts'

const base = {
  tilesUrl: 'http://localhost/map/tiles.json',
  plazaBuildingsUrl: 'http://localhost/map/plaza-buildings.geojson',
  plazas: [],
  boundary: ZIBATA_EXTENT.boundary,
  areaBbox: ZIBATA_EXTENT.areaBbox,
  center: ZIBATA_EXTENT.center,
}
const realismo = { baseUrl: 'http://localhost/map/realismo/' }

const ids = (style: ReturnType<typeof buildMapStyle>) => style.layers.map((layer) => layer.id)

describe('estilo del mapa', () => {
  it('sin realismo no trae ninguna capa ni fuente de realismo', () => {
    const style = buildMapStyle(base)
    expect(ids(style).filter((id) => id.startsWith('realismo-'))).toEqual([])
    expect(Object.keys(style.sources).filter((id) => id.startsWith('realismo-'))).toEqual([])
    expect(ids(style)).toContain('outside-veil')
  })

  it('con realismo cada capa apunta a una fuente que existe y los ids no se repiten', () => {
    const style = buildMapStyle({ ...base, realismo })
    const layerIds = ids(style)
    expect(new Set(layerIds).size).toBe(layerIds.length)
    for (const layer of style.layers) {
      if ('source' in layer && layer.source) expect(style.sources).toHaveProperty(layer.source)
    }
  })

  it('pone el relieve sobre el suelo y bajo los usos de suelo, y el contexto sustituye al velo', () => {
    const layerIds = ids(buildMapStyle({ ...base, realismo }))
    const pos = (id: string) => layerIds.indexOf(id)
    expect(pos('zibata-ground')).toBeLessThan(pos('realismo-tinte'))
    expect(pos('realismo-tinte')).toBeLessThan(pos('realismo-relieve'))
    expect(pos('realismo-relieve')).toBeLessThan(pos('landuse-built'))
    expect(pos('landuse-built')).toBeLessThan(pos('realismo-suelo'))
    expect(pos('realismo-suelo')).toBeLessThan(pos('landuse-green'))
    expect(layerIds).not.toContain('outside-veil')
    expect(pos('road-street')).toBeLessThan(pos('realismo-contexto'))
    expect(pos('realismo-contexto')).toBeLessThan(pos('buildings'))
  })

  it('acredita el relieve y Sentinel-2 en la atribución de la fuente de relieve', () => {
    const style = buildMapStyle({ ...base, realismo })
    const relieve = style.sources['realismo-relieve']
    const attribution = relieve && 'attribution' in relieve ? relieve.attribution : ''
    expect(attribution).toContain('Copernicus DEM GLO-30')
    expect(attribution).toContain('Contains modified Copernicus Sentinel data')
  })
})
