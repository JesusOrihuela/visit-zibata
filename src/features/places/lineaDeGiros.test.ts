import { describe, expect, it } from 'vitest'
import { caracteresQueCaben } from './lineaDeGiros.ts'

describe('caracteresQueCaben', () => {
  it('crece con el ancho: en una hoja ancha entran todas las etiquetas', () => {
    // La fila de un teléfono ronda los 250 px; la de una tableta pasa de 500.
    expect(caracteresQueCaben(250, 2)).toBeGreaterThanOrEqual(25)
    expect(caracteresQueCaben(700, 2)).toBeGreaterThan(100)
  })

  it('descuenta los iconos y, si se pide, el hueco del contador', () => {
    expect(caracteresQueCaben(300, 3)).toBeLessThan(caracteresQueCaben(300, 1))
    expect(caracteresQueCaben(300, 1, true)).toBeLessThan(caracteresQueCaben(300, 1))
  })

  it('nunca baja del mínimo, ni con un ancho de cero', () => {
    expect(caracteresQueCaben(0, 3)).toBe(12)
    expect(caracteresQueCaben(-40, 0, true)).toBe(12)
  })
})
