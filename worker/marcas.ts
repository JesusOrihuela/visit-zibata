/**
 * Las otras dos marcas que deja una persona: las estrellas y las visitas.
 *
 * Viajan al servidor por la misma razón que los favoritos y con el mismo patrón: el gesto es local e
 * instantáneo, el aviso va detrás y nunca lo bloquea. Lo que ganan es sobrevivir a un cambio de
 * dispositivo el día que entre Google.
 *
 * Lo que hace cada una después es distinto:
 *
 *  - **Las estrellas** alimentan el orden de todos, pero solo a través del empuje que calcula
 *    `senales.ts`. La media no sale del servidor.
 *  - **Las visitas** no alimentan ninguna señal pública. Se inflan recargando y repiten con más
 *    ruido lo que ya dice el corazón. Están para que el historial propio no se pierda.
 */

/** La misma forma que tienen los slugs del catálogo. Lo que no encaje no llega al SQL. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** La escala de la interfaz: de media en media, de 0,5 a 5. */
const ESTRELLAS_VALIDAS = (valor: unknown): valor is number =>
  typeof valor === 'number' &&
  Number.isFinite(valor) &&
  valor >= 0.5 &&
  valor <= 5 &&
  valor * 2 === Math.round(valor * 2)

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Tope por petición, igual que en los favoritos: un gesto manda uno, la subida inicial manda todo. */
export const MAXIMO_POR_PETICION = 100

/** Tope de fechas por lugar. Es el mismo que guarda el dispositivo: dos años de ir a diario. */
export const MAXIMO_FECHAS = 730

export interface Calificaciones {
  /** Lugar a estrellas. Un lugar con `null` borra la nota, que es lo que hace volver a pulsarla. */
  notas: Record<string, number | null>
}

export interface Visitas {
  /** Lugar a fechas. Se mandan todas las del lugar, no un incremento: así no hay nada que conciliar. */
  fechas: Record<string, string[]>
}

/** Lee y limpia unas calificaciones, o `null` si el cuerpo no lo es. */
export function calificacionesDe(cuerpo: unknown): Calificaciones | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const crudo = (cuerpo as { notas?: unknown }).notas
  if (typeof crudo !== 'object' || crudo === null) return null

  const notas: Record<string, number | null> = {}
  let cuantas = 0
  for (const [lugar, valor] of Object.entries(crudo as Record<string, unknown>)) {
    // Se filtra en vez de rechazar entero: un identificador raro entre veinte buenos no debe
    // costarle la sincronización a nadie.
    if (!SLUG.test(lugar)) continue
    if (valor === null) notas[lugar] = null
    else if (ESTRELLAS_VALIDAS(valor)) notas[lugar] = valor
    else continue
    cuantas++
  }
  if (cuantas === 0 || cuantas > MAXIMO_POR_PETICION) return null
  return { notas }
}

/** Lee y limpia unas visitas, o `null` si el cuerpo no lo es. */
export function visitasDe(cuerpo: unknown): Visitas | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const crudo = (cuerpo as { fechas?: unknown }).fechas
  if (typeof crudo !== 'object' || crudo === null) return null

  const fechas: Record<string, string[]> = {}
  let lugares = 0
  for (const [lugar, valor] of Object.entries(crudo as Record<string, unknown>)) {
    if (!SLUG.test(lugar) || !Array.isArray(valor)) continue
    const limpias = [
      ...new Set(valor.filter((f): f is string => typeof f === 'string' && FECHA.test(f))),
    ].slice(-MAXIMO_FECHAS)
    if (limpias.length === 0) continue
    fechas[lugar] = limpias
    lugares++
  }
  if (lugares === 0 || lugares > MAXIMO_POR_PETICION) return null
  return { fechas }
}

/** Volver a calificar sustituye: una cuenta tiene una nota por lugar, no un historial de notas. */
export const PONER_NOTA = `
INSERT INTO calificacion (cuenta_id, lugar_id, estrellas, creada) VALUES (?, ?, ?, ?)
ON CONFLICT(cuenta_id, lugar_id) DO UPDATE SET estrellas = excluded.estrellas
`.trim()

export const QUITAR_NOTA = 'DELETE FROM calificacion WHERE cuenta_id = ? AND lugar_id = ?'

export const MIS_NOTAS = 'SELECT lugar_id, estrellas FROM calificacion WHERE cuenta_id = ?'

/** `INSERT OR IGNORE`: reenviar la misma fecha no crea dos filas ni falla. */
export const MARCAR_VISITA =
  'INSERT OR IGNORE INTO visita_marcada (cuenta_id, lugar_id, fecha) VALUES (?, ?, ?)'

/** Desmarcar el mismo día borra la fila, igual que en el dispositivo. */
export const OLVIDAR_VISITAS = 'DELETE FROM visita_marcada WHERE cuenta_id = ? AND lugar_id = ?'

export const MIS_VISITAS = 'SELECT lugar_id, fecha FROM visita_marcada WHERE cuenta_id = ?'
