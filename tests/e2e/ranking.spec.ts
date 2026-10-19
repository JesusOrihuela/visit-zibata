import { expect, test } from '@playwright/test'
import { openApp, panel, waitForSheet } from './helpers.ts'

test.describe('Orden personal', () => {
  test('sin historial, la plaza muestra su orden curado; con gustos, lo preferido sube', async ({
    page,
  }) => {
    await openApp(page, { path: 'zona/paseo-zibata' })
    await waitForSheet(page)
    const cards = panel(page).getByRole('button', { name: /^Ver detalles de/ })
    await expect(cards.first()).toBeVisible()
    const curated = await cards.allTextContents()
    expect(curated[0]).not.toContain('Luka')

    // Favorito guardado en este dispositivo (lo mismo que pulsar el corazón en otra visita).
    await page.evaluate(() =>
      window.localStorage.setItem('zibata:favoritos', JSON.stringify(['luka-pokes'])),
    )
    await page.reload()
    await waitForSheet(page)
    /*
     * El índice ordena por horario pero ya no se parte, así que el orden personal manda **dentro de
     * los que comparten estado**: un favorito cerrado no sube por encima de los que sí están
     * abiertos. No se comprueba que sea la primera tarjeta de la zona, porque eso dependería de la
     * hora a la que corra la prueba, sino las dos cosas que el producto sí promete siempre: que
     * subió, y que ninguno de su mismo estado le pasa por delante.
     */
    const porEstado = await page.evaluate(() => {
      // La lista de lugares, no la de categorías: la que contiene tarjetas que abren una ficha.
      const lista = [...document.querySelectorAll('[data-panel] ul')].find((candidata) =>
        candidata.querySelector('button[aria-label^="Ver detalles de"]'),
      )
      if (!lista) return []
      return [...lista.querySelectorAll('li')].map((item) => ({
        nombre: item.querySelector('button')?.getAttribute('aria-label') ?? '',
        estado: item.querySelector('[data-estado]')?.getAttribute('data-estado') ?? '?',
      }))
    })
    const luka = porEstado.findIndex((fila) => fila.nombre.includes('Luka'))
    expect(luka, `orden: ${porEstado.map((f) => f.nombre).join(' | ')}`).toBeGreaterThanOrEqual(0)
    expect(luka).toBeLessThan(curated.findIndex((texto) => texto.includes('Luka')))
    const suEstado = porEstado[luka]?.estado
    const primeroDeSuEstado = porEstado.findIndex((fila) => fila.estado === suEstado)
    expect(primeroDeSuEstado, `estados: ${porEstado.map((f) => f.estado).join(',')}`).toBe(luka)
  })

  test('marcar un favorito dentro de la lista no la reordena bajo el dedo', async ({ page }) => {
    await openApp(page, { path: 'zona/paseo-zibata' })
    await waitForSheet(page)
    const region = panel(page)
    const cards = region.getByRole('button', { name: /^Ver detalles de/ })
    await expect(cards.first()).toBeVisible()
    const before = await cards.allTextContents()
    await region
      .getByRole('button', { name: /Guardar .*Luka/ })
      .first()
      .click()
    await expect(cards).toHaveText(before)
  })
})
