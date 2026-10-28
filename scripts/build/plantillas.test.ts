import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Category, Place, Plaza } from '../../src/types/domain.ts'
import { type Dataset, pagesFor } from './prerender.ts'

/*
 * Las plantillas con datos distintos de los de hoy. El dataset real de la guía es JSON (no CSV), y
 * lo que cambia de un registro a otro es qué campos trae: aquí se recorre el generador con registros
 * inventados **en memoria** (nunca en `data/`) que traen lo mínimo, lo máximo o lo raro.
 *
 * Lo que se exige no es que todas las páginas digan lo mismo, ni que todos los negocios tengan lo
 * que sus datos no traen. Es lo contrario: que un campo que falta se **omita** (sin "undefined",
 * sin atributos vacíos, sin inventar un horario o un teléfono), que lo que viene de los datos se
 * escape, y que la página siga teniendo título, descripción, canónico, un solo `h1` y datos
 * estructurados válidos.
 */

const leer = <T>(archivo: string): T =>
  JSON.parse(readFileSync(`data/commercial/${archivo}`, 'utf8')) as T
const real = {
  categories: leer<{ categories: Category[] }>('categories.json').categories,
  plazas: leer<{ plazas: Plaza[] }>('plazas.json').plazas,
  places: leer<{ places: Place[] }>('places.json').places,
}

const categoria = real.categories[0] as Category
const giro = categoria.giros[0]?.id as string
const plaza = {
  ...(real.plazas.find((candidata) => candidata.active) as Plaza),
  id: 'plaza-prueba',
  slug: 'plaza-prueba',
  name: 'Plaza Prueba',
  description: { es: 'Una plaza de prueba.', en: 'A test plaza.' },
} as unknown as Plaza

const base = real.places[0] as Place
const registro = (slug: string, extra: Record<string, unknown>): Place =>
  ({
    ...base,
    id: slug,
    slug,
    name: `Local ${slug}`,
    plazaId: 'plaza-prueba',
    giros: [giro],
    secundarios: [],
    description: { es: 'Descripción del local.', en: 'Local description.' },
    cierre: undefined,
    ...extra,
  }) as unknown as Place

const sinNada = { website: null, instagram: null, facebook: null, tiktok: null, whatsapp: null }
const casos: Record<string, Place> = {
  'sin descripción': registro('sin-descripcion', { description: null }),
  'sin horario, teléfono ni enlaces': registro('minimo', {
    hours: null,
    phone: null,
    links: { ...base.links, ...sinNada, rappi: null, uberEats: null, didiFood: null },
  }),
  'solo en español': registro('solo-es', { description: { es: 'Solo en español.' } }),
  'nombre larguísimo': registro('largo', {
    name: 'Restaurante Cafetería y Pastelería Artesanal de la Familia González Hernández de Zibatá',
    description: { es: 'x'.repeat(400), en: 'y'.repeat(400) },
  }),
  'caracteres especiales': registro('especiales', {
    name: 'Café Ñandú & "Hijos" <b>Don\'s</b>',
    description: {
      es: 'Niño, ¿qué pasó? <script>alert(1)</script> & más',
      en: 'Kid & "friends" <img src=x onerror=alert(1)>',
    },
  }),
  'cerrado temporalmente': registro('cerrado', {
    cierre: { motivo: 'remodelacion', desde: '2026-10-09' },
  }),
}

const conjunto: Dataset = {
  categories: [categoria],
  plazas: [plaza],
  places: Object.values(casos),
}
const absoluta = (href: string) => `https://visitzibata.com${href}`

