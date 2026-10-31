/**
 * El contenido comercial visto y editado desde el panel.
 *
 * Lee los tres archivos de `data/commercial` (o los carga del bundle en desarrollo), valida el
 * cambio con los mismos esquemas que el build y lo manda a una rama con PR. No hay una segunda
 * fuente: lo que se edita aquí es lo que publica la guía después de fusionar.
 *
 * Las decisiones que no son obvias:
 *
 *  - **`id` y `slug` no se editan.** Cambiarlos rompería la URL de la ficha y no hay redirección
 *    por slug. En un local nuevo se derivan del nombre y se comprueba que no choquen.
 *  - **Los campos derivados de la plaza se recalculan.** `placeIds` y `categories` no se escriben
 *    a mano: se sincronizan con los locales, igual que hace `data:validate --fix`.
 *  - **La verificación se actualiza al guardar.** Quien edita está afirmando que el dato es de hoy;
 *    se apunta la fecha y una fuente `campo:AAAA-MM-DD`, como el resto del dataset.
 *  - **El diff se mantiene pequeño.** Se reemplaza solo el local tocado y los campos derivados de
 *    su plaza, en vez de volver a serializar todo el archivo desde los objetos de Zod.
 */
import { z } from 'zod'
import categoriasJson from '../data/commercial/categories.json' with { type: 'json' }
import lugaresJson from '../data/commercial/places.json' with { type: 'json' }
import plazasJson from '../data/commercial/plazas.json' with { type: 'json' }
import extent from '../data/geographic/extent.json' with { type: 'json' }
import {
  type CommercialDataset,
  syncPlazaDerivedFields,
  validateRelations,
  validateTranslations,
} from '../src/data/relations.ts'
import { PUBLISHABLE_STATUS } from '../src/data/rules.ts'
import {
  CategoriesFileSchema,
  PlaceSchema,
  PlacesFileSchema,
  PlazasFileSchema,
} from '../src/data/schemas.ts'
import type { Category, Place } from '../src/types/domain.ts'
import { fechaLocal } from './analitica.ts'
import {
  type EntornoGitHub,
  leerArchivo,
  type Publicacion,
  prAbierta,
  publicar,
  ramaDe,
} from './github.ts'
import { slugDe, unico } from './slug.ts'

/** Lo que manda el formulario. Los nombres van en español porque son los de la interfaz. */
export const EntradaNegocioSchema = z.object({
  /** Vacío al crear. Con valor, es el local que se edita. */
  id: z.string().trim().optional(),
  nombre: z.string().trim().min(1, 'El nombre no puede ir vacío').max(160),
  plazaId: z.string().trim().min(1, 'Elige una plaza'),
  giros: z.array(z.string().trim().min(1)).min(1, 'Elige al menos un giro').max(3),
  descripcionEs: z.string().trim().min(1, 'La descripción en español es obligatoria').max(2000),
  descripcionEn: z.string().trim().min(1, 'La descripción en inglés es obligatoria').max(2000),
  telefono: z.string().trim().max(40).optional().default(''),
  sitio: z.string().trim().max(500).optional().default(''),
  instagram: z.string().trim().max(500).optional().default(''),
  facebook: z.string().trim().max(500).optional().default(''),
  whatsapp: z.string().trim().max(40).optional().default(''),
  googleMapsUri: z.string().trim().max(500).optional().default(''),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  horario: z.record(z.string(), z.array(z.string())).nullable().optional(),
  activo: z.boolean().optional().default(true),
})

export interface PlazaResumen {
  id: string
  name: string
  active: boolean
  comingSoon?: boolean
}

export interface ResultadoContenido {
  ref: string
  seco: boolean
  pr: Publicacion | null
  categories: Category[]
  plazas: PlazaResumen[]
  places: Place[]
}

export interface NegocioGuardado {
  id: string
  nombre: string
  nuevo: boolean
}

export type ResultadoGuardado =
  | {
      ok: true
      seco: boolean
      pr: Publicacion | null
      mensaje: string
      negocio: NegocioGuardado
      avisos: string[]
    }
  | { ok: false; problemas: string[] }

