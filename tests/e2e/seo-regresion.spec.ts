import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { MIN_INDEXABLE } from '../../scripts/build/categorias.ts'
import { bloquea } from '../../scripts/build/robots.ts'

/**
 * Regresión SEO sobre lo que el build **realmente escribió** en `dist/`: el sitemap, el HTML de cada
 * página y los archivos a los que enlazan. Nada está escrito a mano: las páginas esperadas salen de
 * `data/commercial` y el resto, de los propios archivos generados.
 *
 * ## Cómo se ejecuta
 *
 * ```bash
 * npm run build            # las pruebas leen dist/, que tiene que ser de este código
 * npm run test:seo         # esta suite + las de generación + las de metadatos y fragmentos
 * ```
 *
 * Para comprobar también que canónicos, sitemap y `robots.txt` salen **absolutos** (como en producción),
 * compila con la URL pública:
 *
 * ```bash
 * SITE_URL=https://visitzibata.com/ npm run build          # bash
 * $env:SITE_URL='https://visitzibata.com/'; npm run build  # PowerShell
 * ```
 *
 * Sin `SITE_URL` las rutas salen relativas y esas comprobaciones se limitan a que sean coherentes entre
 * sí. Con `BASE_PATH` (subruta) se descuenta la base antes de buscar los archivos.
 *
 * ## Qué cubre cada punto del encargo (y dónde está lo demás)
 *
 * | Comprobación | Dónde |
 * | --- | --- |
 * | Build | `npm run build` (la suite falla si falta `dist/`) |
 * | Título, descripción, canónico, `og:*` únicos | `metadatos.spec.ts` y aquí (todas las páginas) |
 * | Un solo `h1` | aquí, en el HTML servido y en el DOM ya renderizado |
 * | Sitemap válido, sin duplicados, sin páginas que falten | aquí |
 * | Canónico = URL del sitemap, `hreflang` recíproco | aquí |
 * | Enlaces internos y recursos rotos | aquí |
 * | Codificación y acentos | aquí y `metadatos.spec.ts` |
 * | Contenido principal en el HTML servido | aquí y `sin-javascript.spec.ts` |
 * | Zonas, fichas e información en el alcance | aquí (contra `data/commercial`) |
 * | Categorías | aquí: no existen páginas de categoría, se fija lo que pasa con `?categoria=` |
 * | Plantillas con datos distintos | `scripts/build/crecimiento.test.ts` (Vitest, datos en memoria) |
 * | Mapa 3D y rutas de navegación | `map.spec.ts`, `places.spec.ts`, `search.spec.ts`, `responsive.spec.ts` |
 *
 * ## Qué NO demuestra (y posibles falsos positivos)
 *
 * - **No dice si Google indexará una página ni qué fragmento mostrará.** La meta descripción es una
 *   sugerencia; el título y el fragmento los decide Google.
 * - **Lee archivos, no el sitio publicado.** Una cabecera, una redirección o una regla de Cloudflare no
 *   se ven aquí. `vite preview` no es el hosting real.
 * - **Los enlaces rotos se buscan solo entre páginas del sitio.** Un enlace externo caído (la web de un
 *   local, Instagram) no se comprueba: sería una prueba que falla por culpa de un tercero.
 * - **Falso positivo posible:** un `href` interno legítimo que el servidor resuelva con una regla que no
 *   sea un archivo (una redirección). Hoy no hay ninguno; si se añade, hay que listarlo en `RESUELTOS`.
 * - Se ejecuta solo en el proyecto `desktop`: lee archivos y no depende del dispositivo.
 */

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url))
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/')

// biome-ignore lint/correctness/noEmptyPattern: Playwright exige desestructurar el primer argumento.
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'lee archivos de dist/, no depende del dispositivo',
  )
})

const leer = (relativo: string) => readFileSync(join(DIST, relativo), 'utf8')

