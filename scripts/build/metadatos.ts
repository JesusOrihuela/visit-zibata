/**
 * Los metadatos de una ficha: el título y la descripción que se escriben en el `<head>`.
 *
 * ## Qué resuelve
 *
 * La descripción de una ficha era el texto del negocio, literal, aplanado a una sola línea y cortado
 * a 160 caracteres. De ahí salían cuatro defectos que se midieron en las 101 fichas:
 *
 *  - **Saltos de línea que se perdían.** 23 descripciones usan el salto como separador sin puntuación
 *    ("Urban Bistró" / "Comer rico y sentirte bien.") y al aplanarse quedaban corridas. Otras dos
 *    tienen un corte duro a media frase, que sí debe unirse con un espacio.
 *  - **Cortes colgantes.** "diga con certeza:…", "pasteles decorados y…".
 *  - **Descripciones sin contexto.** 55 de 101 miden menos de 70 caracteres ("Bowl Revolution.") y no
 *    dicen qué es ni dónde está.
 *  - **Repeticiones.** Dos locales de una misma cadena salían con el mismo título y la misma
 *    descripción, y cuando la descripción empieza con el nombre, el resultado lo decía dos veces.
 *
 * Todo esto es **solo el `<head>`**: el texto visible de la ficha y el `description` del JSON-LD siguen
 * siendo el del negocio, sin tocar. Y nada se inventa: lo único que se añade son los giros y la zona
 * del propio local, que ya están en los datos.
 *
 * Que Google muestre esta descripción, o que respete su orden, no está garantizado: Google la usa
 * cuando le parece que describe mejor la página que el texto de la propia página.
 */

/**
 * Las expresiones con caracteres tipográficos se escriben con su código y no con el carácter, que es
 * como el proyecto evita el guion largo y las comillas curvas en el código y los textos.
 */
