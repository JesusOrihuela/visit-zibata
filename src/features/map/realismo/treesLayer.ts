/**
 * Capa propia de árboles, una instancia por árbol (x, y, base de copa, altura, radio, variante, azar):
 *  - de lejos (menos de zoom 16,3) o con calidad 1, puntos sombreados como esfera;
 *  - de cerca, copa de icosfera deformada con ruido (20 caras hasta zoom 18,2 y 80 caras después) y tronco;
 *  - solo las celdas de 250 m a menos de 450 m de la cámara llevan malla y sombra; el resto, puntos.
 */
import type { CustomLayerInterface, Map as MapLibreMap } from 'maplibre-gl'
import { type LayerHooks, SHADOW_MIN_ZOOM, SUN } from './buildingsLayer.ts'
import {
  type BinHeader,
  type Cell,
  cameraPosition,
  compileProgram,
  fetchBin,
  matrixFor,
  type RenderArgs,
  visibleRanges,
} from './gl.ts'

const POINTS_BELOW_ZOOM = 16.3
const FINE_MESH_FROM_ZOOM = 18.2
const MESH_DISTANCE_M = 450
const STRIDE = 32

interface TreesHeader extends BinHeader {
  instancias: number
}

const PALETTE =
  'const vec3 pal[6] = vec3[6](vec3(0.37,0.54,0.29), vec3(0.53,0.66,0.35), vec3(0.70,0.77,0.44), vec3(0.31,0.48,0.27), vec3(0.61,0.71,0.42), vec3(0.44,0.60,0.35));'
const NOISE = `float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y), f.z); }`

const CROWN_VERTEX = `#version 300 es
in vec3 a_p; in vec4 a_i0; in vec4 a_i1;
uniform mat4 u_matrix; uniform vec3 u_sun;
out vec3 v_col;
${PALETTE}
${NOISE}
void main() {
  float zb = a_i0.z, zt = a_i0.w;
  float rv = max((zt - zb) * 0.5, 0.9), zc = (zb + zt) * 0.5;
  float r = max(a_i1.x, 1.2) * 1.12;
  float n = vn(a_p * 2.4 + a_i1.z * 37.0);
  float s = 1.0 + 0.36 * (n - 0.5);
  vec3 w = vec3(a_i0.x + a_p.x * r * s, a_i0.y + a_p.y * r * s, zc + a_p.z * rv * s);
  gl_Position = u_matrix * vec4(w, 1.0);
  float d = max(dot(normalize(a_p), normalize(u_sun)), 0.0);
  float top = 0.62 + 0.38 * (a_p.z * 0.5 + 0.5);
  v_col = pal[int(a_i1.y)] * (0.5 + 0.6 * d) * top * (0.88 + 0.24 * n);
}`

const TRUNK_VERTEX = `#version 300 es
in vec3 a_p; in vec4 a_i0; in vec4 a_i1;
uniform mat4 u_matrix; uniform vec3 u_sun;
out vec3 v_col;
void main() {
  float height = a_i0.z + 0.9;
  vec3 w = vec3(a_i0.x + a_p.x * 0.24, a_i0.y + a_p.y * 0.24, a_p.z * height);
  gl_Position = u_matrix * vec4(w, 1.0);
  float d = max(dot(normalize(vec3(a_p.xy, 0.0)), normalize(u_sun)), 0.0);
  v_col = vec3(0.45, 0.35, 0.27) * (0.55 + 0.5 * d);
}`

const FRAGMENT = `#version 300 es
precision mediump float;
in vec3 v_col; out vec4 o;
void main() { o = vec4(v_col, 1.0); }`

const POINT_VERTEX = `#version 300 es
in vec4 a_i0; in vec4 a_i1;
uniform mat4 u_matrix; uniform vec2 u_vp; uniform float u_max;
out vec3 v_base; out float v_n;
${PALETTE}
${NOISE}
void main() {
  float zc = (a_i0.z + a_i0.w) * 0.5;
  float r = max(a_i1.x, 1.2) * 1.12;
  vec4 c = u_matrix * vec4(a_i0.x, a_i0.y, zc, 1.0);
  vec4 e = u_matrix * vec4(a_i0.x + r, a_i0.y, zc, 1.0);
  vec2 d = (e.xy / e.w - c.xy / c.w) * 0.5 * u_vp;
  gl_Position = c;
  gl_PointSize = clamp(1.7 * length(d) + 1.0, 2.0, u_max);
  v_base = pal[int(a_i1.y)];
  v_n = vn(vec3(a_i0.xy, 0.0) * 0.7 + a_i1.z * 37.0);
}`