const dato = <T>(archivo: string): T =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../data/commercial/${archivo}`, import.meta.url)),
      'utf8',
    ),
  ) as T
const lugares = dato<{
  places: { id: string; slug: string; active: boolean; giros: string[]; secundarios?: string[] }[]
}>('places.json').places
const categorias = dato<{
  categories: { id: string; slug: { es: string; en: string }; giros: { id: string }[] }[]
}>('categories.json').categories
const girosDe = (lugar: { giros: string[]; secundarios?: string[] }) => [
  ...lugar.giros,
  ...(lugar.secundarios ?? []),
]
/** Cuántos locales tiene una categoría, con la misma regla que el filtro de la aplicación. */
const localesDe = (categoria: (typeof categorias)[number]): number =>
  lugares.filter((lugar) =>
    girosDe(lugar).some((giro) => categoria.giros.some((g) => g.id === giro)),
  ).length
/** Las que se ofrecen a los buscadores: con locales de sobra. El resto existe, pero con `noindex`. */
const categoriasIndexables = (idioma: 'es' | 'en') =>
  new Set(
    categorias
      .filter((categoria) => localesDe(categoria) >= MIN_INDEXABLE)
      .map((categoria) => categoria.slug[idioma]),
  )
const categoriasConLocales = new Set([...categoriasIndexables('es'), ...categoriasIndexables('en')])
const zonas = dato<{ plazas: { id: string; slug: string; active: boolean }[] }>(
  'plazas.json',
).plazas

/** Quita el origen y la base: `https://x.com/visit-zibata/lugar/a` -> `/lugar/a`. */
function rutaDe(direccion: string): string {
  const sinOrigen = direccion.replace(/^https?:\/\/[^/]+/, '')
  const sinBase = sinOrigen.startsWith(BASE) ? `/${sinOrigen.slice(BASE.length)}` : sinOrigen
  return sinBase.split(/[?#]/)[0] || '/'
}

/** El archivo que sirve una ruta del sitio, o `null` si no hay ninguno. Igual que el hosting. */
function archivoDe(ruta: string): string | null {
  const limpia = ruta.replace(/\/+$/, '') || '/'
  const candidatos =
    limpia === '/'
      ? ['index.html']
      : [limpia.slice(1), `${limpia.slice(1)}.html`, `${limpia.slice(1)}/index.html`]
  // Un directorio no es un archivo: `/zona` no es una página porque exista la carpeta `zona/`.
  return candidatos.find((candidato) => esArchivo(join(DIST, candidato))) ?? null
}

function esDirectorio(ruta: string): boolean {
  try {
    return statSync(ruta).isDirectory()
  } catch {
    return false
  }
}

function esArchivo(ruta: string): boolean {
  try {
    return statSync(ruta).isFile()
  } catch {
    return false
  }
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

const sitemap = leer('sitemap.xml')
const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => decodificar(m[1] ?? ''))

interface Pagina {
  loc: string
  ruta: string
  archivo: string
  html: string
}

/** El origen público si el build lo trae (SITE_URL), para tratar sus enlaces como internos. */
const ORIGEN = locs.find((loc) => /^https?:\/\//.test(loc)) ? new URL(locs[0] ?? '').origin : null
const esExterno = (href: string) =>
  /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(href) && !(ORIGEN && href.startsWith(ORIGEN))

const paginas: Pagina[] = locs.map((loc) => {
  const ruta = rutaDe(loc)
  const archivo = archivoDe(ruta) ?? ''
  return { loc, ruta, archivo, html: archivo ? leer(archivo) : '' }
})

const etiqueta = (html: string, patron: RegExp) =>
  [...html.matchAll(patron)].map((m) => decodificar(m[1] ?? ''))

test.describe('Sitemap', () => {
  test('es XML bien formado, con una sola entrada por URL y sin duplicados', () => {
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(sitemap.trimEnd().endsWith('</urlset>')).toBe(true)
    const abre = sitemap.match(/<url>/g)?.length ?? 0
    expect(sitemap.match(/<\/url>/g)?.length).toBe(abre)
    expect(locs).toHaveLength(abre)
    expect(new Set(locs).size, 'URL repetida en el sitemap').toBe(locs.length)
    // Un `&` sin escapar rompe el XML entero.
    expect(sitemap).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#)/)
  })

  test('toda URL tiene su archivo en dist/, y ninguna es la 404 ni una página que no exista', () => {
    for (const pagina of paginas) {
      expect(pagina.archivo, `no hay archivo para ${pagina.loc}`).not.toBe('')
      expect(pagina.archivo, pagina.loc).not.toBe('404.html')
    }
  })

  test('las URLs son coherentes: todas absolutas con el mismo origen https, o todas relativas', () => {
    const absolutas = locs.filter((loc) => /^https?:\/\//.test(loc))
    if (absolutas.length === 0) {
      for (const loc of locs) expect(loc.startsWith('/'), loc).toBe(true)
      return
    }
    expect(absolutas).toHaveLength(locs.length)
    const origenes = new Set(locs.map((loc) => new URL(loc).origin))
    expect(origenes.size).toBe(1)
    expect([...origenes][0]).toMatch(/^https:\/\//)
    for (const loc of locs) expect(loc, 'ni parámetros ni almohadilla').not.toMatch(/[?#]/)
  })

  test('lastmod, cuando está, es una fecha real', () => {
    for (const [, fecha] of sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)) {
      expect(fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(fecha ?? ''))).toBe(false)
    }
  })

  test('hay una página por cada zona activa y cada local activo, en los dos idiomas', () => {
    const rutas = new Set(paginas.map((pagina) => pagina.ruta))
    for (const lugar of lugares.filter((p) => p.active)) {
      expect(rutas.has(`/lugar/${lugar.slug}`), `falta /lugar/${lugar.slug}`).toBe(true)
      expect(rutas.has(`/en/place/${lugar.slug}`), `falta /en/place/${lugar.slug}`).toBe(true)
    }
    for (const zona of zonas.filter((p) => p.active)) {
      expect(rutas.has(`/zona/${zona.slug}`), `falta /zona/${zona.slug}`).toBe(true)
      expect(rutas.has(`/en/area/${zona.slug}`), `falta /en/area/${zona.slug}`).toBe(true)
    }
    for (const idioma of ['es', 'en'] as const) {
      for (const categoria of categorias) {
        const slug = categoria.slug[idioma]
        const ruta = idioma === 'es' ? `/categoria/${slug}` : `/en/category/${slug}`
        const nLocales = localesDe(categoria)
        if (nLocales === 0) {
          expect(
            rutas.has(ruta),
            `${ruta}: no debería estar en el sitemap si no tiene locales`,
          ).toBe(false)
        }
      }
      // Las páginas de categoría en el sitemap deben pertenecer a categorías con al menos 1 local
      for (const ruta of locs) {
        const match = ruta.match(/^\/(?:en\/category|categoria)\/(.+)$/)
        if (match) {
          const slug = match[1]
          const categoria = categorias.find((c) => c.slug[idioma] === slug)
          if (categoria) {
            expect(
              localesDe(categoria),
              `${ruta}: pertenece a una categoría con al menos un local`,
            ).toBeGreaterThan(0)
          }
        }
      }
    }
    expect(rutas.has('/'), 'falta la portada').toBe(true)
    expect(rutas.has('/en'), 'falta la portada en inglés').toBe(true)
  })

  test('nada que no esté en los datos: ni locales ni zonas inactivas, ni rutas desconocidas', () => {
    const activos = new Set(lugares.filter((p) => p.active).map((p) => p.slug))
    const zonasActivas = new Set(zonas.filter((p) => p.active).map((p) => p.slug))
    for (const { ruta } of paginas) {
      const lugar = /^\/(?:en\/place|lugar)\/(.+)$/.exec(ruta)?.[1]
      const zona = /^\/(?:en\/area|zona)\/(.+)$/.exec(ruta)?.[1]
      const categoria = /^\/(?:en\/category|categoria)\/(.+)$/.exec(ruta)?.[1]
      if (lugar) expect(activos.has(lugar), `${ruta} no es un local activo`).toBe(true)
      else if (zona) expect(zonasActivas.has(zona), `${ruta} no es una zona activa`).toBe(true)
      else if (categoria) {
        expect(categoriasConLocales.has(categoria), `${ruta} no llega al umbral`).toBe(true)
      } else expect(ruta, 'ruta fuera de las conocidas').toMatch(/^\/(en)?$|^\/(en\/)?info\//)
    }
  })

  test('los dos idiomas tienen el mismo número de páginas', () => {
    const en = paginas.filter((pagina) => pagina.ruta === '/en' || pagina.ruta.startsWith('/en/'))
    expect(en.length * 2).toBe(paginas.length)
  })

  test('robots.txt permite rastrear y, si el sitio tiene URL pública, apunta al sitemap', () => {
    const robots = leer('robots.txt')
    expect(robots).toMatch(/^User-agent: \*$/m)
    expect(robots).not.toMatch(/^Disallow:\s*\/\s*$/m)
    if (locs.some((loc) => /^https?:\/\//.test(loc))) {
      expect(robots).toMatch(/^Sitemap: https:\/\/[^\s]+\/sitemap\.xml$/m)
    }
  })

  test('robots.txt bloquea el filtro de categoría de una zona y ninguna página del sitemap', () => {
    const reglas = leer('robots.txt')
      .split(/\r?\n/)
      .filter((linea) => linea.startsWith('Disallow: '))
      .map((linea) => linea.slice('Disallow: '.length))
    const bloqueada = (ruta: string) => reglas.some((regla) => bloquea(regla, ruta))
    // El filtro dentro de una zona, que las cápsulas enlazan, es lo que no se debe rastrear.
    expect(bloqueada(`${BASE}zona/condesa?categoria=italiana`)).toBe(true)
    expect(bloqueada(`${BASE}en/area/condesa?category=italian`)).toBe(true)
    // Y ninguna dirección del sitemap, ni la portada con el parámetro antiguo, queda bloqueada.
    expect(locs.length).toBeGreaterThan(0)
    for (const loc of locs)
      expect(bloqueada(rutaDe(loc) === '/' ? BASE : `${BASE}${rutaDe(loc).slice(1)}`), loc).toBe(
        false,
      )
    expect(bloqueada(`${BASE}?categoria=italiana`)).toBe(false)
  })
})

test.describe('Las páginas de categoría', () => {
  const archivoDeCategoria = (idioma: 'es' | 'en', slug: string) =>
    idioma === 'es' ? `categoria/${slug}.html` : `en/category/${slug}.html`

  test('toda categoría con locales tiene su página en los dos idiomas, con sus etiquetas una sola vez', () => {
    for (const idioma of ['es', 'en'] as const) {
      for (const categoria of categorias.filter((c) => localesDe(c) > 0)) {
        const archivo = archivoDeCategoria(idioma, categoria.slug[idioma])
        const html = leer(archivo)
        for (const [nombre, patron] of [
          ['title', /<title>/g],
          ['description', /<meta\s+name="description"/g],
          ['canonical', /<link\s+rel="canonical"/g],
          ['h1', /<h1[\s>]/g],
        ] as const) {
          expect(html.match(patron)?.length ?? 0, `${nombre} en ${archivo}`).toBe(1)
        }
        expect(html, archivo).not.toMatch(/undefined|NaN|\bnull\b/)
      }
    }
  })

  test('las categorías con al menos un local están indexables; las de 0 locales no tienen página', () => {
    let sinPagina = 0
    let conPagina = 0
    for (const idioma of ['es', 'en'] as const) {
      for (const categoria of categorias) {
        const slug = categoria.slug[idioma]
        const ruta = idioma === 'es' ? `/categoria/${slug}` : `/en/category/${slug}`
        const archivo = archivoDe(ruta)
        const nLocales = localesDe(categoria)
        if (nLocales === 0) {
          expect(archivo, `${slug}: no debería tener página HTML`).toBeNull()
          sinPagina += 1
        } else {
          expect(archivo, `${slug}: debería tener página HTML`).not.toBeNull()
          const html = leer(archivo as string)
          const robots = etiqueta(html, /<meta\s+name="robots"\s+content="([^"]*)"/g)
          expect(robots, `${slug}: sin noindex`).toEqual([]) // sin noindex, es indexable
          conPagina += 1
        }
      }
    }
    expect(sinPagina).toBeGreaterThan(0) // al menos una categoría sin locales
    expect(conPagina).toBeGreaterThan(0) // al menos una categoría con locales tiene página
  })

  test('una categoría sin locales no tiene página HTML', () => {
    for (const categoria of categorias.filter((c) => localesDe(c) === 0)) {
      const ruta = `/categoria/${categoria.slug.es}`
      expect(archivoDe(ruta), ruta).toBeNull()
    }
  })
})

test.describe('Cada página del sitemap', () => {
  test('un título, una descripción, un canónico y un h1, todos con texto', () => {
    for (const { loc, html } of paginas) {
      const titulos = etiqueta(html, /<title>([^<]*)<\/title>/g)
      const descripciones = etiqueta(html, /<meta\s+name="description"\s+content="([^"]*)"/g)
      const canonicos = etiqueta(html, /<link\s+rel="canonical"\s+href="([^"]*)"/g)
      expect(titulos, `title en ${loc}`).toHaveLength(1)
      expect(descripciones, `description en ${loc}`).toHaveLength(1)
      expect(canonicos, `canonical en ${loc}`).toHaveLength(1)
      expect(titulos[0]?.trim().length, `title vacío en ${loc}`).toBeGreaterThan(0)
      expect(descripciones[0]?.trim().length, `description vacía en ${loc}`).toBeGreaterThan(0)
      expect(html.match(/<h1[\s>]/g)?.length, `h1 en ${loc}`).toBe(1)
      const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? ''
      expect(h1.replace(/<[^>]*>/g, '').trim().length, `h1 vacío en ${loc}`).toBeGreaterThan(0)
    }
  })

  test('el canónico es la propia URL del sitemap, y ninguna página dice noindex', () => {
    for (const { loc, html } of paginas) {
      const canonico = etiqueta(html, /<link\s+rel="canonical"\s+href="([^"]*)"/g)[0]
      expect(canonico, loc).toBe(loc)
      const robots = etiqueta(html, /<meta\s+name="robots"\s+content="([^"]*)"/g)
      for (const valor of robots) expect(valor, loc).not.toMatch(/noindex/i)
    }
  })

  test('los metadatos no se duplican de forma involuntaria', () => {
    for (const { loc, html } of paginas) {
      for (const patron of [
        /<meta\s+charset=/g,
        /<meta\s+name="viewport"/g,
        /<meta\s+property="og:title"/g,
        /<meta\s+property="og:description"/g,
        /<meta\s+property="og:url"/g,
      ]) {
        expect(html.match(patron)?.length ?? 0, `${patron} en ${loc}`).toBeLessThanOrEqual(1)
      }
      // Varios iconos son normales (svg y png de varios tamaños); el mismo dos veces, no.
      const iconos = [...html.matchAll(/<link\s+rel="icon"[^>]*?href="([^"]*)"/g)].map((m) => m[1])
      expect(new Set(iconos).size, `icono repetido en ${loc}`).toBe(iconos.length)
      // `og:url`, si está, coincide con el canónico.
      const ogUrl = etiqueta(html, /<meta\s+property="og:url"\s+content="([^"]*)"/g)[0]
      if (ogUrl)
        expect(ogUrl, loc).toBe(etiqueta(html, /<link\s+rel="canonical"\s+href="([^"]*)"/g)[0])
    }
  })

  test('los hreflang son recíprocos: cada idioma apunta al otro y el otro le responde', () => {
    const porRuta = new Map(paginas.map((pagina) => [pagina.ruta, pagina]))
    for (const { loc, ruta, html } of paginas) {
      const alternos = new Map(
        [...html.matchAll(/<link\s+rel="alternate"\s+hreflang="([^"]*)"\s+href="([^"]*)"/g)].map(
          (m) => [m[1] ?? '', decodificar(m[2] ?? '')] as const,
        ),
      )
      const esEn = ruta === '/en' || ruta.startsWith('/en/')
      const otro = alternos.get(esEn ? 'es' : 'en')
      expect(otro, `${loc} no declara su versión en ${esEn ? 'español' : 'inglés'}`).toBeDefined()
      const destino = porRuta.get(rutaDe(otro ?? ''))
      expect(destino, `${loc} apunta a una página que no está en el sitemap: ${otro}`).toBeDefined()
      const vuelta = [
        ...(destino?.html ?? '').matchAll(
          /<link\s+rel="alternate"\s+hreflang="([^"]*)"\s+href="([^"]*)"/g,
        ),
      ].map((m) => decodificar(m[2] ?? ''))
      expect(vuelta, `${destino?.loc} no devuelve a ${loc}`).toContain(loc)
    }
  })

  test('el contenido principal está en el HTML servido, sin esperar a JavaScript', () => {
    for (const { loc, html } of paginas) {
      const cuerpo = /<article class="estatico">([\s\S]*?)<\/article>/.exec(html)?.[1]
      expect(cuerpo, `sin contenido servido en ${loc}`).toBeDefined()
      const texto = (cuerpo ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      expect(texto.length, `contenido servido casi vacío en ${loc}`).toBeGreaterThan(60)
    }
  })

  test('los datos estructurados de cada página son JSON válido con @context y @type', () => {
    for (const { loc, html } of paginas) {
      for (const [, crudo] of html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      )) {
        let datos: Record<string, unknown>
        try {
          datos = JSON.parse(crudo ?? '') as Record<string, unknown>
        } catch {
          throw new Error(`JSON-LD inválido en ${loc}`)
        }
        expect(datos['@context'], loc).toBe('https://schema.org')
        expect(datos['@type'] ?? datos['@graph'], loc).toBeDefined()
      }
    }
  })
})

test.describe('Codificación y texto', () => {
  test('ninguna página tiene texto mal codificado ni caracteres de sustitución', () => {
    const rotos = [/Ã[\u0080-¿¡-ÿ]/, /â€[\u0080-¿™œ“”˜]?/, /�/, /Â[ -¿]/]
    for (const { loc, html } of paginas) {
      for (const patron of rotos) {
        expect(patron.test(html), `${patron} en ${loc}`).toBe(false)
      }
      expect(html.startsWith('﻿'), `BOM al principio de ${loc}`).toBe(false)
      expect(html, `charset de ${loc}`).toMatch(/<meta\s+charset="utf-8"/i)
    }
  })

  test('ni "undefined", "null" ni "NaN" se cuelan como texto, y no hay atributos vacíos', () => {
    for (const { loc, html } of paginas) {
      const visible = html
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<[^>]*>/g, ' ')
      expect(visible, `valor sin resolver en ${loc}`).not.toMatch(/\b(undefined|null|NaN)\b/)
      expect(html, `href vacío en ${loc}`).not.toMatch(/href=""/)
      expect(html, `content vacío en ${loc}`).not.toMatch(/<meta\s+name="description"\s+content=""/)
    }
  })

  test('los nombres con ñ, tildes y diéresis llegan enteros', () => {
    const conAcentos = paginas.filter((pagina) => /[ñáéíóúü]/i.test(pagina.html))
    expect(conAcentos.length).toBeGreaterThan(0)
    // Una entidad numérica donde debería haber una letra es señal de un escapado de más.
    for (const { loc, html } of conAcentos) {
      expect(html, loc).not.toMatch(/&#(?:225|233|237|243|250|241|193|201|205|211|218|209);/)
    }
  })
})

test.describe('Enlaces internos y recursos', () => {
  test('todo enlace interno de las 234 páginas lleva a un archivo que existe', () => {
    const rotos: string[] = []
    for (const { loc, html } of paginas) {
      for (const [, destino] of html.matchAll(/<a\s[^>]*?href="([^"]*)"/g)) {
        const href = decodificar(destino ?? '')
        if (esExterno(href)) continue
        const ruta = rutaDe(href.startsWith('/') || /^https?:/i.test(href) ? href : `/${href}`)
        if (!archivoDe(ruta)) rotos.push(`${loc} -> ${href}`)
      }
    }
    expect(rotos, `enlaces rotos:\n${rotos.slice(0, 15).join('\n')}`).toEqual([])
  })

  test('los scripts, hojas de estilo e imágenes que declara cada página existen', () => {
    const rotos: string[] = []
    const vistos = new Set<string>()
    for (const { loc, html } of paginas) {
      for (const [, destino] of html.matchAll(
        /<(?:script|link|img)\s[^>]*?(?:src|href)="([^"]*)"/g,
      )) {
        const href = decodificar(destino ?? '')
        if (esExterno(href)) continue
        const ruta = rutaDe(href)
        if (vistos.has(ruta)) continue
        vistos.add(ruta)
        if (!archivoDe(ruta)) rotos.push(`${loc} -> ${href}`)
      }
    }
    expect(rotos, `recursos que faltan:\n${rotos.slice(0, 15).join('\n')}`).toEqual([])
  })

  test('la imagen social de cada página existe', () => {
    // Las imágenes de vista previa de cada local (`/og/{slug}.jpg`) no las escribe el build: las genera
    // `npm run images:og-places` después, con Chromium, y solo la publicación las deja en dist/. Aquí se
    // exige que apunten al slug de su propia página y, si ya se generaron, que existan; el resto de
    // imágenes (la general, la de marca) tienen que estar siempre.
    const generadas = esDirectorio(join(DIST, 'og'))
    for (const { loc, ruta, html } of paginas) {
      const imagen = etiqueta(html, /<meta\s+property="og:image"\s+content="([^"]*)"/g)[0]
      if (!imagen) continue
      const destino = rutaDe(imagen)
      if (destino.startsWith('/og/')) {
        const slug = /^\/(?:en\/place|lugar)\/(.+)$/.exec(ruta)?.[1]
        expect(destino, `og:image de ${loc}`).toBe(`/og/${slug}.jpg`)
        if (generadas) expect(archivoDe(destino), `falta ${destino} (${loc})`).not.toBeNull()
        continue
      }
      expect(archivoDe(destino), `og:image de ${loc}: ${imagen}`).not.toBeNull()
    }
  })
})

