import { expect, type Page, test } from '@playwright/test'
import { openApp, panel, placesInPlaza, plazaMarker, waitForMap } from './helpers.ts'

/**
 * Plazas representadas en pantalla: marcadores visibles dentro de la vista, ya lleven nombre, solo la
 * cifra o el punto al que se reducen cuando no cabe nada más.
 */
const representedPlazas = (page: Page) =>
  page.evaluate(() => {
    const inView = (element: Element) => {
      const box = element.getBoundingClientRect()
      return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight
    }
    return [...document.querySelectorAll<HTMLElement>('button[data-mode]')].filter(
      (marker) => marker.dataset.mode !== 'hidden' && inView(marker),
    ).length
  })

/**
 * Promesa del mapa: si el punto de una plaza cae en la franja libre (entre la barra superior y el
 * panel), esa plaza tiene marcador (con nombre, con la cifra o reducida a un punto). Las que quedan
 * fuera de la franja (detrás del panel en pantallas muy bajas) se alcanzan por la lista o el selector.
 */
const plazasMissingInBand = (page: Page) =>
  page.evaluate(() => {
    const sheet = document.querySelector('section[data-panel]')?.getBoundingClientRect()
    const topbar = document.querySelector('header')?.getBoundingClientRect()
    // El mapa reserva unos píxeles más que el borde visible del panel (el margen de la cámara), así que
    // la franja que se comprueba es algo menor que el hueco en pantalla.
    const MARGIN = 24
    const band = {
      top: (topbar ? topbar.bottom : 0) + MARGIN,
      bottom: (sheet ? sheet.top : innerHeight) - MARGIN,
    }
    return [...document.querySelectorAll<HTMLElement>('button[data-mode]')]
      .filter((marker) => {
        const anchor = marker.parentElement?.getBoundingClientRect()
        if (!anchor) return false
        const inBand = anchor.bottom >= band.top && anchor.bottom <= band.bottom
        return inBand && marker.dataset.mode === 'hidden'
      })
      .map((marker) => marker.getAttribute('aria-label'))
  })

/** Marcadores mostrados que quedan (en parte) bajo la hoja inferior, que solo existe en móvil. */
const coveredBySheet = (page: Page) =>
  page.evaluate(() => {
    const sheet = document.querySelector('section[data-panel]')?.getBoundingClientRect()
    if (!sheet) return []
    return [...document.querySelectorAll<HTMLElement>('button[data-mode]')]
      .filter(
        (element) =>
          element.dataset.mode !== 'hidden' && element.getBoundingClientRect().bottom > sheet.top,
      )
      .map((element) => element.getAttribute('aria-label'))
  })

/** Nº de plazas activas según el selector de plazas (sin la opción "Todas"). */
const activePlazaCount = async (page: Page) =>
  (await page.getByRole('combobox', { name: 'Filtrar por zona' }).locator('option').count()) - 1

/** Los grados de giro de un elemento, leídos de su matriz de transformación. */
const anguloDe = async (locator: import('@playwright/test').Locator): Promise<number> =>
  locator.evaluate((element) => {
    const matriz = new DOMMatrix(getComputedStyle(element).transform)
    return (Math.atan2(matriz.b, matriz.a) * 180) / Math.PI
  })