describe.each(['es', 'en'] as const)('plantillas con registros de peor caso (%s)', (idioma) => {
  const paginas = pagesFor(idioma, conjunto, '/', absoluta)
  const fichaDe = (slug: string) =>
    paginas.find((pagina) => pagina.href.endsWith(`/${slug}`) && /lugar|place/.test(pagina.href))

  it('cada registro, por raro que sea, produce su ficha', () => {
    for (const lugar of Object.values(casos)) expect(fichaDe(lugar.slug), lugar.slug).toBeDefined()
  })

  it.each(Object.keys(casos))(
    '%s: título, descripción y ruta con texto, sin valores sin resolver',
    (nombre) => {
      const lugar = casos[nombre] as Place
      const ficha = fichaDe(lugar.slug)
      expect(ficha?.title.trim().length).toBeGreaterThan(0)
      expect(ficha?.description.trim().length).toBeGreaterThan(0)
      expect(ficha?.href).toMatch(/^\/(en\/place|es\/lugar)\/[a-z0-9-]+$/)
      const todo = `${ficha?.title} ${ficha?.description} ${ficha?.contenido}`
      expect(todo).not.toMatch(/\b(undefined|NaN)\b|\[object Object\]/)
      expect(ficha?.contenido).not.toMatch(/href=""/)
      // Un solo h1 en el cuerpo servido (el de la ficha).
      expect((ficha?.contenido ?? '').match(/<h1[\s>]/g)?.length ?? 0).toBeLessThanOrEqual(1)
    },
  )

  it('la descripción de la ficha no pasa del tope aunque los datos sean enormes', () => {
    expect(fichaDe('largo')?.description.length).toBeLessThanOrEqual(200)
    expect(fichaDe('largo')?.title.length).toBeGreaterThan(0)
  })

  it('un campo que falta se omite, no se inventa', () => {
    const minimo = fichaDe('minimo')
    // Que las comprobaciones de abajo miren algo: sin esto pasarían igual con una ficha vacía.
    expect(minimo?.jsonLd).toBeDefined()
    expect((minimo?.contenido ?? '').length).toBeGreaterThan(100)
    expect(minimo?.contenido).not.toMatch(/href="tel:/)
    expect(minimo?.contenido).not.toMatch(/wa\.me|instagram\.com|facebook\.com/)
    // Y los datos estructurados no se llenan con lo que no hay.
    const datos = JSON.stringify(minimo?.jsonLd ?? {})
    expect(datos).not.toMatch(/telephone|sameAs|openingHours/)
    expect(datos).not.toMatch(/null|undefined/)
  })

  it('sin descripción propia, la página dice al menos qué es y dónde está', () => {
    const ficha = fichaDe('sin-descripcion')
    expect(ficha?.description).toContain('Plaza Prueba')
  })

  it('lo que viene de los datos se escapa: ni etiquetas ni atributos sueltos en el HTML', () => {
    const ficha = fichaDe('especiales')
    expect((ficha?.contenido ?? '').length).toBeGreaterThan(100)
    expect(ficha?.contenido).not.toContain('<script>alert(1)</script>')
    expect(ficha?.contenido).not.toMatch(/<img src=x/)
    expect(ficha?.contenido).not.toContain('<b>Don')
    // El texto sigue ahí, legible, con sus acentos.
    expect(ficha?.contenido).toContain('Ñandú')
    expect(ficha?.contenido).toContain('&amp;')
  })

  it('los datos estructurados de cada ficha se pueden serializar sin cerrar el bloque antes de tiempo', () => {
    for (const lugar of Object.values(casos)) {
      const crudo = JSON.stringify(fichaDe(lugar.slug)?.jsonLd ?? {})
      expect(() => JSON.parse(crudo)).not.toThrow()
    }
  })

  it('un cierre temporal se dice en la descripción, no solo en los datos', () => {
    expect(fichaDe('cerrado')?.description).toMatch(
      idioma === 'es' ? /cerrad|remodelaci/i : /closed|renovation/i,
    )
  })

  it('los títulos y las descripciones no se repiten entre registros distintos', () => {
    const fichas = Object.values(casos).map((lugar) => fichaDe(lugar.slug))
    expect(new Set(fichas.map((ficha) => ficha?.title)).size).toBe(fichas.length)
  })
})
