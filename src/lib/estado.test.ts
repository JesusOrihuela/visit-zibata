import { describe, expect, it } from 'vitest'
import { makePlace } from '../test/fixtures.ts'
import { estadoDe } from './estado.ts'
import { getZonedMoment } from './hours.ts'

// Un lunes a las 13:00 en Querétaro.
const momento = getZonedMoment(new Date('2026-10-12T19:00:00Z'))

const todoElDia = {
  mon: ['00:00-23:59'],
  tue: ['00:00-23:59'],
  wed: ['00:00-23:59'],
  thu: ['00:00-23:59'],
  fri: ['00:00-23:59'],
  sat: ['00:00-23:59'],
  sun: ['00:00-23:59'],
}

describe('estadoDe', () => {
  it('lee el horario cuando no hay cierre', () => {
    const abierto = makePlace({ id: 'a', plazaId: 'p', hours: todoElDia })
    expect(estadoDe(abierto, momento)).toBe('open')
  })

  it('sin horario no se da por cerrado', () => {
    expect(estadoDe(makePlace({ id: 'b', plazaId: 'p' }), momento)).toBe('unknown')
  })

  it('el cierre temporal manda sobre el horario, y ese es el punto', () => {
    // Un local en obra puede tener su horario de siempre bien puesto. Si el horario ganara, la guía
    // diría "abierto" de una puerta tapiada, que es el peor fallo que puede cometer.
    const enObra = makePlace({
      id: 'c',
      plazaId: 'p',
      hours: todoElDia,
      cierre: { motivo: 'remodelacion', desde: '2026-10-09' },
    })
    expect(estadoDe(enObra, momento)).toBe('temporal')
  })

  it('el horario no se borra: sigue ahí para cuando reabra', () => {
    const enObra = makePlace({
      id: 'd',
      plazaId: 'p',
      hours: todoElDia,
      cierre: { motivo: 'vacaciones', desde: '2026-10-09' },
    })
    expect(enObra.hours).not.toBeNull()
  })
})
