// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { realismoPedido } from './modo.ts'

describe('realismoPedido', () => {
  it('?realismo=no lo apaga y ?realismo=si lo fuerza', () => {
    expect(realismoPedido('?realismo=no')).toBe(false)
    expect(realismoPedido('?realismo=si')).toBe(true)
  })

  it('sin parámetro va encendido cuando no se detecta renderizado por software', () => {
    // jsdom no tiene WebGL: no se puede saber, y se supone que el equipo aguanta.
    expect(realismoPedido('')).toBe(true)
    expect(realismoPedido('?otro=1')).toBe(true)
  })
})
