/**
 * Decide si el mapa lleva el realismo. El mapa es el realista; solo se apaga donde no puede dibujarlo:
 *  - con renderizado por software (SwiftShader, llvmpipe: un equipo sin GPU o con la GPU en lista negra),
 *    porque dibujar edificios y árboles en 3D en el procesador deja el mapa inservible y la calidad
 *    adaptable no alcanza para compensarlo;
 *  - con Save-Data o preferencia de menos datos: el realismo suma unos 935 KB por visitante.
 * Ahí queda el mapa de antes. Si algo falla con el realismo puesto, el respaldo por falla devuelve el mapa
 * de antes y la calidad adaptable baja el costo en equipos lentos (ver install.ts y quality.ts).
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

/** Con Save-Data o preferencia de menos datos no se descarga el realismo. */
export function ahorroDeDatos(): boolean {
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return (
    conexion?.saveData === true ||
    window.matchMedia?.('(prefers-reduced-data: reduce)')?.matches === true
  )
}

export function realismoActivo(): boolean {
  return !ahorroDeDatos() && !renderizadoPorSoftware()
}

export function opcionesRealismo(
  activo: boolean,
  baseUrl: string,
): RealismoStyleOptions | undefined {
  return activo ? { baseUrl } : undefined
}