export type Crudo = Record<string, unknown> & { [clave: string]: unknown }

export interface Cargado {
  ref: string
  seco: boolean
  pr: Publicacion | null
  crudo: { categories: Crudo; plazas: Crudo; places: Crudo }
  dataset: CommercialDataset
}

const ENLACES_VACIOS = {
  website: null,
  instagram: null,
  facebook: null,
  tiktok: null,
  whatsapp: null,
  rappi: null,
  uberEats: null,
  didiFood: null,
}

const [oeste, sur, este, norte] = extent.areaBbox as [number, number, number, number]
export const LIMITES = { west: oeste, south: sur, east: este, north: norte }

const local = (): Cargado['crudo'] => ({
  categories: categoriasJson as unknown as Crudo,
  plazas: plazasJson as unknown as Crudo,
  places: lugaresJson as unknown as Crudo,
})

function datasetDe(crudo: Cargado['crudo']): CommercialDataset {
  return {
    categories: CategoriesFileSchema.parse(crudo.categories).categories,
    plazas: PlazasFileSchema.parse(crudo.plazas).plazas,
    places: PlacesFileSchema.parse(crudo.places).places,
  }
}

/**
 * Los datos de trabajo: los del bundle en desarrollo, o los de GitHub cuando hay testigo. Si hay
 * una PR abierta se lee su rama, para no pisar un cambio anterior que aún no se ha fusionado.
 */
export async function cargar(
  entorno: EntornoGitHub & { PANEL_ABIERTO?: string },
): Promise<Cargado> {
  if (!entorno.GITHUB_TOKEN) {
    if (entorno.PANEL_ABIERTO !== 'si') throw new Error('falta GITHUB_TOKEN')
    const crudo = local()
    return { ref: 'local', seco: true, pr: null, crudo, dataset: datasetDe(crudo) }
  }

  const pr = await prAbierta(entorno)
  const ref = pr ? ramaDe(entorno) : 'main'
  const [categorias, plazas, lugares] = await Promise.all([
    leerArchivo(entorno, 'data/commercial/categories.json', ref),
    leerArchivo(entorno, 'data/commercial/plazas.json', ref),
    leerArchivo(entorno, 'data/commercial/places.json', ref),
  ])
  if (!categorias || !plazas || !lugares) {
    throw new Error(`faltan los archivos de contenido en ${ref}`)
  }
  const crudo = {
    categories: JSON.parse(categorias) as Crudo,
    plazas: JSON.parse(plazas) as Crudo,
    places: JSON.parse(lugares) as Crudo,
  }
  return { ref, seco: false, pr, crudo, dataset: datasetDe(crudo) }
}

/** Lo que el panel necesita para listar y editar. */
export async function contenido(
  entorno: EntornoGitHub & { PANEL_ABIERTO?: string },
): Promise<ResultadoContenido> {
  const cargado = await cargar(entorno)
  return {
    ref: cargado.ref,
    seco: cargado.seco,
    pr: cargado.pr,
    categories: cargado.dataset.categories,
    plazas: cargado.dataset.plazas.map(({ id, name, active, comingSoon }) => ({
      id,
      name,
      active,
      comingSoon,
    })),
    places: cargado.dataset.places,
  }
}

/** Un teléfono en E.164. Si son diez dígitos se asume México; si no, se deja que el esquema decida. */
function telefonoDe(valor: string): string | null {
  const limpio = valor.replace(/[\s().-]/g, '')
  if (!limpio) return null
  if (limpio.startsWith('+')) return limpio
  const digitos = limpio.replace(/\D/g, '')
  if (digitos.length === 10) return `+52${digitos}`
  if (digitos.length === 12 && digitos.startsWith('52')) return `+${digitos}`
  return `+${digitos}`
}

const urlDe = (valor: string): string | null => (valor ? valor : null)