test.describe('Mapa @mapa', () => {
  test('abre directamente en el mapa 3D con plazas y atribución', async ({ page }) => {
    await openApp(page)
    await expect(page).toHaveTitle(/Zibatá/)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Visit Zibatá · La guía local',
      }),
    ).toBeAttached()
    const canvas = page.locator('canvas.maplibregl-canvas')
    await expect(canvas).toBeVisible()
    await expect(canvas).toHaveAttribute('aria-label', 'Mapa 3D interactivo de Zibatá')
    await waitForMap(page)
    // Qué zonas llevan marcador propio depende del tamaño de pantalla; alguna siempre lo tiene.
    await expect(page.getByRole('button', { name: /^.+, \d+ lugar(es)?$/ }).first()).toBeVisible()
    await expect((await plazaMarker(page, 'Xentric Anáhuac')).first()).toHaveAccessibleName(
      `Xentric Anáhuac, ${placesInPlaza('Xentric Anáhuac')} lugares`,
    )
    await expect(
      page.locator('.maplibregl-ctrl-attrib a', { hasText: 'OpenStreetMap' }),
    ).toBeAttached()
  })

  test('muestra el tutorial en la primera visita, se puede recorrer y no se repite en la sesión', async ({
    page,
  }) => {
    await openApp(page, { onboarding: true })
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Explora Zibatá' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Siguiente' }).click()
    await expect(dialog.getByRole('heading', { name: 'Selecciona una zona' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Siguiente' }).click()
    await expect(dialog.getByRole('heading', { name: 'Abre la ficha de un lugar' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Siguiente' }).click()
    await expect(dialog.getByRole('heading', { name: 'Deja tu marca' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Empezar a explorar' }).click()
    await expect(dialog).toBeHidden()

    await page.reload()
    await waitForMap(page)
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('el tutorial se puede saltar', async ({ page }) => {
    await openApp(page, { onboarding: true })
    await page.getByRole('dialog').getByRole('button', { name: 'Saltar' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('los controles del mapa orientan y restauran la vista', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)
    // La vista 3D es la única: ya no hay botón para pasar a cenital.
    await expect(
      page.getByRole('button', { name: 'Cambiar entre vista 3D y vista cenital' }),
    ).toHaveCount(0)
    /*
     * Pulsar la brújula gira un octavo de vuelta, y eso es lo que se comprueba: que el dibujo, que
     * sigue al rumbo del mapa, se mueve exactamente 45 grados. Antes enderezaba al norte, y la
     * prueba de entonces solo miraba que el botón se pudiera pulsar: por eso no vio que una vez en
     * el norte dejaba de hacer nada.
     */
    const brujula = page.getByRole('button', { name: /^Girar el mapa/ })
    const dibujo = brujula.locator('svg')

    // La primera cuadra: la vista arranca a -10 grados, así que el primer salto lleva al 0 y es
    // más corto que un octavo. Lo que se fija es que acabe en un múltiplo de 45.
    await brujula.click()
    await expect.poll(async () => Math.abs(Math.round(await anguloDe(dibujo)) % 45)).toBe(0)

    /*
     * Y desde un múltiplo, cada pulsación mueve exactamente un octavo de vuelta. Se mide el valor
     * absoluto porque el dibujo gira al revés que el mapa: la aguja apunta al norte mientras el
     * terreno gira debajo, así que un rumbo que sube 45 se ve como un icono que baja 45.
     */
    const cuadrada = await anguloDe(dibujo)
    await brujula.click()
    await expect
      .poll(async () => {
        const vuelta = (((await anguloDe(dibujo)) - cuadrada + 540) % 360) - 180
        return Math.abs(Math.round(vuelta))
      })
      .toBe(45)

    await page.getByRole('button', { name: 'Volver a la vista de Zibatá' }).click()
    await expect(page.getByRole('button', { name: /^Xentric Anáhuac/ })).toBeVisible()
  })

  test('la vista inicial representa todas las plazas activas y la atribución es visible', async ({
    page,
  }) => {
    await openApp(page)
    await waitForMap(page)
    await expect.poll(() => plazasMissingInBand(page)).toEqual([])
    await expect.poll(() => representedPlazas(page)).toBe(await activePlazaCount(page))
    // Paseo Zibatá, la plaza con más locales, nunca debe desaparecer del mapa.
    await expect(page.getByRole('button', { name: /^Paseo Zibatá/ })).toBeVisible()
    const attribution = page.locator('.maplibregl-ctrl-attrib')
    await expect(attribution).toBeInViewport()
    // La atribución de OpenStreetMap no puede quedar debajo de la hoja inferior (solo existe en móvil).
    const sheet = page.locator('section[data-panel]')
    if ((await sheet.count()) > 0) {
      const sheetBox = await sheet.boundingBox()
      const box = await attribution.boundingBox()
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(sheetBox?.y ?? 0)
    }
  })

  test('con movimiento reducido cada plaza conserva su marcador en escritorio', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Colocación con el espacio de escritorio')
    // Sin animaciones de cámara no hay pasadas extra: la colocación debe usar el ancho real de las etiquetas.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openApp(page)
    await waitForMap(page)
    const total = await activePlazaCount(page)
    // Ninguna plaza se queda sin marcador…
    await expect
      .poll(() => page.locator('button[data-mode]:not([data-mode="hidden"])').count())
      .toBe(total)
    // …y solo la que comparte esquina con otra (Plaza Loop y Plaza Condesa están a 200 m) se reduce a
    // un punto: el resto conserva su etiqueta con el nombre o la cifra.
    await expect.poll(() => page.locator('button[data-mode="dot"]').count()).toBeLessThanOrEqual(1)
  })

  test('una plaza sin sitio para su etiqueta sigue en el mapa como punto pulsable', async ({
    page,
  }) => {
    await openApp(page)
    await waitForMap(page)
    await page.waitForTimeout(1200)
    const dots = page.locator('button[data-mode="dot"]')
    test.skip((await dots.count()) === 0, 'En esta pantalla todas las plazas muestran su etiqueta')
    const dot = dots.first()
    const name = ((await dot.getAttribute('aria-label')) ?? '').replace(/^(.*), .*$/, '$1')
    await expect(dot).toBeVisible()
    await dot.click()
    await expect(panel(page).getByRole('heading', { level: 2, name })).toBeVisible()
  })

  test('"Volver a la vista de Zibatá" funciona también con una plaza abierta', async ({ page }) => {
    // Sin animaciones, la cámara salta a su destino y la medición es determinista.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openApp(page, { path: 'zona/condesa' })
    await waitForMap(page)
    await expect(
      panel(page).getByRole('heading', { level: 2, name: 'Plaza Condesa' }),
    ).toBeVisible()
    // Distancia en pantalla entre dos plazas: se reduce cuando la cámara vuelve a la vista general.
    const spread = () =>
      page.evaluate(() => {
        const anchor = (name: string) => {
          const marker = document.querySelector(`button[data-mode][aria-label^="${name}, "]`)
          const box = marker?.getBoundingClientRect()
          return box ? { x: box.left + box.width / 2, y: box.bottom } : { x: 0, y: 0 }
        }
        const a = anchor('Plaza Condesa')
        const b = anchor('Plaza Zielo')
        return Math.hypot(a.x - b.x, a.y - b.y)
      })
    await page.waitForTimeout(1000)
    const focused = await spread()
    await page.getByRole('button', { name: 'Volver a la vista de Zibatá' }).click()
    await expect.poll(spread).toBeLessThan(focused * 0.6)
    // Con el panel abierto la franja de mapa es demasiado corta para etiquetar todas las plazas; lo que
    // se comprueba aquí es que la cámara vuelve a la vista general sin cerrar la plaza. La garantía de
    // que ninguna plaza desaparece se verifica en la vista inicial (arriba).
    await expect(page.getByRole('button', { name: /^Plaza Condesa/ })).toBeVisible()
    await expect(
      panel(page).getByRole('heading', { level: 2, name: 'Plaza Condesa' }),
    ).toBeVisible()
  })

  test('seleccionar una plaza en el mapa abre su panel y actualiza la URL', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)
    const marker = await plazaMarker(page, 'Xentric Anáhuac')
    await marker.click()
    const region = panel(page)
    await expect(region.getByRole('heading', { level: 2, name: 'Xentric Anáhuac' })).toBeVisible()
    await expect(
      region.getByText(`Zona · ${placesInPlaza('Xentric Anáhuac')} lugares`),
    ).toBeVisible()
    // El índice va repartido en grupos por horario, así que se cuentan las tarjetas y no los
    // elementos de una lista: lo que se fija es que estén todos los lugares de la zona.
    await expect(region.getByRole('link', { name: /^Ver detalles de/ })).toHaveCount(
      placesInPlaza('Xentric Anáhuac'),
    )
    await expect(page).toHaveURL(/\/zona\/xentric-anahuac$/)
    await expect(marker).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('Móvil en horizontal', () => {
  test.use({ viewport: { width: 844, height: 390 } })

  test('el tutorial se puede recorrer y una plaza abierta deja el mapa visible', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Orientación horizontal de teléfono')
    // MapLibre avisa cuando un encuadre no cabe en el espacio libre (la cámara no se movería).
    const cameraWarnings: string[] = []
    page.on('console', (message) => {
      if (message.text().includes('cannot fit')) cameraWarnings.push(message.text())
    })
    await openApp(page, { onboarding: true })
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Siguiente' }).click()
    await dialog.getByRole('button', { name: 'Siguiente' }).click()
    await dialog.getByRole('button', { name: 'Siguiente' }).click()
    await dialog.getByRole('button', { name: 'Empezar a explorar' }).click()
    await expect(dialog).toBeHidden()

    await waitForMap(page)
    // En horizontal la franja de mapa mide poco más de 100 px: no caben diez marcadores, ni siquiera
    // reducidos a un punto. Lo que sí se exige aquí es que ninguno quede debajo de la hoja, que la plaza
    // con más lugares siga marcada y que el resto se alcance por el selector (se usa justo después).
    await expect.poll(() => coveredBySheet(page)).toEqual([])
    await expect(page.getByRole('button', { name: /^Xentric Anáhuac/ })).toBeVisible()
    await page
      .getByRole('combobox', { name: 'Filtrar por zona' })
      .selectOption({ label: 'Paseo Zibatá' })
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Paseo Zibatá' })).toBeVisible()
    const header = await page
      .locator('header', { has: page.getByRole('searchbox', { name: 'Buscar lugares' }) })
      .boundingBox()
    const sheet = await page.locator('section[data-panel]').boundingBox()
    // Queda una franja de mapa entre la barra superior y la hoja.
    expect((sheet?.y ?? 0) - ((header?.y ?? 0) + (header?.height ?? 0))).toBeGreaterThan(60)
    // La vista general también cabe en pantallas bajas (con y sin plaza abierta).
    await page.getByRole('button', { name: 'Volver a la vista de Zibatá' }).click()
    await page.waitForTimeout(1500)
    expect(cameraWarnings).toEqual([])
  })
})
