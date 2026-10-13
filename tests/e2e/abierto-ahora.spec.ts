import { expect, test } from '@playwright/test'
import { openApp, panel, waitForMap } from './helpers.ts'

/**
 * El filtro y el orden por "abierto ahora".
 *
 * Depende del reloj de Querétaro, así que la prueba no fija cuántos hay abiertos: fija las dos
 * reglas que no cambian con la hora. Si a las cuatro de la mañana no hay ninguno abierto, la
 * pastilla no se dibuja y la prueba lo dice en vez de fallar.
 */
test.describe('Abierto ahora', () => {
  test('el filtro deja solo lo abierto, y todo lo que queda lleva su marca', async ({ page }) => {
    await openApp(page, { path: 'zona/paseo-zibata' })
    await waitForMap(page)
    const region = panel(page)

    const pastilla = page.getByRole('switch', { name: /Abierto ahora/ })
    if ((await pastilla.count()) === 0) {
      test.skip(true, 'No hay nada abierto a esta hora en Querétaro')
      return
    }

    const antes = await region.locator('article').count()
    await pastilla.click()
    await expect(pastilla).toHaveAttribute('aria-checked', 'true')

    const tarjetas = region.locator('article')
    const despues = await tarjetas.count()
    expect(despues).toBeGreaterThan(0)
    expect(despues).toBeLessThanOrEqual(antes)
    // Cada tarjeta que queda tiene su marca de abierto, que es el texto que lee un lector de pantalla.
    await expect(region.getByText(/^Abierto ahora: /)).toHaveCount(despues)

    // Y se puede quitar: la lista vuelve a lo que era.
    await pastilla.click()
    await expect(pastilla).toHaveAttribute('aria-checked', 'false')
    await expect(tarjetas).toHaveCount(antes)
  })

  test('los abiertos salen arriba sin haber marcado nada', async ({ page }) => {
    // Navegador limpio: sin favoritos ni calificaciones, el orden sigue siendo el curado de la guía
    // salvo por esto. Estar abierto no es una señal personal, es una propiedad del mundo.
    await openApp(page, { path: 'zona/paseo-zibata' })
    await waitForMap(page)
    const region = panel(page)

    const total = await region.locator('article').count()
    const marcas = await region.getByText(/^Abierto ahora: /).count()
    if (marcas === 0 || marcas === total) {
      test.skip(true, 'A esta hora están todos abiertos o todos cerrados')
      return
    }

    // Las primeras `marcas` tarjetas son exactamente las que llevan marca.
    const primeras = region.locator('article').nth(marcas - 1)
    await expect(primeras.getByText(/^Abierto ahora: /)).toHaveCount(1)
    const siguiente = region.locator('article').nth(marcas)
    await expect(siguiente.getByText(/^Abierto ahora: /)).toHaveCount(0)
  })
})
