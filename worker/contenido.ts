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
import { TITULOS_RESERVADOS } from '../src/data/titulos-reservados.ts'
import type { Category, Photo, Place } from '../src/types/domain.ts'
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
import { SUFIJO_TITULO, TOPE_TITULO } from './titulos.ts'

/** Lo que manda el formulario. Los nombres van en español porque son los de la interfaz. */
export const EntradaNegocioSchema = z.object({
  /** Vacío al crear. Con valor, es el local que se edita. */
  id: z.string().trim().optional(),
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre no puede ir vacío')
    .max(160)
    // El nombre va al título y al JSON-LD: sin saltos ni espacios dobles.
    .transform((valor) => valor.replace(/\s+/g, ' ')),
  plazaId: z.string().trim().min(1, 'Elige una plaza'),
  giros: z.array(z.string().trim().min(1)).min(1, 'Elige al menos un giro').max(3),
  /** Los secundarios van aparte y sin orden: la ficha solo los muestra como texto. */
  secundarios: z.array(z.string().trim().min(1)).max(2).optional(),
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
  /** `null` limpia el cierre; omitido conserva el que hubiera. */
  cierre: z
    .strictObject({
      motivo: z.enum(['remodelacion', 'vacaciones', 'traspaso']),
      desde: z.iso.date(),
    })
    .nullable()
    .optional(),
  /** El orden de esta lista es el orden de la galería; la primera es la portada. */
  fotos: z
    .array(
      z.strictObject({
        src: z.string().trim().min(1).max(300),
        alt: z.string().trim().min(1, 'Cada foto necesita texto alternativo').max(300),
      }),
    )
    .max(20)
    .optional(),
  activo: z.boolean().optional().default(true),
})

