import { describe, expect, it } from 'vitest'
import categoriasJson from '../data/commercial/categories.json' with { type: 'json' }
import lugaresJson from '../data/commercial/places.json' with { type: 'json' }
import plazasJson from '../data/commercial/plazas.json' with { type: 'json' }
import { ICONOS } from '../src/data/iconos.ts'
import type { CommercialDataset } from '../src/data/relations.ts'
import { CategoriesFileSchema, PlacesFileSchema, PlazasFileSchema } from '../src/data/schemas.ts'
import type { Category } from '../src/types/domain.ts'
import { prepararCategorias } from './categorias.ts'

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

const HOY = '2026-10-31'

type Entrada = {
  categories: {
    id?: string
    label: { es: string; en: string }
    icon: string
    hue: number | null
    order: number
    synonyms: string[]
    giros: {
      id?: string
      label: { es: string; en: string }
      icon: string
      synonyms: string[]
      general?: boolean
    }[]
  }[]
}

const entrada = (): Entrada => ({
  categories: dataset.categories.map((categoria) => ({
    id: categoria.id,
    label: { ...categoria.label, en: categoria.label.en ?? '' },
    icon: categoria.icon,
    hue: categoria.hue ?? null,
    order: categoria.order,
    synonyms: [...categoria.synonyms],
    giros: categoria.giros.map((giro) => ({
      id: giro.id,
      label: { ...giro.label, en: giro.label.en ?? '' },
      icon: giro.icon,
      synonyms: [...giro.synonyms],
      ...(giro.general ? { general: true } : {}),
    })),
  })),
})

const clonar = (): Entrada => structuredClone(entrada())

const categoriaPorId = (lista: Category[], id: string): Category => {
  const encontrada = lista.find((categoria) => categoria.id === id)
  if (!encontrada) throw new Error(`falta ${id}`)
  return encontrada
}

const giroNoGeneral = dataset.categories
  .flatMap((categoria) => categoria.giros.map((giro) => ({ categoria, giro })))
  .find(({ giro }) => !giro.general) as { categoria: Category; giro: Category['giros'][number] }

const iconosDeGiros = new Set(
  dataset.categories.flatMap((categoria) =>
    categoria.giros.filter((giro) => !giro.general).map((giro) => giro.icon),
  ),
)
const iconoLibre = ICONOS.find((icono) => !iconosDeGiros.has(icono)) ?? ICONOS[0]

describe('editar una categoría', () => {
  it('cambia la etiqueta y conserva id y slug', () => {
    const cuerpo = clonar()
    const objetivo = cuerpo.categories.find(
      (categoria) => categoria.id === giroNoGeneral.categoria.id,
    )
    if (!objetivo) throw new Error('sin categoría')
    objetivo.label = { es: 'Categoría renombrada', en: 'Renamed category' }
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    expect(preparado.ok).toBe(true)
    if (!preparado.ok) return
    const cambiada = categoriaPorId(preparado.categorias, objetivo.id ?? '')
    expect(cambiada.label.es).toBe('Categoría renombrada')
    expect(cambiada.slug).toEqual(giroNoGeneral.categoria.slug)
  })

  it('cambia tono y orden', () => {
    const cuerpo = clonar()
    const objetivo = cuerpo.categories.find(
      (categoria) => categoria.id === giroNoGeneral.categoria.id,
    )
    if (!objetivo) throw new Error('sin categoría')
    objetivo.hue = 200
    objetivo.order = 99
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    if (!preparado.ok) throw new Error('no preparó')
    const cambiada = categoriaPorId(preparado.categorias, objetivo.id ?? '')
    expect(cambiada.hue).toBe(200)
    expect(cambiada.order).toBe(99)
  })

  it('el giro general sigue el icono de la categoría', () => {
    const conGeneral = dataset.categories.find(
      (categoria) =>
        categoria.giros.some((giro) => giro.general) &&
        categoria.giros.some((giro) => !giro.general),
    )
    if (!conGeneral) throw new Error('sin categoría con general')
    const cuerpo = clonar()
    const objetivo = cuerpo.categories.find((categoria) => categoria.id === conGeneral.id)
    if (!objetivo) throw new Error('sin categoría')
    objetivo.icon = iconoLibre
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    if (!preparado.ok) throw new Error('no preparó')
    const cambiada = categoriaPorId(preparado.categorias, objetivo.id ?? '')
    const general = cambiada.giros.find((giro) => giro.general)
    expect(general?.icon).toBe(iconoLibre)
  })
})

