import { describe, expect, it } from 'vitest'
import categories from '../../data/commercial/categories.json'
import places from '../../data/commercial/places.json'
import plazas from '../../data/commercial/plazas.json'
import extent from '../../data/geographic/extent.json'
import {
  categoriesFixture,
  makePlace,
  makePlaza,
  placesFixture,
  plazasFixture,
} from '../test/fixtures.ts'
import { buildCatalog } from './catalog.ts'
import {
  isInsidePlazaGeometry,
  syncPlazaDerivedFields,
  validateRelations,
  validateTranslations,
} from './relations.ts'
import {
  CategoriesFileSchema,
  HoursSchema,
  PlaceSchema,
  PlacesFileSchema,
  PlazasFileSchema,
} from './schemas.ts'

const bounds = { west: -100.37, south: 20.65, east: -100.29, north: 20.705 }
const errorsOf = (issues: ReturnType<typeof validateRelations>) =>
  issues.filter((issue) => issue.level === 'error').map((issue) => issue.message)

describe('esquemas', () => {
  it('acepta un lugar mínimo válido y rechaza campos inválidos', () => {
    const place = makePlace({ id: 'cafe-ejemplo', plazaId: 'plaza-01' })
    expect(PlaceSchema.safeParse(place).success).toBe(true)
    expect(PlaceSchema.safeParse({ ...place, id: 'Café Ejemplo' }).success).toBe(false)
    expect(
      PlaceSchema.safeParse({ ...place, links: { ...place.links, website: 'javascript:alert(1)' } })
        .success,
    ).toBe(false)
    expect(PlaceSchema.safeParse({ ...place, location: { lat: 120, lng: 0 } }).success).toBe(false)
    expect(PlaceSchema.safeParse({ ...place, googleMapsUri: 'https://example.com' }).success).toBe(
      false,
    )
    expect(PlaceSchema.safeParse({ ...place, phone: '442 123 4567' }).success).toBe(false)
    expect(PlaceSchema.safeParse({ ...place, extra: true }).success).toBe(false)
  })

  it('valida horarios', () => {
    expect(HoursSchema.safeParse({ mon: ['08:00-22:00'], sun: [] }).success).toBe(true)
    expect(HoursSchema.safeParse({ mon: ['18:00-02:00'] }).success).toBe(true)
    expect(HoursSchema.safeParse({ mon: ['8:00-22:00'] }).success).toBe(false)
    expect(HoursSchema.safeParse({ mon: ['10:00-10:00'] }).success).toBe(false)
    expect(HoursSchema.safeParse({ mon: ['10:00-24:30'] }).success).toBe(false)
    expect(HoursSchema.safeParse({ lunes: ['10:00-12:00'] }).success).toBe(false)
  })

  it('valida fotos con rutas relativas o https', () => {
    const photo = { src: 'images/places/x/foto.webp', alt: 'Fachada' }
    const place = makePlace({ id: 'x', plazaId: 'p' })
    expect(PlaceSchema.safeParse({ ...place, photos: [photo] }).success).toBe(true)
    expect(
      PlaceSchema.safeParse({ ...place, photos: [{ ...photo, src: '/images/x.webp' }] }).success,
    ).toBe(false)
    expect(
      PlaceSchema.safeParse({ ...place, photos: [{ ...photo, src: 'http://cdn.com/x.webp' }] })
        .success,
    ).toBe(false)
    expect(
      PlaceSchema.safeParse({ ...place, photos: [{ src: 'images/x.webp', alt: '' }] }).success,
    ).toBe(false)
  })
})

