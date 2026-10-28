import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { paths } from '../lib/paths.ts'

interface Celda {
  i: number
  j: number
  start: number
  count: number
}

/** Lee la cabecera de un .bin: uint32 LE con el largo del JSON, el JSON y relleno a 4 bytes. */
function leer(archivo: string): {
  cabecera: Record<string, unknown> & { celdas: Celda[] }
  resto: number
} {
  const buffer = readFileSync(`${paths.realismoDir}/${archivo}`)
  const largo = buffer.readUInt32LE(0)
  const cabecera = JSON.parse(buffer.subarray(4, 4 + largo).toString('utf8'))
  const inicio = 4 + largo + ((4 - ((4 + largo) % 4)) % 4)
  return { cabecera, resto: buffer.byteLength - inicio }
}

describe('mallas 3D de realismo', () => {
  it('edificios.bin: 20 bytes por vértice, celdas contiguas que cubren todo', () => {
    const { cabecera, resto } = leer('edificios.bin')
    const vertices = cabecera.vertices as number
    // posición (3 float) + normal y paleta (4 bytes con signo) + color y oclusión (4 bytes)
    expect(resto).toBe(vertices * (12 + 4 + 4))
    expect(vertices % 3).toBe(0)
    let siguiente = 0
    for (const celda of cabecera.celdas) {
      expect(celda.start).toBe(siguiente)
      expect(celda.count % 3).toBe(0)
      siguiente += celda.count
    }
    expect(siguiente).toBe(vertices)
    expect(cabecera.celda).toBe(250)
  })

  it('arboles.bin: ocho float por árbol, celdas contiguas que cubren todo', () => {
    const { cabecera, resto } = leer('arboles.bin')
    const instancias = cabecera.instancias as number
    expect(resto).toBe(instancias * 8 * 4)
    let siguiente = 0
    for (const celda of cabecera.celdas) {
      expect(celda.start).toBe(siguiente)
      siguiente += celda.count
    }
    expect(siguiente).toBe(instancias)
  })

  it('las dos mallas comparten el origen, que el cliente lee de la cabecera', () => {
    expect(leer('edificios.bin').cabecera.lng0).toBe(leer('arboles.bin').cabecera.lng0)
    expect(leer('edificios.bin').cabecera.lat0).toBe(leer('arboles.bin').cabecera.lat0)
  })
})