describe('añadir y mover giros', () => {
  it('añade un giro con un icono libre', () => {
    const cuerpo = clonar()
    const objetivo = cuerpo.categories.find(
      (categoria) => categoria.id === giroNoGeneral.categoria.id,
    )
    if (!objetivo) throw new Error('sin categoría')
    objetivo.giros.push({
      label: { es: 'Giro de prueba', en: 'Test giro' },
      icon: iconoLibre,
      synonyms: ['prueba'],
    })
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    if (!preparado.ok) throw new Error('no preparó')
    const cambiada = categoriaPorId(preparado.categorias, objetivo.id ?? '')
    expect(cambiada.giros.find((giro) => giro.id === 'giro-de-prueba')?.label.es).toBe(
      'Giro de prueba',
    )
  })

  it('rechaza un icono que ya usa otro giro', () => {
    const cuerpo = clonar()
    const objetivo = cuerpo.categories.find(
      (categoria) => categoria.id === giroNoGeneral.categoria.id,
    )
    if (!objetivo) throw new Error('sin categoría')
    objetivo.giros.push({
      label: { es: 'Giro repetido', en: 'Repeated giro' },
      icon: giroNoGeneral.giro.icon,
      synonyms: [],
    })
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('ya lo usa')
  })

  it('mueve un giro no general y la categoría del giro cambia para todos sus locales', () => {
    const destino = dataset.categories.find(
      (categoria) => categoria.id !== giroNoGeneral.categoria.id,
    )
    if (!destino) throw new Error('sin destino')
    const cuerpo = clonar()
    const origen = cuerpo.categories.find(
      (categoria) => categoria.id === giroNoGeneral.categoria.id,
    )
    const llegada = cuerpo.categories.find((categoria) => categoria.id === destino.id)
    if (!origen || !llegada) throw new Error('sin categorías')
    const movido = origen.giros.find((giro) => giro.id === giroNoGeneral.giro.id)
    if (!movido) throw new Error('sin giro')
    origen.giros = origen.giros.filter((giro) => giro.id !== movido.id)
    llegada.giros.push(movido)

    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    if (!preparado.ok) throw new Error('no preparó')
    expect(categoriaPorId(preparado.categorias, origen.id ?? '').giros).not.toContainEqual(
      expect.objectContaining({ id: movido.id }),
    )
    expect(categoriaPorId(preparado.categorias, llegada.id ?? '').giros).toContainEqual(
      expect.objectContaining({ id: movido.id }),
    )

    const locales = dataset.places.filter((place) =>
      [...place.giros, ...place.secundarios].includes(giroNoGeneral.giro.id),
    )
    expect(preparado.afectados.locales).toBe(locales.length)
    expect(preparado.afectados.plazas).toBe(new Set(locales.map((place) => place.plazaId)).size)
  })

  it('no deja mover el giro general', () => {
    const general = dataset.categories
      .flatMap((categoria) => categoria.giros.map((giro) => ({ categoria, giro })))
      .find(({ giro }) => giro.general)
    if (!general) throw new Error('sin general')
    const destino = dataset.categories.find((categoria) => categoria.id !== general.categoria.id)
    if (!destino) throw new Error('sin destino')
    const cuerpo = clonar()
    const origen = cuerpo.categories.find((categoria) => categoria.id === general.categoria.id)
    const llegada = cuerpo.categories.find((categoria) => categoria.id === destino.id)
    if (!origen || !llegada) throw new Error('sin categorías')
    const movido = origen.giros.find((giro) => giro.id === general.giro.id)
    if (!movido) throw new Error('sin giro')
    origen.giros = origen.giros.filter((giro) => giro.id !== movido.id)
    llegada.giros.push(movido)
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('no se puede mover')
  })
})

