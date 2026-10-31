import { describe, expect, it } from 'vitest'
import {
  COMPARTIDAS,
  desdeHace,
  diasDe,
  MAS_CALIFICADOS,
  MAS_GUARDADOS,
  origenPropio,
  POR_DIA,
  POR_PAGINA,
  RESUMEN,
} from './panel.ts'
import { ID_DE_SUGERENCIA } from './sugerencias.ts'

describe('la ventana de tiempo', () => {
  const dias = (busqueda: string) => diasDe(new URL(`https://x/api/panel${busqueda}`))

  it('por omisión son treinta días', () => {
    expect(dias('')).toBe(30)
    expect(dias('?dias=')).toBe(30)
    expect(dias('?dias=hola')).toBe(30)
  })

  it('tiene tope, para que nadie barra la tabla entera desde la URL', () => {
    expect(dias('?dias=99999')).toBe(365)
    expect(dias('?dias=0')).toBe(1)
    expect(dias('?dias=-5')).toBe(1)
  })

  it('la fecha de corte incluye hoy y no un día de más', () => {
    expect(desdeHace(7, new Date('2026-10-11T12:00:00Z'))).toBe('2026-10-05')
    expect(desdeHace(1, new Date('2026-10-11T12:00:00Z'))).toBe('2026-10-11')
  })
})

describe('lo que el panel no enseÃ±a', () => {
  it('ninguna consulta devuelve un promedio de estrellas', () => {
    // La regla vale mÃ¡s entera que con una excepciÃ³n, y una excepciÃ³n aquÃ­ serÃ­a la que alguien
    // copiarÃ­a maÃ±ana. Se ve cuÃ¡ntas notas hay, nunca cuÃ¡nto valen.
    const sql = [RESUMEN, POR_DIA, POR_PAGINA, COMPARTIDAS, MAS_GUARDADOS, MAS_CALIFICADOS]
      .join(' ')
      .toLowerCase()
    expect(sql).not.toContain('avg(')
    expect(sql).not.toContain('estrellas')
  })

  it('ni nada de quien visita o comparte', () => {
    const sql = [RESUMEN, POR_PAGINA, COMPARTIDAS].join(' ').toLowerCase()
    for (const prohibido of ['ip', 'user_agent', 'correo', 'nombre', 'referente', 'secreto']) {
      expect(sql).not.toContain(prohibido)
    }
  })
})

describe('quién puede escribir en el panel', () => {
  const peticion = (cabeceras: Record<string, string>) =>
    new Request('https://visitzibata.com/api/panel/sugerencias/x', {
      method: 'POST',
      headers: cabeceras,
    })

  it('acepta lo que sale de esta misma página', () => {
    expect(origenPropio(peticion({ 'sec-fetch-site': 'same-origin' }))).toBe(true)
    // Una pestaña abierta a mano no manda sitio: el navegador es el mismo.
    expect(origenPropio(peticion({ 'sec-fetch-site': 'none' }))).toBe(true)
    expect(origenPropio(peticion({ origin: 'https://visitzibata.com' }))).toBe(true)
  })

  it('rechaza lo que llega de otra página y lo que no dice de dónde viene', () => {
    expect(origenPropio(peticion({ 'sec-fetch-site': 'cross-site' }))).toBe(false)
    expect(origenPropio(peticion({ 'sec-fetch-site': 'same-site' }))).toBe(false)
    expect(origenPropio(peticion({ origin: 'https://otro.example' }))).toBe(false)
    expect(origenPropio(peticion({}))).toBe(false)
  })

  it('el identificador de una sugerencia tiene la forma que se guarda', () => {
    expect(ID_DE_SUGERENCIA.test('AAAAAAAAAAAAAAAAAAAAAA')).toBe(true)
    expect(ID_DE_SUGERENCIA.test('corta')).toBe(false)
    expect(ID_DE_SUGERENCIA.test('con espacios aqui dentro')).toBe(false)
    expect(ID_DE_SUGERENCIA.test("1' OR 1=1--")).toBe(false)
  })
})