/** Día ausente = no se sabe; lista vacía = cerrado. Una cadena vacía del formulario es "no se sabe". */
function horarioDe(
  horario: Record<string, string[]> | null | undefined,
): Record<string, string[]> | null {
  if (!horario) return null
  const salida: Record<string, string[]> = {}
  for (const [dia, rangos] of Object.entries(horario)) {
    const limpios = rangos.map((rango) => rango.trim()).filter(Boolean)
    if (limpios.length > 0 || rangos.length === 0) salida[dia] = limpios
  }
  return Object.keys(salida).length > 0 ? salida : null
}

/** Arma el objeto completo y lo valida. Los campos que el formulario no toca se conservan. */
function construir(
  entrada: z.infer<typeof EntradaNegocioSchema>,
  existente: Place | undefined,
  ids: Set<string>,
  hoy: string,
): { place?: Place; problemas?: string[] } {
  /*
   * El orden de `giros` no es decorativo: el primero decide el icono de la ficha y la prioridad en
   * la búsqueda. El formulario los lee en el orden de la taxonomía, que no es el del local, así que
   * un cambio de teléfono podía reordenar los giros y cambiar quién sale primero al buscar "pasta".
   * Se conserva el orden de los que ya estaban y los nuevos se añaden al final.
   */
  const pedidos = [...new Set(entrada.giros)]
  const giros = existente
    ? [
        ...existente.giros.filter((giro) => pedidos.includes(giro)),
        ...pedidos.filter((giro) => !existente.giros.includes(giro)),
      ]
    : pedidos
  const secundarios = (existente?.secundarios ?? [])
    .filter((giro) => !giros.includes(giro))
    .slice(0, Math.max(0, 3 - giros.length))

  if ((entrada.lat == null) !== (entrada.lng == null)) {
    return { problemas: ['Indica las dos coordenadas o ninguna'] }
  }

  const id = existente?.id ?? unico(slugDe(entrada.nombre), ids)
  const fuentes = [...(existente?.verification?.sources ?? []), `campo:${hoy}`]
  /*
   * Guardar actualiza la fecha, pero no inventa un estado. Si el local ya era publicable, conserva
   * su estado y su confianza; si se hace visible uno que no lo era, se promueve a activo. Ocultarlo
   * no lo convierte en cerrado: oculto es una decisión de la guía, cerrado es un hecho del negocio.
   */
  const estadoPrevio = existente?.verification?.status
  const publicable =
    estadoPrevio !== undefined && (PUBLISHABLE_STATUS as readonly string[]).includes(estadoPrevio)
  const status = entrada.activo
    ? publicable
      ? (estadoPrevio as string)
      : 'active'
    : (estadoPrevio ?? 'uncertain')
  const confidence =
    entrada.activo && !publicable
      ? 'high'
      : (existente?.verification?.confidence ?? (entrada.activo ? 'high' : 'low'))
  const verification = {
    status,
    confidence,
    lastVerifiedAt: hoy,
    sources: [...new Set(fuentes)].slice(-8),
  }

  const place = {
    id,
    slug: existente?.slug ?? id,
    name: entrada.nombre,
    plazaId: entrada.plazaId,
    giros,
    secundarios,
    description: { es: entrada.descripcionEs, en: entrada.descripcionEn },
    hours: horarioDe(entrada.horario),
    location:
      entrada.lat != null && entrada.lng != null ? { lat: entrada.lat, lng: entrada.lng } : null,
    googleMapsUri: urlDe(entrada.googleMapsUri),
    googlePlaceId: existente?.googlePlaceId ?? null,
    phone: telefonoDe(entrada.telefono),
    photos: existente?.photos ?? [],
    links: {
      ...(existente?.links ?? ENLACES_VACIOS),
      website: urlDe(entrada.sitio),
      instagram: urlDe(entrada.instagram),
      facebook: urlDe(entrada.facebook),
      whatsapp: telefonoDe(entrada.whatsapp),
    },
    active: entrada.activo,
    // Un local que vuelve a estar visible ya no arrastra un cierre temporal viejo.
    ...(existente?.cierre && !(existente.active === false && entrada.activo)
      ? { cierre: existente.cierre }
      : {}),
    verification,
  }

  const revisado = PlaceSchema.safeParse(place)
  if (!revisado.success) {
    return {
      problemas: revisado.error.issues.map(
        (problema) => `${problema.path.join('.') || 'datos'}: ${problema.message}`,
      ),
    }
  }
  return { place: revisado.data }
}

