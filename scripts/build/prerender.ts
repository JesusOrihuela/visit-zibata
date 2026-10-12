/**
 * Una página real por ruta y por idioma, con sus propios metadatos. Más `sitemap.xml` y `robots.txt`.
 *
 * Es lo que hace posible el SEO y las vistas previas al compartir. El motivo es tajante: los robots
 * de Google, WhatsApp o Facebook **no ejecutan JavaScript**, así que leen el HTML tal cual llega del
 * servidor. Con una sola página para todo el sitio, cada enlace compartido mostraba el título y la
 * imagen de la portada, daba igual el lugar.
 *
 * Nada de esto se escribe a mano. Las páginas se derivan de `data/commercial/*.json` en cada
 * compilación, así que añadir un local, cambiarle el nombre o ponerle una foto se refleja solo en la
 * siguiente publicación.
 *
 * Para la persona no cambia nada: las 232 páginas cargan exactamente la misma aplicación. Lo único
 * distinto es lo que hay dentro del `<head>` antes de que arranque.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'
import { en } from '../../src/i18n/en.ts'
import { es } from '../../src/i18n/es.ts'
import { buildPath, INFO_TOPICS, type InfoTopic } from '../../src/lib/url-state.ts'
import type { Category, Place, Plaza } from '../../src/types/domain.ts'
import { bloque, listado, negocio } from './structured-data.ts'

type Locale = 'es' | 'en'
const LOCALES: Locale[] = ['es', 'en']
const CATALOGS = { es, en }

/** Una página lógica: la misma en los dos idiomas, para poder enlazarlas con `hreflang`. */
interface Page {
  /** Ruta con base, tal como la escribe la aplicación. */
  href: string
  title: string
  description: string
  /** Imagen de vista previa, con base. Sin ella se usa la general del sitio. */
  image?: string
  /** Datos estructurados de esta página, ya con URLs absolutas. Las de información no llevan. */
  jsonLd?: Record<string, unknown>
  /**
   * Cuándo cambió de verdad el contenido de esta página, para el `lastmod` del sitemap.
   *
   * Sin esto, todas las URL llevaban la fecha del build, así que cada publicación le decía a Google
   * que las 234 páginas habían cambiado ese día. Google usa `lastmod` para decidir qué vale la pena
   * volver a rastrear, y cuando lo comprueba y no ha cambiado nada, deja de creerlo. Una fecha falsa
   * en todas las páginas es peor que ninguna fecha.
   *
   * Las fichas usan la última verificación de sus datos y las zonas la más reciente de sus locales.
   * Las de información y la portada no llevan: cambian con el código, no con el catálogo, y el
   * `lastmod` es opcional.
   */
  lastmod?: string
}

const text = (value: unknown, locale: Locale): string => {
  if (typeof value === 'string') return value
  const localized = value as { es: string; en?: string } | null
  if (!localized) return ''
  return (locale === 'en' ? localized.en : undefined) ?? localized.es
}

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '')

