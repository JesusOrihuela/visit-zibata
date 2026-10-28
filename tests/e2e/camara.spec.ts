import { expect, type Page, test } from '@playwright/test'
import { isMobile, openApp, waitForMap } from './helpers.ts'

/** Posición media (de 0 a 1 del ancho) de los marcadores de plaza que se ven, y cuántos son. */
const dondeEstaZibata = (page: Page) =>
  page.evaluate(() => {
    const visibles = [...document.querySelectorAll<HTMLElement>('button[data-mode]')]
      .filter((m) => m.dataset.mode !== 'hidden')
      .map((m) => m.getBoundingClientRect())
      .filter((b) => b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight)
    const media = visibles.reduce((s, b) => s + (b.left + b.right) / 2, 0) / (visibles.length || 1)
    return { cuantos: visibles.length, x: media / innerWidth }
  })

test.describe('Cámara acotada a Zibatá @mapa', () => {
  test('por mucho que se aleje y se arrastre, Zibatá sigue a la vista y en torno al centro', async ({
    page,
  }) => {
    test.skip(isMobile(page), 'el gesto es de ratón; en el teléfono lo cubre el límite de zoom')
    // En CI cada paso de rueda o de arrastre cuesta de 1 a 7 s (el mapa se dibuja por software en una pantalla
    // ancha): pocos pasos grandes y más tiempo, en vez de muchos pequeños.
    test.slow()
    await openApp(page)
    await waitForMap(page)
    const { width, height } = page.viewportSize() ?? { width: 1280, height: 800 }
    await page.mouse.move(width / 2, height / 2)
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 1200)
      await page.waitForTimeout(60)
    }
    // Arrastrar una y otra vez en la misma dirección, cada vez más lejos de donde empezó.
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(width * 0.8, height / 2)
      await page.mouse.down()
      await page.mouse.move(width * 0.1, height / 2 - 100, { steps: 4 })
      await page.mouse.up()
      await page.waitForTimeout(250)
    }
    await page.waitForTimeout(1500)
    // Antes el centro podía llegar a 440 m fuera de Zibatá y, en una pantalla ancha, dejarla en una
    // esquina: los marcadores quedaban en el tercio izquierdo. Ahora siguen en torno al centro.
    const { cuantos, x } = await dondeEstaZibata(page)
    expect(cuantos).toBeGreaterThanOrEqual(3)
    expect(x).toBeGreaterThan(0.3)
    expect(x).toBeLessThan(0.7)
  })
})
