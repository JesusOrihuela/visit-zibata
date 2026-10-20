import { expect, test } from '@playwright/test'
import { openApp, panel, waitForMap } from './helpers.ts'

test.describe('Seguridad', () => {
  test('la CSP está activa y el recorrido completo no produce violaciones ni peticiones externas', async ({
    page,
    baseURL,
  }) => {
    const violations: string[] = []
    const external: string[] = []
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`CSP-VIOLATION ${event.violatedDirective} ${event.blockedURI}`)
      })
    })
    page.on('console', (message) => {
      if (/CSP-VIOLATION|Content Security Policy/i.test(message.text())) {
        violations.push(message.text())
      }
    })
    const origin = new URL(baseURL ?? 'http://localhost').origin
    page.on('request', (request) => {
      const url = request.url()
      if (/^https?:/.test(url) && !url.startsWith(origin)) external.push(url)
    })

    await openApp(page, { path: 'zona/condesa' })
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      'content',
      /script-src 'self'; /,
    )
    await waitForMap(page)
    const region = panel(page)
    await region.getByRole('link', { name: 'Ver detalles de Bendito Bocado' }).click()
    await expect(region.getByRole('heading', { level: 2, name: 'Bendito Bocado' })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Buscar lugares' }).fill('tacos')
    // Tiempo para que el mapa pida teselas, fuentes e imágenes tras los movimientos de cámara.
    await page.waitForTimeout(2500)

    expect(violations).toEqual([])
    // Ni una peticion fuera del origen en todo el recorrido, ni leyendo ni guardando: la prueba de
    // trabajo que cuesta crear una cuenta se calcula aqui dentro y no habla con nadie.
    expect(external).toEqual([])
  })

  test('los enlaces externos abren en otra pestaña sin acceso a la página (noopener)', async ({
    page,
  }) => {
    await openApp(page, { path: 'lugar/bendito-bocado' })
    const links = panel(page).locator('a[target="_blank"]')
    await expect(links.first()).toBeVisible()
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute('rel', /noopener/)
      await expect(link).toHaveAttribute('href', /^https:\/\//)
    }
  })

  test('una ruta inexistente responde 404', async ({ request }) => {
    const response = await request.get('./assets/no-existe.js')
    expect(response.status()).toBe(404)
  })
})