/** Meta description: una sola frase, sin cortar a media palabra. */
const trim = (value: string, max = 160): string => {
  const flat = value.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface Dataset {
  categories: Category[]
  plazas: Plaza[]
  places: Place[]
}

function pagesFor(
  locale: Locale,
  data: Dataset,
  base: string,
  ogDir: string,
  absolute: (href: string) => string,
): Page[] {
  const copy = CATALOGS[locale]
  const giroLabel = new Map<string, string>()
  const categoryOfGiro = new Map<string, Category>()
  for (const category of data.categories) {
    for (const giro of category.giros) {
      giroLabel.set(giro.id, text(giro.label, locale))
      categoryOfGiro.set(giro.id, category)
    }
  }
  const plazaById = new Map(data.plazas.map((plaza) => [plaza.id, plaza]))
  const route = (state: Partial<Parameters<typeof buildPath>[0]>) =>
    buildPath(
      { locale, plazaSlug: null, placeSlug: null, categorySlug: null, infoTopic: null, ...state },
      base,
    )
  const activePlazas = data.plazas.filter((plaza) => plaza.active)

  const pages: Page[] = [
    {
      href: route({}),
      title: copy['seo.home.title'],
      description: copy['seo.home.description'],
      // La portada lista sus zonas, que es su contenido real. Listar aquí los 101 locales sería
      // repetir en la raíz lo que cada zona ya dice de los suyos.
      jsonLd: listado(
        copy['seo.home.title'],
        activePlazas.map((plaza) => ({
          name: text(plaza.name, locale),
          url: absolute(route({ plazaSlug: plaza.slug })),
        })),
      ),
    },
  ]

  /** La verificación más reciente de un grupo de locales, o nada si ninguno la tiene. */
  const masReciente = (lugares: typeof data.places): string | undefined => {
    const fechas = lugares
      .map((lugar) => lugar.verification?.lastVerifiedAt)
      .filter((fecha): fecha is string => typeof fecha === 'string')
    return fechas.length > 0 ? fechas.reduce((a, b) => (a > b ? a : b)) : undefined
  }

  for (const plaza of activePlazas) {
    const name = text(plaza.name, locale)
    const deLaPlaza = data.places.filter((place) => place.plazaId === plaza.id)
    pages.push({
      href: route({ plazaSlug: plaza.slug }),
      lastmod: masReciente(deLaPlaza),
      title: fill(copy['seo.title'], { name }),
      description: trim(
        text(plaza.description, locale) || fill(copy['seo.plaza.fallback'], { name }),
      ),
      jsonLd: listado(
        name,
        data.places
          .filter((place) => place.plazaId === plaza.id)
          .map((place) => ({ name: place.name, url: absolute(route({ placeSlug: place.slug })) })),
      ),
    })
  }

  for (const place of data.places) {
    const plaza = plazaById.get(place.plazaId)
    const giros = place.giros.map((id) => giroLabel.get(id) ?? id)
    const image = `${ogDir}${place.slug}.jpg`
    pages.push({
      href: route({ placeSlug: place.slug }),
      lastmod: place.verification?.lastVerifiedAt,
      title: fill(copy['seo.title'], { name: place.name }),
      description: trim(
        text(place.description, locale) ||
          fill(copy['seo.place.fallback'], {
            giros: giros.join(', '),
            plaza: plaza ? text(plaza.name, locale) : 'Zibatá',
          }),
      ),
      image,
      jsonLd: negocio({
        place,
        plaza,
        category: categoryOfGiro.get(place.giros[0] ?? ''),
        giros,
        url: absolute(route({ placeSlug: place.slug })),
        plazaUrl: plaza?.active ? absolute(route({ plazaSlug: plaza.slug })) : undefined,
        image: absolute(image),
        locale,
      }),
    })
  }

  const INFO: Record<InfoTopic, { title: keyof typeof es; lead: keyof typeof es }> = {
    acerca: { title: 'about.title', lead: 'about.aboutLead' },
    privacidad: { title: 'about.privacyTitle', lead: 'about.privacyLead' },
    sugerir: { title: 'about.contribute', lead: 'about.contributeLead' },
    tutorial: { title: 'about.tutorialTitle', lead: 'about.tutorialLead' },
  }
  for (const topic of INFO_TOPICS) {
    const keys = INFO[topic]
    pages.push({
      href: route({ infoTopic: topic }),
      title: fill(copy['seo.title'], { name: String(copy[keys.title]) }),
      description: trim(String(copy[keys.lead])),
    })
  }
  return pages
}

/**
 * Localiza una etiqueta del `<head>` por uno de sus atributos.
 *
 * `\s+` y no un espacio literal: el `index.html` de origen está formateado, y las etiquetas largas
 * llevan sus atributos en líneas aparte. Un patrón escrito con un solo espacio no las encontraba, no
 * reemplazaba nada y `setTag` caía en su rama de "no estaba", así que cada página terminaba con dos
 * descripciones: la general de la portada y la suya. Salió publicado en las 232 de la v4.6.0.
 */
export const metaTag = (atributo: string, valor: string): RegExp =>
  new RegExp(`<meta\\s+${atributo}="${valor}"[^>]*/>`)

/** Reemplaza una etiqueta existente en el HTML, o la añade antes de `</head>` si no estaba. */
function setTag(html: string, pattern: RegExp, tag: string): string {
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace('</head>', `  ${tag}\n  </head>`)
}

/**
 * Ninguna de estas etiquetas puede salir dos veces. Es una comprobación barata sobre algo que ya
 * pasó: un patrón que deja de encajar no rompe nada visible, solo publica metadatos duplicados que
 * nadie mira hasta que un buscador elige la copia equivocada. Aquí rompe el build.
 */
function comprobarUnicas(html: string, href: string): void {
  const unicas: [string, RegExp][] = [
    ['description', /<meta\s+name="description"/g],
    ['og:description', /<meta\s+property="og:description"/g],
    ['og:title', /<meta\s+property="og:title"/g],
    ['og:url', /<meta\s+property="og:url"/g],
    ['og:image', /<meta\s+property="og:image"\s/g],
    ['canonical', /<link\s+rel="canonical"/g],
    ['title', /<title>/g],
  ]
  for (const [nombre, patron] of unicas) {
    const veces = html.match(patron)?.length ?? 0
    if (veces > 1) throw new Error(`${href}: "${nombre}" aparece ${veces} veces en el head`)
  }
}

export function prerender(options: { base: string; siteUrl?: string }): Plugin {
  const { base, siteUrl } = options
  return {
    name: 'zibata-prerender',
    apply: 'build',
    // `writeBundle` y no `generateBundle`: aquí el index.html ya está escrito en disco con todo lo
    // que le añaden los demás plugins (CSP, Open Graph), y es la plantilla de la que salen las demás.
    writeBundle(output) {
      const dist = output.dir ?? 'dist'
      const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T
      const data: Dataset = {
        categories: read<{ categories: Category[] }>('data/commercial/categories.json').categories,
        plazas: read<{ plazas: Plaza[] }>('data/commercial/plazas.json').plazas,
        places: read<{ places: Place[] }>('data/commercial/places.json').places,
      }
      const template = readFileSync(join(dist, 'index.html'), 'utf8')
      const ogDir = `${base}og/`
      // `href` ya lleva la base, y `siteUrl` es la raíz pública del despliegue, que también la
      // lleva (así la usan el resto de plugins). Si no se quitara antes de resolver, un sitio en
      // subdirectorio escribiría la base dos veces en cada `canonical` y en todo el sitemap.
      const absolute = (href: string) => {
        if (!siteUrl) return href
        const relative = href.startsWith(base) ? href.slice(base.length) : href.replace(/^\//, '')
        return new URL(relative, siteUrl).href
      }
      const byLocale = new Map(
        LOCALES.map((l) => [l, pagesFor(l, data, base, ogDir, absolute)] as const),
      )

      const written: { href: string; lastmod?: string }[] = []
      for (const locale of LOCALES) {
        const pages = byLocale.get(locale) ?? []
        pages.forEach((page, index) => {
          // La misma página en el otro idioma ocupa la misma posición: las listas se generan con el
          // mismo recorrido. De ahí salen las `hreflang` sin tener que emparejar por ruta.
          const alternates = LOCALES.map((other) => {
            const twin = byLocale.get(other)?.[index]
            return twin
              ? `<link rel="alternate" hreflang="${other}" href="${escapeHtml(absolute(twin.href))}" />`
              : ''
          })
          const spanish = byLocale.get('es')?.[index]
          if (spanish) {
            alternates.push(
              `<link rel="alternate" hreflang="x-default" href="${escapeHtml(absolute(spanish.href))}" />`,
            )
          }

          let html = template
            .replace('<html lang="es">', `<html lang="${locale}">`)
            .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`)
          html = setTag(
            html,
            metaTag('name', 'description'),
            `<meta name="description" content="${escapeHtml(page.description)}" />`,
          )
          html = setTag(
            html,
            metaTag('property', 'og:title'),
            `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
          )
          html = setTag(
            html,
            metaTag('property', 'og:description'),
            `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
          )
          html = setTag(
            html,
            metaTag('property', 'og:url'),
            `<meta property="og:url" content="${escapeHtml(absolute(page.href))}" />`,
          )
          html = setTag(
            html,
            metaTag('property', 'og:locale'),
            `<meta property="og:locale" content="${locale === 'en' ? 'en_US' : 'es_MX'}" />`,
          )
          if (page.image) {
            html = setTag(
              html,
              metaTag('property', 'og:image'),
              `<meta property="og:image" content="${escapeHtml(absolute(page.image))}" />`,
            )
          }
          html = setTag(
            html,
            /<link\s+rel="canonical"[^>]*\/>/,
            `<link rel="canonical" href="${escapeHtml(absolute(page.href))}" />`,
          )
          html = html.replace('</head>', `  ${alternates.filter(Boolean).join('\n  ')}\n  </head>`)
          if (page.jsonLd) {
            html = html.replace('</head>', `  ${bloque(page.jsonLd)}\n  </head>`)
          }
          comprobarUnicas(html, page.href)

          // Archivos planos (`lugar/tomassa.html`) y no carpetas con índice: así `/lugar/tomassa`
          // se sirve directo, mientras que una carpeta obligaría a redirigir a `/lugar/tomassa/`.
          // Un salto extra en cada enlace compartido, y una URL canónica distinta de la que se
          // comparte. La portada española es la raíz y sí es un índice.
          const relative = page.href.slice(base.length)
          const file = join(dist, relative === '' ? 'index.html' : `${relative}.html`)
          mkdirSync(dirname(file), { recursive: true })
          writeFileSync(file, html)
          written.push({ href: page.href, lastmod: page.lastmod })
        })
      }

      const urls = written
        .map((pagina) => {
          const loc = `<loc>${escapeHtml(absolute(pagina.href))}</loc>`
          // Sin `lastmod` cuando no se sabe. Es opcional en el formato, y omitirlo dice la verdad.
          const fecha = pagina.lastmod ? `<lastmod>${pagina.lastmod}</lastmod>` : ''
          return `  <url>${loc}${fecha}</url>`
        })
        .join('\n')
      writeFileSync(
        join(dist, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      )
      writeFileSync(
        join(dist, 'robots.txt'),
        `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${new URL('sitemap.xml', siteUrl).href}\n` : ''}`,
      )
      console.log(`✓ prerenderizado: ${written.length} páginas, sitemap y robots.txt`)
    },
  }
}
