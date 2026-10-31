/**
 * El editor de categorías y giros del panel.
 *
 * Una categoría no es una isla: sus giros los usan los locales, el buscador indexa sus sinónimos,
 * los filtros se ordenan por `order`, el color sale de `hue` y las plazas guardan una lista derivada
 * de categorías. Por eso un cambio aquí no toca `places.json`, pero sí recalcula `plazas.json` y se
 * valida contra todo el catálogo antes de mandarse.
 *
 * Reglas que el editor hace cumplir, además del esquema:
 *
 *  - **Los ids y los slugs no cambian.** El id de un giro lo referencian los locales y el slug de
 *    una categoría es una URL. En una categoría nueva se derivan del nombre.
 *  - **No se borra nada.** Quitar una categoría o un giro dejaría locales apuntando a la nada; el
 *    editor no lo ofrece y el servidor lo rechaza.
 *  - **El giro general no se mueve.** Comparte el icono con su categoría; moverlo dejaría a la
 *    categoría sin su icono y al destino con dos.
 *  - **Un icono, un giro.** Los giros no generales no repiten dibujo, y el general siempre lleva el
 *    de su categoría. Es la misma regla que fija `placeIcon.test.ts`.
 *  - **Un tono por categoría.** Todas menos `otros` necesitan `hue`; sin él, la prueba de paleta
 *    falla y la categoría se vería neutra.
 */
import { z } from 'zod'
import { ICONOS } from '../src/data/iconos.ts'
import {
  type CommercialDataset,
  syncPlazaDerivedFields,
  validateRelations,
  validateTranslations,
} from '../src/data/relations.ts'
import { CategoriesFileSchema } from '../src/data/schemas.ts'
import type { Category } from '../src/types/domain.ts'
import { fechaLocal } from './analitica.ts'
import { type Cargado, cargar, LIMITES } from './contenido.ts'
import { type EntornoGitHub, type Publicacion, publicar } from './github.ts'
import { slugDe, unico } from './slug.ts'

const Texto = z.object({
  es: z.string().trim().min(1, 'La etiqueta en español es obligatoria').max(80),
  en: z.string().trim().min(1, 'La etiqueta en inglés es obligatoria').max(80),
})

const GiroEntradaSchema = z.object({
  /** Vacío al crear. Con valor, es el giro que se edita o se mueve. */
  id: z.string().trim().optional(),
  label: Texto,
  icon: z.string().trim().min(1).max(60),
  synonyms: z.array(z.string()).optional().default([]),
  /** Solo lo llevan los giros que comparten icono con su categoría. */
  general: z.boolean().optional(),
})

const CategoriaEntradaSchema = z.object({
  /** Vacío al crear. Con valor, es la categoría que se edita. */
  id: z.string().trim().optional(),
  label: Texto,
  icon: z.string().trim().min(1).max(60),
  hue: z.number().int().min(0).max(359).nullable().optional(),
  order: z.number().int().min(0).max(999),
  synonyms: z.array(z.string()).optional().default([]),
  giros: z.array(GiroEntradaSchema).min(1, 'Una categoría necesita al menos un giro'),
})

export const EntradaCategoriasSchema = z.object({
  categories: z.array(CategoriaEntradaSchema).min(1),
})

export interface Afectados {
  locales: number
  plazas: number
}

export type ResultadoCategorias =
  | {
      ok: true
      seco: boolean
      pr: Publicacion | null
      mensaje: string
      afectados: Afectados
    }
  | { ok: false; problemas: string[] }

export type PreparadoCategorias =
  | {
      ok: true
      categorias: Category[]
      archivoCategorias: Record<string, unknown>
      archivoPlazas: Record<string, unknown>
      afectados: Afectados
    }
  | { ok: false; problemas: string[] }

const limpiarSinonimos = (valores: string[]): string[] =>
  [...new Set(valores.map((valor) => valor.trim()).filter(Boolean))].slice(0, 60)

const normalizar = (valor: string): string =>
  valor.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()

const iguales = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * La parte pura: normaliza la taxonomía completa, comprueba las consecuencias y deja los dos
 * archivos listos. Recibe todas las categorías, no solo la editada, porque mover un giro cambia dos
 * y porque la validación es del conjunto.
 */
