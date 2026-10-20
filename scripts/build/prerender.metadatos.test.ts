import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Category, Place, Plaza } from '../../src/types/domain.ts'
import { type Dataset, pagesFor } from './prerender.ts'

/*
 * Los metadatos de las 234 páginas, generados con el dataset real y las dos lenguas: lo que Google
 * lee en el `<head>` y lo que se ve al compartir un enlace. Aquí se comprueba el resultado completo
 * y no cada función por separado, porque los defectos que se corrigen (títulos repetidos, saltos de
 * línea, cortes) solo se ven mirando la lista entera.
 *
 * Esto no dice qué mostrará Google: la meta descripción es una sugerencia que Google usa cuando le
 * parece que describe mejor la página que su propio texto.
 */

const leer = <T>(archivo: string): T =>
  JSON.parse(readFileSync(`data/commercial/${archivo}`, 'utf8')) as T
const data: Dataset = {
  categories: leer<{ categories: Category[] }>('categories.json').categories,
  plazas: leer<{ plazas: Plaza[] }>('plazas.json').plazas,
  places: leer<{ places: Place[] }>('places.json').places,
}

const absoluta = (href: string) => `https://visitzibata.com${href}`
const paginas = {
  es: pagesFor('es', data, '/', '/og/', absoluta),
  en: pagesFor('en', data, '/', '/og/', absoluta),
}
type Idioma = keyof typeof paginas
const idiomas: Idioma[] = ['es', 'en']

const de = (idioma: Idioma, href: string) => {
  const pagina = paginas[idioma].find((candidata) => candidata.href === href)
  if (!pagina) throw new Error(`No hay página ${href} en ${idioma}`)
  return pagina
}
const ficha = (idioma: Idioma, slug: string) =>
  de(idioma, idioma === 'es' ? `/lugar/${slug}` : `/en/place/${slug}`)
const textoDelDato = (place: Place, idioma: Idioma): string =>
  (idioma === 'en' ? place.description?.en : undefined) ?? place.description?.es ?? ''

describe.each(idiomas)('metadatos de las páginas (%s)', (idioma) => {
  const todas = paginas[idioma]
  const fichas = data.places.map((place) => ficha(idioma, place.slug))

  it('genera la portada, las zonas, las fichas y la información', () => {
    expect(todas).toHaveLength(
      1 + data.plazas.filter((p) => p.active).length + data.places.length + 4,
    )
  })

  it('cada título y cada descripción son distintos dentro del idioma', () => {
    for (const campo of ['title', 'description'] as const) {
      const valores = todas.map((pagina) => pagina[campo].toLowerCase())
      const repetidos = valores.filter((valor, i) => valores.indexOf(valor) !== i)
      expect(repetidos, `${campo} repetidos en ${idioma}`).toEqual([])
    }
  })

  it('ningún título ni descripción está vacío ni pasa del tope', () => {
    for (const pagina of todas) {
      expect(pagina.title.length, pagina.href).toBeGreaterThan(0)
      expect(pagina.title.length, `título de ${pagina.href}`).toBeLessThanOrEqual(60)
      expect(pagina.description.length, pagina.href).toBeGreaterThan(0)
      expect(pagina.description.length, `descripción de ${pagina.href}`).toBeLessThanOrEqual(160)
    }
  })

  it('sin saltos de línea, espacios dobles, texto mal codificado ni texto sin normalizar', () => {
    for (const pagina of todas) {
      for (const [campo, valor] of [
        ['title', pagina.title],
        ['description', pagina.description],
      ] as const) {
        expect(valor, `${campo} de ${pagina.href}`).not.toMatch(/[\n\r\t]|\s{2,}|^\s|\s$/)
        expect(valor, `${campo} de ${pagina.href}`).not.toMatch(/�|Ã.|â€|Â./)
        expect(valor.normalize('NFC'), `${campo} de ${pagina.href}`).toBe(valor)
      }
    }
  })

  it('ninguna descripción de ficha acaba colgada: ni ":…" ni una conjunción antes de "…"', () => {
    for (const pagina of fichas) {
      expect(pagina.description, pagina.href).not.toMatch(/[:;,]…$/)
      expect(pagina.description, pagina.href).not.toMatch(
        /\b(y|e|o|de|del|la|el|con|para|en|que|and|or|the|of|with|for|in)…$/i,
      )
    }
  })

  it('el JSON-LD sigue diciendo lo que dice el negocio, sin contexto añadido ni saltos aplanados', () => {
    for (const place of data.places) {
      const esperado = textoDelDato(place, idioma)
      const descripcion = ficha(idioma, place.slug).jsonLd?.description
      if (descripcion !== undefined) expect(descripcion, place.slug).toBe(esperado)
    }
  })

  it('ni los títulos ni las descripciones dejan contenido vacío en el cuerpo servido', () => {
    for (const pagina of fichas) {
      expect(pagina.contenido, pagina.href).not.toMatch(
        /<(p|h1|h2|li|dt|dd)><\/\1>|href=""|href="\+/,
      )
    }
  })

  it('los nombres con ñ, tildes y diéresis salen enteros', () => {
    expect(ficha(idioma, 'nam-nam').title).toContain('Ñam Ñam Sushi')
    expect(ficha(idioma, 'mykona-frozen-yogurt').title).toContain('Myköna Frozen Yogurt')
    expect(ficha(idioma, 'birria-jauregui').title).toContain('Birria Jáuregui')
    expect(ficha(idioma, 'marie-panaderia-artesanal').title).toContain('Marie Panadería Artesanal')
    // Un giro con ç y acentos entra en una descripción compuesta sin deformarse.
    expect(ficha(idioma, 'lilo-bowl-bar').description).toContain('Açaí')
  })
})

