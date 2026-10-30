import { describe, expect, it } from 'vitest'
import categories from '../../data/commercial/categories.json'
import plazas from '../../data/commercial/plazas.json'
import tokensCss from '../styles/tokens.css?raw'
import { contraste, deltaE00, luminancia, oklch } from './color.ts'
import {
  categoryTone,
  DEFAULT_PLAZA_TONE,
  NEUTRAL_CATEGORY_TONE,
  PLAZA_COLORS,
  plazaTones,
} from './palette.ts'

/*
 * Las puertas del color. Cada una responde a una pregunta que alguien se hizo mirando el mapa, y
 * están aquí para que la siguiente zona no tenga que acordarse de ninguna:
 *
 *  10  dos colores a menos de 10 se confunden a tamaño de marcador. El margen era 12 mientras el
 *      marcador podía llevar tinta; con arena en las once, oscurecer las claras acerca los tonos y
 *      el conjunto se queda en 10,8 como par más apretado.
 *   6  una zona y el trazo del icono de una categoría son registros distintos (sólido contra línea
 *      fina sobre tinte claro), así que solo se persigue el caso de "es el mismo color".
 *   3  el texto de la etiqueta va en arena en todas. Por debajo de 3 no se sostiene ni como objeto
 *      gráfico; Anáhuac, que el propietario fijó, se queda justo en ese mínimo.
 * 0,045 de croma es la frontera del gris; por debajo de 30 de claridad hace falta más tono, porque un
 *      color oscuro y poco saturado se lee negro.
 */

const PUERTA = {
  zona: 10,
  marca: 12,
  tinteDeCategoria: 12,
  trazoDeCategoria: 6,
  textoEnLaGota: 3,
}
const CROMA_MINIMO = 0.045
const CLARIDAD_MAXIMA = 0.82
const CLARIDAD_OSCURA = 0.3
const CROMA_OSCURO = 0.09
const PAPEL = '#f8f4ed'
const AA = 4.5

/** Los tokens de la paleta de marca, leídos de donde viven y no de una copia que se queda atrás. */
const tokensDeMarca = [...tokensCss.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(
  ([, nombre, hex]) => [nombre as string, hex as string] as const,
)

const activePlazaIds = plazas.plazas.filter((plaza) => plaza.active).map((plaza) => plaza.id)
const tonos = plazaTones(activePlazaIds)
const pares = activePlazaIds.flatMap((uno, i) =>
  activePlazaIds.slice(i + 1).map((otro) => [uno, otro] as const),
)

describe('colores de zona', () => {
  it('ninguna zona activa se queda sin color', () => {
    for (const id of activePlazaIds) expect(PLAZA_COLORS[id], id).toBeDefined()
  })

  it('dos zonas no se confunden entre sí', () => {
    for (const [uno, otro] of pares) {
      const distancia = deltaE00(tonos.get(uno)?.accent ?? '', tonos.get(otro)?.accent ?? '')
      expect(distancia, `${uno} contra ${otro}`).toBeGreaterThanOrEqual(PUERTA.zona)
    }
  })

  it('ninguna zona se lee como un color de la marca', () => {
    for (const [id, tono] of tonos) {
      for (const [nombre, hex] of tokensDeMarca) {
        expect(deltaE00(tono.accent, hex), `${id} contra ${nombre}`).toBeGreaterThanOrEqual(
          PUERTA.marca,
        )
      }
    }
  })

  it('ninguna zona se lee como una categoría', () => {
    for (const [id, tono] of tonos) {
      for (const category of categories.categories) {
        const categoria = categoryTone(category)
        expect(
          deltaE00(tono.accent, categoria.soft),
          `${id} contra el tinte de ${category.id}`,
        ).toBeGreaterThanOrEqual(PUERTA.tinteDeCategoria)
        expect(
          deltaE00(tono.accent, categoria.ink),
          `${id} contra el trazo de ${category.id}`,
        ).toBeGreaterThanOrEqual(PUERTA.trazoDeCategoria)
      }
    }
  })

  it('ninguna zona es negra, blanca ni gris', () => {
    for (const [id, tono] of tonos) {
      const { l, c } = oklch(tono.accent)
      expect(c, `${id}: sin tono`).toBeGreaterThanOrEqual(CROMA_MINIMO)
      expect(l, `${id}: demasiado clara`).toBeLessThanOrEqual(CLARIDAD_MAXIMA)
      if (l < CLARIDAD_OSCURA)
        expect(c, `${id}: oscura y sin tono`).toBeGreaterThanOrEqual(CROMA_OSCURO)
    }
  })

  it('el texto de la gota va en arena en todas las zonas y se lee', () => {
    for (const [id, tono] of tonos) {
      expect(tono.onAccent, id).toBe('#fcfaf6')
      expect(contraste(tono.accent, tono.onAccent), id).toBeGreaterThanOrEqual(PUERTA.textoEnLaGota)
    }
  })

  it('el nombre de la zona se lee sobre el papel', () => {
    for (const [id, tono] of tonos) {
      expect(contraste(tono.ink, PAPEL), id).toBeGreaterThanOrEqual(AA)
    }
  })

  it('no cambia el color de las zonas existentes al añadir una al final', () => {
    const after = plazaTones([...activePlazaIds, 'plaza-futura'])
    for (const id of activePlazaIds) expect(after.get(id), id).toEqual(tonos.get(id))
  })

  it('una zona sin color declarado usa el verde de marca en vez de romper', () => {
    expect(plazaTones(['plaza-futura']).get('plaza-futura')).toEqual(DEFAULT_PLAZA_TONE)
  })
})

describe('tonos de categoría', () => {
  it('cubre todas las categorías publicadas ("Otros" usa el neutro a propósito)', () => {
    for (const category of categories.categories) {
      if (category.id === 'otros') continue
      expect(categoryTone(category), category.id).not.toEqual(NEUTRAL_CATEGORY_TONE)
    }
  })

  it('una categoría sin tono declarado usa el neutro en vez de romper', () => {
    expect(categoryTone({})).toEqual(NEUTRAL_CATEGORY_TONE)
    expect(categoryTone(undefined)).toEqual(NEUTRAL_CATEGORY_TONE)
  })

  // Una zona y una categoría no significan lo mismo: aunque compartan familia de color, el tinte de
  // categoría siempre es más claro que cualquier superficie de zona, así que no se confunden.
  it('los tintes de categoría son más claros que cualquier color de zona', () => {
    const lightestPlaza = Math.max(...[...tonos.values()].map((tone) => luminancia(tone.site)))
    for (const category of categories.categories) {
      expect(luminancia(categoryTone(category).soft), category.id).toBeGreaterThan(lightestPlaza)
    }
  })
})
