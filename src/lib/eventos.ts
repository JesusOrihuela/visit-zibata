/**
 * Contar lo que se hace dentro de la guía, sin saber quién lo hace.
 *
 * Es el lado del navegador de worker/eventos.ts, que explica la promesa: un contador por día, un
 * vocabulario cerrado y nada de texto libre. Aquí se cumple la otra mitad:
 *
 *  - **No lleva identidad.** No usa `enviar()` de sincronizar.ts, que adjunta la credencial de la
 *    cuenta anónima (y la crea si no existe). Un evento no cuelga de ninguna cuenta.
 *  - **No guarda nada en el dispositivo.** Sin cookie, sin almacenamiento local, sin huella: la cola
 *    vive en memoria y se pierde al cerrar la pestaña.
 *  - **Respeta la señal del navegador.** Con `globalPrivacyControl` o `doNotTrack` activos, no se
 *    encola ni se envía nada.
 *  - **Nunca rompe la página.** Se envía con `sendBeacon` (o `fetch` con `keepalive`) y un fallo se
 *    ignora; no hay reintentos ni avisos.
 *
 * Los eventos se acumulan y salen juntos cuando la pestaña se oculta, con un tope de veinte por
 * envío: una petición por visita en vez de una por clic.
 */

export type Tipo = 'ficha' | 'salida' | 'compartir' | 'busqueda' | 'filtro' | 'mapa' | 'idioma'

export interface Evento {
  tipo: Tipo
  destino: string
  detalle?: string
}

/** Debe coincidir con `MAXIMO_POR_ENVIO` de worker/eventos.ts. */
const MAXIMO_POR_ENVIO = 20
/** Una cola que crece sin enviarse es un fallo: se tira lo más viejo antes que crecer sin fin. */
const MAXIMO_EN_COLA = 100
const RUTA = '/api/evento'

const cola: Evento[] = []

/** ¿Pidió esta persona que no se la mida? `doNotTrack` lo expone cada navegador a su manera. */
export function medicionPermitida(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const aviso = navigator as Navigator & {
    globalPrivacyControl?: boolean
    msDoNotTrack?: string
  }
  const ventana = window as Window & { doNotTrack?: string }
  if (aviso.globalPrivacyControl === true) return false
  const noRastrear = [aviso.doNotTrack, ventana.doNotTrack, aviso.msDoNotTrack]
  return !noRastrear.some((valor) => valor === '1' || valor === 'yes')
}

const idiomaActual = (): 'es' | 'en' => (document.documentElement.lang === 'en' ? 'en' : 'es')

/** Apunta un evento. No hace nada si la persona pidió que no se la mida. */
export function registrar(tipo: Tipo, destino: string, detalle?: string): void {
  if (!medicionPermitida()) return
  cola.push(detalle ? { tipo, destino, detalle } : { tipo, destino })
  if (cola.length > MAXIMO_EN_COLA) cola.splice(0, cola.length - MAXIMO_EN_COLA)
  if (cola.length >= MAXIMO_POR_ENVIO) vaciar()
}

/** Manda lo acumulado, de veinte en veinte. */
export function vaciar(): void {
  while (cola.length > 0) {
    const lote = cola.splice(0, MAXIMO_POR_ENVIO)
    enviarLote(JSON.stringify({ idioma: idiomaActual(), eventos: lote }))
  }
}

function enviarLote(cuerpo: string): void {
  // Texto plano: `text/plain` es una cabecera que el navegador manda sin preguntar, y el Worker lee el
  // cuerpo como texto sin mirar el tipo. Un `Blob` JSON obligaría a una comprobación previa.
  try {
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(RUTA, cuerpo)) return
  } catch {
    // Si el navegador lo rechaza, se intenta con `fetch`.
  }
  try {
    void fetch(RUTA, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: cuerpo,
      keepalive: true,
      // Sin cookies ni credenciales: lo único que viaja es el cuerpo.
      credentials: 'omit',
    }).catch(() => {})
  } catch {
    // Contar es lo accesorio.
  }
}

/**
 * Cómo se llama en la medición cada enlace de contacto de una ficha (la lista cerrada `SALIDAS` de
 * worker/eventos.ts). Lo que no se reconoce devuelve `null` y no se cuenta: mejor perder un clic que
 * mandar un nombre que el Worker va a descartar.
 */
const SALIDA_DE_CONTACTO: Record<string, string> = {
  phone: 'telefono',
  whatsapp: 'whatsapp',
  website: 'web',
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  rappi: 'rappi',
  'uber-eats': 'uber',
  'didi-food': 'didi',
}

export const salidaDe = (clave: string): string | null => SALIDA_DE_CONTACTO[clave] ?? null

let escuchando = false

/** Engancha el envío al momento en que la pestaña se oculta o se cierra. Idempotente. */
export function iniciarMedicion(): void {
  if (escuchando || typeof document === 'undefined') return
  escuchando = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') vaciar()
  })
  // Safari móvil no siempre dispara `visibilitychange` al cerrar: `pagehide` lo cubre.
  window.addEventListener('pagehide', vaciar)
}

/** Para las pruebas. */
export function _colaParaPruebas(): Evento[] {
  return cola
}
