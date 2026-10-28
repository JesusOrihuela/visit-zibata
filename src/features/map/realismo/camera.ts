/**
 * Límites de cámara del realismo. La imagen de contexto cubre unos 46 km y el mapa no debe dejar ver su
 * borde ni alejarse más de lo que Zibatá cabe en el espacio libre:
 *
 *  - alejamiento máximo: el mayor zoom en que el contorno entero cabe entre las barras, tarjetas y el pie
 *    de la guía, con la inclinación y el rumbo actuales. Se busca sobre una copia de la transformación del
 *    mapa, así que no mueve la cámara ni dispara eventos;
 *  - inclinación máxima según el zoom: cuanto más lejos se mira, más terreno ve el borde superior, y el
 *    contexto es finito;
 *  - recentrado suave al llegar al límite, solo cuando la persona ya soltó la pantalla.
 */

import type { Polygon } from 'geojson'
import { LngLat, type Map as MapLibreMap, Point } from 'maplibre-gl'
import { prefersReducedMotion } from '../mapRuntime.ts'
import { cameraTransform } from './internals.ts'

/** Radio que la vista puede alcanzar: la imagen de contexto, menos su orilla difuminada y el desvío del centro. */
const VIEW_RADIUS_M = 17_500
const FOV = 0.6435011087932844
const EARTH_CIRCUMFERENCE = 40075016.686
/** Piso de inclinación: con el padding de la guía en un teléfono horizontal ninguna cabe, y un mapa plano pierde el volumen. */
const MIN_MAX_PITCH = 30
const SETTLE_DELAY_MS = 800
const RECENTER_DEVIATION = 0.05
const FIT_MARGIN = { x: 12, y: 16 } as const

interface Fit {
  zoom: number
  center: [number, number]
}

/** Distancia (m) del centro de la vista al punto más lejano de las esquinas de arriba; Infinity si ve el horizonte. */
function visibleRadius(map: MapLibreMap, pitchDeg: number, zoom: number, latitude: number): number {
  const container = map.getContainer()
  const width = container.clientWidth
  const height = container.clientHeight
  const pad = map.getPadding()
  const f = height / 2 / Math.tan(FOV / 2)
  const lat = (latitude * Math.PI) / 180
  const metersPerPixel = (EARTH_CIRCUMFERENCE * Math.cos(lat)) / (512 * 2 ** zoom)
  const cy = (pad.top ?? 0) + (height - (pad.top ?? 0) - (pad.bottom ?? 0)) / 2
  const cx = (pad.left ?? 0) + (width - (pad.left ?? 0) - (pad.right ?? 0)) / 2
  const pitch = (pitchDeg * Math.PI) / 180
  const h = f * metersPerPixel * Math.cos(pitch)
  let worst = 0
  // Las esquinas de arriba, respecto del centro del padding.
  for (const [u, v] of [
    [-cx, cy],
    [width - cx, cy],
  ] as const) {
    const den = Math.cos(pitch) - (v / f) * Math.sin(pitch)
    if (den <= 0.02) return Number.POSITIVE_INFINITY
    const t = h / den
    const dx = (t * u) / f
    const dy = t * ((v / f) * Math.cos(pitch) + Math.sin(pitch)) - h * Math.tan(pitch)
    worst = Math.max(worst, Math.hypot(dx, dy))
  }
  return worst
}

/** La mayor inclinación (grados enteros) con la que el borde de arriba todavía cae dentro del contexto. */
function maxPitchFor(
  map: MapLibreMap,
  zoom = map.getZoom(),
  latitude = map.getCenter().lat,
): number {
  for (let deg = 72; deg > 0; deg--) {
    if (visibleRadius(map, deg, zoom, latitude) <= VIEW_RADIUS_M) return deg
  }
  return MIN_MAX_PITCH
}

function limitPitch(map: MapLibreMap): void {
  const max = maxPitchFor(map)
  if (Math.abs(map.getMaxPitch() - max) >= 0.5) map.setMaxPitch(max)
}

