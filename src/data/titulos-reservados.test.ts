import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en.ts'
import { es } from '../i18n/es.ts'
import { TITULOS_RESERVADOS } from './titulos-reservados.ts'

const KEYS = [
  'about.title',
  'about.privacyTitle',
  'about.contribute',
  'about.tutorialTitle',
] as const

describe('los títulos reservados', () => {
  it('coinciden con las páginas fijas en los dos idiomas', () => {
    const esperados = [...KEYS.map((key) => es[key]), ...KEYS.map((key) => en[key])]
    expect([...TITULOS_RESERVADOS]).toEqual(esperados)
  })
})