const POINT_FRAGMENT = `#version 300 es
precision mediump float;
in vec3 v_base; in float v_n; out vec4 o;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  vec3 n = vec3(q, sqrt(1.0 - r2));
  float d = max(dot(n, normalize(vec3(-0.45, 0.5, 0.75))), 0.0);
  float top = 0.62 + 0.38 * (n.y * 0.5 + 0.5);
  o = vec4(v_base * (0.5 + 0.6 * d) * top * (0.88 + 0.24 * v_n) * 1.1, 1.0);
}`

const SHADOW_VERTEX = `#version 300 es
in vec2 a_q; in vec4 a_i0; in vec4 a_i1;
uniform mat4 u_matrix; uniform vec3 u_sun;
out vec2 v_q;
void main() {
  v_q = a_q;
  float zc = (a_i0.z + a_i0.w) * 0.5;
  float r = max(a_i1.x, 1.2) * 1.15;
  vec2 c = a_i0.xy - u_sun.xy / u_sun.z * zc;
  vec2 d = normalize(-u_sun.xy);
  vec2 q = vec2(a_q.x * r * 1.5, a_q.y * r);
  vec2 w = c + d * q.x + vec2(-d.y, d.x) * q.y;
  gl_Position = u_matrix * vec4(w, 0.06, 1.0);
}`

const SHADOW_FRAGMENT = `#version 300 es
precision mediump float; in vec2 v_q; out vec4 o;
void main() { float d = dot(v_q, v_q); if (d > 1.0) discard; o = vec4(0.12, 0.14, 0.10, 0.3 * smoothstep(1.0, 0.35, d)); }`