export type Preparado =
  | {
      ok: true
      place: Place
      nuevo: boolean
      lugares: Record<string, unknown>
      plazas: Record<string, unknown>
      avisos: string[]
    }
  | { ok: false; problemas: string[] }

/**
 * La parte pura: valida el formulario, arma el local y deja los dos archivos listos. Va aparte de
 * la red para poder probarla sin GitHub y para que la publicación no mezcle validación y commit.
 */
export function prepararNegocio(
  dataset: CommercialDataset,
  crudo: Cargado['crudo'],
  cuerpo: unknown,
  hoy: string,
): Preparado {
  const entrada = EntradaNegocioSchema.safeParse(cuerpo)
  if (!entrada.success) {
    return {
      ok: false,
      problemas: entrada.error.issues.map(
        (problema) => `${problema.path.join('.') || 'datos'}: ${problema.message}`,
      ),
    }
  }

  const existente = entrada.data.id
    ? dataset.places.find((place) => place.id === entrada.data.id)
    : undefined
  if (entrada.data.id && !existente) {
    return { ok: false, problemas: ['Ese negocio ya no existe'] }
  }

  // También los slugs: un id nuevo no debe chocar con la URL de un local existente.
  const ids = new Set(dataset.places.flatMap((place) => [place.id, place.slug]))
  const construido = construir(entrada.data, existente, ids, hoy)
  if (!construido.place) {
    return { ok: false, problemas: construido.problemas ?? ['No se pudo armar el negocio'] }
  }
  const place = construido.place

  const places = existente
    ? dataset.places.map((actual) => (actual.id === place.id ? place : actual))
    : [...dataset.places, place]
  const plazas = syncPlazaDerivedFields({ ...dataset, places })
  const conPlazas: CommercialDataset = { ...dataset, places, plazas }
  const asuntos = [...validateRelations(conPlazas, LIMITES), ...validateTranslations(conPlazas)]
  const problemas = asuntos
    .filter((asunto) => asunto.level === 'error')
    .map((asunto) => asunto.message)

  /*
   * El prerender exige títulos y descripciones distintos. El título de una ficha es el nombre, y
   * cuando se repite en la misma plaza no hay zona que lo distinga; la descripción se desambigua
   * por zona, así que solo choca dentro de la misma plaza. Dos cadenas en plazas distintas sí
   * pueden compartir nombre y descripción: el contexto ya las separa.
   */
  const normalizar = (valor: string): string =>
    valor.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
  const plazaActiva = (id: string): boolean =>
    dataset.plazas.find((plaza) => plaza.id === id)?.active === true
  if (place.active && plazaActiva(place.plazaId)) {
    const visibles = dataset.places.filter(
      (fila) =>
        fila.id !== place.id &&
        fila.active &&
        fila.plazaId === place.plazaId &&
        plazaActiva(fila.plazaId),
    )
    const nombre = normalizar(place.name)
    const mismoNombre = visibles.find((fila) => normalizar(fila.name) === nombre)
    if (mismoNombre) {
      problemas.push(
        `Ya hay un local activo con el nombre "${mismoNombre.name}" en esta plaza; la ficha y el título se repetirían.`,
      )
    }
    const descripcionEs = normalizar(place.description?.es ?? '')
    const descripcionEn = normalizar(place.description?.en ?? '')
    const mismaDescripcion = visibles.find(
      (fila) =>
        normalizar(fila.description?.es ?? '') === descripcionEs ||
        normalizar(fila.description?.en ?? '') === descripcionEn,
    )
    if (mismaDescripcion) {
      problemas.push(
        `La descripción coincide con la de "${mismaDescripcion.name}" en esta plaza; los metadatos de las dos fichas se repetirían.`,
      )
    }
    // La ficha de una plaza usa el mismo patrón de título que la de un local. Un local llamado
    // como una plaza, o con su descripción, deja dos páginas con el mismo metadato.
    const plazaMismoNombre = dataset.plazas.find((fila) => normalizar(fila.name) === nombre)
    if (plazaMismoNombre) {
      problemas.push(
        `El nombre coincide con el de la plaza "${plazaMismoNombre.name}"; los títulos de las dos páginas se repetirían.`,
      )
    }
    const plazaMismaDescripcion = dataset.plazas.find(
      (fila) =>
        normalizar(fila.description?.es ?? '') === descripcionEs ||
        normalizar(fila.description?.en ?? '') === descripcionEn,
    )
    if (plazaMismaDescripcion) {
      problemas.push(
        `La descripción coincide con la de la plaza "${plazaMismaDescripcion.name}"; los metadatos de las dos páginas se repetirían.`,
      )
    }
  }

  if (problemas.length > 0) return { ok: false, problemas }

  // Solo los avisos de este local. El dataset tiene avisos propios que no vienen a cuento al
  // editar un negocio, y devolverlos todos convertiría el formulario en un muro.
  const avisos = asuntos
    .filter((asunto) => asunto.level === 'warning' && asunto.id === place.id)
    .map((asunto) => asunto.message)

  /*
   * El archivo se escribe desde el JSON crudo y se reemplaza solo la entrada tocada. Serializar los
   * objetos de Zod reordenaría las claves de los 103 locales y el diff de la PR sería ilegible.
   */
  const placesCrudos = (crudo.places.places as Record<string, unknown>[] | undefined) ?? []
  const indice = placesCrudos.findIndex((fila) => String(fila.id) === place.id)
  const placesNuevos =
    indice >= 0
      ? placesCrudos.map((fila, posicion) =>
          posicion === indice ? (place as unknown as Record<string, unknown>) : fila,
        )
      : [...placesCrudos, place as unknown as Record<string, unknown>]

  const plazasCrudas = (crudo.plazas.plazas as Record<string, unknown>[] | undefined) ?? []
  const plazasNuevas = plazasCrudas.map((fila, posicion) => ({
    ...fila,
    placeIds: plazas[posicion]?.placeIds ?? [],
    categories: plazas[posicion]?.categories ?? [],
  }))

  return {
    ok: true,
    place,
    nuevo: !existente,
    lugares: { ...crudo.places, updatedAt: hoy, places: placesNuevos },
    plazas: { ...crudo.plazas, updatedAt: hoy, plazas: plazasNuevas },
    avisos,
  }
}

