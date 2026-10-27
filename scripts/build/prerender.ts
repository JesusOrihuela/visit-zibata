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
 * Desde la v4.16 cada página trae además su **contenido escrito** dentro de `<div id="root">`: el
 * nombre, los giros, la dirección, el horario, el contacto y enlaces de verdad a la zona y a los
 * locales vecinos (ver contenido.ts). Antes el cuerpo eran 193 bytes iguales en las 234, así que un
 * rastreador veía páginas vacías y sin enlaces entre ellas. React lo sustituye al montar.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'
import { en } from '../../src/i18n/en.ts'
import { es } from '../../src/i18n/es.ts'
import { whatsappUrl } from '../../src/lib/maps-url.ts'
import { buildPath, INFO_TOPICS, type InfoTopic } from '../../src/lib/url-state.ts'
import type { Category, Place, Plaza } from '../../src/types/domain.ts'
import {
  categoriasDe,
  conCantidad,
  girosDeCategoria,
  lugaresPorCategoria,
  lista as nombresEnLista,
} from './categorias.ts'
import { contenidoDeLista, contenidoDeLugar } from './contenido.ts'
import { descripcionDeFicha, lugarDe, repetidos } from './metadatos.ts'
import { robotsTxt } from './robots.ts'
import { bloque, listado, negocio } from './structured-data.ts'
import { repartirVecinos } from './vecinos.ts'

type Locale = 'es' | 'en'
const LOCALES: Locale[] = ['es', 'en']
const CATALOGS = { es, en }

/** Una página lógica: la misma en los dos idiomas, para poder enlazarlas con `hreflang`. */
interface Page {
  /** Ruta con base, tal como la escribe la aplicación. */
  href: string
  title: string
  description: string
  /** Imagen de vista previa, con base. Es la misma en todas las páginas y en los dos idiomas. */
  image: string
  /** Datos estructurados de esta página, ya con URLs absolutas. Las de información no llevan. */
  jsonLd?: Record<string, unknown>
  /**
   * El contenido escrito que va dentro de `<div id="root">`, antes de que arranque la aplicación.
   * React lo sustituye al montar (ver scripts/build/contenido.ts).
   */
  contenido?: string
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

/** Hasta dónde llega un título antes de que el buscador lo corte. */
const TOPE_TITULO = 65

/** Orden de la semana tal como se lee, no como lo guarda el JSON. */
const DIAS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/**
 * Los enlaces de contacto de un local, en el orden en que sirven.
 *
 * Solo los que existen: un local sin Instagram no debe mostrar un renglón vacío, y un enlace muerto
 * es peor que no tener enlace.
 */
function contactoDe(place: Place): { texto: string; href: string }[] {
  const enlaces: { texto: string; href: string }[] = []
  if (place.phone) enlaces.push({ texto: place.phone, href: `tel:${place.phone}` })
  if (place.googleMapsUri) enlaces.push({ texto: 'Google Maps', href: place.googleMapsUri })
  const redes: [keyof NonNullable<Place['links']>, string][] = [
    ['website', 'Sitio web'],
    ['instagram', 'Instagram'],
    ['facebook', 'Facebook'],
    ['tiktok', 'TikTok'],
    ['whatsapp', 'WhatsApp'],
    ['uberEats', 'Uber Eats'],
    ['rappi', 'Rappi'],
    ['didiFood', 'DiDi Food'],
  ]
  for (const [clave, nombre] of redes) {
    const url = place.links?.[clave]
    // `whatsapp` es un teléfono (E.164), no una URL: sin pasarlo por `wa.me` el enlace salía relativo.
    if (url) enlaces.push({ texto: nombre, href: clave === 'whatsapp' ? whatsappUrl(url) : url })
  }
  return enlaces
}

/**
 * "9 de octubre de 2026" / "9 October 2026".
 *
 * Se parte a mano en lugar de `new Date(fecha)`: una fecha sin hora se lee en UTC, y en Querétaro
 * eso es el día anterior. El mismo cuidado que en la ficha.
 */
const fechaLarga = (fecha: string, locale: Locale): string => {
  const [year, month, day] = fecha.split('-').map(Number)
  if (!year || !month || !day) return fecha
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, day),
  )
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface Dataset {
  categories: Category[]
  plazas: Plaza[]
  places: Place[]
}