describe('lo que no se puede hacer', () => {
  it('quitar un giro', () => {
    const cuerpo = clonar()
    const objetivo = cuerpo.categories.find(
      (categoria) => categoria.id === giroNoGeneral.categoria.id,
    )
    if (!objetivo) throw new Error('sin categoría')
    objetivo.giros = objetivo.giros.filter((giro) => giro.id !== giroNoGeneral.giro.id)
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('No se pueden quitar giros')
  })

  it('quitar una categoría', () => {
    const cuerpo = clonar()
    const objetivo = cuerpo.categories.find(
      (categoria) => categoria.id === giroNoGeneral.categoria.id,
    )
    if (!objetivo) throw new Error('sin categoría')
    cuerpo.categories = cuerpo.categories.filter((categoria) => categoria.id !== objetivo.id)
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('No se pueden quitar categorías')
  })

  it('una categoría sin tono', () => {
    const cuerpo = clonar()
    const objetivo = cuerpo.categories.find(
      (categoria) => categoria.id !== 'otros' && categoria.id === giroNoGeneral.categoria.id,
    )
    if (!objetivo) throw new Error('sin categoría')
    objetivo.hue = null
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('necesita un tono')
  })

  it('un icono que no existe', () => {
    const cuerpo = clonar()
    const objetivo = cuerpo.categories.find(
      (categoria) => categoria.id === giroNoGeneral.categoria.id,
    )
    if (!objetivo) throw new Error('sin categoría')
    const giro = objetivo.giros.find((fila) => fila.id === giroNoGeneral.giro.id)
    if (!giro) throw new Error('sin giro')
    giro.icon = 'no-existe'
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('no existe')
  })
})

describe('una categoría nueva', () => {
  it('deriva id, slugs y deja el primer giro como general', () => {
    const cuerpo = clonar()
    cuerpo.categories.push({
      label: { es: 'Gimnasios', en: 'Gyms' },
      icon: iconoLibre,
      hue: 200,
      order: 999,
      synonyms: ['gimnasio', 'gym'],
      giros: [
        {
          label: { es: 'Gimnasio', en: 'Gym' },
          icon: iconoLibre,
          synonyms: ['pesas'],
          general: true,
        },
      ],
    })
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    if (!preparado.ok) throw new Error(preparado.problemas.join(' '))
    const nueva = categoriaPorId(preparado.categorias, 'gimnasios')
    expect(nueva.slug).toEqual({ es: 'gimnasios', en: 'gyms' })
    expect(nueva.giros[0]?.general).toBe(true)
    expect(nueva.giros[0]?.icon).toBe(iconoLibre)
  })
})

describe('el impacto', () => {
  it('sin cambios no afecta a ningún local', () => {
    const preparado = prepararCategorias(dataset, crudo, entrada(), HOY)
    if (!preparado.ok) throw new Error(preparado.problemas.join(' '))
    expect(preparado.afectados).toEqual({ locales: 0, plazas: 0 })
  })

  it('cambiar la etiqueta de una categoría cuenta los locales de sus giros', () => {
    const cuerpo = clonar()
    const objetivo = cuerpo.categories.find(
      (categoria) => categoria.id === giroNoGeneral.categoria.id,
    )
    if (!objetivo) throw new Error('sin categoría')
    objetivo.label = { es: 'Otro nombre', en: 'Other name' }
    const preparado = prepararCategorias(dataset, crudo, cuerpo, HOY)
    if (!preparado.ok) throw new Error('no preparó')
    const giros = new Set(giroNoGeneral.categoria.giros.map((giro) => giro.id))
    const locales = dataset.places.filter((place) =>
      [...place.giros, ...place.secundarios].some((giro) => giros.has(giro)),
    )
    expect(preparado.afectados.locales).toBe(locales.length)
  })
})
