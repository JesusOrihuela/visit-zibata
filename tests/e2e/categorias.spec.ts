import { expect, test } from '@playwright/test'
import { openApp, panel, placesInCategory, waitForMap } from './helpers.ts'

/*
 * Cada categoría es una página con su propia dirección (`/categoria/x`, `/en/category/x`), y sus
 * cápsulas son enlaces de verdad. Aquí se comprueba el comportamiento en el navegador; el HTML que se
 * sirve lo comprueban `seo-regresion.spec.ts` y `scripts/build/prerender.metadatos.test.ts`, y la
 * redirección de los enlaces antiguos, `worker/redireccion.test.ts` (`vite preview` no tiene Worker).
 */

const cápsulas = (page: import('@playwright/test').Page) =>
  page.getByRole('list', { name: 'Categorías' }).first()

test.describe('Páginas de categoría', () => {
  test('abrir la dirección de una categoría muestra sus locales con su cápsula elegida', async ({
    page,
  }) => {
    await openApp(page, { path: 'categoria/italiana' })
    const region = panel(page)
    await expect(region.getByRole('heading', { name: 'Resultados' })).toBeVisible()
    await expect(page).toHaveURL(/\/es\/categoria\/italiana$/)
    await expect(cápsulas(page).getByRole('link', { name: /^Italiana/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    // Los locales que se ven son los de la categoría, no un recorte.
    await expect(page.getByText(`${placesInCategory('italiana')} resultados`).first()).toBeVisible()
  })

  test('la cápsula es un enlace con la dirección de su página, y elegirla filtra sin recargar', async ({
    page,
  }) => {
    await openApp(page)
    await waitForMap(page)
    const italiana = cápsulas(page).getByRole('link', { name: /^Italiana/ })
    await expect(italiana).toHaveAttribute('href', /\/categoria\/italiana$/)

    await page.evaluate(() => {
      ;(window as unknown as { __marca: string }).__marca = 'misma-carga'
    })
    await italiana.click()
    await expect(page).toHaveURL(/\/es\/categoria\/italiana$/)
    // Sin recarga: la marca puesta en la página sigue ahí.
    expect(await page.evaluate(() => (window as unknown as { __marca?: string }).__marca)).toBe(
      'misma-carga',
    )
    await expect(italiana).toHaveAttribute('aria-current', 'true')

    // Volver a pulsarla la quita, y la cápsula elegida apunta a la vista sin categoría.
    await expect(italiana).toHaveAttribute('href', /\/es$/)
    await italiana.click()
    await expect(page).toHaveURL(/\/es$/)
    await expect(cápsulas(page).getByRole('link', { name: /^Todo/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  test('cambiar de categoría no llena el historial: atrás no recorre las cápsulas', async ({
    page,
  }) => {
    await openApp(page)
    const antes = await page.evaluate(() => window.history.length)
    await cápsulas(page)
      .getByRole('link', { name: /^Italiana/ })
      .click()
    await expect(page).toHaveURL(/\/es\/categoria\/italiana$/)
    await cápsulas(page).getByRole('link', { name: /^Bar / }).click()
    await expect(page).toHaveURL(/\/es\/categoria\/bar$/)
    expect(await page.evaluate(() => window.history.length)).toBe(antes)
  })

  test('un enlace antiguo con parámetro se lleva a la dirección de la categoría', async ({
    page,
  }) => {
    await openApp(page, { path: '?categoria=italiana' })
    await expect(page).toHaveURL(/\/es\/categoria\/italiana$/)
    await expect(cápsulas(page).getByRole('link', { name: /^Italiana/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  test('en inglés tiene su propia ruta y sus propios nombres', async ({ page }) => {
    await openApp(page, { path: 'en/category/italian' })
    await expect(page).toHaveURL(/\/en\/category\/italian$/)
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible()
  })

  test('dentro de una zona la categoría sigue siendo un filtro de esa zona', async ({ page }) => {
    await openApp(page, { path: 'zona/paseo-zibata' })
    const enlace = cápsulas(page).getByRole('link', { name: /Desayunos y Café/ })
    await expect(enlace).toHaveAttribute(
      'href',
      /\/zona\/paseo-zibata\?categoria=desayunos-y-cafe$/,
    )
    await enlace.click()
    await expect(page).toHaveURL(/\/es\/zona\/paseo-zibata\?categoria=desayunos-y-cafe$/)
  })

  test('con Ctrl el enlace no se intercepta: apunta a una página que existe', async ({ page }) => {
    await openApp(page)
    const italiana = cápsulas(page).getByRole('link', { name: /^Italiana/ })
    const href = await italiana.getAttribute('href')
    expect(href).toMatch(/\/categoria\/italiana$/)
    // Lo que importa es que la app no cancele el clic (el navegador abre la pestaña) y que el destino
    // exista. No se espera a la pestaña nueva: en CI a veces se queda en about:blank y la prueba dependía
    // de eso (falló en el despliegue de #59, en escritorio y tableta).
    await page.evaluate(() => {
      ;(window as unknown as { __clic: Promise<boolean> }).__clic = new Promise((resolve) => {
        window.addEventListener('click', (event) => resolve(event.defaultPrevented), { once: true })
      })
    })
    await italiana.click({ modifiers: ['Control'] })
    const cancelado = await page.evaluate(
      () => (window as unknown as { __clic: Promise<boolean> }).__clic,
    )
    expect(cancelado).toBe(false)
    await expect(page).toHaveURL(/\/es$/)
    const respuesta = await page.request.get(new URL(href ?? '', page.url()).href)
    expect(respuesta.status()).toBe(200)
  })
})
