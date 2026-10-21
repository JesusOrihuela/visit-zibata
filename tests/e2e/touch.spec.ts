import { expect, test } from '@playwright/test'
import { openApp, panel, plazaMarker, waitForMap, waitForSheet } from './helpers.ts'

// Solo en proyectos con pantalla táctil (teléfono Android, iPhone con WebKit y tableta).
test.describe('Interacción táctil', () => {
  test.beforeEach(({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'Requiere pantalla táctil emulada')
    void page
  })

  test('tocar un marcador abre la plaza y tocar una tarjeta abre la ficha', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)
    const marker = await plazaMarker(page, 'Plaza Condesa')
    await marker.tap()
    const region = panel(page)
    await expect(region.getByRole('heading', { level: 2, name: 'Plaza Condesa' })).toBeVisible()
    await region.getByRole('link', { name: 'Ver detalles de Bendito Bocado' }).tap()
    await expect(region.getByRole('heading', { level: 2, name: 'Bendito Bocado' })).toBeVisible()
    await region.getByRole('button', { name: 'Volver a Plaza Condesa' }).tap()
    await expect(region.getByRole('heading', { level: 2, name: 'Plaza Condesa' })).toBeVisible()
  })

  test('las pastillas de categoría y el buscador responden al tacto', async ({ page }) => {
    await openApp(page)
    const categories = page.getByRole('list', { name: 'Categorías' }).first()
    await categories.getByRole('link', { name: /Postres/ }).tap()
    await expect(categories.getByRole('link', { name: /Postres/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    const search = page.getByRole('searchbox', { name: 'Buscar lugares' })
    await search.tap()
    await expect(search).toBeFocused()
    await search.fill('helado')
    await expect(
      panel(page)
        .getByRole('link', { name: /^Ver detalles de/ })
        .first(),
    ).toBeVisible()
  })

  test('arrastrar la hoja inferior hacia arriba la expande', async ({ page, browserName }) => {
    const viewport = page.viewportSize()
    test.skip(
      (viewport?.width ?? 1440) >= 900,
      'La hoja inferior solo existe en pantallas estrechas',
    )
    // Playwright solo puede inyectar gestos táctiles de arrastre en Chromium (CDP). En WebKit se
    // comprueban toques (tap), no arrastres: limitación documentada en docs/TESTING.md.
    test.skip(browserName !== 'chromium', 'Arrastre táctil solo emulable en Chromium')
    await openApp(page)
    await waitForMap(page)
    const handle = page.getByRole('button', { name: 'Ampliar panel' })
    await expect(handle).toBeInViewport()
    await waitForSheet(page)
    const box = await handle.boundingBox()
    if (!box) throw new Error('Sin asa de la hoja')
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    // Arrastre largo (560 px): pasa del punto medio entre hoja colapsada y expandida, así que la hoja se
    // abre por posición y no depende de la velocidad del gesto, que con la máquina cargada baja del umbral.
    for (let step = 1; step <= 14; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - step * 40 }],
      })
      await page.waitForTimeout(16)
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByRole('button', { name: 'Reducir panel' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})
