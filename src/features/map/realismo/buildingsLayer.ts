/**
 * Capa propia de edificios: volúmenes de azotea plana con luz de cielo y sol, oscurecimiento en la base,
 * oclusión entre vecinos (horneada en la malla) y sombra proyectada al suelo. Cada pared lleva un byte con la
 * paleta y la semilla del edificio, y el color de la familia de satélite; ver scripts/map/realismo/build-mallas.ts.
 */
import type { CustomLayerInterface, Map as MapLibreMap } from 'maplibre-gl'
import {
  type BinHeader,
  compileProgram,
  fetchBin,
  matrixFor,
  type RenderArgs,
  visibleRanges,
} from './gl.ts'
import type { Quality } from './quality.ts'

/** Dirección del sol (hacia él), de 225 grados de azimut y 34 de la vertical. */
export const SUN: readonly [number, number, number] = [-0.395, -0.395, 0.829]
/** Las sombras proyectadas solo se dibujan de cerca: de lejos no se distinguen y cuestan el doble de triángulos. */
export const SHADOW_MIN_ZOOM = 15.3

interface BuildingsHeader extends BinHeader {
  vertices: number
}

const VERTEX = `#version 300 es
in vec3 a_pos; in vec4 a_nrm; in vec4 a_col;
uniform mat4 u_matrix; uniform vec3 u_sun;
out vec3 v_col;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 1.0);
  vec3 n = normalize(a_nrm.xyz);
  int wi = int(floor(a_nrm.w * 127.0 + 0.5));
  float seed = float(wi - (wi / 16) * 16) / 15.0;
  bool roof = n.z > 0.9;
  // La azotea es la familia de satélite algo más oscura; las paredes, la misma familia en un tono cálido.
  vec3 albedo = a_col.rgb * (roof ? vec3(0.88) : vec3(0.97, 0.91, 0.83));
  float foot = roof ? 1.0 : mix(0.80, 1.05, smoothstep(0.0, 6.0, a_pos.z));
  float k = 0.94 + 0.12 * seed;
  if (!roof) k *= a_col.a;
  float d = max(dot(n, normalize(u_sun)), 0.0);
  vec3 sky = vec3(0.72, 0.75, 0.82) * (0.62 + 0.18 * n.z);
  vec3 sun = vec3(1.0, 0.92, 0.78) * 0.62 * d;
  v_col = albedo * (sky + sun) * foot * k;
}`

const FRAGMENT = `#version 300 es
precision mediump float;
in vec3 v_col; out vec4 o;
void main() { o = vec4(v_col, 1.0); }`

const SHADOW_VERTEX = `#version 300 es
in vec3 a_pos; uniform mat4 u_matrix; uniform vec3 u_sun;
void main() { vec3 p = a_pos; p.xy -= u_sun.xy / u_sun.z * p.z; p.z = 0.05; gl_Position = u_matrix * vec4(p, 1.0); }`

const SHADOW_FRAGMENT = `#version 300 es
precision mediump float; out vec4 o;
void main() { o = vec4(0.16, 0.12, 0.18, 0.42); }`

export interface LayerHooks {
  quality: Quality
  /** La capa terminó de cargar y ya dibuja: las nativas equivalentes pueden ocultarse. */
  onReady: () => void
  /** La capa falló al montarse o al dibujar: se quita y vuelven las nativas. */
  onFail: (error: unknown) => void
  /** Acción que deja a MapLibre repintar sus máscaras tras la pasada de sombras; `null` si no se puede. */
  resetStencil: (() => void) | null
}

