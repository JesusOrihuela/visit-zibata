import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PREFIX, ROUTE_FAMILIES, SEGMENTS } from '../src/lib/url-state.ts'

/**
 * El despliegue tiene su propia lista de rutas y no puede importarla: `wrangler.jsonc` es configuración
 * del proveedor, no código. Esta prueba es lo que impide que las dos se separen, y el fallo que evita
 * es silencioso: una ruta que no entra en `run_worker_first` se sirve igual, pero sin pasar por las
 * redirecciones ni por el contador.
 */
const configuracion = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')

describe('las rutas del despliegue cubren las de la aplicación', () => {
  it('cada familia, en cada idioma, está en run_worker_first', () => {
    for (const [locale, words] of Object.entries(SEGMENTS)) {
      for (const familia of ROUTE_FAMILIES) {
        const patron = `"/${PREFIX[locale as keyof typeof PREFIX]}/${words[familia]}/*"`
        expect(configuracion, `${locale}/${familia}`).toContain(patron)
      }
      // La raíz del árbol de cada idioma también pasa por el Worker, para sus redirecciones, y con
      // barra final incluida: sin ella, `/es/` no entra y el servidor de assets contesta un 307.
      expect(configuracion, `${locale} raíz`).toContain(
        `"/${PREFIX[locale as keyof typeof PREFIX]}"`,
      )
      expect(configuracion, `${locale} raíz con barra`).toContain(
        `"/${PREFIX[locale as keyof typeof PREFIX]}/"`,
      )
    }
  })

  it('las direcciones de antes del prefijo siguen pasando por el Worker', () => {
    for (const palabra of Object.values(SEGMENTS.es)) {
      expect(configuracion, palabra).toContain(`"/${palabra}/*"`)
    }
    expect(configuracion).toContain('"/"')
  })

  it('la API pasa por el Worker y la 404 es la del build, no una reserva de SPA', () => {
    expect(configuracion).toContain('"/api/*"')
    expect(configuracion).toContain('"not_found_handling": "404-page"')
  })
})

describe('el aviso diario', () => {
  it('va a la dirección del dominio, no al buzón personal', () => {
    expect(configuracion).toContain('"name": "CORREO"')
    expect(configuracion).toContain('"destination_address": "avisos@visitzibata.com"')
  })

  it('se dispara una vez al día, a las 9 de Zibatá', () => {
    // 15:00 UTC: America/Mexico_City es UTC-6 todo el año desde 2022.
    expect(configuracion).toContain('"crons": ["0 15 * * *"]')
  })
})
