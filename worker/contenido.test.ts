import { describe, expect, it } from 'vitest'
import categoriasJson from '../data/commercial/categories.json' with { type: 'json' }
import lugaresJson from '../data/commercial/places.json' with { type: 'json' }
import plazasJson from '../data/commercial/plazas.json' with { type: 'json' }
import type { CommercialDataset } from '../src/data/relations.ts'
import { CategoriesFileSchema, PlacesFileSchema, PlazasFileSchema } from '../src/data/schemas.ts'
import type { Place, Plaza } from '../src/types/domain.ts'
import { prepararNegocio } from './contenido.ts'

const categorias = CategoriesFileSchema.parse(categoriasJson)
const plazas = PlazasFileSchema.parse(plazasJson)
const lugares = PlacesFileSchema.parse(lugaresJson)
const dataset: CommercialDataset = {
  categories: categorias.categories,
  plazas: plazas.plazas,
  places: lugares.places,
}
const crudo = {
  categories: categoriasJson as unknown as Record<string, unknown>,
  plazas: plazasJson as unknown as Record<string, unknown>,
  places: lugaresJson as unknown as Record<string, unknown>,
}

const HOY = '2026-10-30'
const existente = dataset.places.find((fila) => fila.active && fila.description?.en) as Place
const plaza = dataset.plazas.find((fila) => fila.id === existente.plazaId) as Plaza
const giro = dataset.categories[0]?.giros[0]?.id ?? ''

const nuevo = (extra: Record<string, unknown> = {}) => ({
  nombre: `Local de prueba ${Date.now()}`,
  plazaId: plaza.id,
  giros: [giro],
  descripcionEs: 'Un local de prueba.',
  descripcionEn: 'A test place.',
  activo: true,
  ...extra,
})

describe('preparar un negocio nuevo', () => {
  it('lo acepta, deriva el id del nombre y lo añade a su plaza', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ nombre: 'Panadería La Esquina' }),
      HOY,
    )
    expect(preparado.ok).toBe(true)
    if (!preparado.ok) return
    expect(preparado.nuevo).toBe(true)
    expect(preparado.place.id).toBe('panaderia-la-esquina')
    expect(preparado.place.slug).toBe('panaderia-la-esquina')

    const plazasNuevas = preparado.plazas.plazas as Plaza[]
    const tocada = plazasNuevas.find((fila) => fila.id === plaza.id)
    expect(tocada?.placeIds).toContain('panaderia-la-esquina')
  })

  it('si el nombre choca, añade un número en vez de pisar el existente', () => {
    const preparado = prepararNegocio(dataset, crudo, nuevo({ nombre: "Carl's Jr." }), HOY)
    expect(preparado.ok).toBe(true)
    if (!preparado.ok) return
    expect(preparado.place.id).toBe('carls-jr-2')
  })

  it('marca la verificación de hoy con la fuente del panel', () => {
    const preparado = prepararNegocio(dataset, crudo, nuevo(), HOY)
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.verification?.lastVerifiedAt).toBe(HOY)
    expect(preparado.place.verification?.sources).toContain(`campo:${HOY}`)
    expect(preparado.place.verification?.status).toBe('active')
  })

  it('recalcula las categorías de la plaza con el giro nuevo', () => {
    const sinCategoria = dataset.categories.find(
      (categoria) => categoria.giros.length > 0 && !plaza.categories.includes(categoria.id),
    )
    if (!sinCategoria) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ giros: [sinCategoria.giros[0]?.id] }),
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    const tocada = (preparado.plazas.plazas as Plaza[]).find((fila) => fila.id === plaza.id)
    expect(tocada?.categories).toContain(sinCategoria.id)
  })

  it('el archivo conserva los demás locales y solo cambia el que se tocó', () => {
    const preparado = prepararNegocio(dataset, crudo, nuevo(), HOY)
    if (!preparado.ok) throw new Error('no preparó')
    const filas = preparado.lugares.places as Record<string, unknown>[]
    expect(filas).toHaveLength(dataset.places.length + 1)
    expect(filas[0]?.id).toBe(dataset.places[0]?.id)
    expect(preparado.lugares.updatedAt).toBe(HOY)
  })
})

describe('editar un negocio existente', () => {
  it('conserva id y slug aunque cambie el nombre', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      {
        id: existente.id,
        nombre: `${existente.name} renovado`,
        plazaId: existente.plazaId,
        giros: existente.giros,
        descripcionEs: existente.description?.es ?? 'Texto',
        descripcionEn: existente.description?.en ?? 'Text',
        activo: true,
      },
      HOY,
    )
    expect(preparado.ok).toBe(true)
    if (!preparado.ok) return
    expect(preparado.place.id).toBe(existente.id)
    expect(preparado.place.slug).toBe(existente.slug)
    expect(preparado.place.name).toBe(`${existente.name} renovado`)
  })

  it('conserva las fotos y el resto de enlaces que el formulario no toca', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      {
        id: existente.id,
        nombre: existente.name,
        plazaId: existente.plazaId,
        giros: existente.giros,
        descripcionEs: existente.description?.es ?? 'Texto',
        descripcionEn: existente.description?.en ?? 'Text',
        activo: true,
      },
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.photos).toEqual(existente.photos)
    expect(preparado.place.links.rappi).toBe(existente.links.rappi)
  })

  it('al moverlo de plaza, sale de una y entra en la otra', () => {
    const otra = dataset.plazas.find((fila) => fila.active && fila.id !== existente.plazaId)
    if (!otra) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      {
        id: existente.id,
        nombre: existente.name,
        plazaId: otra.id,
        giros: existente.giros,
        descripcionEs: existente.description?.es ?? 'Texto',
        descripcionEn: existente.description?.en ?? 'Text',
        activo: true,
      },
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    const plazasNuevas = preparado.plazas.plazas as Plaza[]
    expect(plazasNuevas.find((fila) => fila.id === existente.plazaId)?.placeIds).not.toContain(
      existente.id,
    )
    expect(plazasNuevas.find((fila) => fila.id === otra.id)?.placeIds).toContain(existente.id)
  })
})

describe('lo que se rechaza', () => {
  it('un giro que no existe', () => {
    const resultado = prepararNegocio(dataset, crudo, nuevo({ giros: ['no-existe'] }), HOY)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.problemas.join(' ')).toContain('no existe')
  })

  it('sin descripción en inglés, que el build exige', () => {
    const resultado = prepararNegocio(dataset, crudo, nuevo({ descripcionEn: '' }), HOY)
    expect(resultado.ok).toBe(false)
  })

  it('con una sola de las dos coordenadas', () => {
    const resultado = prepararNegocio(dataset, crudo, nuevo({ lat: 20.68 }), HOY)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.problemas).toContain('Indica las dos coordenadas o ninguna')
  })

  it('una plaza que no existe', () => {
    const resultado = prepararNegocio(dataset, crudo, nuevo({ plazaId: 'no-existe' }), HOY)
    expect(resultado.ok).toBe(false)
  })

  it('editar un id que ya no está', () => {
    const resultado = prepararNegocio(dataset, crudo, nuevo({ id: 'no-existe' }), HOY)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.problemas).toContain('Ese negocio ya no existe')
  })
})