/** Instala los límites; devuelve la función que los quita. */
export function installCameraLimits(map: MapLibreMap, boundary: Polygon): () => void {
  const ring = (boundary.coordinates[0] ?? []).map(([lng = 0, lat = 0]) => new LngLat(lng, lat))
  const box = ring.reduce(
    (b, p) => [
      Math.min(b[0], p.lng),
      Math.min(b[1], p.lat),
      Math.max(b[2], p.lng),
      Math.max(b[3], p.lat),
    ],
    [180, 90, -180, -90],
  ) as [number, number, number, number]

  let lastKey = ''
  let fit: Fit | null = null

  function fitMinZoom(force = false): void {
    // Con el mapa en movimiento (p. ej. la animación de padding de la guía) no se toca la cámara.
    if (map.isMoving()) return
    const container = map.getContainer()
    const pad = map.getPadding()
    const key = [
      container.clientWidth,
      container.clientHeight,
      pad.top,
      pad.bottom,
      pad.left,
      pad.right,
      map.getBearing(),
      map.getPitch(),
    ]
      .map((v) => Math.round(v ?? 0))
      .join('|')
    if (key === lastKey && !force) return
    const t = cameraTransform(map)
    if (!t) return
    t.setMinZoom(0)
    t.setMaxZoom(24)
    t.setMinPitch(0)
    t.setMaxPitch(85)
    t.resize(container.clientWidth, container.clientHeight)
    t.setPadding(pad)
    t.setBearing(map.getBearing())
    const pitch = map.getPitch()
    const free = {
      x0: (pad.left ?? 0) + FIT_MARGIN.x,
      y0: (pad.top ?? 0) + FIT_MARGIN.y,
      x1: container.clientWidth - (pad.right ?? 0) - FIT_MARGIN.x,
      y1: container.clientHeight - (pad.bottom ?? 0) - FIT_MARGIN.y,
    }
    // Cuanto más lejos, menor la inclinación máxima: el encuadre se calcula con la que habrá en ese zoom.
    const pitchAt = (center: [number, number], zoom: number): number =>
      Math.min(pitch, maxPitchFor(map, zoom, center[1]))
    const place = (center: [number, number], zoom: number): void => {
      t.setCenter(new LngLat(center[0], center[1]))
      t.setZoom(zoom)
      t.setPitch(pitchAt(center, zoom))
    }
    const bounds = () => {
      let x0 = 1e9
      let y0 = 1e9
      let x1 = -1e9
      let y1 = -1e9
      for (const p of ring) {
        const q = t.locationToScreenPoint(p)
        x0 = Math.min(x0, q.x)
        x1 = Math.max(x1, q.x)
        y0 = Math.min(y0, q.y)
        y1 = Math.max(y1, q.y)
      }
      return { x0, y0, x1, y1 }
    }
    const fits = (center: [number, number], zoom: number): boolean => {
      place(center, zoom)
      const k = bounds()
      return k.x0 >= free.x0 && k.x1 <= free.x1 && k.y0 >= free.y0 && k.y1 <= free.y1
    }

    let center: [number, number] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]
    let zoom = 6
    // El mayor zoom en que cabe; después se centra el contorno en el espacio libre y se repite (la inclinación lo descentra).
    for (let round = 0; round < 3; round++) {
      let lo = 6
      let hi = 17
      for (let i = 0; i < 12; i++) {
        const z = (lo + hi) / 2
        if (fits(center, z)) lo = z
        else hi = z
      }
      zoom = lo
      place(center, zoom)
      const k = bounds()
      const dx = (free.x0 + free.x1) / 2 - (k.x0 + k.x1) / 2
      const dy = (free.y0 + free.y1) / 2 - (k.y0 + k.y1) / 2
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break
      const p0 = t.locationToScreenPoint(new LngLat(center[0], center[1]))
      const moved = t.screenPointToLocation(new Point(p0.x - dx, p0.y - dy))
      center = [moved.lng, moved.lat]
    }
    // Si a ese zoom la vista rebasa lo que cubre el contexto (espacio libre muy pequeño), el límite se queda donde todavía cubre.
    const radius = visibleRadius(map, pitchAt(center, zoom), zoom, center[1])
    if (radius > VIEW_RADIUS_M && Number.isFinite(radius)) zoom += Math.log2(radius / VIEW_RADIUS_M)
    fit = { zoom, center }
    lastKey = key
    // Visible en el contenedor: sirve para comprobar el límite desde fuera y para depurar en un equipo real.
    container.dataset.realismoZoomMin = zoom.toFixed(2)
    // Si el nuevo límite queda por encima del zoom actual (p. ej. al girar), la cámara se acerca con una
    // animación corta en lugar de saltar.
    const current = map.getZoom()
    if (current < zoom - 0.005 && !prefersReducedMotion()) {
      map.setMinZoom(current)
      map.easeTo({ zoom, duration: 450 })
      // En el turno siguiente: un `once` puesto dentro del `moveend` que nos llamó se dispararía en ese
      // mismo evento y forzaría el zoom de golpe.
      setTimeout(() => map.once('moveend', () => map.setMinZoom(zoom)), 0)
    } else {
      map.setMinZoom(zoom)
    }
  }

  // En el límite de alejamiento Zibatá cabe justo: al llegar ahí por el zoom o por un movimiento de la guía
  // la cámara se centra despacio, cuando la persona ya soltó la pantalla. Si lo último que hizo fue arrastrar,
  // rotar o inclinar sin cambiar el zoom, la cámara se queda donde la dejó.
  let timer: ReturnType<typeof setTimeout> | undefined
  let zoomAtStart = 0
  let byPerson = false
  let nested = 0
  const cancelRecenter = (): void => clearTimeout(timer)
  const recenter = (): void => {
    if (!fit || map.isMoving() || map.getZoom() > fit.zoom + 0.03) return
    const container = map.getContainer()
    const pad = map.getPadding()
    const free = Math.min(
      container.clientWidth - (pad.left ?? 0) - (pad.right ?? 0),
      container.clientHeight - (pad.top ?? 0) - (pad.bottom ?? 0),
    )
    const here = map.project(map.getCenter())
    const target = map.project(new LngLat(fit.center[0], fit.center[1]))
    if (Math.hypot(here.x - target.x, here.y - target.y) > RECENTER_DEVIATION * free) {
      map.easeTo({
        center: fit.center,
        duration: prefersReducedMotion() ? 0 : 800,
        easing: (x) => 1 - (1 - x) ** 3,
      })
    }
  }
  const onMoveStart = (event: { originalEvent?: unknown }): void => {
    cancelRecenter()
    // La inercia de un arrastre emite su propio inicio de movimiento sin evento de la persona: cuenta como parte del mismo gesto.
    if (nested++ === 0) {
      zoomAtStart = map.getZoom()
      byPerson = false
    }
    if (event.originalEvent) byPerson = true
  }
  const onMoveEnd = (): void => {
    if (--nested > 0) return
    nested = 0
    const onlyMoved = byPerson && Math.abs(map.getZoom() - zoomAtStart) < 0.02
    if (!onlyMoved) timer = setTimeout(recenter, SETTLE_DELAY_MS)
  }

  const pitchEvents = ['zoom', 'resize', 'moveend'] as const
  const fitEvents = ['resize', 'moveend', 'idle', 'rotateend', 'pitchend'] as const
  const onPitch = (): void => limitPitch(map)
  const onFit = (): void => fitMinZoom()
  limitPitch(map)
  for (const name of pitchEvents) map.on(name, onPitch)
  for (const name of fitEvents) map.on(name, onFit)
  map.on('movestart', onMoveStart)
  map.on('moveend', onMoveEnd)
  map.getCanvasContainer().addEventListener('pointerdown', cancelRecenter, { passive: true })

  return () => {
    cancelRecenter()
    for (const name of pitchEvents) map.off(name, onPitch)
    for (const name of fitEvents) map.off(name, onFit)
    map.off('movestart', onMoveStart)
    map.off('moveend', onMoveEnd)
    map.getCanvasContainer().removeEventListener('pointerdown', cancelRecenter)
  }
}