export function prepararCategorias(
  dataset: CommercialDataset,
  crudo: Cargado['crudo'],
  cuerpo: unknown,
  hoy: string,
): PreparadoCategorias {
  const entrada = EntradaCategoriasSchema.safeParse(cuerpo)
  if (!entrada.success) {
    return {
      ok: false,
      problemas: entrada.error.issues.map(
        (problema) => `${problema.path.join('.') || 'datos'}: ${problema.message}`,
      ),
    }
  }

  const problemas: string[] = []
  const error = (mensaje: string) => problemas.push(mensaje)

  const basePorId = new Map(dataset.categories.map((categoria) => [categoria.id, categoria]))
  const giroBasePorId = new Map(
    dataset.categories.flatMap((categoria) =>
      categoria.giros.map((giro) => [giro.id, giro] as const),
    ),
  )
  const categoriaDelGiro = new Map(
    dataset.categories.flatMap((categoria) =>
      categoria.giros.map((giro) => [giro.id, categoria.id] as const),
    ),
  )

  const idsCategorias = new Set(dataset.categories.map((categoria) => categoria.id))
  const idsGiros = new Set(giroBasePorId.keys())
  const slugsEs = new Set(dataset.categories.map((categoria) => categoria.slug.es))
  const slugsEn = new Set(dataset.categories.map((categoria) => categoria.slug.en))
  const idsEnLaEntrada = new Set<string>()
  const girosEnLaEntrada = new Set<string>()

  const nuevas: Category[] = []
  for (const entradaCategoria of entrada.data.categories) {
    const base = entradaCategoria.id ? basePorId.get(entradaCategoria.id) : undefined
    if (entradaCategoria.id && !base) {
      error(`La categoría "${entradaCategoria.id}" no existe.`)
      continue
    }
    if (base && idsEnLaEntrada.has(base.id)) {
      error(`La categoría "${base.label.es}" está repetida en la entrada.`)
      continue
    }

    const id = base?.id ?? unico(slugDe(entradaCategoria.label.es), idsCategorias)
    idsCategorias.add(id)
    idsEnLaEntrada.add(id)
    const slug = base?.slug ?? {
      es: unico(slugDe(entradaCategoria.label.es), slugsEs),
      en: unico(slugDe(entradaCategoria.label.en), slugsEn),
    }
    slugsEs.add(slug.es)
    slugsEn.add(slug.en)

    let hue: number | undefined
    if (id === 'otros') {
      hue = entradaCategoria.hue ?? undefined
    } else if (entradaCategoria.hue == null) {
      error(`La categoría "${entradaCategoria.label.es}" necesita un tono.`)
    } else {
      hue = entradaCategoria.hue
    }

    const giros: Category['giros'] = []
    let generales = 0
    for (const entradaGiro of entradaCategoria.giros) {
      const giroBase = entradaGiro.id ? giroBasePorId.get(entradaGiro.id) : undefined
      if (entradaGiro.id && !giroBase) {
        error(`El giro "${entradaGiro.id}" no existe.`)
        continue
      }
      if (entradaGiro.id && girosEnLaEntrada.has(entradaGiro.id)) {
        error(`El giro "${giroBase?.label.es ?? entradaGiro.id}" está repetido en la entrada.`)
        continue
      }
      const giroId = giroBase?.id ?? unico(slugDe(entradaGiro.label.es), idsGiros)
      idsGiros.add(giroId)
      girosEnLaEntrada.add(giroId)

      const general = giroBase?.general === true || entradaGiro.general === true
      if (giroBase?.general && categoriaDelGiro.get(giroId) !== id) {
        error(`El giro general "${giroBase.label.es}" no se puede mover de categoría.`)
      }
      if (general) generales += 1
      giros.push({
        id: giroId,
        label: { es: entradaGiro.label.es, en: entradaGiro.label.en },
        // El general comparte el icono con su categoría: es la misma idea, no un dibujo aparte.
        icon: general ? entradaCategoria.icon : entradaGiro.icon,
        synonyms: limpiarSinonimos(entradaGiro.synonyms),
        ...(general ? { general: true } : {}),
      })
    }
    if (generales > 1) {
      error(`La categoría "${entradaCategoria.label.es}" tiene más de un giro general.`)
    }

    nuevas.push({
      id,
      slug,
      label: { es: entradaCategoria.label.es, en: entradaCategoria.label.en },
      icon: entradaCategoria.icon,
      ...(hue === undefined ? {} : { hue }),
      order: entradaCategoria.order,
      synonyms: limpiarSinonimos(entradaCategoria.synonyms),
      giros,
    })
  }

  // La etiqueta de una categoría es el título de su página y el nombre del filtro. Dos iguales
  // dejarían dos páginas con el mismo título, que es lo que la prueba de metadatos prohíbe.
  const etiquetas = { es: new Map<string, string>(), en: new Map<string, string>() }
  for (const categoria of nuevas) {
    for (const locale of ['es', 'en'] as const) {
      const etiqueta = normalizar(categoria.label[locale] ?? '')
      if (!etiqueta) continue
      const anterior = etiquetas[locale].get(etiqueta)
      if (anterior) {
        error(`La etiqueta "${categoria.label[locale]}" ya la usa "${anterior}".`)
      } else {
        etiquetas[locale].set(etiqueta, categoria.label.es)
      }
    }
  }

  // No se borra: un giro que desaparece deja locales apuntando a la nada y una categoría que
  // desaparece se lleva sus giros por delante. El editor no lo ofrece; el servidor lo rechaza.
  for (const categoria of dataset.categories) {
    if (!idsEnLaEntrada.has(categoria.id)) {
      error(`No se pueden quitar categorías desde el editor; falta "${categoria.label.es}".`)
    }
  }
  for (const giro of giroBasePorId.values()) {
    if (!girosEnLaEntrada.has(giro.id)) {
      error(`No se pueden quitar giros desde el editor; falta "${giro.label.es}".`)
    }
  }

  const iconos = new Set<string>(ICONOS)
  for (const categoria of nuevas) {
    if (!iconos.has(categoria.icon)) error(`El icono "${categoria.icon}" no existe.`)
    for (const giro of categoria.giros) {
      if (!iconos.has(giro.icon)) error(`El icono "${giro.icon}" no existe.`)
    }
  }
  const iconoUsado = new Map<string, string>()
  for (const categoria of nuevas) {
    for (const giro of categoria.giros) {
      if (giro.general) continue
      const anterior = iconoUsado.get(giro.icon)
      if (anterior) {
        error(`El icono "${giro.icon}" ya lo usa otro giro ("${anterior}").`)
      }
      iconoUsado.set(giro.icon, giro.label.es)
    }
  }

  if (problemas.length > 0) return { ok: false, problemas }

  const archivo = CategoriesFileSchema.safeParse({
    ...crudo.categories,
    updatedAt: hoy,
    categories: nuevas,
  })
  if (!archivo.success) {
    return {
      ok: false,
      problemas: archivo.error.issues.map(
        (problema) => `${problema.path.join('.') || 'datos'}: ${problema.message}`,
      ),
    }
  }
  const categorias = archivo.data.categories
  const plazas = syncPlazaDerivedFields({
    categories: categorias,
    plazas: dataset.plazas,
    places: dataset.places,
  })
  const conPlazas: CommercialDataset = {
    categories: categorias,
    plazas,
    places: dataset.places,
  }
  const relaciones = [
    ...validateRelations(conPlazas, LIMITES),
    ...validateTranslations(conPlazas),
  ].filter((asunto) => asunto.level === 'error')
  if (relaciones.length > 0) {
    return { ok: false, problemas: relaciones.map((asunto) => asunto.message) }
  }

  /*
   * El archivo se arma desde el JSON crudo para conservar el orden de las categorías existentes y
   * que el diff de la PR se lea. Las nuevas se añaden al final.
   */
  const crudas = (crudo.categories.categories as Record<string, unknown>[] | undefined) ?? []
  const porId = new Map(categorias.map((categoria) => [categoria.id, categoria]))
  const vistas = new Set<string>()
  const categoriasRaw = crudas.map((fila) => {
    const id = String(fila.id)
    const nueva = porId.get(id)
    if (!nueva) return fila
    vistas.add(id)
    return nueva as unknown as Record<string, unknown>
  })
  for (const nueva of categorias) {
    if (!vistas.has(nueva.id)) {
      categoriasRaw.push(nueva as unknown as Record<string, unknown>)
    }
  }

  const plazasCrudas = (crudo.plazas.plazas as Record<string, unknown>[] | undefined) ?? []
  const plazasRaw = plazasCrudas.map((fila, posicion) => ({
    ...fila,
    categories: plazas[posicion]?.categories ?? [],
  }))

  /*
   * El impacto no es "todo lo que se tocó", sino "a quién le cambia algo":
   *  - si cambia la presentación de la categoría (nombre, icono, tono, orden, sinónimos), cambian
   *    todos los locales de sus giros;
   *  - si cambia un giro concreto, solo los locales que lo usan;
   *  - si se mueve, los del giro movido, no los de las dos categorías enteras.
   */
  const antesPorId = new Map(dataset.categories.map((categoria) => [categoria.id, categoria]))
  const sinGiros = (categoria: Category) => ({
    id: categoria.id,
    slug: categoria.slug,
    label: categoria.label,
    icon: categoria.icon,
    hue: categoria.hue,
    order: categoria.order,
    synonyms: categoria.synonyms,
  })
  const girosAfectados = new Set<string>()
  for (const categoria of categorias) {
    const antes = antesPorId.get(categoria.id)
    if (!antes) {
      for (const giro of categoria.giros) girosAfectados.add(giro.id)
      continue
    }
    if (!iguales(sinGiros(antes), sinGiros(categoria))) {
      for (const giro of categoria.giros) girosAfectados.add(giro.id)
    }
    for (const giro of categoria.giros) {
      const anterior = antes.giros.find((fila) => fila.id === giro.id)
      if (!anterior || !iguales(anterior, giro)) girosAfectados.add(giro.id)
    }
    for (const giro of antes.giros) {
      if (!categoria.giros.some((fila) => fila.id === giro.id)) girosAfectados.add(giro.id)
    }
  }
  const plazasActivas = new Set(
    dataset.plazas.filter((plaza) => plaza.active).map((plaza) => plaza.id),
  )
  const locales = dataset.places.filter(
    (place) =>
      place.active &&
      plazasActivas.has(place.plazaId) &&
      [...place.giros, ...place.secundarios].some((giro) => girosAfectados.has(giro)),
  )
  const plazasAfectadas = new Set(locales.map((place) => place.plazaId))

  return {
    ok: true,
    categorias,
    archivoCategorias: { ...crudo.categories, updatedAt: hoy, categories: categoriasRaw },
    archivoPlazas: { ...crudo.plazas, updatedAt: hoy, plazas: plazasRaw },
    afectados: { locales: locales.length, plazas: plazasAfectadas.size },
  }
}

