/**
 * Mantiene a Zibatá en pantalla. La restricción vive en la cámara misma (`transformConstrain` de MapLibre),
 * que la aplica cada vez que el centro o el zoom cambian, también a mitad de un gesto: no hay un momento en
 * que la cámara esté fuera y luego vuelva (lo hacía `keepOverZibata`, que corregía al soltar).
 *
 * La regla depende del zoom. El centro puede moverse por el rectángulo de Zibatá menos una parte de lo que
 * la pantalla abarca a ese zoom: de cerca se recorre toda la zona; al alejarse el margen crece, y en el
 * alejamiento máximo (donde Zibatá cabe justo) solo queda el centro. Así, por mucho que se arrastre o se
 * aleje, más de la mitad de lo que se ve sigue siendo Zibatá.
 */

import type { Position } from 'geojson'
import { LngLat, type Map as MapLibreMap } from 'maplibre-gl'
import type { Bbox } from '../../config/map.ts'

const METERS_PER_PIXEL_Z0 = 40075016.686 / 512
const METERS_PER_DEGREE_LAT = 110574
const METERS_PER_DEGREE_LNG_EQUATOR = 111320
/** Cuánto de media pantalla puede quedar fuera de Zibatá: 0 sería nada, 1 que el centro llegue al borde. */
const SHARE_OUTSIDE = 0.35

export interface View {
  /** Espacio libre (sin las barras, tarjetas y el pie de la guía) en píxeles. */
  width: number
  height: number
  /** Rumbo en grados: con el mapa girado, lo que abarca la pantalla se reparte distinto en este y norte. */
  bearing: number
}

export interface Center {
  lng: number
  lat: number
}

/** ¿Está el punto dentro del anillo? (par-impar) */
function insideRing(point: Center, ring: readonly Position[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi = 0, yi = 0] = ring[i] ?? []
    const [xj = 0, yj = 0] = ring[j] ?? []
    if (
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside
    }
  }
  return inside
}

/** El punto del contorno más cercano a uno que quedó fuera (distancias en metros aproximados). */
function nearestOnRing(point: Center, ring: readonly Position[]): Center {
  const kx = Math.cos((point.lat * Math.PI) / 180)
  let best: Center = point
  let bestDistance = Number.POSITIVE_INFINITY
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax = 0, ay = 0] = ring[i] ?? []
    const [bx = 0, by = 0] = ring[i + 1] ?? []
    const dx = (bx - ax) * kx
    const dy = by - ay
    const length2 = dx * dx + dy * dy
    const t =
      length2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.lng - ax) * kx * dx + (point.lat - ay) * dy) / length2))
    const candidate = { lng: ax + (bx - ax) * t, lat: ay + dy * t }
    const distance = ((candidate.lng - point.lng) * kx) ** 2 + (candidate.lat - point.lat) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best
}

/** El centro más cercano al pedido que mantiene a Zibatá a la vista, con el zoom y la pantalla dados. */
export function constrainCenter(
  center: Center,
  zoom: number,
  view: View,
  bbox: Bbox,
  ring?: readonly Position[],
  anchor?: [number, number],
): Center {
  const [west, south, east, north] = bbox
  const lat = (south + north) / 2
  const metersPerPixel = (METERS_PER_PIXEL_Z0 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
  const halfWidth = (view.width / 2) * metersPerPixel
  const halfHeight = (view.height / 2) * metersPerPixel
  const angle = (view.bearing * Math.PI) / 180
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  // Rectángulo que abarca la pantalla, alineado con este y norte, aunque el mapa esté girado.
  const insetLng =
    (SHARE_OUTSIDE * (cos * halfWidth + sin * halfHeight)) /
    (METERS_PER_DEGREE_LNG_EQUATOR * Math.cos((lat * Math.PI) / 180))
  const insetLat = (SHARE_OUTSIDE * (sin * halfWidth + cos * halfHeight)) / METERS_PER_DEGREE_LAT
  const axis = (value: number, low: number, high: number, fallback: number): number =>
    low > high ? fallback : Math.min(Math.max(value, low), high)
  const boxed = {
    lng: axis(center.lng, west + insetLng, east - insetLng, anchor?.[0] ?? (west + east) / 2),
    lat: axis(center.lat, south + insetLat, north - insetLat, anchor?.[1] ?? (south + north) / 2),
  }
  // El rectángulo tiene esquinas vacías: el centro también tiene que quedar dentro del contorno real.
  return ring && ring.length > 3 && !insideRing(boxed, ring) ? nearestOnRing(boxed, ring) : boxed
}

/**
 * La restricción lista para pasarle a MapLibre al crear el mapa. Necesita el mapa para saber el tamaño de la
 * pantalla y el rumbo, y el mapa necesita la restricción para crearse: `attach` cierra ese círculo. `setAnchor`
 * fija a dónde va el centro cuando el alejamiento máximo no deja margen (el que calcula realismo/camera.ts, que
 * ya cuenta la inclinación).
 */
export function createCameraConstraint(bbox: Bbox, ring?: readonly Position[]) {
  let map: MapLibreMap | null = null
  let anchor: [number, number] | undefined
  return {
    constrain(center: LngLat, zoom: number): { center: LngLat; zoom: number } {
      if (!map) return { center, zoom }
      // Con una restricción propia MapLibre deja de acotar el zoom por su cuenta: se hace aquí.
      const bounded = Math.min(Math.max(zoom, map.getMinZoom()), map.getMaxZoom())
      const container = map.getContainer()
      const padding = map.getPadding()
      const view: View = {
        width: container.clientWidth - (padding.left ?? 0) - (padding.right ?? 0),
        height: container.clientHeight - (padding.top ?? 0) - (padding.bottom ?? 0),
        bearing: map.getBearing(),
      }
      const next = constrainCenter(center, bounded, view, bbox, ring, anchor)
      return { center: new LngLat(next.lng, next.lat), zoom: bounded }
    },
    attach(instance: MapLibreMap): void {
      map = instance
    },
    setAnchor(next: [number, number]): void {
      anchor = next
    },
  }
}
