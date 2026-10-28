// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { realismoActivo } from './modo.ts'

const conexion = (valor: unknown) =>
  Object.defineProperty(navigator, 'connection', { value: valor, configurable: true })

afterEach(() => {
  Reflect.deleteProperty(navigator, 'connection')
})

describe('realismoActivo', () => {
  it('va encendido cuando no se detecta renderizado por software ni ahorro de datos', () => {
    // jsdom no tiene WebGL: no se puede saber, y se supone que el equipo aguanta.
    expect(realismoActivo()).toBe(true)
  })

  it('con Save-Data queda apagado', () => {
    conexion({ saveData: true })
    expect(realismoActivo()).toBe(false)
  })

  it('con Save-Data apagado sigue encendido', () => {
    conexion({ saveData: false })
    expect(realismoActivo()).toBe(true)
  })
})
