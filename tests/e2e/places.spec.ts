import { expect, test } from '@playwright/test'
import {
  isMobile,
  openApp,
  panel,
  placeById,
  placesInPlaza,
  waitForMap,
  waitForSheet,
} from './helpers.ts'

test.describe('Plazas y lugares', () => {
  test('abre el detalle de un lugar y el botón "Cómo llegar" lleva a Google Maps', async ({
    page,
    context,
  }) => {
    // Nunca se sale a internet en los tests: Google Maps se simula, también sus enlaces cortos (los
    // que aporta el propietario para los locales con ubicación propia verificada).
    await context.route(/^https:\/\/(www\.google\.com\/maps|maps\.app\.goo\.gl)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<title>Google Maps (simulado)</title>',
      }),
    )
    await openApp(page, { path: 'zona/condesa' })
    const region = panel(page)
    await expect(region.getByRole('heading', { level: 2, name: 'Plaza Condesa' })).toBeVisible()

    await region.getByRole('button', { name: 'Ver detalles de Bendito Bocado' }).click()
    await expect(region.getByRole('heading', { level: 2, name: 'Bendito Bocado' })).toBeVisible()
    await expect(page).toHaveURL(/\/lugar\/bendito-bocado$/)
    // Enlace oficial verificado en la investigación (research/business-audit.json).
    await expect(region.getByRole('link', { name: /Facebook/ })).toHaveAttribute(
      'href',
      'https://www.facebook.com/p/Bendito-Bocado-Zibat%C3%A1-61552620264859/',
    )

    // Con ubicación propia verificada, la ruta lleva a la puerta del local; sin ella, a la plaza por
    // nombre y dirección (nunca a unas coordenadas que Google rotularía con el negocio más cercano).
    const directions = region.getByRole('link', { name: /Cómo llegar/ })
    await expect(directions).toHaveAttribute(
      'href',
      placeById('bendito-bocado').googleMapsUri ??
        'https://www.google.com/maps/dir/?api=1&destination=Plaza+Condesa%2C+Av.+Paseo+de+las+Pitahayas+9-B%2C+Zibat%C3%A1',
    )
    await expect(directions).toHaveAttribute('target', '_blank')
    const popupPromise = page.waitForEvent('popup')
    await directions.click()
    const popup = await popupPromise
    // Abre Google Maps: la ruta a la plaza o el sitio exacto del local, según lo verificado.
    await expect(popup).toHaveURL(/^https:\/\/(www\.google\.com\/maps|maps\.app\.goo\.gl)/)
    await popup.close()

    await region.getByRole('button', { name: 'Volver a Plaza Condesa' }).click()
    await expect(region.getByRole('heading', { level: 2, name: 'Plaza Condesa' })).toBeVisible()
  })

  test('un enlace directo a un lugar abre su ficha', async ({ page }) => {
    await openApp(page, { path: 'lugar/tomassa' })
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Tomassa' })).toBeVisible()
    await expect(panel(page).getByRole('article', { name: 'Tomassa' })).toContainText(
      'Paseo Zibatá',
    )
  })

  test('la ficha servida lleva sus datos estructurados, sin horario ni medias', async ({
    page,
  }) => {
    await openApp(page, { path: 'lugar/tomassa' })
    const bloque = page.locator('script[type="application/ld+json"]')
    await expect(bloque).toHaveCount(1)
    const datos = JSON.parse((await bloque.textContent()) ?? '{}')

    expect(datos['@context']).toBe('https://schema.org')
    expect(datos['@type']).toBe('Restaurant')
    expect(datos.name).toBe('Tomassa Almacén de Pastas')
    expect(datos.address.addressCountry).toBe('MX')
    // Lo que la guía no publica no se publica tampoco aquí: el horario se pudre y una media
    // inventada es justo lo que este proyecto no hace.
    expect(datos).not.toHaveProperty('openingHours')
    expect(datos).not.toHaveProperty('aggregateRating')
  })

  test('compartir un lugar copia siempre la misma URL, sin el filtro desde el que se comparte', async ({
    page,
  }) => {
    // Se entra con una categoría activa a propósito: la ruta de la vista la arrastra y la URL que
    // se comparte no debe llevarla, o el mismo lugar generaría una URL distinta por cada filtro.
    await openApp(page, { path: 'lugar/tomassa?categoria=italiana' })
    const region = panel(page)
    await expect(region.getByRole('heading', { level: 2, name: 'Tomassa' })).toBeVisible()
    await expect(page).toHaveURL(/categoria=italiana/)

    const compartir = region.getByRole('button', { name: 'Compartir Tomassa' })
    await expect(compartir).toBeVisible()
    // La hoja del sistema abriría un diálogo nativo que Playwright no puede cerrar: se fuerza la
    // rama del portapapeles, que es la que se puede comprobar.
    await page.evaluate(() => {
      Reflect.deleteProperty(Navigator.prototype, 'share')
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (texto: string) => {
            ;(window as unknown as { copiado?: string }).copiado = texto
            return Promise.resolve()
          },
        },
      })
    })
    await compartir.click()

    /*
     * Se espera a lo copiado y no al acuse. El acuse vive 2,4 segundos y se borra solo, así que
     * afirmarlo desde aquí es una carrera contra un temporizador que a veces se pierde en un runner
     * cargado, por mucho que se mire primero. Lo copiado queda en `window` para siempre, que es lo
     * que esta prueba dice en su nombre que vino a comprobar. El acuse está cubierto donde se puede
     * comprobar sin reloj: ShareButton.test.tsx.
     */
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { copiado?: string }).copiado))
      .toMatch(/\/lugar\/tomassa$/)

    const copiado = await page.evaluate(() => (window as unknown as { copiado?: string }).copiado)
    expect(copiado).not.toContain('categoria')
    // Sin almohadilla: es la ruta que indexan los buscadores, no el formato antiguo.
    expect(copiado).not.toContain('#')
  })

  test('"atrás" en el navegador cierra la plaza seleccionada', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)
    await page
      .getByRole('combobox', { name: 'Filtrar por zona' })
      .selectOption({ label: 'Plaza Zielo' })
    await expect(page).toHaveURL(/\/zona\/plaza-zielo$/)
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Plaza Zielo' })).toBeVisible()
    await page.goBack()
    await expect(page).not.toHaveURL(/plaza-zielo/)
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Plaza Zielo' })).toBeHidden()
  })

  test('se pueden guardar favoritos y filtrar por ellos', async ({ page }) => {
    await openApp(page, { path: 'zona/plaza-zielo' })
    const region = panel(page)
    await region.getByRole('button', { name: 'Guardar en favoritos: Escarola' }).click()
    await expect(
      region.getByRole('button', { name: 'Quitar de favoritos: Escarola' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await region.getByRole('button', { name: 'Cerrar panel' }).click()
    await page.getByRole('button', { name: /Favoritos/ }).click()
    await expect(region.getByRole('heading', { name: 'Resultados' })).toBeVisible()
    await expect(region.getByRole('button', { name: /^Ver detalles de/ })).toHaveCount(1)
    await page.reload()
    await expect(page.getByRole('button', { name: /Favoritos/ })).toContainText('1')
  })

  test('en móvil la hoja inferior se expande y se reduce sin tapar todo el mapa', async ({
    page,
  }) => {
    test.skip(!isMobile(page), 'Solo aplica a la hoja inferior móvil')
    await openApp(page)
    await waitForMap(page)
    await page.getByRole('button', { name: 'Explora Zibatá' }).click()
    const handle = page.getByRole('button', { name: 'Reducir panel' })
    await expect(handle).toHaveAttribute('aria-expanded', 'true')
    await waitForSheet(page)
    await expect(
      page.getByRole('button', {
        name: new RegExp(`^Xentric Anáhuac, ${placesInPlaza('Xentric Anáhuac')} lugares`),
      }),
    ).toBeVisible()
    const box = await panel(page).boundingBox()
    const viewport = page.viewportSize()
    expect(box && viewport ? box.height / viewport.height : 1).toBeLessThan(0.9)
    await handle.click()
    await waitForSheet(page)
    await expect(page.getByRole('button', { name: 'Ampliar panel' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  test('el ritmo vertical de la ficha se mantiene en sus tres pasos', async ({ page }) => {
    // Lo que se vigila no son los números, es la uniformidad: cada relación repite siempre el mismo
    // paso. Se rompe en cuanto alguien añade un bloque con margen propio, que es como se desordenó
    // antes. La escala está escrita en PlaceDetail.module.css.
    await openApp(page, { path: 'lugar/al-grano' })
    await waitForMap(page)
    const huecos = await page.evaluate(() => {
      const entre = (padre: Element | null) => {
        if (!padre) return []
        const hijos = [...padre.children].filter(
          (hijo) => !hijo.classList.contains('visually-hidden'),
        )
        return hijos.slice(1).map((hijo, i) => {
          const previo = hijos[i] as HTMLElement
          return Math.round(
            hijo.getBoundingClientRect().top - previo.getBoundingClientRect().bottom,
          )
        })
      }
      const ficha = document.querySelector('[class*="detail_"]')
      return {
        bloques: entre(ficha),
        cabecera: entre(document.querySelector('[class*="header_"]')),
      }
    })
    expect(huecos.bloques.length).toBeGreaterThan(2)
    expect(huecos.cabecera.length).toBeGreaterThan(1)
    expect(new Set(huecos.bloques).size, `bloques: ${huecos.bloques}`).toBe(1)
    expect(new Set(huecos.cabecera).size, `cabecera: ${huecos.cabecera}`).toBe(1)
    // El paso de dentro es menor que el de fuera: son dos niveles, no uno con ruido.
    expect(huecos.cabecera[0]).toBeLessThan(huecos.bloques[0] as number)
  })
})
