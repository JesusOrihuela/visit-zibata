// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { classifyLabel, displayName } from './classify.ts'

describe('displayName', () => {
  it('pasa a capital inicial los nombres que OSM guarda en mayúsculas', () => {
    expect(displayName('PARQUE NANDÚ')).toBe('Parque Nandú')
    expect(displayName('CIRCUITO PASEO DE LAS PITAHAYAS')).toBe('Circuito Paseo de las Pitahayas')
  })

  it('deja igual un nombre que ya está bien escrito', () => {
    expect(displayName('El Jamadi')).toBe('El Jamadi')
    expect(displayName('Universidad Anáhuac Querétaro')).toBe('Universidad Anáhuac Querétaro')
  })

  it('unifica la caja aunque el nombre llegue mezclado', () => {
    expect(displayName('residencial altana')).toBe('Residencial Altana')
    expect(displayName('Residencial BIANCO')).toBe('Residencial Bianco')
    expect(displayName('AV. PASEO DE LAS PITAHAYAS')).toBe('Av. Paseo de las Pitahayas')
  })
})

describe('classifyLabel', () => {
  it('rotula vías, áreas verdes, agua, escuelas y residenciales', () => {
    expect(classifyLabel({ name: 'Circuito Ceiba', landuse: 'residential' })).toBe('district')
    expect(classifyLabel({ name: 'Zakía', place: 'neighbourhood' })).toBe('district')
    expect(classifyLabel({ name: 'Golf Zibatá', leisure: 'golf_course' })).toBe('golf')
    expect(classifyLabel({ name: 'Parque Jamadí', leisure: 'park' })).toBe('park')
    expect(classifyLabel({ name: 'Lago', natural: 'water' })).toBe('water')
    expect(classifyLabel({ name: 'Newland', amenity: 'school' })).toBe('education')
  })

  it('un edificio con nombre no se rotula', () => {
    expect(classifyLabel({ name: 'Edificio B', building: 'yes' })).toBeNull()
    expect(classifyLabel({ name: 'Discovery Center', building: 'commercial' })).toBeNull()
  })

  it('tampoco si OSM lo etiqueta como universidad, que es lo que pasaba con Edifico B', () => {
    expect(classifyLabel({ name: 'Edifico B', amenity: 'university' })).toBeNull()
    expect(classifyLabel({ name: 'Edificio B', amenity: 'university' })).toBeNull()
    expect(classifyLabel({ name: 'Universidad del Valle de México', amenity: 'university' })).toBe(
      'education',
    )
  })

  it('sin nombre no hay rótulo', () => {
    expect(classifyLabel({ landuse: 'residential' })).toBeNull()
  })
})
