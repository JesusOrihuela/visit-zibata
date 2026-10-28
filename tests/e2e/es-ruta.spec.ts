import { expect, test } from '@playwright/test'
import { openApp } from './helpers.ts'

/*
 * El español lleva `/es`, como el inglés lleva `/en`. Aquí se fija lo que el resto de la suite da por
 * hecho (que `openApp` escribe `es/…` por sí solo): la ruta, el canónico, las `hreflang` y el camino
 * desde las direcciones de antes. La redirección con 301 de `/lugar/x` a `/es/lugar/x` es del Worker,
 * que la vista previa no tiene: la cubren las pruebas de `worker/redireccion.ts` y, tras desplegar, `curl`.
 */

/** La ruta de una dirección absoluta (con SITE_URL) o relativa (sin él, como en la vista previa). */
const rutaDe = (direccion: string | null | undefined): string =>
  new URL(direccion ?? '', 'http://localhost').pathname

test.describe('El español con /es', () => {
  test('la portada es /es, con su canónico y sus hreflang apuntando a /es y /en', async ({
    page,
    baseURL,
  }) => {
    await openApp(page)
    expect(new URL(page.url()).pathname).toMatch(/\/es$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')

    const canonico = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(rutaDe(canonico)).toMatch(/\/es$/)
    const alternos = Object.fromEntries(
      await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((links) =>
          links.map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]),
        ),
    ) as Record<string, string>
    expect(rutaDe(alternos.es)).toMatch(/\/es$/)
    expect(rutaDe(alternos.en)).toMatch(/\/en$/)
    // `x-default` apunta a una página que responde 200, no a `/`, que el Worker redirige.
    expect(rutaDe(alternos['x-default'])).toMatch(/\/es$/)
    const respuesta = await page.request.get(new URL('es', baseURL).href)
    expect(respuesta.status()).toBe(200)
  })

  test('una ficha y una zona viven en /es/… y su canónico también', async ({ page }) => {
    for (const ruta of ['lugar/tomassa', 'zona/paseo-zibata', 'info/privacidad']) {
      await openApp(page, { path: ruta })
      expect(new URL(page.url()).pathname, ruta).toContain(`/es/${ruta}`)
      const canonico = await page.locator('link[rel="canonical"]').getAttribute('href')
      expect(rutaDe(canonico), ruta).toContain(`/es/${ruta}`)
    }
  })

  test('los enlaces de la interfaz llevan /es, y el cambio de idioma va a /en y vuelve', async ({
    page,
  }) => {
    await openApp(page, { path: 'zona/paseo-zibata' })
    // Las cápsulas de categoría se ven en todas las pantallas: "Todo" apunta a la portada y las demás, a su
    // página o al filtro de la zona.
    const cápsulas = page.getByRole('list', { name: 'Categorías' }).first().getByRole('link')
    await expect(cápsulas.first()).toBeVisible()
    const enlaces = await cápsulas.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    )
    expect(enlaces.length).toBeGreaterThan(3)
    for (const href of enlaces)
      expect(href).toMatch(
        /\/es(?:\/zona\/[a-z0-9-]+)?(?:\/categoria\/[a-z0-9-]+|\?categoria=[a-z0-9-]+)?$/,
      )

    await page.getByRole('link', { name: /View the guide in English/ }).click()
    await expect(page).toHaveURL(/\/en\/area\/paseo-zibata$/)
    await page.getByRole('link', { name: /Ver la guía en Español/ }).click()
    await expect(page).toHaveURL(/\/es\/zona\/paseo-zibata$/)
  })

  test('la dirección de antes, sin prefijo, acaba en /es sin perder la página', async ({
    page,
  }) => {
    // Con hash (el formato más viejo) y la raíz: lo único sin prefijo que existe en la vista previa.
    await page.addInitScript(() => window.localStorage.setItem('zibata:onboarding-visto', '1'))
    await page.goto('./#/lugar/tomassa')
    await expect(page).toHaveURL(/\/es\/lugar\/tomassa$/)
    await page.goto('./')
    await expect(page).toHaveURL(/\/es$/)
  })
})
