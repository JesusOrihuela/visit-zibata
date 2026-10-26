/**
 * Cuántos caracteres caben en la línea de giros de una tarjeta.
 *
 * Antes era 25, medido en un teléfono de 375 px y aplicado en todas partes: en una hoja ancha sobraba
 * la mitad del espacio y aun así salía "+1". Ahora sale del ancho real de la fila, descontando los
 * iconos y, cuando se recorta, el hueco del contador.
 *
 * 6.1 px por carácter es la media de las etiquetas del catálogo a 13 px (medida entre 5.5 y 6.5). No
 * se mide el texto: eso obligaría a leer el layout de cada tarjeta al pintar, que es justo lo que la
 * lista evita. Si una etiqueta ancha se pasa, el texto recorta con puntos suspensivos y el contador
 * sigue a la vista, así que el error se ve como un carácter cortado y no como una fila rota.
 */
const ANCHO_CARACTER = 6.1
const ANCHO_ICONO = 18.8
const ANCHO_CONTADOR = 20

/**
 * Caracteres que caben en una fila de `px`.
 *
 * `conContador` reserva el sitio del "+1". Solo se pide cuando de verdad va a haber etiquetas de
 * sobra: reservarlo siempre es lo que hacía que una línea con todo el sitio del mundo se cortara.
 */
export function caracteresQueCaben(px: number, iconos: number, conContador = false): number {
  const ocupado = iconos * ANCHO_ICONO + (conContador ? ANCHO_CONTADOR : 0)
  return Math.max(12, Math.floor((px - ocupado) / ANCHO_CARACTER))
}
