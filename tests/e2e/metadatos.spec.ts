import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Los metadatos tal como salen en el HTML que se publica (`dist/`), no como los calcula el
 * generador: lo que lee Google y lo que se ve al compartir un enlace. `prerender.metadatos.test.ts`
 * comprueba la lógica con el dataset; esto comprueba que lo que llega al archivo es lo mismo y que
 * nada se duplicó ni se estropeó al escribirlo.
 *
 * No dice qué mostrará Google: la meta descripción es una sugerencia que Google puede ignorar.
 */

interface Cabecera {
  title: string[]
  description: string[]
  ogTitle: string[]
  ogDescription: string[]
  canonical: string[]
  lang: string | null
  charset: string[]
  html: string
}

const entidades: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}
const decodificar = (texto: string) =>
  texto.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => entidades[e] ?? e)
const todos = (html: string, patron: RegExp) =>
  [...html.matchAll(patron)].map((m) => decodificar(m[1] ?? ''))

async function cabecera(request: APIRequestContext, ruta: string): Promise<Cabecera> {
  const respuesta = await request.get(ruta)
  expect(respuesta.status(), ruta).toBe(200)
  const html = await respuesta.text()
  return {
    html,
    title: todos(html, /<title>([^<]*)<\/title>/g),
    description: todos(html, /<meta\s+name="description"\s+content="([^"]*)"/g),
    ogTitle: todos(html, /<meta\s+property="og:title"\s+content="([^"]*)"/g),
    ogDescription: todos(html, /<meta\s+property="og:description"\s+content="([^"]*)"/g),
    canonical: todos(html, /<link\s+rel="canonical"\s+href="([^"]*)"/g),
    lang: /<html\s+lang="([^"]*)"/.exec(html)?.[1] ?? null,
    charset: todos(html, /<meta\s+charset="([^"]*)"/g),
  }
}