export function createBuildingsLayer(
  id: string,
  url: string,
  hooks: LayerHooks,
): CustomLayerInterface {
  let mapRef: MapLibreMap | null = null
  let program: WebGLProgram | null = null
  let shadowProgram: WebGLProgram | null = null
  let vao: WebGLVertexArrayObject | null = null
  let header: BuildingsHeader | null = null
  const buffers: WebGLBuffer[] = []
  let failed = false

  const fail = (error: unknown): void => {
    if (failed) return
    failed = true
    hooks.onFail(error)
  }

  return {
    id,
    type: 'custom',
    renderingMode: '3d',
    async onAdd(map: MapLibreMap, context) {
      try {
        mapRef = map
        const g = context as WebGL2RenderingContext
        program = compileProgram(g, VERTEX, FRAGMENT)
        shadowProgram = compileProgram(g, SHADOW_VERTEX, SHADOW_FRAGMENT)
        const { buffer, header: h, offset } = await fetchBin<BuildingsHeader>(url)
        header = h
        const n = h.vertices
        vao = g.createVertexArray()
        g.bindVertexArray(vao)
        let at = offset
        const upload = (
          type: number,
          bytes: number,
          name: string,
          size: number,
          normalized: boolean,
        ) => {
          const b = g.createBuffer()
          g.bindBuffer(g.ARRAY_BUFFER, b)
          g.bufferData(g.ARRAY_BUFFER, new Uint8Array(buffer, at, bytes), g.STATIC_DRAW)
          buffers.push(b)
          for (const p of [program, shadowProgram]) {
            if (!p) continue
            const loc = g.getAttribLocation(p, name)
            if (loc < 0) continue
            g.enableVertexAttribArray(loc)
            g.vertexAttribPointer(loc, size, type, normalized, bytes / n, 0)
          }
          at += bytes
        }
        // Mismas ubicaciones en los dos programas: la sombra solo lee la posición.
        g.bindAttribLocation(program, 0, 'a_pos')
        g.bindAttribLocation(shadowProgram, 0, 'a_pos')
        g.linkProgram(program)
        g.linkProgram(shadowProgram)
        upload(g.FLOAT, n * 12, 'a_pos', 3, false)
        upload(g.BYTE, n * 4, 'a_nrm', 4, true)
        upload(g.UNSIGNED_BYTE, n * 4, 'a_col', 4, true)
        g.bindVertexArray(null)
        map.triggerRepaint()
        hooks.onReady()
      } catch (error) {
        fail(error)
      }
    },
    render(g, args) {
      if (failed || !vao || !program || !shadowProgram || !header) return
      try {
        const gl2 = g as WebGL2RenderingContext
        const matrix = matrixFor(args as unknown as RenderArgs, header)
        const sun = new Float32Array(SUN)
        gl2.useProgram(program)
        gl2.uniformMatrix4fv(gl2.getUniformLocation(program, 'u_matrix'), false, matrix)
        gl2.uniform3fv(gl2.getUniformLocation(program, 'u_sun'), sun)
        gl2.enable(gl2.DEPTH_TEST)
        gl2.depthFunc(gl2.LEQUAL)
        gl2.depthMask(true)
        gl2.disable(gl2.CULL_FACE)
        gl2.bindVertexArray(vao)
        for (const r of visibleRanges(matrix, header.celdas, header.celda, 45)) {
          gl2.drawArrays(gl2.TRIANGLES, r.from, r.to - r.from)
        }
        if (
          hooks.quality.level >= 2 &&
          hooks.resetStencil &&
          (mapRef?.getZoom() ?? 0) >= SHADOW_MIN_ZOOM
        ) {
          // Sombra proyectada al suelo a lo largo del rayo del sol; el estarcido evita oscurecer dos veces donde se solapan.
          gl2.useProgram(shadowProgram)
          gl2.uniformMatrix4fv(gl2.getUniformLocation(shadowProgram, 'u_matrix'), false, matrix)
          gl2.uniform3fv(gl2.getUniformLocation(shadowProgram, 'u_sun'), sun)
          gl2.depthMask(false)
          gl2.enable(gl2.BLEND)
          gl2.blendFunc(gl2.SRC_ALPHA, gl2.ONE_MINUS_SRC_ALPHA)
          gl2.enable(gl2.STENCIL_TEST)
          gl2.stencilMask(0xff)
          gl2.clearStencil(0)
          gl2.clear(gl2.STENCIL_BUFFER_BIT)
          gl2.stencilFunc(gl2.NOTEQUAL, 1, 0xff)
          gl2.stencilOp(gl2.KEEP, gl2.KEEP, gl2.REPLACE)
          for (const r of visibleRanges(matrix, header.celdas, header.celda, 45, 40)) {
            gl2.drawArrays(gl2.TRIANGLES, r.from, r.to - r.from)
          }
          gl2.disable(gl2.STENCIL_TEST)
          gl2.disable(gl2.BLEND)
          gl2.depthMask(true)
          hooks.resetStencil()
        }
        gl2.bindVertexArray(null)
      } catch (error) {
        fail(error)
      }
    },
    onRemove(_map, context) {
      for (const b of buffers) context.deleteBuffer(b)
    },
  }
}
