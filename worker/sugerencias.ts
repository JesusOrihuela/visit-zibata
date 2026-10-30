/**
 * "Sugiere un cambio", sin terceros.
 *
 * Antes de la v4.18 esto salía a Web3Forms, que lo entregaba por correo. Nunca llegó a funcionar en
 * producción (faltaba la clave y el formulario no se dibujaba), y para cuando iba a ponerse ya
 * había servidor propio, así que no tenía sentido abrir un destino externo en la política de
 * seguridad para algo que podemos guardar nosotros.
 *
 * Lo que se gana: `connect-src` vuelve a ser solo `'self'`, no hay clave que configurar ni que
 * caduque, y las sugerencias quedan en la base, donde el panel privado las lee. Lo que se pierde:
 * el aviso por correo. Hay que entrar al panel a mirar, y por eso el panel las cuenta.
 *
 * ## Qué frena el spam
 *
 * Lo mismo que el alta de cuentas y por el mismo precio:
 *
 *  - **El campo trampa** del formulario, que ninguna persona ve.
 *  - **La prueba de trabajo**: mandar una sugerencia cuesta unos segundos de CPU del navegador.
 *  - **Que cada prueba vale una vez**, porque el sello es la clave única de la fila. Reenviar la
 *    misma choca contra el índice y no escribe nada.
 *
 * No hay identidad de por medio: mandar un recado no es guardar algo tuyo, y pedir una cuenta para
 * avisar de un horario mal puesto sería pedir más de lo que hace falta.
 */

/** Quién escribe. Saberlo cambia cuánto pesa el dato, y no obliga a nada más. */
const QUIENES = new Set(['vecino', 'negocio', 'otro'])

export const MAXIMO_MENSAJE = 1200
export const MAXIMO_LUGAR = 120
export const MAXIMO_CONTACTO = 160

export interface Sugerencia {
  quien: string
  lugar: string
  mensaje: string
  contacto: string
  sello: string
}

/** El sello tiene la forma de un secreto: 43 caracteres base64url (ver prueba-de-trabajo.ts). */
const SELLO = /^[A-Za-z0-9_-]{43}$/

/**
 * Lee y limpia una sugerencia, o `null` si no lo es.
 *
 * Se recorta en vez de rechazar por largo: quien escribió de más no debe perder lo que escribió, y
 * los topes son los mismos que ya impone el formulario.
 */
export function sugerenciaDe(cuerpo: unknown): Sugerencia | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const crudo = cuerpo as Record<string, unknown>

  const texto = (valor: unknown, tope: number): string =>
    typeof valor === 'string' ? valor.trim().slice(0, tope) : ''

  const mensaje = texto(crudo.mensaje, MAXIMO_MENSAJE)
  if (mensaje.length === 0) return null

  const sello = typeof crudo.sello === 'string' ? crudo.sello : ''
  if (!SELLO.test(sello)) return null

  const quien = typeof crudo.quien === 'string' && QUIENES.has(crudo.quien) ? crudo.quien : 'otro'
  return {
    quien,
    lugar: texto(crudo.lugar, MAXIMO_LUGAR),
    mensaje,
    contacto: texto(crudo.contacto, MAXIMO_CONTACTO),
    sello,
  }
}

export const GUARDAR = `
INSERT INTO sugerencia (id, creada, quien, lugar, mensaje, contacto, sello)
VALUES (?, ?, ?, ?, ?, ?, ?)
`.trim()

/** Las últimas para el panel. Sin paginar: con una guía de barrio no van a ser cientos. */
export const ULTIMAS = `
SELECT id, creada, quien, lugar, mensaje, contacto, atendida
  FROM sugerencia
 ORDER BY creada DESC
 LIMIT 50
`.trim()

export const SIN_ATENDER = 'SELECT COUNT(*) AS total FROM sugerencia WHERE atendida = 0'

/**
 * El identificador de una sugerencia: 16 bytes aleatorios en base64url. Se valida antes de tocar la
 * base para que una ruta inventada no llegue siquiera a una consulta.
 */
export const ID_DE_SUGERENCIA = /^[A-Za-z0-9_-]{22}$/

/** Marca una sugerencia como atendida. Atender dos veces la misma no cambia nada. */
export const ATENDER = 'UPDATE sugerencia SET atendida = 1 WHERE id = ?'