export function pagesFor(
  locale: Locale,
  data: Dataset,
  base: string,
  absolute: (href: string) => string,
): Page[] {
  const copy = CATALOGS[locale]
  // Una imagen social por idioma, igual en todas las páginas de ese idioma (public/og-image.png y og-image-en.png): lleva escrito el
  // texto de la marca en su idioma, así que una ficha en inglés no se comparte con una imagen en español.
  const image = `${base}${locale === 'en' ? 'og-image-en.png' : 'og-image.png'}`
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

  /*
   * Cada categoría con algún local tiene su página (`/categoria/x`), y las desde donde se llega a ella
   * son un enlace de verdad en el HTML servido: la portada, cada zona y cada ficha. Sin esos enlaces
   * serían páginas huérfanas, que es lo que el sitemap solo no arregla.
   */
  const porCategoria = lugaresPorCategoria(data.places, categoryOfGiro)
  const categoriasConPagina = data.categories.filter(
    (categoria) => (porCategoria.get(categoria.id)?.length ?? 0) > 0,
  )
  const enlaceDeCategoria = (categoria: Category) => ({
    texto: text(categoria.label, locale),
    href: route({ categorySlug: categoria.slug[locale] }),
  })

  const pages: Page[] = [
    {
      href: route({}),
      title: copy['seo.home.title'],
      description: copy['seo.home.description'],
      image,
      // La portada lista sus zonas, que es su contenido real. Listar aquí los 101 locales sería
      // repetir en la raíz lo que cada zona ya dice de los suyos.
      jsonLd: listado(
        copy['seo.home.title'],
        activePlazas.map((plaza) => ({
          name: text(plaza.name, locale),
          url: absolute(route({ plazaSlug: plaza.slug })),
        })),
      ),
      contenido: contenidoDeLista({
        nombre: `${copy['app.name']} · ${copy['app.tagline']}`,
        descripcion: trim(copy['seo.home.description'], 400),
        tituloLista: copy['seo.zones'],
        enlaces: activePlazas.map((plaza) => ({
          texto: text(plaza.name, locale),
          href: route({ plazaSlug: plaza.slug }),
        })),
        secciones: [
          {
            titulo: copy['seo.categories'],
            enlaces: categoriasConPagina.map(enlaceDeCategoria),
            sinFragmento: true,
          },
        ],
      }),
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
      image,
      title: fill(copy['seo.title'], { name }),
      description: trim(
        text(plaza.description, locale) || fill(copy['seo.plaza.fallback'], { name }),
      ),
      jsonLd: listado(
        name,
        deLaPlaza.map((place) => ({
          name: place.name,
          url: absolute(route({ placeSlug: place.slug })),
        })),
      ),
      contenido: contenidoDeLista({
        nombre: name,
        descripcion: text(plaza.description, locale) || plaza.address || undefined,
        tituloLista: copy['seo.whatsHere'],
        enlaces: deLaPlaza.map((place) => ({
          texto: place.name,
          href: route({ placeSlug: place.slug }),
        })),
        secciones: [
          {
            titulo: copy['seo.categories'],
            enlaces: data.categories
              .filter((categoria) =>
                deLaPlaza.some((place) =>
                  categoriasDe(place, categoryOfGiro).some((otra) => otra.id === categoria.id),
                ),
              )
              .map(enlaceDeCategoria),
            sinFragmento: true,
          },
        ],
        volver: { texto: copy['seo.backHome'], href: route({}) },
      }),
    })
  }

  /*
   * Una página por cada categoría que tiene al menos un local, y todas se ofrecen a los buscadores.
   * Una que se queda sin locales deja de tener página (esa dirección pasa a dar 404).
   */
  for (const categoria of categoriasConPagina) {
    const lugares = porCategoria.get(categoria.id) ?? []
    const etiqueta = text(categoria.label, locale)
    const name = fill(copy['seo.category.name'], { label: etiqueta })
    const zonas = activePlazas.filter((plaza) =>
      lugares.some((place) => place.plazaId === plaza.id),
    )
    // En singular y plural, y sin "en 0 zonas" si ninguno de sus locales está en una zona activa.
    const resumen = fill(
      conCantidad(
        copy[zonas.length === 0 ? 'seo.category.descriptionSinZona' : 'seo.category.description'],
        lugares.length,
        locale,
      ),
      {
        label: etiqueta,
        lugares: conCantidad(copy['places.count'], lugares.length, locale),
        zonas: conCantidad(copy['seo.category.zoneCount'], zonas.length, locale),
      },
    )
    /*
     * El título nombra lo que la gente busca cuando la etiqueta es más general ("Comida Rápida" se
     * busca como "hamburguesas" o "alitas"): los dos giros con más locales que la etiqueta no dice.
     * Con menos de dos no se añade nada, porque un solo giro suelto sonaría a hueco.
     */
    const giros = girosDeCategoria(categoria, lugares, locale).slice(0, 2)
    const conGiros = fill(copy['seo.title'], {
      name: fill(copy['seo.category.title'], {
        label: etiqueta,
        giros: nombresEnLista(giros, locale),
      }),
    })
    const sinGiros = fill(copy['seo.title'], { name })
    // Solo si caben en un título (unos 60 caracteres): cortado a media palabra sería peor que corto.
    const titulo = giros.length >= 2 && conGiros.length <= TOPE_TITULO ? conGiros : sinGiros
    pages.push({
      href: route({ categorySlug: categoria.slug[locale] }),
      lastmod: masReciente(lugares),
      image,
      title: titulo,
      // Solo lo que dicen los datos: cuántos y en cuántas zonas. Nada de "abierto ahora".
      description: trim(resumen),
      jsonLd: listado(
        name,
        lugares.map((place) => ({
          name: place.name,
          url: absolute(route({ placeSlug: place.slug })),
        })),
      ),
      contenido: contenidoDeLista({
        nombre: name,
        descripcion: resumen,
        tituloLista: copy['seo.category.places'],
        enlaces: lugares.map((place) => {
          const zona = plazaById.get(place.plazaId)
          return {
            texto: zona ? `${place.name} (${text(zona.name, locale)})` : place.name,
            href: route({ placeSlug: place.slug }),
          }
        }),
        secciones: [
          {
            titulo: copy['seo.category.zones'],
            enlaces: zonas.map((plaza) => ({
              texto: text(plaza.name, locale),
              href: route({ plazaSlug: plaza.slug }),
            })),
          },
        ],
        volver: { texto: copy['seo.backHome'], href: route({}) },
      }),
    })
  }

  /*
   * Los metadatos de todas las fichas se deciden juntos y no de una en una: un título o una descripción
   * solo se puede distinguir de otro mirando la lista entera. Dos locales de una misma cadena
   * ("Starbucks", "Luka") salían con el mismo título y a veces con la misma descripción.
   */
  const fichas = data.places.map((place) => {
    const plaza = plazaById.get(place.plazaId)
    const giros = place.giros.map((id) => giroLabel.get(id) ?? id)
    const nombrePlaza = plaza ? text(plaza.name, locale) : undefined
    return {
      place,
      plaza,
      giros,
      nombrePlaza,
      descripcion: text(place.description, locale),
      // El mismo aviso que abre el cuerpo de la ficha, sin la fecha ni la reapertura: cabe en un fragmento.
      aviso: place.cierre
        ? `${copy['closure.title']}. ${copy[`closure.${place.cierre.motivo}`]}`
        : undefined,
      contexto: {
        giros: giros.slice(0, 2),
        lugar: lugarDe(nombrePlaza),
        conGiros: copy['seo.place.context'],
        soloLugar: copy['seo.place.contextLugar'],
      },
    }
  })

  // La zona va en el título solo de los locales cuyo nombre se repite: es lo que los distingue.
  const mismoNombre = repetidos(fichas.map((ficha) => ficha.place.name))
  const titulos = fichas.map((ficha, indice) =>
    mismoNombre.has(indice) && ficha.nombrePlaza
      ? fill(copy['seo.title.zone'], { name: ficha.place.name, plaza: ficha.nombrePlaza })
      : fill(copy['seo.title'], { name: ficha.place.name }),
  )

  const componer = (ficha: (typeof fichas)[number], conContexto: boolean): string =>
    descripcionDeFicha({
      descripcion: ficha.descripcion,
      nombre: ficha.place.name,
      contexto: ficha.contexto,
      aviso: ficha.aviso,
      conContexto,
    })
  const descripciones = fichas.map((ficha) => componer(ficha, true))

  // A qué locales enlaza cada ficha: el mismo bloque de siempre, repartido entre todos (ver vecinos.ts).
  const placeById = new Map(data.places.map((place) => [place.id, place]))
  const vecinosDe = repartirVecinos(
    data.places.map((place) => ({
      id: place.id,
      plazaId: place.plazaId,
      categorias: [
        ...new Set(
          [...place.giros, ...(place.secundarios ?? [])].flatMap((giro) => {
            const categoria = categoryOfGiro.get(giro)
            return categoria ? [categoria.id] : []
          }),
        ),
      ],
    })),
  )

  fichas.forEach(({ place, plaza, giros }, indice) => {
    pages.push({
      href: route({ placeSlug: place.slug }),
      // La última vez que el dato cambió de verdad: la verificación o, si es más reciente, el cierre.
      lastmod: [place.verification?.lastVerifiedAt, place.cierre?.desde]
        .filter((fecha): fecha is string => typeof fecha === 'string')
        .sort()
        .at(-1),
      title: titulos[indice] ?? '',
      description: descripciones[indice] ?? '',
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
      contenido: contenidoDeLugar({
        nombre: place.name,
        aviso: place.cierre
          ? [
              `${copy['closure.title']}.`,
              copy[`closure.${place.cierre.motivo}`],
              fill(copy['closure.since'], { date: fechaLarga(place.cierre.desde, locale) }),
              copy['closure.noReturn'],
            ].join(' ')
          : undefined,
        giros: [...place.giros, ...(place.secundarios ?? [])].map((id) => giroLabel.get(id) ?? id),
        plaza: plaza?.active
          ? { texto: text(plaza.name, locale), href: route({ plazaSlug: plaza.slug }) }
          : undefined,
        direccion: plaza?.address ?? undefined,
        descripcion: text(place.description, locale) || undefined,
        dias: DIAS.map((dia) => ({
          dia: copy[`day.${dia}`],
          franjas: place.hours?.[dia] ?? [],
          cerrado: copy['hours.closedAllDay'],
        })).filter((dia) => dia.franjas.length > 0 || place.hours),
        tituloHorario: copy['place.hours'],
        contacto: contactoDe(place),
        tituloContacto: copy['place.contact'],
        vecinos: (vecinosDe.get(place.id) ?? []).flatMap((id) => {
          const otro = placeById.get(id)
          return otro ? [{ texto: otro.name, href: route({ placeSlug: otro.slug }) }] : []
        }),
        tituloVecinos: fill(copy['seo.nearby'], {
          plaza: plaza ? text(plaza.name, locale) : 'Zibatá',
        }),
        categorias: {
          titulo: copy['seo.categories'],
          enlaces: categoriasDe(place, categoryOfGiro).map(enlaceDeCategoria),
          sinFragmento: true,
        },
        volver: { texto: copy['seo.backHome'], href: route({}) },
      }),
    })
  })

  const INFO: Record<
    InfoTopic,
    { title: keyof typeof es; lead: keyof typeof es; body?: (keyof typeof es)[] }
  > = {
    acerca: { title: 'about.title', lead: 'about.aboutLead', body: ['about.aboutBody'] },
    /*
     * Privacidad lleva varios párrafos porque desde la v4.18 también son los términos de uso, y el
     * argumento de la página vale igual para ellos: unos términos que solo existen si se ejecuta
     * JavaScript no se pueden citar ni archivar.
     */
    privacidad: {
      title: 'about.privacyTitle',
      lead: 'about.privacyLead',
      body: [
        'about.privacyBody',
        'about.termsWhat',
        'about.termsData',
        'about.termsFix',
        'about.termsContent',
      ],
    },
    sugerir: {
      title: 'about.contribute',
      lead: 'about.contributeLead',
      body: ['about.contributeBody'],
    },
    // El tutorial es una ventana de cuatro pasos sobre gestos del mapa: no tiene cuerpo que servir.
    tutorial: { title: 'about.tutorialTitle', lead: 'about.tutorialLead' },
  }
  for (const topic of INFO_TOPICS) {
    const keys = INFO[topic]
    pages.push({
      href: route({ infoTopic: topic }),
      title: fill(copy['seo.title'], { name: String(copy[keys.title]) }),
      description: trim(String(copy[keys.lead])),
      image,
      /*
       * El texto de estas páginas también va escrito. Importa sobre todo en privacidad: una política
       * que solo existe si se ejecuta JavaScript no se puede citar ni archivar.
       */
      contenido: contenidoDeLista({
        nombre: String(copy[keys.title]),
        descripcion: [
          String(copy[keys.lead]),
          ...(keys.body ?? []).map((clave) => String(copy[clave])),
        ].filter(Boolean),
        tituloLista: copy['about.moreLabel'],
        enlaces: INFO_TOPICS.filter((otro) => otro !== topic).map((otro) => ({
          texto: String(copy[INFO[otro].title]),
          href: route({ infoTopic: otro }),
        })),
        volver: { texto: copy['seo.backHome'], href: route({}) },
      }),
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
    ['robots', /<meta\s+name="robots"/g],
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
      // `href` ya lleva la base, y `siteUrl` es la raíz pública del despliegue, que también la
      // lleva (así la usan el resto de plugins). Si no se quitara antes de resolver, un sitio en
      // subdirectorio escribiría la base dos veces en cada `canonical` y en todo el sitemap.
      const absolute = (href: string) => {
        if (!siteUrl) return href
        const relative = href.startsWith(base) ? href.slice(base.length) : href.replace(/^\//, '')
        return new URL(relative, siteUrl).href
      }
      const byLocale = new Map(LOCALES.map((l) => [l, pagesFor(l, data, base, absolute)] as const))

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
          html = setTag(
            html,
            metaTag('property', 'og:image'),
            `<meta property="og:image" content="${escapeHtml(absolute(page.image))}" />`,
          )
          html = setTag(
            html,
            metaTag('property', 'og:image:alt'),
            `<meta property="og:image:alt" content="${escapeHtml(String(CATALOGS[locale]['seo.imageAlt']))}" />`,
          )
          html = setTag(
            html,
            /<link\s+rel="canonical"[^>]*\/>/,
            `<link rel="canonical" href="${escapeHtml(absolute(page.href))}" />`,
          )
          html = html.replace('</head>', `  ${alternates.filter(Boolean).join('\n  ')}\n  </head>`)
          if (page.jsonLd) {
            html = html.replace('</head>', `  ${bloque(page.jsonLd)}\n  </head>`)
          }
          if (page.contenido) {
            html = html.replace('<div id="root"></div>', `<div id="root">${page.contenido}</div>`)
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
        robotsTxt(base, siteUrl ? new URL('sitemap.xml', siteUrl).href : undefined),
      )
      console.log(`✓ prerenderizado: ${written.length} páginas, sitemap y robots.txt`)
    },
  }
}
