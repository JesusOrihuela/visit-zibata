/**
 * Utilidades de WebGL2 para las capas propias del mapa: compilar programas, pasar de metros locales
 * a la matriz de MapLibre, descartar por celdas lo que queda fuera de la vista y leer los .bin.
 */

/** Origen de las mallas: lo escribe `map:build:mallas` en la cabecera de cada .bin. */
export interface Origin {
  lng0: number
  lat0: number
}

export interface Cell {
  i: number
  j: number
  start: number
  count: number
}

export interface BinHeader extends Origin {
  celda: number
  celdas: Cell[]
}

/** Los .bin llevan: uint32 LE con el largo de la cabecera JSON, la cabecera, relleno a 4 bytes y los buffers. */
export function readBin<T extends BinHeader>(buffer: ArrayBuffer): { header: T; offset: number } {
  const length = new DataView(buffer).getUint32(0, true)
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, length))) as T
  return { header, offset: 4 + length + ((4 - ((4 + length) % 4)) % 4) }
}

export async function fetchBin<T extends BinHeader>(
  url: string,
): Promise<{ buffer: ArrayBuffer; header: T; offset: number }> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const buffer = await response.arrayBuffer()
  return { buffer, ...readBin<T>(buffer) }
}

export function compileProgram(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
): WebGLProgram {
  const shader = (type: number, source: string): WebGLShader => {
    const s = gl.createShader(type)
    if (!s) throw new Error('No se pudo crear el sombreador')
    gl.shaderSource(s, source)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? '')
    return s
  }
  const program = gl.createProgram()
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex))
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? '')
  }
  return program
}

const EARTH_CIRCUMFERENCE = 40075016.686

function multiply(a: ArrayLike<number>, b: ArrayLike<number>): Float32Array {
  const out = new Float64Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += (a[k * 4 + r] ?? 0) * (b[c * 4 + k] ?? 0)
      out[c * 4 + r] = sum
    }
  }
  return Float32Array.from(out)
}

/** Lo que MapLibre pasa a `render`: la matriz de proyección principal (6.x) o la de modelo-vista-proyección. */
export interface RenderArgs {
  defaultProjectionData?: { mainMatrix: ArrayLike<number> }
  modelViewProjectionMatrix?: ArrayLike<number>
}

/** Matriz de metros locales (este, norte, altura) a la pantalla: la de MapLibre por la de metros a Mercator. */
export function matrixFor(args: RenderArgs, origin: Origin): Float32Array {
  const projection = args.defaultProjectionData?.mainMatrix ?? args.modelViewProjectionMatrix
  if (!projection) throw new Error('MapLibre no entregó la matriz de proyección')
  const lat = (origin.lat0 * Math.PI) / 180
  const mx = (origin.lng0 + 180) / 360
  const my = 0.5 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / (2 * Math.PI)
  const s = 1 / (EARTH_CIRCUMFERENCE * Math.cos(lat))
  // biome-ignore format: matriz 4x4 en columnas
  const toMercator = [s, 0, 0, 0, 0, -s, 0, 0, 0, 0, s, 0, mx, my, 0, 1]
  return multiply(projection, toMercator)
}

/**
 * Rangos contiguos [ini, fin) de las celdas cuya caja toca la vista. Si una esquina queda detrás de
 * la cámara la celda se conserva (prueba conservadora). `margin` ensancha cada caja (sombras largas).
 */
export function visibleRanges(
  matrix: ArrayLike<number>,
  cells: readonly Cell[],
  cellSize: number,
  maxHeight: number,
  margin = 0,
  filter: ((cell: Cell) => boolean) | null = null,
): { from: number; to: number }[] {
  const m = (index: number): number => matrix[index] ?? 0
  const ranges: { from: number; to: number }[] = []
  for (const cell of cells) {
    if (filter && !filter(cell)) continue
    const x0 = cell.i * cellSize - margin
    const y0 = cell.j * cellSize - margin
    const width = cellSize + 2 * margin
    let outside = 63
    let near = false
    for (let k = 0; k < 8; k++) {
      const x = x0 + (k & 1 ? width : 0)
      const y = y0 + (k & 2 ? width : 0)
      const z = k & 4 ? maxHeight : 0
      const w = m(3) * x + m(7) * y + m(11) * z + m(15)
      if (w < 0.001) {
        near = true
        break
      }
      const cx = m(0) * x + m(4) * y + m(8) * z + m(12)
      const cy = m(1) * x + m(5) * y + m(9) * z + m(13)
      const cz = m(2) * x + m(6) * y + m(10) * z + m(14)
      outside &=
        (cx < -w ? 1 : 0) |
        (cx > w ? 2 : 0) |
        (cy < -w ? 4 : 0) |
        (cy > w ? 8 : 0) |
        (cz < -w ? 16 : 0) |
        (cz > w ? 32 : 0)
    }
    if (!near && outside) continue
    const last = ranges.at(-1)
    if (last && last.to === cell.start) last.to = cell.start + cell.count
    else ranges.push({ from: cell.start, to: cell.start + cell.count })
  }
  return ranges
}

/** Posición de la cámara en metros locales (este, norte, altura), con la geometría de la cámara de MapLibre. */
export function cameraPosition(
  map: {
    getCenter(): { lng: number; lat: number }
    getZoom(): number
    getPitch(): number
    getBearing(): number
    getContainer(): HTMLElement
  },
  origin: Origin,
): [number, number, number] {
  const center = map.getCenter()
  const lat = (center.lat * Math.PI) / 180
  const lat0 = (origin.lat0 * Math.PI) / 180
  const mx0 = (origin.lng0 + 180) / 360
  const my0 = 0.5 - Math.log(Math.tan(Math.PI / 4 + lat0 / 2)) / (2 * Math.PI)
  const scale = 1 / (EARTH_CIRCUMFERENCE * Math.cos(lat0))
  const mx = (center.lng + 180) / 360
  const my = 0.5 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / (2 * Math.PI)
  const cx = (mx - mx0) / scale
  const cy = -(my - my0) / scale
  const metersPerPixel = (EARTH_CIRCUMFERENCE * Math.cos(lat)) / (512 * 2 ** map.getZoom())
  // Campo de visión vertical de 0,6435 rad: distancia al centro = (alto / 2) / tan(campo / 2) píxeles.
  const distance =
    (map.getContainer().clientHeight / 2 / Math.tan(0.6435011087932844 / 2)) * metersPerPixel
  const pitch = (map.getPitch() * Math.PI) / 180
  const bearing = (map.getBearing() * Math.PI) / 180
  return [
    cx - Math.sin(bearing) * Math.sin(pitch) * distance,
    cy - Math.cos(bearing) * Math.sin(pitch) * distance,
    Math.cos(pitch) * distance,
  ]
}