test.describe('Lo que no existe y debe seguir sin existir (o avisar)', () => {
  test('el filtro de una zona (?categoria=) sigue sirviendo la zona con el canónico de la zona', async ({
    request,
  }) => {
    // Dentro de una zona la categoría es un filtro, no una página: su canónico es el de la zona. La
    // redirección de `/?categoria=x` a la página de la categoría la hace el Worker (worker/redireccion.ts),
    // que `vite preview` no tiene: se prueba aparte, con sus pruebas unitarias.
    const canonico = (html: string) =>
      etiqueta(html, /<link\s+rel="canonical"\s+href="([^"]*)"/g)[0]
    const filtrada = await request.get(`${BASE}zona/condesa?categoria=italiana`)
    const zonaSola = await request.get(`${BASE}zona/condesa`)
    expect(filtrada.status()).toBe(200)
    expect(canonico(await filtrada.text())).toBe(canonico(await zonaSola.text()))
    expect(
      locs.some((loc) => loc.includes('?')),
      'el sitemap lista una URL con parámetros',
    ).toBe(false)
  })

  test('una ruta que no existe responde con la 404 propia, no con 200', async ({ request }) => {
    const respuesta = await request.get(`${BASE}lugar/no-existe-este-local`)
    expect(respuesta.status()).toBe(404)
    // El cuerpo que sirve el hosting es dist/404.html: `vite preview` no lo devuelve a `request`.
    expect(leer('404.html')).toMatch(/<meta\s+name="robots"\s+content="noindex/i)
    expect(locs.some((loc) => loc.includes('404'))).toBe(false)
  })
})

