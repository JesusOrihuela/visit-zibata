/**
 * Esquemas del modelo de datos comercial (Zod).
 *
 * Son la única fuente de verdad de la estructura: los usan los scripts de datos (validación en build e
 * importación CSV) y los tests. La app valida en runtime con `runtimeValidation.ts`, que comparte las reglas
 * de `rules.ts` sin cargar Zod en el navegador.
 * Los tipos del dominio se infieren de aquí (ver `src/types/domain.ts`).
 */
import { z } from 'zod'
import {
  E164_PATTERN,
  GOOGLE_PLACE_ID_PATTERN,
  HEX_COLOR_PATTERN,
  isGoogleMapsUrl,
  isSafePhotoSrc,
  isValidSource,
  isValidTimeRange,
  LOCATION_CONFIDENCE,
  RESEARCH_STATUS,
  SLUG_PATTERN,
  TIME_RANGE_PATTERN,
} from './rules.ts'

export {
  DAY_KEYS,
  FIELD_SOURCE_PATTERN,
  isGoogleMapsUrl,
  LOCATION_CONFIDENCE,
  PUBLISHABLE_STATUS,
  RESEARCH_STATUS,
  SLUG_PATTERN,
  TIME_RANGE_PATTERN,
} from './rules.ts'

const slug = z
  .string()
  .regex(SLUG_PATTERN, 'Debe ser un identificador en minúsculas con guiones, p. ej. "paseo-zibata"')

const nonEmptyText = z.string().trim().min(1)

export const LocalizedTextSchema = z.object({
  es: nonEmptyText,
  en: nonEmptyText.optional(),
})

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const httpUrl = z.httpUrl({ error: 'Debe ser una URL completa que empiece por https://' })

const position = z.tuple([z.number(), z.number()])
const linearRing = z.array(position).min(4, 'Un anillo necesita al menos 4 posiciones')

export const PlazaGeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(linearRing).min(1) }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(linearRing).min(1)).min(1),
  }),
])

const timeRange = z
  .string()
  .regex(TIME_RANGE_PATTERN, 'Usa el formato "HH:MM-HH:MM" (24 h), p. ej. "08:00-22:00"')
  .refine(isValidTimeRange, 'La hora de apertura y la de cierre no pueden ser iguales')

/**
 * Horario semanal. Día ausente = sin información; lista vacía = cerrado ese día.
 * Un rango cuyo cierre es menor que la apertura cruza la medianoche ("18:00-02:00").
 */
export const HoursSchema = z.strictObject({
  mon: z.array(timeRange).optional(),
  tue: z.array(timeRange).optional(),
  wed: z.array(timeRange).optional(),
  thu: z.array(timeRange).optional(),
  fri: z.array(timeRange).optional(),
  sat: z.array(timeRange).optional(),
  sun: z.array(timeRange).optional(),
  note: nonEmptyText.optional(),
})

/**
 * Fotografía gestionada como asset propio (nunca Google Places ni scraping).
 * `src` es relativa a `public/` (sin "/" inicial) o una URL https de un almacenamiento propio.
 * `variants` lista anchos generados por `npm run images:optimize` junto a `src`
 * (`nombre-480.webp`, `nombre-480.avif`, …).
 */
export const PhotoSchema = z.strictObject({
  src: z
    .string()
    .trim()
    .min(1)
    .refine(isSafePhotoSrc, 'Usa una ruta relativa a public/ (sin "/" inicial) o una URL https'),
  alt: nonEmptyText,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  variants: z.array(z.number().int().positive()).optional(),
  placeholder: z.string().regex(HEX_COLOR_PATTERN).optional(),
  credit: nonEmptyText.optional(),
})

const e164Phone = z
  .string()
  .regex(E164_PATTERN, 'Usa formato internacional sin espacios, p. ej. "+524421234567"')

export const LinksSchema = z.strictObject({
  website: httpUrl.nullish(),
  instagram: httpUrl.nullish(),
  facebook: httpUrl.nullish(),
  tiktok: httpUrl.nullish(),
  whatsapp: e164Phone.nullish(),
  // Reparto: el enlace lo da cada negocio; sin él no se dibuja botón (nunca uno que no lleve a nada).
  rappi: httpUrl.nullish(),
  uberEats: httpUrl.nullish(),
  didiFood: httpUrl.nullish(),
})

/** URL pública o verificación en sitio ("campo:AAAA-MM-DD"); ver isValidSource en rules.ts. */
const source = z
  .string()
  .refine(isValidSource, 'Usa una URL https o "campo:AAAA-MM-DD" (verificación en sitio)')

export const VerificationSchema = z.strictObject({
  status: z.enum(RESEARCH_STATUS),
  confidence: z.enum(LOCATION_CONFIDENCE),
  lastVerifiedAt: z.iso.date(),
  sources: z.array(source).min(1),
})

const googleMapsUrl = httpUrl.refine(isGoogleMapsUrl, 'Debe ser un enlace https de Google Maps')

