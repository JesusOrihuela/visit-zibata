/**
 * Medición en el dispositivo (`?medir=1`): recorre tres vistas en los tres niveles de calidad girando la
 * cámara y mide los cuadros por segundo. Sin botones: arranca sola al cargar y deja el resultado en un
 * cuadro de texto de solo lectura que se puede seleccionar y copiar, para que quien tenga un equipo que no
 * podemos probar (un iPhone, un Android viejo) mande las cifras sin instalar nada. `?medir=corto` acorta
 * las etapas para probar la herramienta.
 */
import type { Map as MapLibreMap } from 'maplibre-gl'
import { glContext } from './internals.ts'
import { applyLevel, type Quality, type QualityLevel } from './quality.ts'

interface View {
  name: string
  camera: { center: [number, number]; zoom: number; pitch: number; bearing: number }
}

const VIEWS: View[] = [
  {
    name: 'Panorámica',
    camera: { center: [-100.3225, 20.6805], zoom: 14.9, pitch: 62, bearing: -25 },
  },
  { name: 'Barrio', camera: { center: [-100.3135, 20.6784], zoom: 17.2, pitch: 62, bearing: 200 } },
  { name: 'Casas', camera: { center: [-100.3296, 20.6877], zoom: 18, pitch: 58, bearing: 20 } },
]

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const sorted = (values: number[]) => [...values].sort((a, b) => a - b)

export async function runBenchmark(
  map: MapLibreMap,
  quality: Quality,
  { short = false } = {},
): Promise<void> {
  const times = short
    ? { warm: 1500, measure: 1500, settle: 3000 }
    : { warm: 3000, measure: 6000, settle: 10000 }

  const box = document.createElement('div')
  box.setAttribute('role', 'status')
  box.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:99999;background:#fcfaf6f2;border:1px solid #d1c3b0;border-radius:10px;padding:8px 10px;font:12px/1.35 system-ui,sans-serif;color:#1f2419;max-width:calc(100vw - 16px);width:340px;display:grid;gap:6px'
  const status = document.createElement('div')
  status.style.fontWeight = '700'
  const output = document.createElement('textarea')
  output.readOnly = true
  output.rows = 9
  output.setAttribute('aria-label', 'Resultado de la medición')
  output.style.cssText =
    'display:none;width:100%;font:11px/1.3 ui-monospace,Consolas,monospace;box-sizing:border-box'
  box.append(status, output)
  document.body.append(box)

  const settle = (limit: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, limit)
      map.once('idle', () => {
        clearTimeout(timer)
        resolve()
      })
      map.triggerRepaint()
    })
  async function spin(from: number, ms: number): Promise<number[]> {
    const intervals: number[] = []
    let last = 0
    const onRender = (): void => {
      const now = performance.now()
      if (last) intervals.push(now - last)
      last = now
    }
    map.on('render', onRender)
    map.easeTo({ bearing: from + 60, duration: ms, easing: (t) => t })
    await wait(ms + 250)
    map.off('render', onRender)
    return intervals
  }

  const saved = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    level: quality.level,
  }
  quality.frozen = true
  const rows: string[] = []
  try {
    for (const level of [3, 2, 1] as QualityLevel[]) {
      for (const view of VIEWS) {
        applyLevel(map, quality, level)
        status.textContent = `Calidad ${level} · ${view.name}… (no toques la pantalla)`
        map.jumpTo(view.camera)
        await settle(times.settle)
        await spin(view.camera.bearing, times.warm)
        await settle(times.settle)
        const intervals = await spin(view.camera.bearing, times.measure)
        const ordered = sorted(intervals)
        const median = ordered[ordered.length >> 1] ?? 0
        const p95 = ordered[Math.floor(ordered.length * 0.95)] ?? 0
        rows.push(
          [
            level,
            view.name,
            map.getZoom().toFixed(2),
            intervals.length + 1,
            median.toFixed(1),
            p95.toFixed(1),
            median ? (1000 / median).toFixed(0) : 'n/d',
          ].join(' | '),
        )
      }
    }
  } finally {
    quality.frozen = false
    map.jumpTo({
      center: saved.center,
      zoom: saved.zoom,
      pitch: saved.pitch,
      bearing: saved.bearing,
    })
    applyLevel(map, quality, saved.level)
  }

  const gl = glContext(map)
  const extension = gl?.getExtension('WEBGL_debug_renderer_info')
  const connection = (
    navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }
  ).connection
  const device = {
    fecha: new Date().toISOString(),
    agente: navigator.userAgent,
    pantalla: `${screen.width}x${screen.height}`,
    ventana: `${innerWidth}x${innerHeight}`,
    pixelesPorPixel: devicePixelRatio,
    nucleos: navigator.hardwareConcurrency ?? 'n/d',
    memoriaGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 'n/d',
    conexion: connection
      ? `${connection.effectiveType}${connection.saveData ? ' ahorro de datos' : ''}`
      : 'n/d',
    grafica: gl && extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'n/d',
    minZoom: Number(map.getMinZoom().toFixed(2)),
  }
  output.value = [
    'MEDICIÓN DE ZIBATÁ',
    JSON.stringify(device),
    '',
    'nivel | vista | zoom | cuadros | mediana ms | p95 ms | cuadros/s',
    ...rows,
  ].join('\n')
  output.style.display = 'block'
  status.textContent = 'Listo. Mantén pulsado el cuadro, selecciona todo y copia.'
}
