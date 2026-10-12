/**
 * Datos del propio sitio (no de los negocios). Aquí viven los ajustes que cambian con el proyecto y
 * no con el contenido: la versión que se muestra en "Acerca de" y el canal de "Sugiere un cambio".
 */
export const APP_VERSION = __APP_VERSION__

/**
 * URL pública de la guía, la misma que usa Open Graph. Vacía si no se pasó `SITE_URL` al compilar
 * (desarrollo, pruebas y despliegues de prueba), y entonces el enlace para compartir se arma con la
 * ubicación real del navegador.
 */
export const SITE_URL = __SITE_URL__

/**
 * Adónde se envía "Sugiere un cambio": a nuestro propio servidor.
 *
 * Antes de la v4.16 salía a Web3Forms, que lo entregaba por correo. Nunca llegó a funcionar en
 * producción (faltaba la clave, así que el formulario no se dibujaba), y para cuando iba a ponerse
 * ya había servidor propio. Abrir un destino externo en la política de seguridad para algo que
 * podemos guardar nosotros no se sostenía (ver worker/sugerencias.ts).
 */
export const SUGGEST_FORM_ENDPOINT = '/api/sugerencia'
