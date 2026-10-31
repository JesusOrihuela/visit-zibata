import * as turf from '@turf/turf'
import { describe, expect, it } from 'vitest'
import { MEZCLA_ARBUSTO, medianAreas, placeTrees } from './trees.ts'

// Un cuadrado de ~110 × 110 m de arbolado, cruzado por una calle y con una casa dentro.
const area = turf.polygon([
  [
    [-100.33, 20.68],
    [-100.329, 20.68],
    [-100.329, 20.681],
    [-100.33, 20.681],
    [-100.33, 20.68],
  ],
])
const road = turf.lineString(
  [
    [-100.331, 20.6805],
    [-100.328, 20.6805],
  ],
  { class: 'street' },
)
const house = turf.polygon([
  [
    [-100.3298, 20.6801],
    [-100.3294, 20.6801],
    [-100.3294, 20.6803],
    [-100.3298, 20.6803],
    [-100.3298, 20.6801],
  ],
])
const options = {
  spacingM: 12,
  roadClearanceM: { street: 7, service: 5, path: 3 },
}
const obstacles = { roads: [road], buildings: [house] }
const crowns = (list: ReturnType<typeof placeTrees>) =>
  list.filter((tree) => tree.properties.part === 'crown')

describe('placeTrees', () => {
  const trees = placeTrees([area], obstacles, options)

  it('solo pone árboles donde hay arbolado, con tronco y copa', () => {
    expect(crowns(trees).length).toBeGreaterThan(20)
    // Un árbol son tres volúmenes: tronco, copa baja y copa alta.
    expect(trees.length).toBe(crowns(trees).length * 3)
    for (const tree of crowns(trees))
      expect(turf.booleanPointInPolygon(turf.centroid(tree), area)).toBe(true)
    expect(placeTrees([], obstacles, options)).toEqual([])
  })

  it('la copa entera se mantiene fuera de la calle y de la casa', () => {
    for (const tree of crowns(trees)) {
      const center = turf.centroid(tree)
      const radius = turf.length(turf.polygonToLine(tree), { units: 'meters' }) / 6
      expect(
        turf.pointToLineDistance(center, road, { units: 'meters' }),
        'la copa invade la calle',
      ).toBeGreaterThan(options.roadClearanceM.street)
      expect(
        turf.pointToPolygonDistance(center, house, { units: 'meters' }),
        'la copa se monta en la casa',
      ).toBeGreaterThan(radius)
    }
  })

  it('el tronco queda debajo de la copa y la copa empieza donde acaba el tronco', () => {
    for (const tree of crowns(trees)) {
      expect(tree.properties.height).toBeGreaterThan(tree.properties.base)
      expect(tree.properties.base).toBeGreaterThanOrEqual(1)
    }
    for (const trunk of trees.filter((tree) => tree.properties.part === 'trunk')) {
      expect(trunk.properties.base).toBe(0)
      expect(trunk.properties.height).toBeGreaterThan(0.5)
    }
  })

  it('reparte especies de la zona, no un árbol genérico', () => {
    const especies = new Set(crowns(trees).map((tree) => tree.properties.species))
    expect(especies.size).toBeGreaterThan(2)
    expect([...especies]).not.toContain(undefined)
  })

  it('el arbusto es un solo volumen bajo, sin tronco ni copa', () => {
    const arbustos = placeTrees([area], obstacles, {
      ...options,
      spacingM: 9,
      forma: 'arbusto',
      especies: MEZCLA_ARBUSTO,
    })
    expect(arbustos.length).toBeGreaterThan(10)
    for (const arbusto of arbustos) {
      expect(arbusto.properties.part).toBe('shrub')
      expect(arbusto.properties.base).toBe(0)
      expect(arbusto.properties.height).toBeLessThanOrEqual(2)
    }
  })

  it('es determinista: el mismo dato da el mismo mapa en cada build', () => {
    expect(placeTrees([area], obstacles, options)).toEqual(trees)
  })
})

describe('medianAreas', () => {
  const ida = turf.lineString(
    [
      [-100.331, 20.68],
      [-100.328, 20.68],
    ],
    { name: 'Avenida Paseo de las Pitahayas', oneway: true },
  )
  const vuelta = turf.lineString(
    [
      [-100.328, 20.68018],
      [-100.331, 20.68018],
    ],
    { name: 'Avenida Paseo de las Pitahayas', oneway: true },
  )

  it('encuentra el camellón entre dos calzadas opuestas', () => {
    const areas = medianAreas([ida, vuelta], 3.5)
    expect(areas).toHaveLength(1)
    expect(turf.area(areas[0] as never)).toBeGreaterThan(100)
  })

  it('no inventa camellón con una sola calzada ni con dos en el mismo sentido', () => {
    expect(medianAreas([ida], 3.5)).toEqual([])
    const mismo = turf.lineString(
      [
        [-100.331, 20.68018],
        [-100.328, 20.68018],
      ],
      { name: 'Avenida Paseo de las Pitahayas', oneway: true },
    )
    expect(medianAreas([ida, mismo], 3.5)).toEqual([])
  })
})

describe('excluir', () => {
  it('no planta dentro de un área excluida', () => {
    const excluida = turf.polygon([
      [
        [-100.3297, 20.6803],
        [-100.3293, 20.6803],
        [-100.3293, 20.6807],
        [-100.3297, 20.6807],
        [-100.3297, 20.6803],
      ],
    ])
    const sin = placeTrees([area], obstacles, { ...options, excluir: [excluida] })
    for (const crown of sin.filter((tree) => tree.properties.part === 'crown')) {
      expect(turf.booleanPointInPolygon(turf.centroid(crown), excluida)).toBe(false)
    }
  })
})
