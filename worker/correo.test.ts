import { describe, expect, it, vi } from 'vitest'
import { avisar, type Correo, MAXIMO_EN_EL_CORREO, resumenDe } from './correo.ts'

type Mensaje = Parameters<Correo['send']>[0]

const fila = (extra: Partial<Parameters<typeof resumenDe>[0][number]> = {}) => ({
  creada: '2026-10-28T10:00:00.000Z',
  quien: 'vecino',
  lugar: 'Plaza Anáhuac',
  mensaje: 'Falta la panadería nueva.',
  contacto: '',
  ...extra,
})

describe('el resumen diario', () => {
  it('sin pendientes no hay correo', () => {
    expect(resumenDe([], 0)).toBeNull()
  })

  it('una sola se cuenta en singular', () => {
    const resumen = resumenDe([fila()], 1)
    expect(resumen?.subject).toBe('1 sugerencia sin atender en Visit Zibatá')
    expect(resumen?.text).toContain('Hay 1 sugerencia sin atender')
  })

  it('varias se cuentan en plural y con su número', () => {
    expect(resumenDe([fila(), fila()], 2)?.subject).toBe(
      '2 sugerencias sin atender en Visit Zibatá',
    )
  })

  it('cada una lleva fecha local, quién, lugar y mensaje', () => {
    const resumen = resumenDe(
      [fila({ quien: 'negocio', lugar: 'Tomassa', mensaje: 'Cambió el horario' })],
      1,
    )
    // 10:00 UTC son las 4 de la mañana en Zibatá: el mismo día, en la zona de la guía.
    expect(resumen?.text).toContain('2026-10-28 · El negocio · Tomassa')
    expect(resumen?.text).toContain('Cambió el horario')
  })

  it('el contacto va solo si lo dejaron', () => {
    expect(resumenDe([fila()], 1)?.text).not.toContain('Contacto:')
    expect(resumenDe([fila({ contacto: 'vecina@ejemplo.com' })], 1)?.text).toContain(
      'Contacto: vecina@ejemplo.com',
    )
  })

  it('dice cuántas no caben, en vez de callarlas', () => {
    expect(resumenDe([fila(), fila()], 5)?.text).toContain('Y 3 más')
  })

  it('no mete más de las que caben y dice cuántas quedan', () => {
    const muchas = Array.from({ length: MAXIMO_EN_EL_CORREO + 5 }, (_, indice) =>
      fila({ mensaje: `Mensaje ${indice}` }),
    )
    const resumen = resumenDe(muchas)
    expect(resumen?.subject).toBe(
      `${MAXIMO_EN_EL_CORREO + 5} sugerencias sin atender en Visit Zibatá`,
    )
    expect(resumen?.text).toContain('Y 5 más')
  })

  it('lo que escribió la persona se queda como texto, no como etiquetas', () => {
    expect(resumenDe([fila({ mensaje: '<b>hola</b>' })], 1)?.text).toContain('<b>hola</b>')
  })
})

describe('el envío', () => {
  it('no manda nada si no hay pendientes', async () => {
    let enviados = 0
    const correo: Correo = {
      send: async () => {
        enviados += 1
      },
    }
    expect(await avisar(correo, [], 0)).toBe(false)
    expect(enviados).toBe(0)
  })

  it('sin enlace lo dice y no revienta', async () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await avisar(undefined, [fila()], 1)).toBe(false)
    expect(registro).toHaveBeenCalledWith('[correo] falta el enlace send_email')
    registro.mockRestore()
  })

  it('manda a la dirección del dominio, con el asunto y el texto', async () => {
    const enviados: Mensaje[] = []
    const correo: Correo = {
      send: async (mensaje) => {
        enviados.push(mensaje)
      },
    }
    expect(await avisar(correo, [fila()], 1)).toBe(true)
    expect(enviados).toHaveLength(1)
    expect(enviados[0]?.to).toBe('avisos@visitzibata.com')
    expect(enviados[0]?.from).toEqual({ email: 'avisos@visitzibata.com', name: 'Visit Zibatá' })
    expect(enviados[0]?.text).toContain('Plaza Anáhuac')
  })

  it('un fallo del enlace sube a quien llama, que es quien lo apunta', async () => {
    const correo: Correo = {
      send: async () => {
        throw new Error('sin correo')
      },
    }
    await expect(avisar(correo, [fila()], 1)).rejects.toThrow('sin correo')
  })
})
