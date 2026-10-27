import { expect, test } from '@playwright/test'
import { openApp, waitForMap } from './helpers.ts'

test.describe('Realismo del mapa @mapa', () => {
  test('sin el parámetro no se pide ninguna capa de realismo', async ({ page }) => {
    const pedidas: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/map/realismo/')) pedidas.push(request.url())
    })
    await openApp(page)
    await waitForMap(page)
    await page.waitForTimeout(1500)
    expect(pedidas).toEqual([])
  })

  test('con ?realismo=si carga suelo, contexto, calles y relieve del mismo origen, con sus créditos', async ({
    page,
    baseURL,
  }) => {
    const origen = new URL(baseURL ?? 'http://localhost').origin
    const violaciones: string[] = []
    const externas: string[] = []
    const fallidas: string[] = []
    const pedidas = new Set<string>()
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`CSP-VIOLATION ${event.violatedDirective} ${event.blockedURI}`)
      })
    })
    page.on('console', (message) => {
      if (/CSP-VIOLATION|Content Security Policy/i.test(message.text())) {
        violaciones.push(message.text())
      }
    })
    page.on('request', (request) => {
      const url = request.url()
      if (/^https?:/.test(url) && !url.startsWith(origen)) externas.push(url)
    })
    page.on('response', (response) => {
      const url = response.url()
      if (!url.includes('/map/realismo/')) return
      pedidas.add(url.split('/map/realismo/')[1] ?? '')
      if (response.status() >= 400) fallidas.push(`${response.status()} ${url}`)
    })

    await openApp(page, { path: '?realismo=si' })
    await waitForMap(page)
    // Tiempo para que el mapa pida las imágenes y las teselas de relieve de la vista.
    await page.waitForTimeout(3000)

    expect(violaciones).toEqual([])
    expect(externas).toEqual([])
    expect(fallidas).toEqual([])
    const nombres = [...pedidas]
    expect(nombres).toEqual(expect.arrayContaining(['suelo.webp', 'contexto.webp', 'vias.geojson']))
    expect(nombres.some((nombre) => /^relieve\/12\/\d+\/\d+\.webp$/.test(nombre))).toBe(true)

    const atribucion = await page.locator('.maplibregl-ctrl-attrib').textContent()
    expect(atribucion).toContain('OpenStreetMap')
    expect(atribucion).toContain('Copernicus DEM GLO-30')
    expect(atribucion).toContain('Contains modified Copernicus Sentinel data')
  })
})