describe('validateRelations', () => {
  const dataset = { categories: categoriesFixture, plazas: plazasFixture, places: placesFixture }

  it('un conjunto coherente no tiene errores', () => {
    expect(errorsOf(validateRelations(dataset, bounds))).toEqual([])
  })

  it('un slug de categoría repetido dentro de un idioma es un error, entre idiomas no', () => {
    const [primera, segunda, ...resto] = categoriesFixture
    if (!primera || !segunda) throw new Error('el fixture necesita dos categorías')

    // Mismo slug en inglés: haría ambigua la URL de filtro del árbol inglés.
    const chocan = {
      ...dataset,
      categories: [
        primera,
        { ...segunda, slug: { ...segunda.slug, en: primera.slug.en } },
        ...resto,
      ],
    }
    expect(errorsOf(validateRelations(chocan, bounds))).toContain(
      `Slug de categoría duplicado en en: "${primera.slug.en}"`,
    )

    // El mismo texto en los dos idiomas de UNA categoría no estorba: son árboles distintos.
    const cruzado = {
      ...dataset,
      categories: [
        { ...primera, slug: { es: primera.slug.es, en: primera.slug.es } },
        segunda,
        ...resto,
      ],
    }
    expect(errorsOf(validateRelations(cruzado, bounds))).toEqual([])
  })

  it('detecta IDs duplicados y referencias inexistentes', () => {
    const broken = {
      ...dataset,
      places: [
        ...placesFixture,
        makePlace({ id: 'cafe-aurora', plazaId: 'plaza-fantasma', giros: ['sushi'] }),
      ],
    }
    const errors = errorsOf(validateRelations(broken, bounds))
    expect(errors).toContain('ID de local duplicado: "cafe-aurora"')
    expect(errors).toContain('La plaza "plaza-fantasma" no existe')
    expect(errors).toContain('El giro "sushi" no existe')
  })

  it('detecta giros repetidos y coordenadas fuera de Zibatá', () => {
    const broken = {
      ...dataset,
      places: placesFixture.map((place) =>
        place.id === 'pizza-norte'
          ? { ...place, giros: ['pizza', 'pizza'], location: { lat: 19.43, lng: -99.13 } }
          : place,
      ),
    }
    const errors = errorsOf(validateRelations(broken, bounds))
    expect(errors).toContain('Giro repetido "pizza"')
    expect(errors).toContain('Las coordenadas del local están fuera del área de Zibatá')
  })

  it('exige que el punto de la plaza caiga dentro de su polígono (respetando huecos)', () => {
    const square = plazasFixture[0]?.geometry as Parameters<typeof isInsidePlazaGeometry>[1]
    expect(isInsidePlazaGeometry({ lat: 20.6801, lng: -100.3199 }, square)).toBe(true)
    expect(isInsidePlazaGeometry({ lat: 20.679, lng: -100.31975 }, square)).toBe(false)
    const withHole: Parameters<typeof isInsidePlazaGeometry>[1] = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
      ],
    }
    expect(isInsidePlazaGeometry({ lat: 2, lng: 2 }, withHole)).toBe(true)
    expect(isInsidePlazaGeometry({ lat: 5, lng: 5 }, withHole)).toBe(false)

    const displaced = {
      ...dataset,
      plazas: plazasFixture.map((plaza) =>
        plaza.id === 'plaza-norte'
          ? { ...plaza, coordinates: { lat: 20.69, lng: -100.32 } }
          : plaza,
      ),
      places: placesFixture.map((place) =>
        place.id === 'pizza-norte' ? { ...place, location: { lat: 20.69, lng: -100.32 } } : place,
      ),
    }
    const issues = validateRelations(displaced, bounds)
    expect(errorsOf(issues)).toContain('El punto de la plaza queda fuera de su propio polígono')
    expect(
      issues.some(
        (issue) =>
          issue.level === 'warning' &&
          issue.message.includes('fuera del polígono de "plaza-norte"'),
      ),
    ).toBe(true)
  })

  it('detecta campos derivados desincronizados y los repara', () => {
    const stale = {
      ...dataset,
      plazas: [
        makePlaza({ id: 'plaza-norte', placeIds: ['cafe-aurora'] }),
        ...plazasFixture.filter((plaza) => plaza.id !== 'plaza-norte'),
      ],
    }
    const errors = errorsOf(validateRelations(stale, bounds))
    expect(errors.some((message) => message.startsWith('Falta el local "tacos-el-farol"'))).toBe(
      true,
    )
    expect(errors.some((message) => message.startsWith('categories no coincide'))).toBe(true)
    const fixed = { ...stale, plazas: syncPlazaDerivedFields(stale) }
    expect(errorsOf(validateRelations(fixed, bounds))).toEqual([])
  })

  it('exige verificación publicable en los locales activos', () => {
    const verification = {
      status: 'likely_active' as const,
      confidence: 'medium' as const,
      lastVerifiedAt: '2026-09-14',
      sources: ['https://example.com/ficha'],
    }
    const place = makePlace({ id: 'cafe-aurora', plazaId: 'plaza-norte' })
    expect(PlaceSchema.safeParse({ ...place, verification }).success).toBe(true)
    expect(
      PlaceSchema.safeParse({ ...place, verification: { ...verification, sources: [] } }).success,
    ).toBe(false)
    expect(
      PlaceSchema.safeParse({ ...place, verification: { ...verification, sources: ['ftp://x'] } })
        .success,
    ).toBe(false)

    const withStatus = (status: string) => ({
      ...dataset,
      places: placesFixture.map((p) =>
        p.id === 'cafe-aurora' ? { ...p, verification: { ...verification, status } } : p,
      ) as typeof placesFixture,
    })
    expect(errorsOf(validateRelations(withStatus('active'), bounds))).toEqual([])
    expect(errorsOf(validateRelations(withStatus('closed'), bounds))).toContain(
      'Un local con estado "closed" no puede publicarse como activo',
    )
    const warnings = validateRelations(dataset, bounds).filter((i) => i.level === 'warning')
    expect(warnings.some((i) => i.message.startsWith('Local activo sin verificación'))).toBe(true)
  })

  it('el catálogo solo expone lugares activos de plazas activas', () => {
    const inactivePlaza = plazasFixture.map((plaza) =>
      plaza.id === 'plaza-sur' ? { ...plaza, active: false } : plaza,
    )
    const catalog = buildCatalog(categoriesFixture, inactivePlaza, placesFixture)
    expect(catalog.places.map((place) => place.id)).toEqual([
      'cafe-aurora',
      'tacos-el-farol',
      'pizza-norte',
    ])
    expect(catalog.placesByPlaza.get('plaza-sur')).toEqual([])
  })
})

