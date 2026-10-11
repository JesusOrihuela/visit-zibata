import { describe, expect, it } from 'vitest'
import {
  COMPARTIDAS,
  desdeHace,
  diasDe,
  MAS_CALIFICADOS,
  MAS_GUARDADOS,
  POR_DIA,
  POR_PAGINA,
  puedeVerElPanel,
  RESUMEN,
} from './panel.ts'

const peticion = (url: string, cabeceras: Record<string, string> = {}) =>
  new Request(url, { headers: cabeceras })

describe('la puerta del panel', () => {
  it('deja pasar a quien trae la cabecera que inyecta Cloudflare Access', () => {
    expect(
      puedeVerElPanel(
        peticion('https://visitzibata.com/api/panel', { 'cf-access-jwt-assertion': 'eyJhbGci...' }),
      ),
    ).toBe(true)
  })

  it('falla cerrado: sin esa cabecera, en el dominio, no hay datos', () => {
    // Si alguien quita la regla de Access por error, esto responde 403 en vez de publicar todo.
    expect(puedeVerElPanel(peticion('https://visitzibata.com/api/panel'))).toBe(false)
    expect(puedeVerElPanel(peticion('https://visitzibata.com/api/panel?dias=7'))).toBe(false)
  })

  it('en local se entra sin Access, que es la única forma de desarrollarlo', () => {
    expect(puedeVerElPanel(peticion('http://localhost:8787/api/panel'))).toBe(true)
    expect(puedeVerElPanel(peticion('http://127.0.0.1:8787/api/panel'))).toBe(true)
  })

  it('un nombre de host que solo se parece a local no entra', () => {
    for (const url of [
      'https://localhost.visitzibata.com/api/panel',
      'https://notlocalhost/api/panel',
      'https://127.0.0.1.atacante.com/api/panel',
    ]) {
      expect(puedeVerElPanel(peticion(url))).toBe(false)
    }
  })
})

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

  it('la fecha de corte es la de hace tantos días', () => {
    expect(desdeHace(7, new Date('2026-10-11T12:00:00Z'))).toBe('2026-10-04')
  })
})

describe('lo que el panel no enseña', () => {
  it('ninguna consulta devuelve un promedio de estrellas', () => {
    // La regla vale más entera que con una excepción, y una excepción aquí sería la que alguien
    // copiaría mañana. Se ve cuántas notas hay, nunca cuánto valen.
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
