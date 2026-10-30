import { describe, expect, it, vi } from 'vitest'
import type { Correo } from './correo.ts'
import type { Base } from './cuenta.ts'
import trabajador from './index.ts'

const fila = (mensaje: string) => ({
  creada: '2026-10-28T10:00:00.000Z',
  quien: 'vecino',
  lugar: 'Plaza Anáhuac',
  mensaje,
  contacto: '',
})

/** Una base de mentira que solo sabe contestar las dos consultas del aviso. */
function baseDe(total: number, filas: ReturnType<typeof fila>[]): Base {
  return {
    prepare(sql: string) {
      const sentencia = {
        bind: () => sentencia,
        run: async () => ({}),
        first: async () => (sql.includes('COUNT(*)') ? { total } : null),
        all: async () => ({ results: filas }),
      }
      return sentencia
    },
    batch: async () => ({}),
  } as unknown as Base
}

type EntornoDePrueba = Parameters<typeof trabajador.scheduled>[1]

async function ejecutar(entorno: Partial<EntornoDePrueba>): Promise<void> {
  const pendientes: Promise<unknown>[] = []
  trabajador.scheduled({}, entorno as EntornoDePrueba, {
    waitUntil: (promesa) => {
      pendientes.push(promesa)
    },
  })
  await Promise.all(pendientes)
}

describe('la tarea programada del aviso', () => {
  it('sin sugerencias sin atender no manda nada', async () => {
    let enviados = 0
    const correo: Correo = {
      send: async () => {
        enviados += 1
      },
    }
    await ejecutar({ ANALITICA: baseDe(0, []), CORREO: correo })
    expect(enviados).toBe(0)
  })

  it('con varias manda un solo correo con todas', async () => {
    const mensajes: Parameters<Correo['send']>[0][] = []
    const correo: Correo = {
      send: async (mensaje) => {
        mensajes.push(mensaje)
      },
    }
    await ejecutar({
      ANALITICA: baseDe(2, [fila('Falta la panadería.'), fila('Cambió el horario.')]),
      CORREO: correo,
    })
    expect(mensajes).toHaveLength(1)
    expect(mensajes[0]?.subject).toBe('2 sugerencias sin atender en Visit Zibatá')
    expect(mensajes[0]?.text).toContain('Falta la panadería.')
    expect(mensajes[0]?.text).toContain('Cambió el horario.')
  })

  it('si el correo falla, se apunta y la tarea termina igual', async () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const correo: Correo = {
      send: async () => {
        throw new Error('sin correo')
      },
    }
    await expect(ejecutar({ ANALITICA: baseDe(1, [fila('Hola')]), CORREO: correo })).resolves.toBe(
      undefined,
    )
    expect(registro).toHaveBeenCalled()
    registro.mockRestore()
  })

  it('sin base no hay nada que avisar y no revienta', async () => {
    await expect(ejecutar({})).resolves.toBe(undefined)
  })
})