/** Guarda la taxonomía: valida, sincroniza las plazas y la manda a la PR. */
export async function guardarCategorias(
  entorno: EntornoGitHub & { PANEL_ABIERTO?: string },
  cuerpo: unknown,
): Promise<ResultadoCategorias> {
  const cargado = await cargar(entorno)
  const hoy = fechaLocal(new Date())
  const preparado = prepararCategorias(cargado.dataset, cargado.crudo, cuerpo, hoy)
  if (!preparado.ok) return preparado

  if (cargado.seco) {
    return {
      ok: true,
      seco: true,
      pr: null,
      mensaje: 'Cambio validado. En desarrollo no se commitea.',
      afectados: preparado.afectados,
    }
  }

  const pr = await publicar(
    entorno,
    [
      {
        ruta: 'data/commercial/categories.json',
        contenido: `${JSON.stringify(preparado.archivoCategorias, null, 2)}\n`,
      },
      {
        ruta: 'data/commercial/plazas.json',
        contenido: `${JSON.stringify(preparado.archivoPlazas, null, 2)}\n`,
      },
    ],
    'Panel: categorías y giros',
  )
  return {
    ok: true,
    seco: false,
    pr,
    mensaje: 'Cambio enviado a la PR.',
    afectados: preparado.afectados,
  }
}
