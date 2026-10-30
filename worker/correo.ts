/**
 * El aviso diario de sugerencias sin atender.
 *
 * Es la única cosa que el Worker manda fuera del sitio, y va por el enlace `send_email` de
 * Cloudflare: no hay servicio de correo contratado, ni clave, ni SMTP que mantener.
 *
 * ## A quién le llega
 *
 * A `avisos@visitzibata.com`, que no es un buzón: Email Routing lo reenvía al correo de quien
 * mantiene la guía. Así la dirección personal no aparece en el repositorio, que es público, y la
 * que se ve es una del dominio.
 *
 * ## Por qué texto y no HTML
 *
 * Los mensajes los escribe cualquiera. En texto plano no hay etiquetas que interpretar y no hace
 * falta escapar nada; en HTML habría que hacerlo bien o dejar una puerta abierta en el correo de
 * quien mantiene la guía.
 *
 * ## Cuándo se manda
 *
 * Una vez al día, a las 9 de la mañana de Zibatá (ver `triggers.crons` en wrangler.jsonc). Si no
 * hay nada pendiente no se manda nada: un correo vacío todos los días es ruido y acaba ignorado.
 * Las que siguen sin atenderse vuelven a salir al día siguiente, que es justo lo que se quiere.
 */
import { fechaLocal } from './analitica.ts'

/** Una sugerencia sin atender, con lo justo para el correo. */
export interface Pendiente {
  creada: string
  quien: string
  lugar: string
  mensaje: string
  contacto: string
}

/**
 * Lo que se usa del enlace `send_email`. Se declara aquí y no se importa de la plataforma porque el
 * resto del Worker hace lo mismo: solo lo que de verdad se usa.
 */
export interface Correo {
  send(mensaje: {
    from: { email: string; name: string }
    to: string
    subject: string
    text: string
  }): Promise<unknown>
}

/** De dónde sale y a dónde llega. La segunda la reenvía Email Routing al buzón de verdad. */
export const DE = 'avisos@visitzibata.com'
export const PARA = 'avisos@visitzibata.com'

/** Los nombres se leen en el correo, no se guardan así en la base. */
const QUIENES: Record<string, string> = {
  vecino: 'Vecino',
  negocio: 'El negocio',
  otro: 'Otro',
}

/** Cuántas caben en un correo. Más de treinta no se lee, se archiva. */
export const MAXIMO_EN_EL_CORREO = 30

const dia = (creada: string): string => {
  const fecha = new Date(creada)
  return Number.isNaN(fecha.getTime()) ? creada.slice(0, 10) : fechaLocal(fecha)
}

/**
 * El asunto y el cuerpo de un resumen, o `null` si no hay nada que contar.
 *
 * `total` es cuántas hay sin atender de verdad, que puede ser mayor que las que caben en `filas`:
 * el correo dice cuántas quedan fuera para que el número no engañe.
 */
export function resumenDe(
  filas: Pendiente[],
  total = filas.length,
): { subject: string; text: string } | null {
  const cuantas = Math.max(total, filas.length)
  if (filas.length === 0 || cuantas === 0) return null

  const subject =
    cuantas === 1
      ? '1 sugerencia sin atender en Visit Zibatá'
      : `${cuantas} sugerencias sin atender en Visit Zibatá`

  // El tope se aplica aquí y no solo en la consulta: así el correo no depende de que quien llame
  // se acuerde de recortar.
  const mostradas = filas.slice(0, MAXIMO_EN_EL_CORREO)
  const bloques = mostradas.map((fila, indice) => {
    const donde = [dia(fila.creada), QUIENES[fila.quien] ?? fila.quien, fila.lugar]
      .filter(Boolean)
      .join(' · ')
    const contacto = fila.contacto ? `\nContacto: ${fila.contacto}` : ''
    return `${indice + 1}. ${donde}\n${fila.mensaje}${contacto}`
  })

  const fuera =
    cuantas > mostradas.length
      ? `\n\nY ${cuantas - mostradas.length} más, que no caben en este correo.`
      : ''

  const text = [
    cuantas === 1
      ? 'Hay 1 sugerencia sin atender en Visit Zibatá.'
      : `Hay ${cuantas} sugerencias sin atender en Visit Zibatá.`,
    '',
    bloques.join('\n\n') + fuera,
    '',
    'Atiéndelas en https://visitzibata.com/panel',
  ].join('\n')

  return { subject, text }
}

/**
 * Manda el resumen si hay algo. Devuelve si salió, y no lanza: quien llama decide qué hacer con el
 * fallo, y un correo que no sale no puede tumbar nada más.
 */
export async function avisar(
  correo: Correo | undefined,
  filas: Pendiente[],
  total = filas.length,
): Promise<boolean> {
  const resumen = resumenDe(filas, total)
  if (!resumen) return false
  if (!correo) {
    console.error('[correo] falta el enlace send_email')
    return false
  }
  await correo.send({
    from: { email: DE, name: 'Visit Zibatá' },
    to: PARA,
    ...resumen,
  })
  return true
}
