/**
 * Colores de identidad: los de cada zona y los de cada categoría.
 *
 * Dos dimensiones, cada una en la superficie donde responde a la pregunta del usuario:
 *  - Zona (mapa y cabeceras): "¿cuál es cuál?" al mirar Zibatá desde arriba.
 *  - Categoría (listas y fichas): "¿qué tipo de comida es?" al elegir dónde comer.
 *
 * Para que nunca parezca que una zona y una categoría "comparten" color (no significan lo mismo) las
 * dos familias viven en registros distintos:
 *  - Zona: color de identidad pleno y saturado, siempre en una forma sólida (la gota del marcador, el
 *    suelo y el volumen de sus edificios en el mapa).
 *  - Categoría: tinte muy claro de fondo con el icono en tinta oscura; nunca un color pleno.
 *
 * El color de una zona se declara una sola vez, abajo, y de él salen los demás: su texto legible, su
 * suelo y sus edificios. No se reparten por orden de llegada, así que una zona nueva no le mueve el
 * color a nadie.
 */
import { contraste, hslDe } from './color.ts'

/** Convierte HSL a hexadecimal. Los tonos derivados se definen en HSL porque la regla vive en la saturación. */
function hsl(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100
  const l = lightness / 100
  const k = (n: number) => (n + hue / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const value = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

/**
 * Aclara (positivo) u oscurece (negativo) un color en su propio tono. Los estados del mapa ·cursor
 * encima y plaza seleccionada· se derivan así del color de cada zona, en vez de volver todos al verde
 * de marca: la zona sigue siendo reconocible mientras está seleccionada.
 */
export function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => {
    const current = (value >> shift) & 0xff
    const next = amount >= 0 ? current + (255 - current) * amount : current * (1 + amount)
    return Math.round(Math.min(255, Math.max(0, next)))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(16)}${channel(8)}${channel(0)}`
}

export interface PlazaTone {
  /** Suelo de la zona en el mapa. */
  site: string
  siteOutline: string
  /** Volumen de los edificios de la zona. */
  building: string
  /** El color de identidad en pantalla: la gota, su tallo y los alfileres en miniatura. */
  accent: string
  /** Texto que va encima de `accent`: arena en todas, por decisión de la marca. */
  onAccent: string
  /** El mismo tono como texto sobre superficie clara (nombre de zona, cifra de la gota). */
  ink: string
  /** Fondo suave para insignias y pastillas. */
  soft: string
}

/** Las tres superficies claras donde se apoya un color de zona. */
const PAPEL = '#f8f4ed' // sand-50, la superficie de una ficha
const ARENA = '#fcfaf6' // sand-25

/** Oscurece el tono en su propia saturación hasta que se lea sobre el papel. */
function tintaLegible(accent: string): string {
  const { h, s, l } = hslDe(accent)
  for (let luz = l; luz >= 12; luz -= 1) {
    const candidato = hsl(h, s, luz)
    if (contraste(candidato, PAPEL) >= 4.5) return candidato
  }
  return hsl(h, s, 12)
}

/**
 * El color de cada zona activa, el que se ve en la gota y en el suelo del mapa. Es el único sitio
 * donde vive: el suelo, los edificios y los textos se derivan de aquí.
 *
 * Cuatro van un paso más hondos que su color de marca, lo justo para que el texto de la etiqueta vaya
 * en arena como en todas: se les baja la claridad y nada más, así que el tono sigue siendo el suyo.
 * Anáhuac es la excepción que fijó el propietario: conserva `#ff5900` y su arena se queda en 3,02:1,
 * el mínimo de un objeto gráfico.
 *
 * Lo que la prueba comprueba, no este comentario: que dos zonas no se confundan (ΔE00 ≥ 10 entre
 * todas), que ninguna se lea como la paleta de marca ni como una categoría, que ninguna sea negra,
 * blanca ni gris, y que el texto de la gota y el nombre sobre papel se lean.
 */
export const PLAZA_COLORS: Readonly<Record<string, string>> = {
  'anahuac-queretaro': '#ff5900',
  'xentric-anahuac': '#007e8e', // #0097aa
  'xentric-zibata': '#6e3b14',
  'centro-zibata': '#078450',
  'paseo-zibata': '#cf403f', // #eb5b53
  condesa: '#248411', // #2ca115
  'plaza-loop': '#4b2fb5',
  'plaza-luna': '#021f4f',
  'mol-jamadi': '#3b1548',
  'campo-de-golf': '#02467d',
  'plaza-zielo': '#189ad2', // #53bdeb
}

function tonoDeZona(color: string): PlazaTone {
  const { h } = hslDe(color)
  return {
    accent: color,
    onAccent: ARENA,
    ink: tintaLegible(color),
    site: hsl(h, 42, 80),
    siteOutline: hsl(h, 45, 58),
    building: hsl(h, 45, 63),
    soft: hsl(h, 42, 93),
  }
}

const PLAZA_TONES = new Map(
  Object.entries(PLAZA_COLORS).map(([id, color]) => [id, tonoDeZona(color)]),
)

/** Zonas sin color propio (en obra o sin publicar): el verde de marca. */
export const DEFAULT_PLAZA_TONE = tonoDeZona('#536c2a')

/**
 * El tono de cada zona que se le pida. Se calcula una vez por catálogo: el mapa y los paneles
 * consultan el mismo mapa de tonos.
 */
export function plazaTones(plazaIds: readonly string[]): Map<string, PlazaTone> {
  return new Map(plazaIds.map((id) => [id, PLAZA_TONES.get(id) ?? DEFAULT_PLAZA_TONE]))
}

/**
 * Las variables CSS de un tono, para un `style`. Son cuatro y van juntas a propósito: quien pinta el
 * color tiene que poder pintar también el texto que va encima, o el texto lo elige otro.
 */
export function plazaVars(tone: PlazaTone, prefix = 'plaza'): Record<string, string> {
  return {
    [`--${prefix}-accent`]: tone.accent,
    [`--${prefix}-on-accent`]: tone.onAccent,
    [`--${prefix}-ink`]: tone.ink,
    [`--${prefix}-soft`]: tone.soft,
  }
}

export interface CategoryTone {
  /** Fondo de la placa de categoría: un tinte, nunca un color pleno. */
  soft: string
  /** Trazo del icono sobre ese fondo (contraste AA). */
  ink: string
}

export const NEUTRAL_CATEGORY_TONE: CategoryTone = { soft: '#ece5da', ink: '#665847' }

/**
 * Tinte de fondo y tinta del icono a partir del tono que declara la categoría en los datos
 * (`hue` en research/taxonomy.json → categories.json). Mucho más claros y apagados que cualquier color
 * de zona. Una categoría nueva sin tono usa el neutro: añadir categorías nunca rompe la interfaz.
 */
export function categoryTone(category: { hue?: number } | undefined): CategoryTone {
  const hue = category?.hue
  return hue === undefined
    ? NEUTRAL_CATEGORY_TONE
    : { soft: hsl(hue, 34, 92), ink: hsl(hue, 38, 33) }
}
