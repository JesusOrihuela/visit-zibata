import { expect, type Page, test } from '@playwright/test'
import { openApp, panel } from './helpers.ts'

/**
 * Lo que Google puede usar como fragmento (SNP-01 de la auditoría).
 *
 * Google compone el fragmento con el texto de la página ya renderizada, y en una ficha eso incluye
 * la ayuda para lectores de pantalla de "Cómo llegar" y los controles personales. Para que no los
 * use, el texto de interfaz va dentro de un elemento con `data-nosnippet`; el nombre, la zona, la
 * dirección y la descripción, que son lo que dice el local, no.
 *
 * Esta prueba mide el DOM, no a Google: que Google haga caso es algo que solo se ve en producción.
 */

interface Medida {
  cadena: string
  encontradas: number
  /** Nodos de texto que contienen la cadena y NO tienen un ancestro con `data-nosnippet`. */
  sinAtributo: number
  /** Nodos de texto que contienen la cadena y SÍ tienen un ancestro con `data-nosnippet`. */
  conAtributo: number
}

/** Cuenta, dentro de una región, cuántos nodos de texto con cada cadena quedan dentro o fuera. */
async function medir(page: Page, selector: string, cadenas: string[]): Promise<Medida[]> {
  return page.evaluate(
    ({ selector, cadenas }) => {
      const raiz = document.querySelector(selector)
      if (!raiz) throw new Error(`No hay nada que coincida con ${selector}`)
      const nodos: Text[] = []
      const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
      for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
        nodos.push(nodo as Text)
      }
      return cadenas.map((cadena) => {
        const coinciden = nodos.filter((nodo) => (nodo.textContent ?? '').includes(cadena))
        const con = coinciden.filter((nodo) => nodo.parentElement?.closest('[data-nosnippet]'))
        return {
          cadena,
          encontradas: coinciden.length,
          sinAtributo: coinciden.length - con.length,
          conAtributo: con.length,
        }
      })
    },
    { selector, cadenas },
  )
}

/** Todo `data-nosnippet` de la página debe estar en un elemento donde Google lo reconoce. */
async function elementosConAtributo(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-nosnippet]')].map((el) => el.tagName.toLowerCase()),
  )
}

const FICHA = 'article[aria-labelledby="place-detail-title"]'
const ZONA = 'section[aria-labelledby="plaza-panel-title"]'

test.describe('Fragmentos de búsqueda', () => {
  test('en una ficha, el texto de interfaz va excluido y lo que dice el local no', async ({
    page,
  }) => {
    await openApp(page, { path: 'lugar/birria-jauregui' })
    await expect(
      panel(page).getByRole('heading', { level: 2, name: 'Birria Jáuregui' }),
    ).toBeVisible()

    const interfaz = await medir(page, FICHA, [
      'Cómo llegar',
      'Abre Google Maps en una pestaña nueva',
      'Tu calificación',
      'Califica este lugar',
      'Registrar visita',
      'Registra tu primera visita',
    ])
    for (const medida of interfaz) {
      expect(medida.encontradas, `"${medida.cadena}" debería estar en la ficha`).toBeGreaterThan(0)
      expect(medida.sinAtributo, `"${medida.cadena}" debería ir excluido`).toBe(0)
    }

    // El botón de compartir solo se dibuja si el navegador puede compartir o copiar: si está, va
    // excluido, y si no está no hay nada que excluir.
    for (const medida of await medir(page, FICHA, ['Compartir', 'Copiado'])) {
      expect(medida.sinAtributo, `"${medida.cadena}" debería ir excluido`).toBe(0)
    }

    const contenido = await medir(page, FICHA, [
      'Birria Jáuregui',
      'Paseo Zibatá',
      'Av. Paseo de las Pitahayas 501, Zibatá',
      '¡Llegó la mejor Birria a Querétaro',
    ])
    for (const medida of contenido) {
      expect(medida.encontradas, `"${medida.cadena}" debería estar en la ficha`).toBeGreaterThan(0)
      expect(medida.conAtributo, `"${medida.cadena}" no debería ir excluido`).toBe(0)
    }

    expect(new Set(await elementosConAtributo(page))).toEqual(new Set(['div', 'section']))
  })

  test('en una zona, "Cómo llegar a la zona" y el estado oculto de las tarjetas van excluidos', async ({
    page,
  }) => {
    await openApp(page, { path: 'zona/condesa' })
    await expect(
      panel(page).getByRole('heading', { level: 2, name: 'Plaza Condesa' }),
    ).toBeVisible()

    const interfaz = await medir(page, ZONA, ['Cómo llegar a la zona'])
    expect(interfaz[0]?.encontradas).toBeGreaterThan(0)
    expect(interfaz[0]?.sinAtributo).toBe(0)

    const contenido = await medir(page, ZONA, [
      'Zona comercial del desarrollo Riscos Condesa I',
      'Av. Paseo de las Pitahayas 9-B, Zibatá',
    ])
    for (const medida of contenido) {
      expect(medida.encontradas, `"${medida.cadena}" debería estar en la zona`).toBeGreaterThan(0)
      expect(medida.conAtributo, `"${medida.cadena}" no debería ir excluido`).toBe(0)
    }

    // Cada tarjeta lleva su estado oculto ("Abierto ahora: nombre") excluido; el nombre visible, no.
    const tarjetas = await page.evaluate((zona) => {
      const raiz = document.querySelector(zona)
      const enlaces = [...(raiz?.querySelectorAll('a[href*="/lugar/"]') ?? [])]
      return enlaces.map((enlace) => {
        const oculto = enlace.querySelector('[class*="visually-hidden"]')
        const visible = enlace.querySelector('[class*="_name_"]')
        return {
          ocultoExcluido: Boolean(oculto?.closest('[data-nosnippet]')),
          hayOculto: Boolean(oculto),
          visibleExcluido: Boolean(visible?.closest('[data-nosnippet]')),
        }
      })
    }, ZONA)
    expect(tarjetas.length).toBeGreaterThan(0)
    for (const tarjeta of tarjetas) {
      expect(tarjeta.hayOculto).toBe(true)
      expect(tarjeta.ocultoExcluido).toBe(true)
      expect(tarjeta.visibleExcluido).toBe(false)
    }

    // El atributo solo vale en span, div y section: el del enlace de la zona va en un `span`.
    const permitidos = new Set(['span', 'div', 'section'])
    for (const etiqueta of await elementosConAtributo(page)) {
      expect(permitidos.has(etiqueta), `data-nosnippet en <${etiqueta}>`).toBe(true)
    }
  })

  test('la ficha en inglés lleva el mismo número de exclusiones', async ({ page }) => {
    await openApp(page, { path: 'lugar/birria-jauregui' })
    await expect(
      page.locator(FICHA).getByRole('heading', { level: 2, name: 'Birria Jáuregui' }),
    ).toBeVisible()
    const enEspanol = await page.locator(`${FICHA} [data-nosnippet]`).count()

    await openApp(page, { path: 'en/place/birria-jauregui' })
    await expect(
      page.locator(FICHA).getByRole('heading', { level: 2, name: 'Birria Jáuregui' }),
    ).toBeVisible()
    const enIngles = await page.locator(`${FICHA} [data-nosnippet]`).count()

    expect(enEspanol).toBeGreaterThan(0)
    expect(enIngles).toBe(enEspanol)
  })
})