const APOSTROFOS = /[\u2018\u2019]/g
const SEPARADOR = /^\s*(?:[.:|\u00b7\-\u2013\u2014]\s+|[|\u00b7]\s*)/
const SIGNOS_FINALES = /[\s,;:|\u00b7(\-\u2013\u2014"'\u201c\u201d\u2018\u2019]+$/u

/** Tope de la descripción. Google no documenta un límite; es el que ya usaba el sitio. */
export const LIMITE_DESCRIPCION = 160

/** Por debajo de esto, la descripción del negocio no basta para saber qué es ni dónde está. */
export const MINIMO_DESCRIPCION = 70

/**
 * Palabras que no pueden quedar al final de un texto cortado: "…pasteles decorados y…" no dice nada.
 * Solo las de uso corriente en español e inglés.
 */
const COLGANTES = new Set([
  'y',
  'e',
  'o',
  'u',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'con',
  'para',
  'en',
  'a',
  'que',
  'un',
  'una',
  'por',
  'al',
  'sin',
  '&',
  'and',
  'or',
  'the',
  'of',
  'with',
  'for',
  'in',
  'to',
  'an',
])

/**
 * Une las líneas de una descripción en una sola.
 *
 * Un salto de línea en los datos significa dos cosas opuestas, y se distinguen por lo que sigue:
 *
 *  - Si la línea siguiente empieza en **minúscula**, es un corte duro a media frase ("…una buena
 *    hamburguesa" / "sin pagar de más…"), y se une con un espacio.
 *  - Si empieza en mayúscula, emoji o cifra, es un **separador** ("Urban Bistró" / "Comer rico…").
 *    Se une con " · " cuando la anterior no termina en puntuación, y con un espacio si ya termina en
 *    ella o en un emoji. Un punto inventado partiría mal un nombre ("Arepanas" / "Bar de Arepas").
 */
export function aplanarDescripcion(texto: string): string {
  const lineas = texto
    .split(/\r?\n/)
    .map((linea) => linea.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  let salida = ''
  for (const linea of lineas) {
    if (!salida) salida = linea
    else if (/^\p{Ll}/u.test(linea)) salida += ` ${linea}`
    else if (/[\p{L}\p{N}]$/u.test(salida)) salida += ` · ${linea}`
    else salida += ` ${linea}`
  }
  return salida
}

/** Sin acentos, sin mayúsculas y con un solo tipo de apóstrofo: para comparar un nombre con un texto. */
const forma = (valor: string): string =>
  valor.normalize('NFKD').replace(/\p{M}/gu, '').replace(APOSTROFOS, "'").toLowerCase()

/**
 * Quita el nombre del local del principio de su descripción, **solo** cuando va seguido de un
 * separador ("Marie Panadería Artesanal. Pan dulce…", "Husky's Ice Cream | Helados…") y queda texto
 * de verdad. El título ya dice el nombre, y repetirlo en el fragmento lo dice dos veces.
 *
 * Nunca lo quita cuando el nombre es el sujeto de la frase ("CAFELE es una cafetería…") ni cuando la
 * descripción sigue con más nombre ("Entrecot Asador Mexicano").
 */
export function quitarNombre(texto: string, nombre: string): string {
  const objetivo = forma(nombre)
  for (let largo = 1; largo <= Math.min(texto.length, nombre.length + 3); largo++) {
    if (forma(texto.slice(0, largo)) !== objetivo) continue
    const resto = texto.slice(largo)
    const separador = SEPARADOR.exec(resto)
    if (!separador) return texto
    const queda = resto.slice(separador[0].length).trim()
    return queda.length >= 20 ? queda : texto
  }
  return texto
}

/** Quita lo que no puede quedar al final de un texto cortado: signos sueltos y palabras colgantes. */
function sinColgantes(texto: string): string {
  let corte = texto
  for (;;) {
    const limpio = corte.replace(SIGNOS_FINALES, '')
    const ultima = limpio.split(' ').pop()?.toLowerCase() ?? ''
    const sinUltima = COLGANTES.has(ultima)
      ? limpio.slice(0, limpio.length - ultima.length)
      : limpio
    if (sinUltima === corte) return corte
    corte = sinUltima
  }
}

/**
 * Corta un texto a `max` caracteres sin dejarlo a media frase.
 *
 * Prefiere terminar en una frase completa (si deja al menos la mitad del texto); si no, corta en una
 * palabra, sin signos ni palabras colgantes, y añade "…". Nunca corta dentro de una palabra ni de un
 * emoji compuesto: corta siempre en un espacio.
 */
export function recortar(valor: string, max = LIMITE_DESCRIPCION): string {
  const plano = valor.replace(/\s+/g, ' ').trim()
  if (plano.length <= max) return plano
  const ventana = plano.slice(0, Math.max(0, max - 1))
  const fin = Math.max(
    ventana.lastIndexOf('. '),
    ventana.lastIndexOf('! '),
    ventana.lastIndexOf('? '),
  )
  if (fin >= max / 2) return ventana.slice(0, fin + 1)
  const espacio = ventana.lastIndexOf(' ')
  const hasta = espacio > 0 ? ventana.slice(0, espacio) : ventana
  const limpio = sinColgantes(hasta)
  return limpio ? `${limpio}…` : `${hasta}…`
}

/** Asegura que un texto termine en puntuación, o en un emoji, antes de añadirle algo detrás. */
const terminado = (texto: string): string => (/[\p{L}\p{N}]$/u.test(texto) ? `${texto}.` : texto)

/** Lo que se sabe del local y se puede añadir sin inventar: sus giros y dónde está. */
export interface Contexto {
  /** Los giros del local, ya traducidos ("Hamburguesas", "Hot Dogs"). */
  giros: string[]
  /** "Plaza Loop Urban, Zibatá" (ver `lugarDe`). */
  lugar: string
  /** Plantilla con giros: "{giros} en {lugar}." */
  conGiros: string
  /** Plantilla sin giros, para cuando la descripción ya los dice: "En {lugar}." */
  soloLugar: string
}

const llenar = (plantilla: string, valores: Record<string, string>): string =>
  plantilla.replace(/\{(\w+)\}/g, (_, clave: string) => valores[clave] ?? '')

/**
 * El contexto que se añade a una descripción corta: los giros y la zona del local. Un giro que la
 * descripción ya nombra no se repite ("Pizza artesanal. Pizza en Paseo Zibatá." no dice nada nuevo):
 * si no queda ninguno, solo se dice dónde está.
 */
export function contextoDe(contexto: Contexto, base: string): string {
  const dicho = forma(base)
  const nuevos = contexto.giros.filter((giro) => !dicho.includes(forma(giro)))
  return nuevos.length > 0
    ? llenar(contexto.conGiros, { giros: nuevos.join(', '), lugar: contexto.lugar })
    : llenar(contexto.soloLugar, { lugar: contexto.lugar })
}

export interface OpcionesDescripcion {
  /** El texto del negocio, tal como está en los datos. */
  descripcion: string
  nombre: string
  contexto: Contexto
  /** El aviso de cierre temporal, si lo hay ("Cerrado temporalmente. Por remodelación."). */
  aviso?: string
  /** Fuerza el contexto aunque la descripción sea larga: para separar dos fichas idénticas. */
  conContexto?: boolean
  max?: number
}

/**
 * La descripción de una ficha. Delante, el aviso de cierre si lo hay; después, el texto del negocio
 * (sin su nombre repetido y en una sola línea); y detrás, el contexto, **solo** si el texto es corto
 * o si hace falta para distinguirla de otra.
 */
export function descripcionDeFicha(opciones: OpcionesDescripcion): string {
  const { nombre, aviso, conContexto = false, max = LIMITE_DESCRIPCION } = opciones
  const base = quitarNombre(aplanarDescripcion(opciones.descripcion), nombre)
  const delante = aviso ? `${aviso} ` : ''
  const corta = base.length < MINIMO_DESCRIPCION
  const contexto = contextoDe(opciones.contexto, base)
  if (!base) return recortar(`${delante}${contexto}`, max)
  if (!corta && !conContexto) return `${delante}${recortar(base, max - delante.length)}`
  const cabida = max - delante.length - contexto.length - 1
  return `${delante}${contexto} ${terminado(recortar(base, cabida))}`
}

/** Dónde está el local, dicho una sola vez: "Plaza Loop Urban, Zibatá", y "Paseo Zibatá" a secas. */
export const lugarDe = (plaza: string | undefined): string =>
  !plaza ? 'Zibatá' : /zibat[aá]/i.test(plaza) ? plaza : `${plaza}, Zibatá`

/**
 * Las claves que se repiten en una lista: devuelve el conjunto de índices cuya clave aparece más de
 * una vez. Sirve para saber qué títulos o descripciones hay que distinguir.
 */
export function repetidos(claves: string[]): Set<number> {
  const cuenta = new Map<string, number[]>()
  claves.forEach((clave, indice) => {
    const normal = clave.toLowerCase()
    cuenta.set(normal, [...(cuenta.get(normal) ?? []), indice])
  })
  return new Set([...cuenta.values()].filter((indices) => indices.length > 1).flat())
}