test.describe('Metadatos del HTML publicado', () => {
  test('cada página lleva un solo título, una sola descripción y un solo canónico, y el resto de etiquetas dicen lo mismo', async ({
    request,
  }) => {
    for (const ruta of [
      '',
      'en',
      'zona/condesa',
      'lugar/cafele',
      'lugar/agave-grill',
      'lugar/sinforosa',
      'en/place/luka-anahuac',
      'info/acerca',
    ]) {
      const c = await cabecera(request, ruta)
      expect(c.title, ruta).toHaveLength(1)
      expect(c.description, ruta).toHaveLength(1)
      expect(c.canonical, ruta).toHaveLength(1)
      expect(c.charset, ruta).toEqual(['UTF-8'])
      // Lo que se ve al compartir el enlace es lo mismo que lee el buscador.
      expect(c.ogTitle, ruta).toEqual(c.title)
      expect(c.ogDescription, ruta).toEqual(c.description)
      expect(c.lang, ruta).toBe(ruta.startsWith('en') ? 'en' : 'es')
    }
  })

  test('la portada se presenta como una guía local para descubrir Zibatá, sin reducirla a restaurantes', async ({
    request,
  }) => {
    const es = await cabecera(request, '')
    expect(es.title[0]).toBe('Visit Zibatá · La guía local para descubrir Zibatá')
    expect(es.description[0]).toContain('negocios y lugares de cada plaza')
    const en = await cabecera(request, 'en')
    expect(en.title[0]).toBe('Visit Zibatá · The local guide to discovering Zibatá')
    expect(en.description[0]).toContain('businesses and places')
    for (const texto of [es.title[0], es.description[0], en.title[0], en.description[0]]) {
      expect(texto).not.toMatch(/restaurant/i)
    }
  })

  test('dos locales de una misma cadena tienen título y descripción distintos', async ({
    request,
  }) => {
    const [a, b] = await Promise.all([
      cabecera(request, 'lugar/sinforosa'),
      cabecera(request, 'lugar/sinforosa-anahuac'),
    ])
    expect(a.title[0]).toBe('Sinforosa Café en Paseo Zibatá · Visit Zibatá')
    expect(b.title[0]).toBe('Sinforosa Café en Anáhuac Querétaro · Visit Zibatá')
    expect(a.description[0]).not.toBe(b.description[0])
    // Y un local cuyo nombre no se repite conserva su título de siempre.
    expect((await cabecera(request, 'lugar/cafele')).title[0]).toBe('Cafele · Visit Zibatá')
  })

  test('una ficha reabierta ya no muestra el aviso de cierre', async ({ request }) => {
    const agave = await cabecera(request, 'lugar/agave-grill')
    expect(agave.description[0]).not.toMatch(/^Cerrado temporalmente/)
    const sitemap = await (await request.get('sitemap.xml')).text()
    const entrada = /<loc>[^<]*\/lugar\/agave-grill<\/loc><lastmod>([^<]*)<\/lastmod>/.exec(sitemap)
    expect(entrada?.[1]).toBeDefined()
  })

  test('el enlace de WhatsApp del HTML servido apunta a wa.me y no a una ruta relativa', async ({
    request,
  }) => {
    const { html } = await cabecera(request, 'lugar/masaru')
    expect(html).toContain('href="https://wa.me/524426028627"')
    expect(html).not.toContain('href="+')
  })

  test('los caracteres especiales llegan enteros al HTML', async ({ request }) => {
    for (const [ruta, esperado] of [
      ['lugar/nam-nam', 'Ñam Ñam Sushi'],
      ['lugar/mykona-frozen-yogurt', 'Myköna Frozen Yogurt'],
      ['lugar/birria-jauregui', 'Birria Jáuregui'],
      ['lugar/burger-fries', 'Burger & Fries Forever'],
    ] as const) {
      const c = await cabecera(request, ruta)
      expect(c.title[0], ruta).toContain(esperado)
      // El `&` va escapado en el HTML y se lee como `&`, no como `&amp;` ni doblemente escapado.
      expect(c.html, ruta).not.toMatch(/&amp;amp;|&amp;#|�|Ã|â€/)
    }
  })

  test('en todas las páginas del sitemap, los títulos y las descripciones no se repiten dentro de un idioma', async ({
    request,
  }) => {
    const sitemap = await (await request.get('sitemap.xml')).text()
    // Relativas a la base: `request.get` ya parte de ella, y con una subruta (`/visit-zibata/`) dejarla
    // dentro de la ruta la duplicaría.
    const base = (process.env.BASE_PATH ?? '/').replace(/^\/|\/$/g, '')
    const rutas = [...sitemap.matchAll(/<loc>(?:https?:\/\/[^/]+)?\/([^<]*)<\/loc>/g)].map((m) =>
      (m[1] ?? '').replace(new RegExp(`^${base}/?`), ''),
    )
    // 234 de siempre y las de categoría: el número exacto lo fija seo-regresion.spec.ts contra los datos.
    expect(rutas.length).toBeGreaterThan(234)
    const vistos = { es: new Map<string, string>(), en: new Map<string, string>() }
    const repetidos: string[] = []
    for (const ruta of rutas) {
      const c = await cabecera(request, ruta)
      expect(c.title, ruta).toHaveLength(1)
      expect(c.description, ruta).toHaveLength(1)
      expect(c.description[0], ruta).not.toMatch(/[\n\r]|\s{2,}/)
      const idioma = ruta === 'en' || ruta.startsWith('en/') ? 'en' : 'es'
      for (const [campo, valor] of [
        ['title', c.title[0]],
        ['description', c.description[0]],
      ] as const) {
        const clave = `${campo}:${(valor ?? '').toLowerCase()}`
        const antes = vistos[idioma].get(clave)
        if (antes) repetidos.push(`${antes} y ${ruta} (${campo})`)
        else vistos[idioma].set(clave, ruta)
      }
    }
    expect(repetidos).toEqual([])
  })
})