describe('cobertura de traducciones', () => {
  it('señala una descripción publicada sin inglés', () => {
    const dataset = {
      categories: categoriesFixture,
      plazas: plazasFixture,
      places: [
        makePlace({
          id: 'sin-ingles',
          plazaId: 'plaza-norte',
          description: { es: 'Solo español.' },
        }),
      ],
    }
    expect(validateTranslations(dataset).map((issue) => issue.id)).toContain('sin-ingles')
  })

  it('no señala nada cuando todo está traducido', () => {
    const [category] = categoriesFixture
    if (!category) throw new Error('Falta la categoría de prueba')
    const dataset = {
      categories: [
        {
          ...category,
          label: { es: 'Categoría', en: 'Category' },
          giros: category.giros.map((giro) => ({
            ...giro,
            label: { es: 'Giro', en: 'Tag' },
          })),
        },
      ],
      plazas: plazasFixture,
      places: [
        makePlace({
          id: 'traducido',
          plazaId: 'plaza-norte',
          description: { es: 'Hola.', en: 'Hello.' },
        }),
      ],
    }
    expect(validateTranslations(dataset)).toEqual([])
  })
})

describe('datos reales del repositorio', () => {
  it('cumplen los esquemas y no tienen errores de relaciones', () => {
    const c = CategoriesFileSchema.parse(categories)
    const z = PlazasFileSchema.parse(plazas)
    const p = PlacesFileSchema.parse(places)
    const [west, south, east, north] = extent.areaBbox as [number, number, number, number]
    const dataset = { categories: c.categories, plazas: z.plazas, places: p.places }
    const issues = validateRelations(dataset, { west, south, east, north })
    expect(errorsOf(issues)).toEqual([])
    expect(validateTranslations(dataset)).toEqual([])
  })
})