describe('las fichas que antes salían iguales', () => {
  const cadenas: [string, string][] = [
    ['sinforosa', 'sinforosa-anahuac'],
    ['luka-pokes', 'luka-anahuac'],
    ['la-michoacana', 'la-michoacana-xentric-zibata'],
    ['starbucks-centro-zibata', 'starbucks-anahuac'],
  ]
  const zonaDe = (slug: string, idioma: Idioma) => {
    const place = data.places.find((candidato) => candidato.slug === slug)
    const plaza = data.plazas.find((candidata) => candidata.id === place?.plazaId)
    const nombre = plaza?.name as unknown
    return typeof nombre === 'string' ? nombre : ((nombre as Record<string, string>)[idioma] ?? '')
  }

  it.each(idiomas)(
    'tienen título y descripción distintos y la zona en el título (%s)',
    (idioma) => {
      for (const [a, b] of cadenas) {
        const [fa, fb] = [ficha(idioma, a), ficha(idioma, b)]
        expect(fa.title, `${a} y ${b}`).not.toBe(fb.title)
        expect(fa.description, `${a} y ${b}`).not.toBe(fb.description)
        expect(fa.title).toContain(zonaDe(a, idioma))
        expect(fb.title).toContain(zonaDe(b, idioma))
      }
    },
  )

  it('los locales cuyo nombre no se repite conservan el título de siempre', () => {
    expect(ficha('es', 'cafele').title).toBe('Cafele · Visit Zibatá')
    expect(ficha('es', 'agave-grill').title).toBe('Agave Grill · Visit Zibatá')
    expect(ficha('es', 'burger-fries').title).toBe('Burger & Fries Forever · Visit Zibatá')
  })
})

describe('lo que se comprobó en las fichas concretas de la auditoría', () => {
  it('cafele, que ya decía lo suficiente, no cambia', () => {
    const cafele = data.places.find((place) => place.slug === 'cafele')
    expect(ficha('es', 'cafele').description).toBe(textoDelDato(cafele as Place, 'es'))
  })

  it('una descripción que empezaba con el nombre ya no lo repite (marie, huskys)', () => {
    expect(ficha('es', 'marie-panaderia-artesanal').description).toMatch(/^Pan dulce artesanal/)
    expect(ficha('es', 'huskys-ice-cream').description).toMatch(/^Helados artesanales/)
    // Pero cuando el nombre es el sujeto de la frase, se queda.
    expect(ficha('es', 'cafele').description).toMatch(/^CAFELE es una cafetería/)
    expect(ficha('es', 'la-michoacana').description).toMatch(/^La Michoacana es una marca/)
  })

  it('un salto que separa dos ideas se une con " · " y uno que parte una frase, con un espacio', () => {
    expect(ficha('es', 'origenatural').description).toContain(
      'Urban Bistró · Comer rico y sentirte bien.',
    )
    expect(ficha('es', 'la-880').description).toContain('se mezclan · Alitas & Pisto')
    expect(ficha('es', 'burger-fries').description).toContain(
      'una buena hamburguesa sin pagar de más',
    )
  })

  it('una descripción corta dice dónde está y qué es, sin repetir su propio giro', () => {
    expect(ficha('es', 'lilo-bowl-bar').description).toMatch(
      /^Bowl Revolution\. .+ en Centro Zibatá\.$/,
    )
    // "Pizza artesanal." ya dice "pizza": solo se añade la zona.
    expect(ficha('es', 'enzza-pizza-zibata').description).toBe('Pizza artesanal. En Paseo Zibatá.')
  })

  it('agave grill abre con el aviso de cierre y su lastmod no es anterior al cierre', () => {
    const es = ficha('es', 'agave-grill')
    expect(es.description.startsWith('Cerrado temporalmente. Por remodelación.')).toBe(true)
    expect(
      ficha('en', 'agave-grill').description.startsWith('Temporarily closed. For refurbishment.'),
    ).toBe(true)
    expect((es.lastmod ?? '') >= '2026-10-09').toBe(true)
    // Las que no cierran siguen con la fecha de su verificación.
    const cafele = data.places.find((place) => place.slug === 'cafele')
    expect(ficha('es', 'cafele').lastmod).toBe(cafele?.verification?.lastVerifiedAt)
  })

  it('el enlace de WhatsApp del HTML servido es una URL, no un teléfono suelto', () => {
    const masaru = ficha('es', 'masaru').contenido ?? ''
    expect(masaru).toContain('href="https://wa.me/524426028627"')
    expect(masaru).not.toContain('href="+')
  })
})

describe('la portada', () => {
  it('presenta la guía como un lugar para descubrir Zibatá, sin reducirla a restaurantes', () => {
    for (const idioma of idiomas) {
      const portada = de(idioma, idioma === 'es' ? '/' : '/en')
      expect(portada.title).toContain('Visit Zibatá')
      expect(portada.title.length).toBeLessThanOrEqual(60)
      expect(portada.description.length).toBeLessThanOrEqual(160)
      for (const texto of [portada.title, portada.description]) {
        expect(texto).not.toMatch(/restaurant/i)
        expect(texto).toContain('Zibatá')
      }
    }
    expect(de('es', '/').title).toMatch(/guía local/i)
    expect(de('es', '/').description).toMatch(/negocios y lugares/)
    expect(de('en', '/en').description).toMatch(/businesses and places/)
  })
})

describe('las zonas y la información no cambian de plantilla', () => {
  it('conservan el título "{nombre} · Visit Zibatá" y su propia descripción', () => {
    const condesa = de('es', '/zona/condesa')
    expect(condesa.title).toBe('Plaza Condesa · Visit Zibatá')
    expect(condesa.description).toBe(
      'Zona comercial del desarrollo Riscos Condesa I, frente a la Universidad Anáhuac.',
    )
  })
})
