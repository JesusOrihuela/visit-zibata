import { describe, expect, it } from 'vitest'
import { hasCategoryIcon } from '../components/icons/CategoryIcon.tsx'
import { ICONOS } from './iconos.ts'

describe('los nombres de icono', () => {
  it('todos tienen dibujo en el componente', () => {
    for (const nombre of ICONOS) expect(hasCategoryIcon(nombre), nombre).toBe(true)
  })

  it('no hay nombres repetidos', () => {
    expect(new Set(ICONOS).size).toBe(ICONOS.length)
  })
})
