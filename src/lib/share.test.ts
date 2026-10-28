// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canShare, placeUrl, share } from './share.ts'

/** Deja `navigator.share` / `navigator.clipboard` como los tenga cada navegador real. */
function conNavegador(parches: Record<string, unknown>) {
  for (const [clave, valor] of Object.entries(parches)) {
    Object.defineProperty(navigator, clave, { value: valor, configurable: true, writable: true })
  }
}

afterEach(() => {
  for (const clave of ['share', 'clipboard']) {
    Reflect.deleteProperty(navigator, clave)
  }
  vi.restoreAllMocks()
})

describe('placeUrl', () => {
  it('es la misma URL desde cualquier filtro: no arrastra el estado de la vista', () => {
    window.history.replaceState(null, '', '/lugar/tomassa?categoria=pizza')
    const desdeFiltro = placeUrl('tomassa')
    window.history.replaceState(null, '', '/en/area/plaza-luna')
    expect(placeUrl('tomassa')).toBe(desdeFiltro)
    expect(desdeFiltro).not.toContain('categoria')
  })

  it('es la ruta sin almohadilla, que es la que indexan los buscadores', () => {
    expect(placeUrl('tomassa')).toMatch(/\/es\/lugar\/tomassa$/)
    expect(placeUrl('tomassa')).not.toContain('#')
  })

  it('es absoluta, que es lo que se pega en un chat', () => {
    expect(placeUrl('tomassa')).toMatch(/^https?:\/\//)
  })
})

describe('share', () => {
  const carga = { title: 'Tomassa', text: 'Tomassa · Pizzería · Plaza Luna', url: 'https://x/#/l' }

  it('usa la hoja del sistema cuando existe', async () => {
    const hoja = vi.fn().mockResolvedValue(undefined)
    conNavegador({ share: hoja })
    expect(await share(carga)).toBe('shared')
    expect(hoja).toHaveBeenCalledWith(carga)
  })

  it('cerrar la hoja no es un fallo y no debe avisar de nada', async () => {
    const abortada = Object.assign(new Error('cancelado'), { name: 'AbortError' })
    conNavegador({ share: vi.fn().mockRejectedValue(abortada) })
    expect(await share(carga)).toBe('cancelled')
  })

  it('si la hoja falla por otra razón, cae al portapapeles en vez de dejar sin nada', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    conNavegador({
      share: vi.fn().mockRejectedValue(new Error('no implementada')),
      clipboard: { writeText: escribir },
    })
    expect(await share(carga)).toBe('copied')
    // Al portapapeles va solo la URL: es lo que se espera de "copiar enlace".
    expect(escribir).toHaveBeenCalledWith(carga.url)
  })

  it('sin hoja del sistema copia el enlace', async () => {
    conNavegador({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    expect(await share(carga)).toBe('copied')
  })

  it('sin ninguna de las dos lo dice, para que el botón pueda avisar', async () => {
    expect(await share(carga)).toBe('unsupported')
    expect(canShare()).toBe(false)
  })
})
