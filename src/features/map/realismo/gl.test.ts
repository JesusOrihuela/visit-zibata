import { describe, expect, it } from 'vitest'
import { matrixFor, readBin, visibleRanges } from './gl.ts'

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

describe('readBin', () => {
  it('lee la cabecera JSON y dice dónde empiezan los buffers, alineados a 4 bytes', () => {
    const header = JSON.stringify({ lng0: -100.3, lat0: 20.6, celda: 250, celdas: [] })
    const bytes = new TextEncoder().encode(header)
    const padding = (4 - ((4 + bytes.length) % 4)) % 4
    const buffer = new ArrayBuffer(4 + bytes.length + padding + 8)
    new DataView(buffer).setUint32(0, bytes.length, true)
    new Uint8Array(buffer).set(bytes, 4)
    const { header: parsed, offset } = readBin(buffer)
    expect(parsed.lng0).toBe(-100.3)
    expect(offset % 4).toBe(0)
    expect(offset).toBe(4 + bytes.length + padding)
  })
})

describe('matrixFor', () => {
  it('lleva el origen de las mallas al punto de Mercator de ese origen', () => {
    const matrix = matrixFor({ modelViewProjectionMatrix: IDENTITY }, { lng0: 0, lat0: 0 })
    // Con proyección identidad, el origen (0, 0, 0) cae en el centro de Mercator: (0,5; 0,5).
    expect(matrix[12]).toBeCloseTo(0.5, 6)
    expect(matrix[13]).toBeCloseTo(0.5, 6)
    expect(matrix[15]).toBe(1)
  })

  it('prefiere la matriz principal de MapLibre 6 sobre la antigua', () => {
    const principal = [...IDENTITY]
    principal[12] = 10
    const matrix = matrixFor(
      { defaultProjectionData: { mainMatrix: principal }, modelViewProjectionMatrix: IDENTITY },
      { lng0: 0, lat0: 0 },
    )
    expect(matrix[12]).toBeCloseTo(10.5, 6)
  })

  it('falla con un mensaje claro si MapLibre no entrega ninguna matriz', () => {
    expect(() => matrixFor({}, { lng0: 0, lat0: 0 })).toThrow(/matriz/)
  })
})

describe('visibleRanges', () => {
  // Proyección identidad: la vista es el cubo [-1, 1] en x, y, z.
  const cells = [
    { i: 0, j: 0, start: 0, count: 6 },
    { i: 1, j: 0, start: 6, count: 3 },
    { i: 100, j: 0, start: 9, count: 3 },
  ]

  it('descarta las celdas fuera de la vista y junta las contiguas en un solo rango', () => {
    // Celdas de 0,5 unidades: las dos primeras caben en el cubo, la tercera queda muy fuera.
    expect(visibleRanges(IDENTITY, cells, 0.5, 0.5)).toEqual([{ from: 0, to: 9 }])
  })

  it('el margen incluye celdas cercanas pero fuera de la vista (sombras largas)', () => {
    const lejos = [{ i: 6, j: 0, start: 0, count: 3 }]
    expect(visibleRanges(IDENTITY, lejos, 0.5, 0.5)).toEqual([])
    expect(visibleRanges(IDENTITY, lejos, 0.5, 0.5, 3)).toEqual([{ from: 0, to: 3 }])
  })

  it('aplica el filtro de cada celda', () => {
    expect(visibleRanges(IDENTITY, cells, 0.5, 0.5, 0, (c) => c.i === 1)).toEqual([
      { from: 6, to: 9 },
    ])
  })

  it('conserva la celda cuya esquina queda detrás de la cámara (prueba conservadora)', () => {
    const detras = [...IDENTITY]
    detras[15] = -1
    expect(visibleRanges(detras, [cells[0] as (typeof cells)[number]], 0.5, 0.5)).toEqual([
      { from: 0, to: 6 },
    ])
  })
})