export const PlaceSchema = z
  .strictObject({
    id: slug,
    slug: slug,
    name: nonEmptyText,
    plazaId: slug,
    /**
     * Los giros **principales**: lo que define al local (El Hornero: parrilla argentina y pizza). Van
     * en orden y son los que llevan icono en la lista y en la ilustración redonda. La categoría no se
     * escribe aquí: se deduce de los giros con el catálogo.
     */
    giros: z.array(slug).min(1).max(3),
    /**
     * Los giros **secundarios**: lo demás que se vende ahí. En la lista salen solo como texto y su
     * dibujo aparece únicamente en la ficha. Filtran y se buscan igual que los principales, porque son
     * igual de ciertos; lo que cambia es el peso visual, no si el local aparece.
     */
    secundarios: z.array(slug).max(2).default([]),
    /**
     * La descripción la escribe el propio negocio, en español. El inglés es una traducción
     * generada: la ficha la marca como tal y deja ver el original. Sin `en`, se lee el original.
     */
    description: LocalizedTextSchema.nullable(),
    hours: HoursSchema.nullable(),
    location: LatLngSchema.nullable(),
    /**
     * Ubicación propia del local (`location`) y su enlace de Maps: solo cuando está verificada y es la
     * actual. Si faltan, la ficha lleva a la plaza, que siempre es correcta.
     */
    googleMapsUri: googleMapsUrl.nullable(),
    googlePlaceId: z
      .string()
      .regex(GOOGLE_PLACE_ID_PATTERN, 'Identificador de Google Place no válido')
      .nullable(),
    phone: e164Phone.nullable(),
    photos: z.array(PhotoSchema),
    links: LinksSchema,
    active: z.boolean(),
    /**
     * Cerrado temporalmente: por obra, vacaciones o cambio de dueño.
     *
     * No es lo mismo que `active: false`, que es la baja definitiva y saca al local del catálogo.
     * Aquí el local sigue existiendo, se busca y se encuentra; lo que cambia es que la guía avisa
     * de que ir hoy es perder el viaje, y deja de contarlo como abierto.
     *
     * Tampoco es lo mismo que vaciarle el horario. Un local sin horario es uno del que la guía no
     * sabe nada; este es uno del que sabe bastante, y callarlo mandaría gente a una puerta cerrada.
     *
     * El motivo sale de una lista cerrada para poder decirlo en los dos idiomas sin traducir texto
     * libre. `desde` es la fecha en que empezó, y no hay fecha de reapertura: mientras el negocio no
     * la dé, inventarla sería inventar un dato. La revisión por temporada es la que tiene que
     * preguntar por los que llevan meses así, porque "cerrado temporalmente" desde hace dos años es
     * un dato falso con otro nombre.
     */
    cierre: z
      .strictObject({
        motivo: z.enum(['remodelacion', 'vacaciones', 'traspaso']),
        desde: z.iso.date(),
      })
      .optional(),
    verification: VerificationSchema.optional(),
  })
  .superRefine((place, ctx) => {
    // Tres giros como tope entre los dos niveles: un local que necesita más de tres no se está
    // describiendo, se está enumerando.
    if (place.giros.length + place.secundarios.length > 3)
      ctx.addIssue({ code: 'custom', message: 'Entre giros y secundarios el tope son tres' })
    const repetido = place.secundarios.find((giro) => place.giros.includes(giro))
    if (repetido)
      ctx.addIssue({ code: 'custom', message: `"${repetido}" no puede ser principal y secundario` })
  })

export const PlazaSchema = z.strictObject({
  id: slug,
  slug: slug,
  name: nonEmptyText,
  description: LocalizedTextSchema.nullable(),
  address: nonEmptyText.nullable(),
  coordinates: LatLngSchema,
  geometry: PlazaGeometrySchema,
  active: z.boolean(),
  /**
   * Plaza confirmada y en construcción: aparece en el mapa y en la lista con la leyenda
   * "Próximamente", sin locales, y no entra en filtros ni conteos.
   */
  comingSoon: z.boolean().optional(),
  /**
   * Enlace de Google Maps de la plaza aportado y comprobado por quien mantiene la guía. Con él, "Cómo
   * llegar" abre ese sitio exacto en vez de buscar por nombre y dirección.
   */
  googleMapsUri: googleMapsUrl.optional(),
  placeIds: z.array(slug),
  categories: z.array(slug),
  /** Procedencia de la ubicación, para saber qué plazas conviene verificar en campo. */
  locationConfidence: z.enum(LOCATION_CONFIDENCE),
  locationSource: nonEmptyText,
  verification: VerificationSchema.optional(),
})

/**
 * Un giro: el tag que llevan los locales. Cada uno tiene su dibujo, salvo el marcado como `general`,
 * que es el cajón de "es esto, en general" de su categoría y comparte dibujo con ella.
 */
export const GiroSchema = z.strictObject({
  id: slug,
  label: LocalizedTextSchema,
  icon: nonEmptyText,
  synonyms: z.array(nonEmptyText),
  general: z.boolean().optional(),
})

/**
 * El slug que sale a la URL, por idioma. NO es el identificador: `id` es la clave estable con la
 * que los locales se relacionan con su categoría y nunca cambia, mientras que el slug es cara
 * pública y se puede retocar sin tocar un solo dato. Hoy el de español coincide con el id por
 * historia, no por obligación.
 */
export const LocalizedSlugSchema = z.strictObject({ es: slug, en: slug })

export const CategorySchema = z.strictObject({
  id: slug,
  slug: LocalizedSlugSchema,
  label: LocalizedTextSchema,
  icon: nonEmptyText,
  /** Tono (0-359) de la placa de color en listas y fichas; sin él se usa un neutro. */
  hue: z.number().int().min(0).max(359).optional(),
  order: z.number().int(),
  synonyms: z.array(nonEmptyText),
  giros: z.array(GiroSchema).min(1),
})

const datasetMeta = {
  $schema: z.string().optional(),
  version: z.literal(1),
  updatedAt: z.iso.date(),
}

export const CategoriesFileSchema = z.strictObject({
  ...datasetMeta,
  categories: z.array(CategorySchema),
})
export const PlazasFileSchema = z.strictObject({ ...datasetMeta, plazas: z.array(PlazaSchema) })
export const PlacesFileSchema = z.strictObject({ ...datasetMeta, places: z.array(PlaceSchema) })
