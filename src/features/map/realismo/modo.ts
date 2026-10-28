/**
 * Opciones del realismo para el estilo. El realismo va encendido para todos y `?realismo=no` lo apaga;
 * lo lee Experience al montar (la sincronización de la URL descarta los parámetros que no conoce) y
 * aquí solo se resuelve qué se descarga. Si algo falla, el respaldo por falla devuelve el mapa de siempre
 * y la calidad adaptable baja el costo en equipos lentos (ver install.ts y quality.ts).
 */
import type { RealismoStyleOptions } from '../style/layers/realismo.ts'

/** Con Save-Data o preferencia de menos datos no se descargan la imagen de la región ni sus calles. */
export function ahorroDeDatos(): boolean {
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return conexion?.saveData === true || window.matchMedia('(prefers-reduced-data: reduce)').matches
}

export function opcionesRealismo(
  activo: boolean,
  baseUrl: string,
): RealismoStyleOptions | undefined {
  return activo ? { baseUrl, conContexto: !ahorroDeDatos() } : undefined
}
