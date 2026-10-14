/**
 * Quién puede preguntarle al horario directamente.
 *
 * `getOpenStatus` solo sabe de horarios. Desde que un local puede estar cerrado temporalmente, esa
 * respuesta ya no es el estado del lugar: un local en obra tiene su horario de siempre bien puesto,
 * así que el horario dice "abierto" y es falso.
 *
 * Esta prueba existe porque el error se cometió **tres veces** en el mismo cambio. Se escribió
 * `estadoDe()` para que la pregunta viviera en un sitio, y aun así quedaron tres sitios preguntando
 * por su cuenta: la tabla de horarios de la ficha (decía "Abierto" debajo del aviso de cierre), el
 * contador de la pastilla de abiertos (anunciaba un resultado más de los que daba el filtro) y el
 * propio filtro. Una convención que se rompe tres veces no se sostiene con un comentario.
 *
 * Los permitidos son el módulo que define la pregunta, el que la calcula, y el componente tonto que
 * solo pinta un horario y recibe de fuera si hay cierre.
 *
 * Vive en `scripts/` y no en `src/` porque lee el árbol de archivos: `src` compila contra los tipos
 * del navegador y ahí `node:fs` no existe.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = join(import.meta.dirname, '..', 'src')
const PERMITIDOS = ['lib/estado.ts', 'lib/hours.ts', 'features/places/OpenStatus.tsx']

function* archivos(dir: string): Generator<string> {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) yield* archivos(ruta)
    else if (/\.tsx?$/.test(nombre) && !/\.test\./.test(nombre)) yield ruta
  }
}

describe('la pregunta por el estado vive en un solo sitio', () => {
  it('nadie más importa getOpenStatus', () => {
    const culpables: string[] = []
    for (const ruta of archivos(RAIZ)) {
      const relativa = ruta
        .slice(RAIZ.length + 1)
        .split(sep)
        .join('/')
      if (PERMITIDOS.includes(relativa)) continue
      // Solo el import cuenta: nombrarlo en un comentario para explicar el porqué es bienvenido.
      if (/import\s*\{[^}]*\bgetOpenStatus\b[^}]*\}/.test(readFileSync(ruta, 'utf8'))) {
        culpables.push(relativa)
      }
    }
    expect(culpables).toEqual([])
  })
})
