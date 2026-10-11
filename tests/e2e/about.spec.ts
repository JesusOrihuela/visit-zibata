import { expect, test } from '@playwright/test'
import { isMobile, openApp } from './helpers.ts'

test.describe('Información de la guía', () => {
  test('se llega desde la pantalla inicial y cada página tiene su propia ruta', async ({
    page,
  }) => {
    await openApp(page)
    // En escritorio, la franja del mapa; en móvil, tu sello de la barra superior.
    if (isMobile(page)) {
      await page.getByRole('button', { name: 'Tu Zibatá' }).click()
      await page
        .getByRole('dialog', { name: 'Tu Zibatá' })
        .getByRole('button', { name: 'Privacidad' })
        .click()
    } else {
      await expect(page.getByText('Guía independiente de establecimientos')).toBeVisible()
      await page.getByRole('button', { name: 'Privacidad' }).first().click()
    }

    const privacy = page.getByRole('dialog', { name: 'Privacidad' })
    await expect(privacy).toBeVisible()
    await expect(privacy).toContainText('no usa cuentas ni cookies de rastreo')
    // Lo que sí se hace también se dice, y en la página que la gente abre, no solo en el repositorio.
    await expect(privacy).toContainText('una visita por página y por día')
    await expect(privacy).toContainText('se envían para que no se pierdan')
    await expect(privacy).toContainText('no se publican nunca, ni siquiera como promedio')
    await expect(page).toHaveURL(/\/info\/privacidad$/)
    // Sin canal de contacto todavía: se explica, no se dibuja un enlace que no lleva a ningún sitio.
    await expect(privacy.getByRole('link')).toHaveCount(0)

    // Desde una página se llega a las otras dos.
    await privacy.getByRole('button', { name: 'Sugiere un cambio' }).click()
    await expect(page.getByRole('dialog', { name: 'Sugiere un cambio' })).toBeVisible()
    await expect(page).toHaveURL(/\/info\/sugerir$/)

    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/$/)
  })

  test('una ruta de información se puede abrir directamente', async ({ page }) => {
    await openApp(page, { path: 'info/acerca' })
    const about = page.getByRole('dialog', { name: 'Acerca de esta guía' })
    await expect(about).toBeVisible()
    await expect(about).toContainText('OpenStreetMap')
    // Cerrar con Escape deja la guía en su vista normal.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('el tutorial no tapa una página compartida y se vuelve a abrir desde los enlaces', async ({
    page,
  }) => {
    // Sin la marca de "ya lo vio": si el tutorial fuera a salir solo, aquí saldría.
    await openApp(page, { path: 'info/acerca', onboarding: true })
    const about = page.getByRole('dialog', { name: 'Acerca de esta guía' })
    await expect(about).toBeVisible()
    // Quien abre /info/acerca viene a leer eso, no a que le expliquen el mapa por encima.
    await expect(page.getByRole('button', { name: 'Saltar' })).toHaveCount(0)

    // Y desde que se recuerda por dispositivo, esta es la forma de volver a verlo.
    await about.getByRole('button', { name: 'Ver el tutorial' }).click()
    await expect(page.getByRole('button', { name: 'Saltar' })).toBeVisible()
    // Por el id del título: "Explora Zibatá" también es el botón de la barra superior.
    await expect(page.locator('#onboarding-title')).toHaveText('Explora Zibatá')
    // Tiene ruta propia, como las otras tres, y la hoja de debajo se cierra.
    await expect(page).toHaveURL(/\/info\/tutorial$/)
    await expect(page.getByRole('dialog', { name: 'Acerca de esta guía' })).toHaveCount(0)

    // Y por eso el botón atrás lo cierra en vez de sacarte de la guía.
    await page.goBack()
    await expect(page.getByRole('button', { name: 'Saltar' })).toHaveCount(0)
    await expect(page).toHaveURL(/\/info\/acerca$/)
  })

  test('la página del tutorial se abre directamente, como las otras tres', async ({ page }) => {
    await openApp(page, { path: 'info/tutorial' })
    await expect(page.getByRole('button', { name: 'Saltar' })).toBeVisible()
    // Los cuatro temas se comportan igual: misma clase de ruta y el mismo trato en el sitemap.
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('el idioma se cambia desde la barra y se recuerda', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'View the guide in English' }).click()
    // El cambio alcanza a toda la interfaz, no solo a una hoja.
    await expect(page.getByRole('searchbox', { name: 'Search places' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ver la guía en Español' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('searchbox', { name: 'Search places' })).toBeVisible()
  })
})
