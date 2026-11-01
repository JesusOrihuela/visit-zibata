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

const plazasActivas = new Set(data.plazas.filter((plaza) => plaza.active).map((plaza) => plaza.id))
const visibles = data.places.filter((place) => place.active && plazasActivas.has(place.plazaId))

const absoluta = (href: string) => `https://visitzibata.com${href}`
const paginas = {
  es: pagesFor('es', data, '/', absoluta),
  en: pagesFor('en', data, '/', absoluta),
}
type Idioma = keyof typeof paginas
const idiomas: Idioma[] = ['es', 'en']

const de = (idioma: Idioma, href: string) => {
  const pagina = paginas[idioma].find((candidata) => candidata.href === href)
  if (!pagina) throw new Error(`No hay página ${href} en ${idioma}`)
  return pagina
}
const ficha = (idioma: Idioma, slug: string) =>
  de(idioma, idioma === 'es' ? `/es/lugar/${slug}` : `/en/place/${slug}`)
const textoDelDato = (place: Place, idioma: Idioma): string =>
  (idioma === 'en' ? place.description?.en : undefined) ?? place.description?.es ?? ''

describe.each(idiomas)('metadatos de las páginas (%s)', (idioma) => {
  const todas = paginas[idioma]
  const fichas = visibles.map((place) => ficha(idioma, place.slug))

  it('genera la portada, las zonas, una página por cada categoría, las fichas y la información', () => {
    const categoriasConLocales = data.categories.filter((c) =>
      visibles.some((p) => p.giros.some((giro) => c.giros.some((g) => g.id === giro))),
    )
    expect(todas).toHaveLength(
      1 + plazasActivas.size + categoriasConLocales.length + visibles.length + 4,
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
      // Unos 60; las categorías llevan además sus giros y admiten un poco más.
      const tope = /^\/(?:en\/category|es\/categoria)\//.test(pagina.href) ? 65 : 60
      expect(pagina.title.length, `título de ${pagina.href}`).toBeLessThanOrEqual(tope)
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

  it('todas las páginas del idioma usan su imagen social, también en el JSON-LD de las fichas', () => {
    // Una imagen por idioma, igual en todas las páginas de ese idioma: no hay imagen por local.
    const imagen = idioma === 'en' ? '/og-image-en.png' : '/og-image.png'
    for (const pagina of todas) expect(pagina.image, pagina.href).toBe(imagen)
    for (const pagina of fichas) {
      expect(pagina.jsonLd?.image, pagina.href).toBe(absoluta(imagen))
    }
  })

  it('con una base en subruta la imagen social la lleva', () => {
    const imagen = idioma === 'en' ? 'og-image-en.png' : 'og-image.png'
    for (const pagina of pagesFor(idioma, data, '/visit-zibata/', absoluta)) {
      expect(pagina.image, pagina.href).toBe(`/visit-zibata/${imagen}`)
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
  it('cafele, que ya decía lo suficiente, lleva el contexto primero y luego su texto', () => {
    expect(ficha('es', 'cafele').description).toMatch(
      /^.*en MOL Pitahaya, Zibatá\. CAFELE es una cafetería/,
    )
  })

  it('una descripción que empezaba con el nombre lleva el contexto primero', () => {
    expect(ficha('es', 'marie-panaderia-artesanal').description).toMatch(
      /^.*en Centro Zibatá\. Pan dulce artesanal/,
    )
    expect(ficha('es', 'huskys-ice-cream').description).toMatch(
      /^.*en Xentric Anáhuac, Zibatá\. Helados artesanales/,
    )
    // Pero cuando el nombre es el sujeto de la frase, se queda después del contexto.
    expect(ficha('es', 'cafele').description).toMatch(
      /^.*en MOL Pitahaya, Zibatá\. CAFELE es una cafetería/,
    )
    expect(ficha('es', 'la-michoacana').description).toMatch(
      /^En Paseo Zibatá\. La Michoacana es una marca/,
    )
  })

  it('un salto que separa dos ideas se une con " · " y uno que parte una frase, con un espacio, después del contexto', () => {
    expect(ficha('es', 'origenatural').description).toMatch(
      /^.*en Xentric Anáhuac, Zibatá\. Urban Bistró · Comer rico y sentirte bien\./,
    )
    expect(ficha('es', 'la-880').description).toMatch(
      /^.*en Xentric Anáhuac, Zibatá\. El lugar donde la música, la comida y las risas se mezclan · Alitas & Pisto/,
    )
    expect(ficha('es', 'burger-fries').description).toMatch(
      /^.*en Plaza Loop Urban, Zibatá\. Creemos que todos deben disfrutar de una buena hamburguesa sin pagar de más/,
    )
  })

  it('una descripción corta dice dónde está y qué es, sin repetir su propio giro, con el contexto primero', () => {
    expect(ficha('es', 'lilo-bowl-bar').description).toMatch(
      /^.*en Centro Zibatá\. Bowl Revolution\.$/,
    )
    // "Pizza artesanal." ya dice "pizza": solo se añade la zona.
    expect(ficha('es', 'enzza-pizza-zibata').description).toBe('En Paseo Zibatá. Pizza artesanal.')
  })

  it('agave grill ya reabrió: no lleva aviso de cierre y usa la fecha de su verificación', () => {
    const es = ficha('es', 'agave-grill')
    expect(es.description.startsWith('Cerrado temporalmente')).toBe(false)
    const agave = data.places.find((place) => place.slug === 'agave-grill')
    expect(es.lastmod).toBe(agave?.verification?.lastVerifiedAt)
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
  it('presenta la guía local de Zibatá, sin repetir la marca ni reducirla a restaurantes', () => {
    for (const idioma of idiomas) {
      const portada = de(idioma, idioma === 'es' ? '/es' : '/en')
      expect(portada.title.length).toBeLessThanOrEqual(60)
      expect(portada.description.length).toBeLessThanOrEqual(160)
      for (const texto of [portada.title, portada.description]) {
        expect(texto).not.toMatch(/restaurant/i)
      }
      expect(portada.title).toContain('Zibatá')
      expect(portada.title.match(/Zibatá/g) ?? []).toHaveLength(1)
      expect(portada.description).not.toContain('Zibatá')
    }
    expect(de('es', '/es').title).toMatch(/guía local/i)
    expect(de('es', '/es').description).toMatch(/plaza por plaza/i)
    expect(de('en', '/en').description).toMatch(/plaza by plaza/i)
  })
})

describe('las zonas y la información no cambian de plantilla', () => {
  it('conservan el título "{nombre} · Visit Zibatá" y su propia descripción', () => {
    const condesa = de('es', '/es/zona/condesa')
    expect(condesa.title).toBe('Plaza Condesa · Visit Zibatá')
    expect(condesa.description).toBe(
      'Zona comercial del desarrollo Riscos Condesa I, frente a la Universidad Anáhuac.',
    )
  })
})

describe('los enlaces entre fichas del HTML servido', () => {
  const hrefs = (contenido: string | undefined) =>
    [...(contenido ?? '').matchAll(/<a href="(\/es\/lugar\/[a-z0-9-]+)"/g)].map((m) => m[1] ?? '')

  it('casi ninguna ficha queda con un único enlace entrante: solo las que están solas en su zona', () => {
    const entrantes = new Map<string, number>()
    for (const pagina of paginas.es) {
      if (pagina.href.startsWith('/es/zona/') || pagina.href.startsWith('/es/lugar/')) {
        for (const destino of new Set(hrefs(pagina.contenido))) {
          entrantes.set(destino, (entrantes.get(destino) ?? 0) + 1)
        }
      }
    }
    const solas = data.plazas
      .map((plaza) => data.places.filter((place) => place.plazaId === plaza.id))
      .filter((locales) => locales.length === 1)
      .flat()
      .map((place) => `/es/lugar/${place.slug}`)
    const conUno = data.places
      .map((place) => `/es/lugar/${place.slug}`)
      .filter((href) => (entrantes.get(href) ?? 0) <= 1)
    // Antes del reparto eran 37: los ocho primeros de cada zona grande recibían todos los enlaces.
    expect(conUno.sort()).toEqual(solas.sort())
  })

  it('la ficha en español y la inglesa enlazan a los mismos locales', () => {
    for (const place of data.places) {
      const es = hrefs(ficha('es', place.slug).contenido).map((h) => h.replace('/es/lugar/', ''))
      const en = [
        ...(ficha('en', place.slug).contenido ?? '').matchAll(
          /<a href="\/en\/place\/([a-z0-9-]+)"/g,
        ),
      ].map((m) => m[1])
      expect(en, place.slug).toEqual(es)
    }
  })
})

describe.each(idiomas)('las páginas de categoría (%s)', (idioma) => {
  const todas = paginas[idioma]
  const ruta = (slug: string) =>
    idioma === 'es' ? `/es/categoria/${slug}` : `/en/category/${slug}`
  const deCategoria = todas.filter((p) => p.href.startsWith(ruta('')))
  const categoriaDeGiro = new Map(
    data.categories.flatMap((c) => c.giros.map((g) => [g.id, c.id] as const)),
  )
  const idsDe = (place: Place) =>
    new Set([...place.giros, ...(place.secundarios ?? [])].map((g) => categoriaDeGiro.get(g)))
  const conLocales = data.categories.filter((c) => data.places.some((p) => idsDe(p).has(c.id)))

  it('hay una por cada categoría que tiene al menos un local', () => {
    const conLocales = data.categories.filter((c) => data.places.some((p) => idsDe(p).has(c.id)))
    expect(conLocales.length).toBeGreaterThan(0)
    expect(deCategoria.map((p) => p.href).sort()).toEqual(
      conLocales.map((c) => ruta(c.slug[idioma])).sort(),
    )
  })

  it('la descripción dice la cantidad de locales y de zonas, sin "0" ni plurales de uno', () => {
    for (const categoria of conLocales) {
      const pagina = de(idioma, ruta(categoria.slug[idioma]))
      expect(pagina.description, categoria.id).not.toMatch(
        /\b0 (zonas?|areas?)|\b1 (lugares|places|zonas|areas)\b/,
      )
      expect(pagina.description, categoria.id).toMatch(/\b\d+ (lugares?|places?)\b/)
    }
  })

  it('una categoría sin locales no tiene página', () => {
    const vacias = data.categories.filter((c) => !conLocales.includes(c))
    expect(vacias.length).toBeGreaterThan(0)
    for (const categoria of vacias) {
      expect(() => de(idioma, ruta(categoria.slug[idioma]))).toThrow()
    }
  })

  it('el título nombra lo que la gente busca cuando la etiqueta es general (hamburguesas, alitas)', () => {
    const rapida = data.categories.find((c) => c.slug.es === 'hamburguesas')
    const pagina = de(idioma, ruta(rapida?.slug[idioma] ?? ''))
    expect(pagina.title).toMatch(idioma === 'es' ? /hamburguesas y alitas/ : /burgers and wings/)
    // Y nunca nombra un giro con un solo local ("arepas", "memelas").
    for (const p of todas.filter((x) => x.href.startsWith(ruta('')))) {
      expect(p.title, p.href).not.toMatch(/arepas|memelas|boba|carnitas/i)
    }
  })

  it('cada una lista exactamente los locales de su categoría, con el mismo criterio que el filtro', () => {
    for (const categoria of conLocales) {
      const pagina = de(idioma, ruta(categoria.slug[idioma]))
      const enPagina = [
        ...(pagina.contenido ?? '').matchAll(/<a href="[^"]*\/(?:lugar|place)\/([a-z0-9-]+)"/g),
      ]
        .map((m) => m[1])
        .sort()
      const esperados = data.places
        .filter((p) => idsDe(p).has(categoria.id))
        .map((p) => p.slug)
        .sort()
      expect(enPagina, categoria.id).toEqual(esperados)
    }
  })

  it('título, descripción y h1 dicen la categoría; el título no se repite en el sitio', () => {
    const titulos = new Set(todas.map((p) => p.title))
    expect(titulos.size).toBe(todas.length)
    for (const categoria of conLocales) {
      const pagina = de(idioma, ruta(categoria.slug[idioma]))
      const etiqueta = categoria.label[idioma] ?? categoria.label.es
      expect(pagina.title).toContain(etiqueta)
      expect(pagina.description).toContain(etiqueta)
      expect(pagina.contenido).toContain(`<h1>${etiqueta.replace(/&/g, '&amp;')}`)
      expect(pagina.description.length).toBeGreaterThan(40)
      expect(pagina.description.length).toBeLessThanOrEqual(160)
    }
  })

  it('solo dicen lo que dicen los datos: ningún "abierto ahora" ni horario', () => {
    for (const pagina of deCategoria) {
      expect(`${pagina.description} ${pagina.contenido}`).not.toMatch(
        /abiert[oa]s? ahora|open now|<dl>/i,
      )
    }
  })

  it('la cifra de la descripción es el número de locales de la lista', () => {
    for (const categoria of conLocales) {
      const pagina = de(idioma, ruta(categoria.slug[idioma]))
      const n = data.places.filter((p) => idsDe(p).has(categoria.id)).length
      expect(pagina.description).toMatch(new RegExp(`(?<![0-9])${n} (lugares|places)`))
    }
  })

  it('se llega a cada una desde la portada, desde las zonas donde hay y desde las fichas que son suyas', () => {
    const portada = de(idioma, idioma === 'es' ? '/es' : '/en')
    for (const categoria of conLocales) {
      const destino = ruta(categoria.slug[idioma])
      expect(portada.contenido, `portada -> ${destino}`).toContain(`href="${destino}"`)
    }
    // Una categoría sin locales no se enlaza desde ningún sitio: no hay a dónde llevar.
    for (const categoria of data.categories.filter((c) => !conLocales.includes(c))) {
      expect(portada.contenido).not.toContain(`href="${ruta(categoria.slug[idioma])}"`)
    }
    for (const place of data.places) {
      const pagina = ficha(idioma, place.slug)
      for (const categoria of data.categories) {
        const destino = ruta(categoria.slug[idioma])
        expect(pagina.contenido?.includes(`href="${destino}"`), `${place.slug} ${destino}`).toBe(
          idsDe(place).has(categoria.id),
        )
      }
    }
    for (const plaza of data.plazas.filter((p) => p.active)) {
      const pagina = de(
        idioma,
        idioma === 'es' ? `/es/zona/${plaza.slug}` : `/en/area/${plaza.slug}`,
      )
      for (const categoria of data.categories) {
        const hay = data.places.some((p) => p.plazaId === plaza.id && idsDe(p).has(categoria.id))
        expect(
          pagina.contenido?.includes(`href="${ruta(categoria.slug[idioma])}"`),
          `${plaza.slug} ${categoria.id}`,
        ).toBe(hay)
      }
    }
  })

  it('los enlaces a categorías van en un data-nosnippet: son una vía, no el contenido de la ficha', () => {
    const f = ficha(idioma, data.places[0]?.slug ?? '')
    expect(f.contenido).toMatch(
      /<div data-nosnippet><h2>[^<]+<\/h2><ul><li><a href="[^"]*\/(?:categoria|category)\//,
    )
  })
})

describe('los locales ocultos', () => {
  it('no generan ficha ni entrada en el sitemap', () => {
    const base = data.places[0]
    if (!base) throw new Error('El dataset de prueba no tiene locales')
    const oculto: Place = {
      ...base,
      id: 'oculto-de-prueba',
      slug: 'oculto-de-prueba',
      active: false,
    }
    const conOculto = { ...data, places: [...data.places, oculto] }
    const generadas = pagesFor('es', conOculto, '/', absoluta)
    expect(generadas.some((pagina) => pagina.href === '/es/lugar/oculto-de-prueba')).toBe(false)
  })
})

describe('las páginas de categoría en los dos idiomas', () => {
  const conLocales = data.categories.filter((c) =>
    visibles.some((p) =>
      [...p.giros, ...(p.secundarios ?? [])].some((g) => c.giros.some((g2) => g2.id === g)),
    ),
  )

  it('ocupan la misma posición, que es lo que empareja las hreflang', () => {
    const posiciones = (idioma: Idioma) =>
      paginas[idioma]
        .map((p, i) => [p.href, i] as const)
        .filter(([href]) => /^\/(en\/category|es\/categoria)\//.test(href))
        .map(([, i]) => i)
    expect(posiciones('es')).toEqual(posiciones('en'))
    expect(posiciones('es').length).toBe(conLocales.length)
  })
})
