/**
 * Decide si el mapa lleva el realismo y qué se descarga. Va encendido para todos, con dos salvedades:
 *  - `?realismo=no` lo apaga y `?realismo=si` lo fuerza;
 *  - con renderizado por software (SwiftShader, llvmpipe: un equipo sin GPU o con la GPU en lista negra)
 *    va apagado por defecto: dibujar edificios y árboles en 3D en el procesador deja el mapa inservible,
 *    y la calidad adaptable no alcanza para compensarlo.
 * Si algo falla con el realismo, el respaldo por falla devuelve el mapa de siempre y la calidad adaptable
 * baja el costo en equipos lentos (ver install.ts y quality.ts).
 */
import type { RealismoStyleOptions } from '../style/layers/realismo.ts'

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i

/** ¿El navegador dibuja WebGL en el procesador? Si no se puede saber, se supone que no. */
export function renderizadoPorSoftware(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return false
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return SOFTWARE_RENDERER.test(renderer)
  } catch {
    return false
  }
}

/** El realismo que pide la persona (por la URL) o, sin parámetro, el que aguanta el equipo. */
export function realismoPedido(search: string): boolean {
  const pedido = new URLSearchParams(search).get('realismo')
  if (pedido === 'no') return false
  if (pedido === 'si') return true
  return !renderizadoPorSoftware()
}

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
