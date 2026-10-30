import { describe, expect, it } from 'vitest'
import {
  GUARDAR,
  MAXIMO_MENSAJE,
  PENDIENTES,
  SIN_ATENDER,
  sugerenciaDe,
  ULTIMAS,
} from './sugerencias.ts'

const SELLO = 'sello-de-prueba-que-no-vale-nada-aaaaaaaaaa'
const buena = { quien: 'negocio', lugar: 'Tomassa', mensaje: 'Cambió el horario', sello: SELLO }

describe('lo que acepta el servidor', () => {
  it('acepta una sugerencia normal', () => {
    expect(sugerenciaDe(buena)).toEqual({ ...buena, contacto: '' })
  })

  it('sin mensaje no hay sugerencia, aunque venga todo lo demás', () => {
    expect(sugerenciaDe({ ...buena, mensaje: '   ' })).toBeNull()
    expect(sugerenciaDe({ ...buena, mensaje: undefined })).toBeNull()
  })

  it('sin sello con la forma correcta tampoco', () => {
    // Es lo que cuesta mandarla. Sin eso, el endpoint sería un buzón abierto.
    for (const sello of [undefined, '', 'corto', `${SELLO}x`, "' OR 1=1 --"]) {
      expect(sugerenciaDe({ ...buena, sello })).toBeNull()
    }
  })

  it('quien no reconoce se guarda como "otro" en vez de tirar el recado', () => {
    expect(sugerenciaDe({ ...buena, quien: 'administrador' })?.quien).toBe('otro')
    expect(sugerenciaDe({ ...buena, quien: 42 })?.quien).toBe('otro')
  })

  it('recorta en vez de rechazar: quien escribió de más no pierde lo que escribió', () => {
    const largo = 'a'.repeat(MAXIMO_MENSAJE + 500)
    expect(sugerenciaDe({ ...buena, mensaje: largo })?.mensaje).toHaveLength(MAXIMO_MENSAJE)
  })

  it('el contacto es opcional y se queda vacío si no lo dejaron', () => {
    expect(sugerenciaDe(buena)?.contacto).toBe('')
    expect(sugerenciaDe({ ...buena, contacto: ' hola@ejemplo.com ' })?.contacto).toBe(
      'hola@ejemplo.com',
    )
  })

  it('rechaza lo que no es un cuerpo', () => {
    for (const malo of [null, 'texto', 42, []]) expect(sugerenciaDe(malo)).toBeNull()
  })
})

describe('lo que se guarda y lo que no', () => {
  it('cada sello vale una sola vez, por el índice y no por una tabla aparte', () => {
    // La columna es UNIQUE en el esquema: reenviar el mismo sello choca y no escribe nada.
    expect(GUARDAR).toContain('sello')
  })

  it('no se guarda nada de quien escribe más allá de lo que escribió', () => {
    const sql = [GUARDAR, ULTIMAS, SIN_ATENDER, PENDIENTES].join(' ').toLowerCase()
    for (const prohibido of ['ip', 'user_agent', 'cuenta_id', 'referente', 'secreto']) {
      expect(sql).not.toContain(prohibido)
    }
  })

  it('el panel lee las últimas y no la tabla entera', () => {
    expect(ULTIMAS).toContain('LIMIT')
    expect(ULTIMAS).toContain('ORDER BY creada DESC')
  })

  it('el aviso diario lee solo las que siguen sin atender', () => {
    expect(PENDIENTES).toContain('atendida = 0')
    expect(PENDIENTES).toContain('LIMIT')
  })
})