test.describe('Estructura ya renderizada', () => {
  /*
   * Google indexa el DOM que queda cuando React toma el control, no el HTML servido. Así que el `h1`
   * de la página ya renderizada tiene que ser el mismo que trae el archivo: el nombre del local, el de
   * la zona, el de la categoría o el de la página de información. Es texto escondido a la vista, así que
   * no cambia lo que se ve. Mientras el catálogo carga, el `h1` es el lema de la marca.
   */
  const rutas = [
    '',
    'en',
    'zona/condesa',
    'en/area/condesa',
    'lugar/bendito-bocado',
    'en/place/bendito-bocado',
    'categoria/italiana',
    'en/category/italian',
    'categoria/botanas',
    'info/privacidad',
    'en/info/privacy',
    // Un filtro dentro de una zona sigue siendo la zona.
    'zona/condesa?categoria=italiana',
  ]
  for (const ruta of rutas) {
    test(`/${ruta}: un solo h1, y es el mismo que sirve el archivo`, async ({ page }) => {
      const archivo = archivoDe(rutaDe(`${BASE}${ruta}`))
      expect(archivo, `no hay archivo para /${ruta}`).not.toBeNull()
      const servido = decodificar(
        (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(leer(archivo ?? ''))?.[1] ?? '').replace(/<[^>]*>/g, ''),
      ).trim()
      expect(servido.length).toBeGreaterThan(0)

      await page.addInitScript(() => window.localStorage.setItem('zibata:onboarding-visto', '1'))
      await page.goto(`${BASE}${ruta}`)
      const h1 = page.locator('h1')
      await expect(h1).toHaveCount(1)
      await expect(h1).toHaveText(servido)
    })
  }
})
