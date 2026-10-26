import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Category, Place, Plaza } from '../../src/types/domain.ts'
import { type Dataset, pagesFor } from './prerender.ts'

/*
 * La guía va a crecer más allá de comer y beber (servicios, deporte, tiendas), y la única categoría
 * "abierta" de hoy, `otros`, tiene cero locales: ese camino nunca se ha recorrido con datos. Esta
 * prueba lo recorre con un dataset **inventado y en memoria** (una peluquería), sin tocar `data/`:
 * una categoría que no es de comida tiene que salir con su ficha, sus datos estructurados sin
 * marcado de cocina y una descripción con sentido, sin cambiar el generador.
 */

const leer = <T>(archivo: string): T =>
  JSON.parse(readFileSync(`data/commercial/${archivo}`, 'utf8')) as T
const real = {
  categories: leer<{ categories: Category[] }>('categories.json').categories,
  plazas: leer<{ plazas: Plaza[] }>('plazas.json').plazas,
  places: leer<{ places: Place[] }>('places.json').places,
}

const categoria = {
  ...(real.categories[0] as Category),
  id: 'belleza',
  slug: { es: 'belleza', en: 'beauty' },
  label: { es: 'Belleza', en: 'Beauty' },
  giros: [
    {
      id: 'peluqueria',
      label: { es: 'Peluquería', en: 'Hair salon' },
      icon: 'scissors',
      synonyms: [],
    },
  ],
} as unknown as Category

const plaza = {
  ...(real.plazas[0] as Plaza),
  id: 'plaza-prueba',
  slug: 'plaza-prueba',
  name: 'Plaza Prueba',
  active: true,
  description: { es: 'Una plaza de prueba.', en: 'A test plaza.' },
} as unknown as Plaza

const peluqueria = {
  ...(real.places[0] as Place),
  id: 'estilo-x',
  slug: 'estilo-x',
  name: 'Estilo X',
  plazaId: 'plaza-prueba',
  giros: ['peluqueria'],
  secundarios: [],
  description: { es: 'Cortes y color.', en: 'Haircuts and colour.' },
  cierre: undefined,
  links: { website: null, instagram: null, facebook: null, tiktok: null, whatsapp: null },
} as unknown as Place

const sintetico: Dataset = { categories: [categoria], plazas: [plaza], places: [peluqueria] }
const absoluta = (href: string) => `https://visitzibata.com${href}`

describe.each([
  ['es', '/lugar/estilo-x', 'Peluquería en Plaza Prueba, Zibatá. Cortes y color.'],
  ['en', '/en/place/estilo-x', 'Hair salon at Plaza Prueba, Zibatá. Haircuts and colour.'],
] as const)('una categoría que no es de comida (%s)', (idioma, href, descripcion) => {
  const paginas = pagesFor(idioma, sintetico, '/', '/og/', absoluta)
  const ficha = paginas.find((pagina) => pagina.href === href)

  it('genera la portada, la zona, la categoría, la ficha y la información', () => {
    expect(paginas).toHaveLength(1 + 1 + 1 + 1 + 4)
    // La categoría nueva tiene su propia página, con su ruta, y la ficha enlaza a ella.
    const categoria = paginas.find(
      (pagina) => pagina.href.includes('belleza') || pagina.href.includes('beauty'),
    )
    expect(categoria?.title).toContain(idioma === 'es' ? 'Belleza en Zibatá' : 'Beauty in Zibatá')
    expect(paginas.find((pagina) => pagina.href.includes('estilo-x'))?.contenido).toContain(
      categoria?.href ?? 'sin-categoria',
    )
    expect(ficha).toBeDefined()
  })

  it('la ficha lleva título, descripción con su giro y su zona, y enlaza a su zona', () => {
    expect(ficha?.title).toBe('Estilo X · Visit Zibatá')
    expect(ficha?.description).toBe(descripcion)
    expect(ficha?.contenido).toContain('Plaza Prueba')
    expect(ficha?.contenido).toMatch(/href="[^"]*plaza-prueba"/)
  })

  it('los datos estructurados son un negocio local sin marcado de cocina', () => {
    expect(ficha?.jsonLd?.['@type']).toBe('LocalBusiness')
    expect(ficha?.jsonLd).not.toHaveProperty('servesCuisine')
    expect(ficha?.jsonLd?.name).toBe('Estilo X')
  })

  it('la zona la lista y la portada no habla de comida', () => {
    const zona = paginas.find(
      (pagina) => pagina.href.endsWith('plaza-prueba') && !pagina.href.includes('lugar'),
    )
    expect(zona?.contenido).toContain('Estilo X')
    const portada = paginas[0]
    expect(`${portada?.title} ${portada?.description}`).not.toMatch(/restaurant|comer|food|eat/i)
  })
})

describe.each([
  [
    'es',
    'Conoce 1 lugar en 1 zona de la localidad. Horario, contacto y cómo llegar.',
    'Conoce 1 lugar de la localidad.',
  ],
  [
    'en',
    '1 place in 1 area, with hours, contact and directions.',
    '1 place, with hours, contact and directions.',
  ],
] as const)(
  'la descripción de una categoría con un solo local (%s)',
  (idioma, conZona, sinZona) => {
    const paginaDeCategoria = (datos: Dataset) =>
      pagesFor(idioma, datos, '/', '/og/', absoluta).find((pagina) =>
        /\/(categoria|category)\//.test(pagina.href),
      )

    it('habla en singular, sin "los" ni "cada uno"', () => {
      const pagina = paginaDeCategoria(sintetico)
      expect(pagina?.description).toContain(conZona)
      expect(pagina?.description).not.toMatch(/\b1 (lugares|places|zonas|areas)\b|cada uno/)
    })

    it('si su único local está en una zona que no está activa, no dice "0 zonas"', () => {
      const plazaInactiva = { ...plaza, active: false } as unknown as Plaza
      const pagina = paginaDeCategoria({ ...sintetico, plazas: [plazaInactiva] })
      expect(pagina).toBeDefined()
      expect(pagina?.description).toContain(sinZona)
      expect(pagina?.description).not.toMatch(/\b0 |zonas?\b|areas?\b/)
    })
  },
)
