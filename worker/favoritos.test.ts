import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ANADIR,
  cambioDe,
  EDAD_MINIMA_MS,
  MAXIMO_POR_CUENTA,
  MAXIMO_POR_PETICION,
} from './favoritos.ts'
import { CONTEO_CORAZONES } from './senales.ts'

describe('lo que pide el navegador', () => {
  it('acepta un gesto normal', () => {
    expect(cambioDe({ anadir: ['tomassa'] })).toEqual({ anadir: ['tomassa'], quitar: [] })
    expect(cambioDe({ quitar: ['tomassa'] })).toEqual({ anadir: [], quitar: ['tomassa'] })
  })

  it('acepta la subida inicial de lo que ya había en el dispositivo', () => {
    const muchos = ['tomassa', 'bendito-bocado', 'el-hornero']
    expect(cambioDe({ anadir: muchos })?.anadir).toEqual(muchos)
  })

  it('filtra lo que no es un slug en vez de tirar el gesto entero', () => {
    // Un identificador raro entre buenos no debe costarle el corazón a nadie.
    const cambio = cambioDe({ anadir: ['tomassa', "' OR 1=1 --", 'MAYUSCULAS', 42, null, '../x'] })
    expect(cambio).toEqual({ anadir: ['tomassa'], quitar: [] })
  })

  it('no repite', () => {
    expect(cambioDe({ anadir: ['tomassa', 'tomassa'] })?.anadir).toEqual(['tomassa'])
  })

  it('rechaza lo que no es un cambio', () => {
    for (const malo of [null, 'texto', 42, [], {}, { anadir: [] }, { anadir: ['NO'] }]) {
      expect(cambioDe(malo)).toBeNull()
    }
  })

  it('rechaza añadir y quitar lo mismo, que es un error de quien llama', () => {
    expect(cambioDe({ anadir: ['tomassa'], quitar: ['tomassa'] })).toBeNull()
  })

  it('pone un tope por petición', () => {
    const demasiados = Array.from({ length: MAXIMO_POR_PETICION + 1 }, (_, i) => `lugar-${i}`)
    expect(cambioDe({ anadir: demasiados })).toBeNull()
  })
})

describe('las reglas del conteo público viven en el servidor', () => {
  it('la edad mínima está en el SQL, no en la interfaz', () => {
    // Si estuviera en el navegador, bastaría con pedir los datos a mano para saltársela.
    expect(CONTEO_CORAZONES).toContain('c.creada <=')
  })

  it('la edad mínima convierte un ataque instantáneo en uno que hay que sostener', () => {
    // Diez minutos eran un café. Un día obliga a sostenerlo, y a una persona no le cuesta nada:
    // su corazón se ve en su dispositivo desde el primer momento.
    expect(EDAD_MINIMA_MS).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000)
  })

  it('el tope por cuenta sigue al catálogo y no se queda en un número de otra época', () => {
    /*
     * El Worker no tiene los datos, así que el número se escribe a mano. Esto es lo que impide que
     * se quede obsoleto en silencio: nadie guarda más lugares de los que hay, y si el catálogo se
     * acerca al tope, esta prueba falla y obliga a revisarlo. El 500 anterior, con 101 locales, no
     * freno nunca nada.
     */
    const datos = JSON.parse(readFileSync('data/commercial/places.json', 'utf8'))
    const lugares: number = (datos.places ?? datos).length
    expect(lugares).toBeGreaterThan(0)
    expect(MAXIMO_POR_CUENTA).toBeGreaterThanOrEqual(lugares)
    expect(MAXIMO_POR_CUENTA).toBeLessThanOrEqual(lugares * 2)
  })

  it('dar dos veces el mismo corazón no crea dos filas ni falla', () => {
    expect(ANADIR).toContain('INSERT OR IGNORE')
  })

  it('no se guarda nada de la persona', () => {
    const sql = `${ANADIR} ${CONTEO_CORAZONES}`.toLowerCase()
    for (const prohibido of ['ip', 'user_agent', 'correo', 'nombre', 'referente']) {
      expect(sql).not.toContain(prohibido)
    }
  })
})