/**
 * Guarda un negocio: lo valida, sincroniza su plaza y lo manda a la PR. En desarrollo, sin
 * testigo de GitHub, valida y devuelve un aviso en vez de commitear.
 */
export async function guardarNegocio(
  entorno: EntornoGitHub & { PANEL_ABIERTO?: string },
  cuerpo: unknown,
): Promise<ResultadoGuardado> {
  const cargado = await cargar(entorno)
  const hoy = fechaLocal(new Date())
  const preparado = prepararNegocio(cargado.dataset, cargado.crudo, cuerpo, hoy)
  if (!preparado.ok) return preparado

  const negocio: NegocioGuardado = {
    id: preparado.place.id,
    nombre: preparado.place.name,
    nuevo: preparado.nuevo,
  }

  if (cargado.seco) {
    return {
      ok: true,
      seco: true,
      pr: null,
      mensaje: 'Cambio validado. En desarrollo no se commitea.',
      negocio,
      avisos: preparado.avisos,
    }
  }

  const pr = await publicar(
    entorno,
    [
      {
        ruta: 'data/commercial/places.json',
        contenido: `${JSON.stringify(preparado.lugares, null, 2)}\n`,
      },
      {
        ruta: 'data/commercial/plazas.json',
        contenido: `${JSON.stringify(preparado.plazas, null, 2)}\n`,
      },
    ],
    `Panel: ${negocio.nuevo ? 'nuevo' : 'editar'} negocio "${negocio.nombre}"`,
  )

  return {
    ok: true,
    seco: false,
    pr,
    mensaje: negocio.nuevo ? 'Negocio enviado a la PR.' : 'Cambio enviado a la PR.',
    negocio,
    avisos: preparado.avisos,
  }
}
