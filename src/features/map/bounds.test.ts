import { describe, expect, it } from 'vitest'
import type { Bbox } from '../../config/map.ts'
import { constrainCenter, type View } from './bounds.ts'

// Un rectángulo de unos 5 km por 4 km, como Zibatá.
const BBOX: Bbox = [-100.359, 20.669, -100.31, 20.705]
const MIDDLE = { lng: (BBOX[0] + BBOX[2]) / 2, lat: (BBOX[1] + BBOX[3]) / 2 }
const DESKTOP: View = { width: 1600, height: 800, bearing: 0 }

describe('constrainCenter', () => {
  it('de cerca deja el centro donde está si queda dentro de Zibatá', () => {
    const near = { lng: MIDDLE.lng + 0.005, lat: MIDDLE.lat - 0.003 }
    expect(constrainCenter(near, 17, DESKTOP, BBOX)).toEqual(near)
  })

  it('de cerca, un centro muy lejos vuelve al borde de Zibatá, no al margen de antes', () => {
    const far = constrainCenter({ lng: MIDDLE.lng + 1, lat: MIDDLE.lat }, 17, DESKTOP, BBOX)
    expect(far.lng).toBeLessThan(BBOX[2])
    expect(far.lng).toBeGreaterThan(MIDDLE.lng)
    expect(far.lat).toBe(MIDDLE.lat)
  })

  it('al alejarse el margen crece: con el mismo centro pedido, cuanto más lejos más se acerca al medio', () => {
    const wanted = { lng: BBOX[2], lat: MIDDLE.lat }
    const at16 = constrainCenter(wanted, 16, DESKTOP, BBOX).lng
    const at15 = constrainCenter(wanted, 15, DESKTOP, BBOX).lng
    const at14 = constrainCenter(wanted, 14, DESKTOP, BBOX).lng
    expect(at16).toBeGreaterThan(at15)
    expect(at15).toBeGreaterThan(at14)
  })

  it('en el alejamiento máximo no hay margen: el centro queda en el medio', () => {
    const result = constrainCenter({ lng: BBOX[2], lat: BBOX[3] }, 12, DESKTOP, BBOX)
    expect(result.lng).toBeCloseTo(MIDDLE.lng, 6)
    expect(result.lat).toBeCloseTo(MIDDLE.lat, 6)
  })

  it('sin margen usa el ancla si la hay (la que cuenta la inclinación)', () => {
    const anchor: [number, number] = [MIDDLE.lng + 0.001, MIDDLE.lat - 0.002]
    const result = constrainCenter(
      { lng: BBOX[0], lat: BBOX[1] },
      12,
      DESKTOP,
      BBOX,
      undefined,
      anchor,
    )
    expect(result).toEqual({ lng: anchor[0], lat: anchor[1] })
  })

  it('con el mapa girado 90 grados el ancho y el alto de la pantalla se intercambian', () => {
    const wide: View = { width: 2000, height: 600, bearing: 0 }
    const turned: View = { ...wide, bearing: 90 }
    const wanted = { lng: BBOX[2], lat: BBOX[3] }
    const normal = constrainCenter(wanted, 15, wide, BBOX)
    const rotated = constrainCenter(wanted, 15, turned, BBOX)
    // Girado, la pantalla ancha abarca más norte-sur y menos este-oeste.
    expect(rotated.lng).toBeGreaterThan(normal.lng)
    expect(rotated.lat).toBeLessThan(normal.lat)
  })

  describe('con el contorno real', () => {
    // Una L: el cuadrante noreste del rectángulo está vacío, como las esquinas de Zibatá.
    const midLng = MIDDLE.lng
    const midLat = MIDDLE.lat
    const RING: [number, number][] = [
      [BBOX[0], BBOX[1]],
      [BBOX[2], BBOX[1]],
      [BBOX[2], midLat],
      [midLng, midLat],
      [midLng, BBOX[3]],
      [BBOX[0], BBOX[3]],
      [BBOX[0], BBOX[1]],
    ]

    it('un centro dentro del contorno no se mueve', () => {
      const inside = { lng: BBOX[0] + 0.01, lat: BBOX[3] - 0.005 }
      expect(constrainCenter(inside, 18, DESKTOP, BBOX, RING)).toEqual(inside)
    })

    it('la esquina vacía del rectángulo se lleva al borde del contorno', () => {
      const corner = { lng: BBOX[2] - 0.003, lat: BBOX[3] - 0.002 }
      const result = constrainCenter(corner, 18, DESKTOP, BBOX, RING)
      // Sin el contorno se quedaría en la esquina vacía (el rectángulo la permite).
      expect(constrainCenter(corner, 18, DESKTOP, BBOX)).toEqual(corner)
      expect(result).not.toEqual(corner)
      // Lo que devuelve está en el borde de la zona vacía: o en la mitad este-oeste o en la mitad norte-sur.
      const onEdge = Math.abs(result.lng - midLng) < 1e-9 || Math.abs(result.lat - midLat) < 1e-9
      expect(onEdge).toBe(true)
    })
  })
})
