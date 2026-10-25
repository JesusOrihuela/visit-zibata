import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { isMobile, openApp, panel, placesInPlaza, plazaMarker, waitForMap } from './helpers.ts'

test.describe('Estados de error', () => {
  test('sin WebGL2 se explica el problema y la guía sigue funcionando con la lista', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      // Simula un navegador sin WebGL.
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...args: unknown[]
      ) {
        if (type === 'webgl2' || type === 'webgl') return null
        return (original as (...a: unknown[]) => RenderingContext | null).call(this, type, ...args)
      } as typeof HTMLCanvasElement.prototype.getContext
    })
    await openApp(page)
    await expect(
      page.getByRole('alert').filter({ hasText: 'El mapa 3D no está disponible' }),
    ).toBeVisible()
    if (isMobile(page)) await page.getByRole('button', { name: 'Ver las zonas' }).click()
    await page
      .getByRole('link', {
        name: new RegExp(`^Paseo Zibatá, ${placesInPlaza('Paseo Zibatá')} lugares`),
      })
      .click()
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Paseo Zibatá' })).toBeVisible()
  })

  test('si los datos no cargan se muestra un error claro con opción de reintentar', async ({
    page,
  }) => {
    await page.route(/\/assets\/places-[\w-]+\.js$/, (route) => route.abort())
    await openApp(page)
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('No pudimos cargar los lugares')
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  })

  test('un registro inválido se omite con aviso y el resto de la guía funciona', async ({
    page,
  }) => {
    const warnings: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'warning' && message.text().includes('[datos]')) {
        warnings.push(message.text())
      }
    })
    // Publicación defectuosa: un local con enlace peligroso y otro sin plaza existente.
    await page.route(/\/assets\/places-[\w-]+\.js$/, async (route) => {
      const response = await route.fetch()
      // El chunk es JavaScript minificado (claves sin comillas, cadenas con acentos graves).
      const body = (await response.text())
        .replace('links:{website:null', 'links:{website:`javascript:alert(1)`')
        .replace('plazaId:`paseo-zibata`', 'plazaId:`plaza-que-no-existe`')
      await route.fulfill({ response, body })
    })
    await openApp(page)
    await expect(page.getByRole('searchbox', { name: 'Buscar lugares' })).toBeVisible()
    await page
      .getByRole('button', { name: isMobile(page) ? 'Ver las zonas' : 'Explora Zibatá' })
      .click()
    // La plaza sigue abriéndose: solo faltan los registros defectuosos.
    await page.getByRole('link', { name: /^Plaza Condesa, \d+ lugares/ }).click()
    await expect(
      panel(page).getByRole('heading', { level: 2, name: 'Plaza Condesa' }),
    ).toBeVisible()
    expect(warnings.join(' ')).toMatch(/omitido|omitida/)
  })

  test('si el código del mapa no descarga, la guía no queda en blanco y sigue usable', async ({
    page,
  }) => {
    // Red caída o publicación nueva que retiró el chunk que pedía una página abierta.
    await page.route(/\/assets\/MapView-[\w-]+\.js$/, (route) => route.abort())
    await openApp(page)
    const alert = page.getByRole('alert').filter({ hasText: 'El mapa 3D no está disponible' })
    await expect(alert).toBeVisible()
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Buscar lugares' })).toBeVisible()
    if (isMobile(page)) await page.getByRole('button', { name: 'Ver las zonas' }).click()
    await page
      .getByRole('link', {
        name: new RegExp(`^Paseo Zibatá, ${placesInPlaza('Paseo Zibatá')} lugares`),
      })
      .click()
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Paseo Zibatá' })).toBeVisible()
  })

  test('si la cartografía base no carga, se informa y se recupera al reintentar', async ({
    page,
  }) => {
    // Se corta el TileJSON, no una tesela: es lo que MapLibre pide primero, y su fallo es el único
    // que deja el mapa sin base. Una tesela suelta que falle no debe disparar este aviso.
    let available = false
    await page.route(/map\/tiles\.json/, (route) =>
      available ? route.continue() : route.fulfill({ status: 404, body: 'Not found' }),
    )
    await openApp(page)
    const alert = page.getByRole('alert').filter({ hasText: 'El mapa 3D no está disponible' })
    await expect(alert).toBeVisible()
    available = true
    await alert.getByRole('button', { name: 'Reintentar' }).click()
    await waitForMap(page)
    await expect(alert).toBeHidden()
  })
})

test.describe('Accesibilidad', () => {
  test('sin violaciones graves o críticas en inicio, plaza y ficha', async ({ page }) => {
    // Sin animaciones de entrada: axe mide los colores finales, no fotogramas semitransparentes.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openApp(page)
    await waitForMap(page)
    const scan = async () => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // El lienzo WebGL no es contenido textual; su alternativa son los marcadores (sí se analizan) y la lista.
        .exclude('canvas.maplibregl-canvas')
        .analyze()
      return results.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => ({
          id: violation.id,
          targets: violation.nodes.map((node) => node.target.join(' ')),
        }))
    }
    expect(await scan()).toEqual([])

    await page
      .getByRole('combobox', { name: 'Filtrar por zona' })
      .selectOption({ label: 'Xentric Zibatá' })
    await expect(
      panel(page).getByRole('heading', { level: 2, name: 'Xentric Zibatá' }),
    ).toBeVisible()
    expect(await scan()).toEqual([])

    await panel(page).getByRole('link', { name: 'Ver detalles de Cosi Fan Tutte' }).click()
    await expect(
      panel(page).getByRole('heading', { level: 2, name: 'Cosi Fan Tutte' }),
    ).toBeVisible()
    expect(await scan()).toEqual([])
  })

  test('al cerrar el panel con teclado el foco vuelve al marcador que lo abrió', async ({
    page,
  }) => {
    await openApp(page)
    await waitForMap(page)
    const marker = await plazaMarker(page, 'Xentric Anáhuac')
    await marker.focus()
    await page.keyboard.press('Enter')
    const region = panel(page)
    await expect(region.getByRole('heading', { level: 2, name: 'Xentric Anáhuac' })).toBeFocused()
    await region.getByRole('button', { name: 'Cerrar panel' }).focus()
    await page.keyboard.press('Enter')
    await expect(marker).toBeFocused()
  })

  test('respeta "reducir movimiento"', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openApp(page)
    await waitForMap(page)
    await (await plazaMarker(page, 'Xentric Anáhuac')).click()
    await expect(
      panel(page).getByRole('heading', { level: 2, name: 'Xentric Anáhuac' }),
    ).toBeVisible()
    const duration = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--duration-slow'),
    )
    expect(duration.trim()).toMatch(/^0m?s$/)
  })
})

test.describe('Sin conexión', () => {
  test('avisa al perder la conexión, la guía cargada sigue usable y el aviso desaparece al volver', async ({
    page,
    context,
  }) => {
    await openApp(page)
    await waitForMap(page)
    const notice = page.getByRole('main').getByText(/^Sin conexión a internet/)
    await expect(notice).toBeHidden()
    await context.setOffline(true)
    await expect(notice).toBeVisible()
    await expect(page.locator('[aria-live="polite"]')).toHaveText(/^Sin conexión a internet/)
    // Los datos ya descargados permiten seguir buscando.
    await page.getByRole('searchbox', { name: 'Buscar lugares' }).fill('pizza')
    await expect(
      panel(page)
        .getByRole('link', { name: /^Ver detalles de/ })
        .first(),
    ).toBeVisible()
    await context.setOffline(false)
    await expect(notice).toBeHidden()
  })
})
