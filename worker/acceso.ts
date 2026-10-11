/**
 * La puerta del panel: comprobar de verdad el testigo de Cloudflare Access.
 *
 * ## Por qué no basta con mirar que la cabecera exista
 *
 * La primera versión de esto daba por buena cualquier petición que trajera
 * `Cf-Access-Jwt-Assertion`, con el argumento de que un Worker solo corre dentro de Cloudflare y
 * Cloudflare borra las cabeceras `Cf-*` de fuera. El argumento tenía dos agujeros:
 *
 *  1. **Access solo intercepta las rutas que cubre su regla.** Si la aplicación de Access se
 *     configura para `/panel` pero no para `/api/panel`, o si mañana aparece una ruta nueva, esa
 *     petición llega al Worker sin pasar por ninguna puerta, y entonces quien la hace puede escribir
 *     la cabecera él mismo. La comprobación no añadía nada y daba la impresión de añadir algo.
 *  2. **Un Worker se sirve también en `workers.dev`** salvo que se apague, y ahí la regla de Access
 *     del dominio no existe. Está apagado en `wrangler.jsonc`, pero apagarlo es una línea que
 *     alguien puede volver a encender sin darse cuenta.
 *
 * Así que se verifica la firma, que es lo que Cloudflare documenta y lo único que no depende de que
 * la configuración esté perfecta. Sin dependencias: `crypto.subtle` trae RS256, que es lo que Access
 * firma.
 *
 * ## Falla cerrado, siempre
 *
 * Sin configuración, sin testigo, con un testigo que no verifica o con el JWKS caído, la respuesta
 * es no. La única salida es `PANEL_ABIERTO`, que solo existe en desarrollo (ver `npm run worker:dev`).
 */

/** La cabecera que inyecta Cloudflare Access en todo lo que deja pasar. */
export const CABECERA_ACCESS = 'cf-access-jwt-assertion'

export interface EntornoAcceso {
  /** El dominio del equipo en Zero Trust, sin esquema: `algo.cloudflareaccess.com`. */
  ACCESS_TEAM?: string
  /** La etiqueta AUD de la aplicación de Access. La da el panel al crearla. */
  ACCESS_AUD?: string
  /** Solo en desarrollo: abre el panel sin Access. En producción no existe. */
  PANEL_ABIERTO?: string
}

/** Lo que trae el testigo y aquí se mira. Lo demás no se usa, así que no se declara. */
interface Carga {
  aud?: string | string[]
  iss?: string
  exp?: number
  nbf?: number
}

// `Uint8Array<ArrayBuffer>` y no `Uint8Array` a secas: el tipo suelto admite un `SharedArrayBuffer`
// por debajo, y `crypto.subtle` no lo acepta.
function base64urlADatos(texto: string): Uint8Array<ArrayBuffer> {
  const relleno = texto.replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(relleno.padEnd(Math.ceil(relleno.length / 4) * 4, '='))
  const bytes = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

const base64urlAJson = (texto: string): unknown =>
  JSON.parse(new TextDecoder().decode(base64urlADatos(texto)))

/**
 * Comprueba lo que se puede comprobar sin la firma: emisor, destinatario y vigencia.
 *
 * Va aparte porque es la mitad que se puede probar sin red, y porque un testigo bien firmado para
 * **otra** aplicación de Access sigue siendo un testigo que no vale aquí. Esa es la razón de mirar
 * el `aud`, y es un fallo clásico cuando solo se verifica la firma.
 */
export function cargaValida(carga: unknown, team: string, aud: string, ahora: number): boolean {
  if (typeof carga !== 'object' || carga === null) return false
  const { aud: destino, iss, exp, nbf } = carga as Carga
  if (iss !== `https://${team}`) return false
  const destinos = Array.isArray(destino) ? destino : [destino]
  if (!destinos.includes(aud)) return false
  if (typeof exp !== 'number' || exp * 1000 <= ahora) return false
  if (typeof nbf === 'number' && nbf * 1000 > ahora) return false
  return true
}

/** El JWKS del equipo, cacheado en el isolate. Access rota sus claves despacio. */
let claves: { expira: number; keys: JsonWebKey[] } | null = null
const VIDA_DEL_JWKS_MS = 60 * 60 * 1000

async function clavesDe(team: string, ahora: number): Promise<JsonWebKey[]> {
  if (claves && claves.expira > ahora) return claves.keys
  const respuesta = await fetch(`https://${team}/cdn-cgi/access/certs`)
  if (!respuesta.ok) throw new Error(`JWKS ${respuesta.status}`)
  const cuerpo = (await respuesta.json()) as { keys?: JsonWebKey[] }
  const keys = cuerpo.keys ?? []
  claves = { expira: ahora + VIDA_DEL_JWKS_MS, keys }
  return keys
}

/** Solo para las pruebas: olvida el JWKS cacheado. */
export function olvidarClaves(): void {
  claves = null
}

/**
 * ¿Puede ver el panel quien hace esta petición?
 *
 * Nunca lanza: cualquier sorpresa (red, formato, clave que no está) es un no.
 */
export async function puedeVerElPanel(
  peticion: Request,
  entorno: EntornoAcceso,
  ahora = Date.now(),
): Promise<boolean> {
  // La salida de desarrollo. No es el nombre de host: eso se puede falsificar con una cabecera Host
  // en según qué topología, y además dependía de que nadie publicara el Worker en workers.dev.
  if (entorno.PANEL_ABIERTO === 'si') return true

  const team = entorno.ACCESS_TEAM?.trim()
  const aud = entorno.ACCESS_AUD?.trim()
  // Sin configuración no hay nada que verificar, así que no se entra. Es lo contrario de lo cómodo
  // y es lo correcto: un despliegue a medias deja el panel cerrado, no abierto.
  if (!team || !aud) return false

  const testigo = peticion.headers.get(CABECERA_ACCESS)
  if (!testigo) return false
  const partes = testigo.split('.')
  if (partes.length !== 3) return false
  const [cabecera, carga, firma] = partes as [string, string, string]

  try {
    const { alg, kid } = base64urlAJson(cabecera) as { alg?: string; kid?: string }
    // Solo RS256, que es lo que firma Access. Aceptar `alg` del propio testigo es el agujero de
    // libro: con `none` o con HMAC, quien lo manda elige cómo se comprueba.
    if (alg !== 'RS256' || !kid) return false

    const jwk = (await clavesDe(team, ahora)).find(
      (clave) => (clave as { kid?: string }).kid === kid,
    )
    if (!jwk) return false

    const clave = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const firmado = new TextEncoder().encode(`${cabecera}.${carga}`)
    const bien = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      clave,
      base64urlADatos(firma),
      firmado,
    )
    if (!bien) return false

    return cargaValida(base64urlAJson(carga), team, aud, ahora)
  } catch {
    return false
  }
}