/** Lo que manda el formulario de fotos: la imagen ya viene reducida desde el navegador. */
export const EntradaFotoSchema = z.strictObject({
  id: z.string().trim().min(1, 'Falta el negocio'),
  archivo: z.string().trim().max(160).optional().default(''),
  alt: z.string().trim().min(1, 'El texto alternativo es obligatorio').max(300),
  ancho: z.number().int().positive().max(6000),
  alto: z.number().int().positive().max(6000),
  placeholder: z.string().regex(/^#[0-9a-f]{6}$/, 'El color de relleno no es válido'),
  /** Base64 sin el prefijo `data:`. */
  datos: z.string().min(1),
})

/**
 * El tope de una foto ya reducida en el navegador. Cuatro megas dejan sitio a una foto de 1600 px
 * con calidad alta y mantienen el cuerpo por debajo del límite del Worker y de la API de GitHub.
 */
export const TOPE_FOTO = 4 * 1024 * 1024

/** El formato se decide por los bytes, no por la extensión que diga el archivo. */
export function formatoDeImagen(bytes: Uint8Array): 'webp' | 'jpg' | 'png' | null {
  if (bytes.length < 12) return null
  const texto = (inicio: number, fin: number) => String.fromCharCode(...bytes.slice(inicio, fin))
  if (texto(0, 4) === 'RIFF' && texto(8, 12) === 'WEBP') return 'webp'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (bytes[0] === 0x89 && texto(1, 4) === 'PNG') return 'png'
  return null
}

/** Bytes a base64 canónico, por trozos para no desbordar la pila con una foto grande. */
export function base64DeBytes(bytes: Uint8Array): string {
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binario)
}
export function bytesDeBase64(datos: string): Uint8Array | null {
  const limpio = datos.replace(/\s/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(limpio) || limpio.length % 4 !== 0) return null
  try {
    const binario = atob(limpio)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

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

export type PreparadoFoto =
  | { ok: true; foto: Photo; lugares: Record<string, unknown> }
  | { ok: false; problemas: string[] }

/**
 * Valida una foto ya reducida y la deja lista para el commit. El archivo se guarda dos veces a
 * propósito: el original en `photos-src` para que `images:optimize` pueda generar variantes y AVIF
 * más adelante, y la copia que sirve la guía en `public/images/places`.
 */
export function prepararFoto(
  dataset: CommercialDataset,
  crudo: Cargado['crudo'],
  entrada: z.infer<typeof EntradaFotoSchema>,
  hoy: string,
): PreparadoFoto {
  const place = dataset.places.find((fila) => fila.id === entrada.id)
  if (!place) return { ok: false, problemas: ['Ese negocio ya no existe.'] }

  const bytes = bytesDeBase64(entrada.datos)
  if (!bytes) return { ok: false, problemas: ['La foto no llegó como base64 válido.'] }
  if (bytes.length > TOPE_FOTO) {
    return {
      ok: false,
      problemas: [`La foto pesa ${Math.round(bytes.length / 1024)} KB; el tope son 4096 KB.`],
    }
  }
  const formato = formatoDeImagen(bytes)
  if (!formato) {
    return { ok: false, problemas: ['El archivo no es una imagen WebP, JPEG o PNG.'] }
  }

  const base = slugDe(entrada.archivo.replace(/\.[^.]+$/, '')) || 'foto'
  const usados = new Set(place.photos.map((foto) => foto.src))
  let nombre = `${base}.${formato}`
  let numero = 2
  while (usados.has(`images/places/${place.id}/${nombre}`)) {
    nombre = `${base}-${numero++}.${formato}`
  }
  const src = `images/places/${place.id}/${nombre}`
  const foto: Photo = {
    src,
    alt: entrada.alt,
    width: entrada.ancho,
    height: entrada.alto,
    placeholder: entrada.placeholder,
  }

  const placesCrudos = (crudo.places.places as Record<string, unknown>[] | undefined) ?? []
  const indice = placesCrudos.findIndex((fila) => String(fila.id) === place.id)
  if (indice < 0) return { ok: false, problemas: ['El negocio no está en places.json.'] }
  const placesNuevos = placesCrudos.map((fila, posicion) =>
    posicion === indice
      ? {
          ...fila,
          photos: [...((fila.photos as unknown[] | undefined) ?? []), foto],
        }
      : fila,
  )
  const lugares = { ...crudo.places, updatedAt: hoy, places: placesNuevos }
  const revisado = PlacesFileSchema.safeParse(lugares)
  if (!revisado.success) {
    return {
      ok: false,
      problemas: revisado.error.issues.map(
        (problema) => `${problema.path.join('.') || 'datos'}: ${problema.message}`,
      ),
    }
  }
  return { ok: true, foto, lugares }
}

export type ResultadoFoto =
  | {
      ok: true
      seco: boolean
      pr: Publicacion | null
      mensaje: string
      foto: Photo | null
    }
  | { ok: false; problemas: string[] }

/** Sube una foto: la valida y la manda a la misma rama con PR que el resto del contenido. */
export async function guardarFoto(
  entorno: EntornoGitHub & { PANEL_ABIERTO?: string },
  cuerpo: unknown,
): Promise<ResultadoFoto> {
  const entrada = EntradaFotoSchema.safeParse(cuerpo)
  if (!entrada.success) {
    return {
      ok: false,
      problemas: entrada.error.issues.map(
        (problema) => `${problema.path.join('.') || 'datos'}: ${problema.message}`,
      ),
    }
  }

  const cargado = await cargar(entorno)
  const hoy = fechaLocal(new Date())
  const preparado = prepararFoto(cargado.dataset, cargado.crudo, entrada.data, hoy)
  if (!preparado.ok) return preparado

  const negocio = cargado.dataset.places.find((fila) => fila.id === entrada.data.id)
  if (cargado.seco) {
    return {
      ok: true,
      seco: true,
      pr: null,
      mensaje: 'Foto validada. En desarrollo no se guarda el archivo.',
      foto: null,
    }
  }

  const bytes = bytesDeBase64(entrada.data.datos)
  if (!bytes) return { ok: false, problemas: ['La foto no llegó como base64 válido.'] }
  const nombre = preparado.foto.src.split('/').pop() ?? 'foto'
  const contenido = base64DeBytes(bytes)

  const pr = await publicar(
    entorno,
    [
      {
        ruta: `data/commercial/photos-src/${entrada.data.id}/${nombre}`,
        contenido,
        codificacion: 'base64',
      },
      {
        ruta: `public/${preparado.foto.src}`,
        contenido,
        codificacion: 'base64',
      },
      {
        ruta: 'data/commercial/places.json',
        contenido: `${JSON.stringify(preparado.lugares, null, 2)}\n`,
      },
    ],
    `Panel: foto en "${negocio?.name ?? entrada.data.id}"`,
  )

  return {
    ok: true,
    seco: false,
    pr,
    mensaje: 'Foto enviada a la PR.',
    foto: preparado.foto,
  }
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
   * la búsqueda. Ahora el formulario manda la lista ya ordenada, con sus secundarios aparte, así que
   * se respeta tal cual. Antes eran casillas sin orden y el servidor tenía que adivinarlo.
   */
  const problemasDeGiros: string[] = []
  const pedidos = [...new Set(entrada.giros)]
  if (pedidos.length !== entrada.giros.length) {
    problemasDeGiros.push('Hay un giro repetido en la lista principal.')
  }
  const giros = pedidos
  const secundariosPedidos = entrada.secundarios
    ? [...new Set(entrada.secundarios)]
    : (existente?.secundarios ?? [])
  if (secundariosPedidos.some((giro) => giros.includes(giro))) {
    problemasDeGiros.push('Un giro no puede ser principal y secundario a la vez.')
  }
  if (giros.length + secundariosPedidos.length > 3) {
    problemasDeGiros.push('Entre giros principales y secundarios el tope son tres.')
  }
  const secundarios = secundariosPedidos
    .filter((giro) => !giros.includes(giro))
    .slice(0, Math.max(0, 3 - giros.length))
  if (problemasDeGiros.length > 0) return { problemas: problemasDeGiros }

  if ((entrada.lat == null) !== (entrada.lng == null)) {
    return { problemas: ['Indica las dos coordenadas o ninguna'] }
  }

  if (entrada.cierre && entrada.cierre.desde > hoy) {
    return { problemas: ['El cierre temporal no puede empezar en el futuro.'] }
  }

  /*
   * Las fotos se suben antes que el negocio, así que aquí solo se reordena la galería y se corrige
   * el texto alternativo. Un `src` que ya no exista se rechaza: adivinarlo sería pisar otra foto.
   */
  let photos = existente?.photos ?? []
  if (entrada.fotos) {
    const disponibles = new Map(photos.map((foto) => [foto.src, foto]))
    const vistas = new Set<string>()
    const problemasDeFotos: string[] = []
    const elegidas = []
    for (const foto of entrada.fotos) {
      const previa = disponibles.get(foto.src)
      if (!previa) {
        problemasDeFotos.push(`La foto "${foto.src}" ya no existe; recarga el panel.`)
        continue
      }
      if (vistas.has(foto.src)) {
        problemasDeFotos.push('Hay una foto repetida en la galería.')
        continue
      }
      vistas.add(foto.src)
      elegidas.push({ ...previa, alt: foto.alt })
    }
    if (problemasDeFotos.length > 0) return { problemas: problemasDeFotos }
    photos = elegidas
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
    photos,
    links: {
      ...(existente?.links ?? ENLACES_VACIOS),
      website: urlDe(entrada.sitio),
      instagram: urlDe(entrada.instagram),
      facebook: urlDe(entrada.facebook),
      whatsapp: telefonoDe(entrada.whatsapp),
    },
    active: entrada.activo,
    // `null` lo quita, `undefined` conserva el que hubiera: el formulario decide, no una heurística.
    ...(entrada.cierre === null
      ? {}
      : entrada.cierre
        ? { cierre: entrada.cierre }
        : existente?.cierre
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
    // El prerender recorta la descripción; dos textos distintos a partir del carácter 161 dejan
    // el mismo metadato. Se comparan ya recortados.
    const recorte = (valor: string): string => normalizar(valor).slice(0, 160)
    const descripcionEs = recorte(place.description?.es ?? '')
    const descripcionEn = recorte(place.description?.en ?? '')
    const mismaDescripcion = visibles.find(
      (fila) =>
        recorte(fila.description?.es ?? '') === descripcionEs ||
        recorte(fila.description?.en ?? '') === descripcionEn,
    )
    if (mismaDescripcion) {
      problemas.push(
        `La descripción coincide con la de "${mismaDescripcion.name}" en esta plaza; los metadatos de las dos fichas se repetirían.`,
      )
    }

    const plaza = dataset.plazas.find((fila) => fila.id === place.plazaId)
    // El prerender pone la zona en el título cuando el nombre se repite en cualquier plaza, no
    // solo en la misma. El título con zona es más largo y también tiene que caber.
    const visiblesGlobal = dataset.places.filter(
      (fila) => fila.id !== place.id && fila.active && plazaActiva(fila.plazaId),
    )
    const nombreRepetido = visiblesGlobal.some((fila) => normalizar(fila.name) === nombre)
    const titulos =
      nombreRepetido && plaza
        ? [
            `${place.name} en ${plaza.name}${SUFIJO_TITULO}`,
            `${place.name} in ${plaza.name}${SUFIJO_TITULO}`,
          ]
        : [`${place.name}${SUFIJO_TITULO}`]
    for (const titulo of titulos) {
      if (titulo.length > TOPE_TITULO) {
        problemas.push(
          `El nombre no cabe en el título de la página: ${titulo.length} de ${TOPE_TITULO} caracteres.`,
        )
      }
    }
    // La ficha de una plaza usa el mismo patrón de título que la de un local. Un local llamado
    // como una plaza, o con su descripción, deja dos páginas con el mismo metadato.
    const tituloReservado = TITULOS_RESERVADOS.find((titulo) => normalizar(titulo) === nombre)
    if (tituloReservado) {
      problemas.push(
        `El nombre coincide con el de la página de información "${tituloReservado}"; los títulos se repetirían.`,
      )
    }
    const plazaMismoNombre = dataset.plazas.find((fila) => normalizar(fila.name) === nombre)
    if (plazaMismoNombre) {
      problemas.push(
        `El nombre coincide con el de la plaza "${plazaMismoNombre.name}"; los títulos de las dos páginas se repetirían.`,
      )
    }
    const plazaMismaDescripcion = dataset.plazas.find(
      (fila) =>
        recorte(fila.description?.es ?? '') === descripcionEs ||
        recorte(fila.description?.en ?? '') === descripcionEn,
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