/** Icosfera con `subdivisions` subdivisiones: 0 son 12 vértices y 20 caras; 1, 42 y 80. */
function icosphere(subdivisions: number): {
  vertices: Float32Array
  indices: Uint16Array
} {
  const t = (1 + Math.sqrt(5)) / 2
  const unit = (q: number[]): number[] => {
    const l = Math.hypot(...q)
    return q.map((x) => x / l)
  }
  const v: number[][] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map(unit)
  // biome-ignore format: caras del icosaedro
  let f: number[][] = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]]
  for (let it = 0; it < subdivisions; it++) {
    const memo = new Map<string, number>()
    const next: number[][] = []
    const middle = (a: number, b: number): number => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`
      const known = memo.get(key)
      if (known !== undefined) return known
      const pa = v[a] as number[]
      const pb = v[b] as number[]
      v.push(unit(pa.map((x, i) => (x + (pb[i] as number)) / 2)))
      memo.set(key, v.length - 1)
      return v.length - 1
    }
    for (const [a, b, c] of f as [number, number, number][]) {
      const ab = middle(a, b)
      const bc = middle(b, c)
      const ca = middle(c, a)
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca])
    }
    f = next
  }
  return {
    vertices: new Float32Array(v.flat()),
    indices: new Uint16Array(f.flat()),
  }
}

/** Prisma hexagonal de base 0 y altura 1: el tronco. */
function hexPrism(): { vertices: Float32Array; indices: Uint16Array } {
  const sides = 6
  const vertices: number[] = []
  const indices: number[] = []
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2
    vertices.push(Math.cos(a), Math.sin(a), 0, Math.cos(a), Math.sin(a), 1)
  }
  for (let k = 0; k < sides; k++) {
    const a = k * 2
    const b = ((k + 1) % sides) * 2
    indices.push(a, b, a + 1, b, b + 1, a + 1)
  }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  }
}

interface InstancedMesh {
  vao: WebGLVertexArrayObject
  count: number
  locations: [number, number][]
}

export function createTreesLayer(id: string, url: string, hooks: LayerHooks): CustomLayerInterface {
  let mapRef: MapLibreMap | null = null
  let header: TreesHeader | null = null
  let instances: WebGLBuffer | null = null
  let crownProgram: WebGLProgram | null = null
  let trunkProgram: WebGLProgram | null = null
  let pointProgram: WebGLProgram | null = null
  let shadowProgram: WebGLProgram | null = null
  let pointVao: WebGLVertexArrayObject | null = null
  let shadowVao: WebGLVertexArrayObject | null = null
  let crownFine: InstancedMesh | null = null
  let crownCoarse: InstancedMesh | null = null
  let trunk: InstancedMesh | null = null
  let maxPointSize = 64
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
        crownProgram = compileProgram(g, CROWN_VERTEX, FRAGMENT)
        trunkProgram = compileProgram(g, TRUNK_VERTEX, FRAGMENT)
        pointProgram = compileProgram(g, POINT_VERTEX, POINT_FRAGMENT)
        shadowProgram = compileProgram(g, SHADOW_VERTEX, SHADOW_FRAGMENT)
        maxPointSize = g.getParameter(g.ALIASED_POINT_SIZE_RANGE)[1]
        const { buffer, header: h, offset } = await fetchBin<TreesHeader>(url)
        header = h
        const data = new Float32Array(buffer, offset, h.instancias * 8)
        instances = g.createBuffer()
        buffers.push(instances)
        g.bindBuffer(g.ARRAY_BUFFER, instances)
        g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW)

        const attrib = (
          program: WebGLProgram,
          name: string,
          offsetBytes: number,
          divisor: number,
        ): number => {
          const loc = g.getAttribLocation(program, name)
          if (loc < 0) return loc
          g.enableVertexAttribArray(loc)
          g.vertexAttribPointer(loc, 4, g.FLOAT, false, STRIDE, offsetBytes)
          g.vertexAttribDivisor(loc, divisor)
          return loc
        }
        const mesh = (
          program: WebGLProgram,
          geometry: { vertices: Float32Array; indices: Uint16Array },
        ): InstancedMesh => {
          const vao = g.createVertexArray()
          g.bindVertexArray(vao)
          const vertexBuffer = g.createBuffer()
          const indexBuffer = g.createBuffer()
          buffers.push(vertexBuffer, indexBuffer)
          g.bindBuffer(g.ARRAY_BUFFER, vertexBuffer)
          g.bufferData(g.ARRAY_BUFFER, geometry.vertices, g.STATIC_DRAW)
          const p = g.getAttribLocation(program, 'a_p')
          g.enableVertexAttribArray(p)
          g.vertexAttribPointer(p, 3, g.FLOAT, false, 0, 0)
          g.bindBuffer(g.ARRAY_BUFFER, instances)
          const locations: [number, number][] = [
            [attrib(program, 'a_i0', 0, 1), 0],
            [attrib(program, 'a_i1', 16, 1), 16],
          ]
          g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, indexBuffer)
          g.bufferData(g.ELEMENT_ARRAY_BUFFER, geometry.indices, g.STATIC_DRAW)
          g.bindVertexArray(null)
          return { vao, count: geometry.indices.length, locations }
        }
        crownFine = mesh(crownProgram, icosphere(1))
        crownCoarse = mesh(crownProgram, icosphere(0))
        trunk = mesh(trunkProgram, hexPrism())

        shadowVao = g.createVertexArray()
        g.bindVertexArray(shadowVao)
        const quad = g.createBuffer()
        buffers.push(quad)
        g.bindBuffer(g.ARRAY_BUFFER, quad)
        g.bufferData(
          g.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
          g.STATIC_DRAW,
        )
        const q = g.getAttribLocation(shadowProgram, 'a_q')
        g.enableVertexAttribArray(q)
        g.vertexAttribPointer(q, 2, g.FLOAT, false, 0, 0)
        g.bindBuffer(g.ARRAY_BUFFER, instances)
        attrib(shadowProgram, 'a_i0', 0, 1)
        attrib(shadowProgram, 'a_i1', 16, 1)
        g.bindVertexArray(null)

        pointVao = g.createVertexArray()
        g.bindVertexArray(pointVao)
        g.bindBuffer(g.ARRAY_BUFFER, instances)
        attrib(pointProgram, 'a_i0', 0, 0)
        attrib(pointProgram, 'a_i1', 16, 0)
        g.bindVertexArray(null)
        map.triggerRepaint()
        hooks.onReady()
      } catch (error) {
        fail(error)
      }
    },
    render(g, args) {
      if (failed || !header || !mapRef || !instances) return
      try {
        draw(g as WebGL2RenderingContext, args as unknown as RenderArgs, header, mapRef)
      } catch (error) {
        fail(error)
      }
    },
    onRemove(_map, context) {
      for (const b of buffers) context.deleteBuffer(b)
    },
  }

  function draw(
    g: WebGL2RenderingContext,
    args: RenderArgs,
    h: TreesHeader,
    map: MapLibreMap,
  ): void {
    if (!pointProgram || !shadowProgram || !crownProgram || !trunkProgram) return
    if (!pointVao || !shadowVao || !crownFine || !crownCoarse || !trunk) return
    const matrix = matrixFor(args, h)
    const sun = new Float32Array(SUN)
    const zoom = map.getZoom()
    g.enable(g.DEPTH_TEST)
    g.depthFunc(g.LEQUAL)
    g.depthMask(true)
    g.disable(g.CULL_FACE)

    const points = (filter: ((cell: Cell) => boolean) | null): void => {
      if (!pointProgram) return
      g.useProgram(pointProgram)
      g.uniformMatrix4fv(g.getUniformLocation(pointProgram, 'u_matrix'), false, matrix)
      g.uniform2f(
        g.getUniformLocation(pointProgram, 'u_vp'),
        g.drawingBufferWidth,
        g.drawingBufferHeight,
      )
      g.uniform1f(g.getUniformLocation(pointProgram, 'u_max'), maxPointSize)
      g.bindVertexArray(pointVao)
      for (const r of visibleRanges(matrix, h.celdas, h.celda, 20, 0, filter)) {
        g.drawArrays(g.POINTS, r.from, r.to - r.from)
      }
      g.bindVertexArray(null)
    }
    if (zoom < POINTS_BELOW_ZOOM || hooks.quality.level <= 1) {
      points(null)
      return
    }

    // Solo las celdas a menos de MESH_DISTANCE_M de la cámara llevan malla y sombra; el resto, puntos.
    const camera = cameraPosition(map, h)
    const half = h.celda / 2
    const reach2 = MESH_DISTANCE_M * MESH_DISTANCE_M
    const near = (c: Cell): boolean => {
      const dx = Math.max(Math.abs((c.i + 0.5) * h.celda - camera[0]) - half, 0)
      const dy = Math.max(Math.abs((c.j + 0.5) * h.celda - camera[1]) - half, 0)
      return dx * dx + dy * dy + camera[2] * camera[2] <= reach2
    }
    points((c) => !near(c))

    if (hooks.quality.level >= 2 && zoom >= SHADOW_MIN_ZOOM) {
      g.useProgram(shadowProgram)
      g.uniformMatrix4fv(g.getUniformLocation(shadowProgram, 'u_matrix'), false, matrix)
      g.uniform3fv(g.getUniformLocation(shadowProgram, 'u_sun'), sun)
      g.depthMask(false)
      g.enable(g.BLEND)
      g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA)
      g.bindVertexArray(shadowVao)
      g.bindBuffer(g.ARRAY_BUFFER, instances)
      const a0 = g.getAttribLocation(shadowProgram, 'a_i0')
      const a1 = g.getAttribLocation(shadowProgram, 'a_i1')
      for (const r of visibleRanges(matrix, h.celdas, h.celda, 20, 30, near)) {
        g.vertexAttribPointer(a0, 4, g.FLOAT, false, STRIDE, r.from * STRIDE)
        g.vertexAttribPointer(a1, 4, g.FLOAT, false, STRIDE, r.from * STRIDE + 16)
        g.drawArraysInstanced(g.TRIANGLES, 0, 6, r.to - r.from)
      }
      g.bindVertexArray(null)
      g.disable(g.BLEND)
      g.depthMask(true)
    }

    const fine = zoom >= FINE_MESH_FROM_ZOOM
    for (const [program, mesh] of [
      [trunkProgram, trunk],
      [crownProgram, fine ? crownFine : crownCoarse],
    ] as const) {
      g.useProgram(program)
      g.uniformMatrix4fv(g.getUniformLocation(program, 'u_matrix'), false, matrix)
      g.uniform3fv(g.getUniformLocation(program, 'u_sun'), sun)
      g.bindVertexArray(mesh.vao)
      g.bindBuffer(g.ARRAY_BUFFER, instances)
      for (const r of visibleRanges(matrix, h.celdas, h.celda, 20, 0, near)) {
        for (const [loc, offsetBytes] of mesh.locations) {
          if (loc >= 0)
            g.vertexAttribPointer(loc, 4, g.FLOAT, false, STRIDE, r.from * STRIDE + offsetBytes)
        }
        g.drawElementsInstanced(g.TRIANGLES, mesh.count, g.UNSIGNED_SHORT, 0, r.to - r.from)
      }
      g.bindVertexArray(null)
    }
  }
}
