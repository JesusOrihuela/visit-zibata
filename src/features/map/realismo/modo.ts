/**
 * Opciones del realismo para el estilo. Quien lo pide (hoy solo `?realismo=si`, que lee Experience al
 * montar porque la sincronización de la URL descarta los parámetros que no conoce) decide si va; aquí
 * solo se resuelve qué se descarga. Se enciende para todos en la última fase, cuando el respaldo por
 * falla y la calidad adaptable ya están probados.
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
