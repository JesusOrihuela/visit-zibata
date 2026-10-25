import { describe, expect, it } from 'vitest'
import { dispersion, percentil75, senalesDe } from './senales.ts'

const corazones = (pares: [string, number][]) =>
  pares.map(([lugar, cuantos]) => ({ lugar, cuantos }))
const notas = (tripletas: [string, number, number][]) =>
  tripletas.map(([lugar, votos, media]) => ({ lugar, votos, media }))

describe('el conteo público', () => {
  it('publica el número desde el primer corazón, y el empuje cuenta igual', () => {
    const senales = senalesDe(
      corazones([
        ['poco', 1],
        ['mucho', 40],
      ]),
      [],
    )
    expect(senales.poco?.corazones).toBe(1)
    expect(senales.poco?.empuje).toBeGreaterThan(0)
    expect(senales.mucho?.corazones).toBe(40)
  })
})

describe('la media nunca sale de aquí', () => {
  it('lo que se devuelve son corazones y un empuje, nunca estrellas ni votos', () => {
    const senales = senalesDe(corazones([['x', 9]]), notas([['x', 30, 4.8]]))
    // La garantía estructural del diseño: si la interfaz no recibe la media, no puede enseñarla.
    expect(Object.keys(senales.x ?? {}).sort()).toEqual(['corazones', 'empuje'])
  })
})

describe('la calibración sale del propio catálogo', () => {
  it('una nota alta con pocos votos pesa menos que la misma sostenida por muchos', () => {
    const catalogo = notas([
      ['pocos', 2, 5],
      ['muchos', 60, 5],
      ['normal', 40, 3.8],
      ['otro', 35, 3.9],
    ])
    const senales = senalesDe([], catalogo)
    expect(senales.muchos?.empuje ?? 0).toBeGreaterThan(senales.pocos?.empuje ?? 0)
  })

  it('estar por debajo de la media del catálogo no resta: el empuje solo sube', () => {
    const senales = senalesDe(
      [],
      notas([
        ['malo', 50, 1],
        ['bueno', 50, 5],
      ]),
    )
    // Sin este tope, tres votos malintencionados hunden a un negocio que no puede rebatirlo.
    expect(senales.malo?.empuje).toBe(0)
    expect(senales.bueno?.empuje ?? 0).toBeGreaterThan(0)
  })

  it('el centro es la media real y no un 3,5 escrito a mano', () => {
    // Las notas de consumo se amontonan en 4 y 5. Con un centro fijo en 3,5, todo el catálogo
    // quedaría por encima y el término subiría a todos por igual, que es no decir nada.
    const todosAltos = notas([
      ['a', 40, 4.5],
      ['b', 40, 4.6],
      ['c', 40, 4.4],
    ])
    const empujes = Object.values(senalesDe([], todosAltos)).map((s) => s.empuje)
    expect(Math.max(...empujes)).toBeLessThan(0.5)
  })

  it('la escala de los corazones sigue al catálogo, no a un número de otra época', () => {
    // Un barrio chico y uno grande tienen que producir señales comparables: lo que manda es la
    // posición relativa, no el valor absoluto.
    const chico = senalesDe(
      corazones([
        ['a', 1],
        ['b', 3],
        ['c', 8],
      ]),
      [],
    )
    const grande = senalesDe(
      corazones([
        ['a', 100],
        ['b', 300],
        ['c', 800],
      ]),
      [],
    )
    expect(chico.c?.empuje ?? 0).toBeCloseTo(grande.c?.empuje ?? 0, 1)
  })

  it('el empuje nunca se sale de 0 a 1', () => {
    const senales = senalesDe(corazones([['x', 100000]]), notas([['x', 9999, 5]]))
    expect(senales.x?.empuje ?? 0).toBeGreaterThan(0)
    expect(senales.x?.empuje ?? 0).toBeLessThanOrEqual(1)
  })
})

describe('las piezas de la aritmética', () => {
  it('el percentil 75 nunca devuelve cero, para no dividir por nada', () => {
    expect(percentil75([])).toBe(1)
    expect(percentil75([0, 0, 0])).toBe(1)
    expect(percentil75([1, 2, 3, 4, 100])).toBe(4)
  })

  it('la desviación tiene suelo, para que un catálogo uniforme no dispare la escala', () => {
    expect(dispersion([4, 4, 4]).desviacion).toBeGreaterThanOrEqual(0.25)
    expect(dispersion([4, 4, 4]).media).toBe(4)
  })
})
