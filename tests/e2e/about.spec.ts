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
        .getByRole('link', { name: 'Privacidad' })
        .click()
    } else {
      await expect(page.getByText('Guía independiente de establecimientos')).toBeVisible()
      await page.getByRole('link', { name: 'Privacidad' }).first().click()
    }

    const privacy = page.getByRole('dialog', { name: 'Privacidad y términos' })
    await expect(privacy).toBeVisible()
    await expect(privacy).toContainText('no usa cuentas ni cookies de rastreo')
    // Lo que sí se hace también se dice, y en la página que la gente abre, no solo en el repositorio.
    await expect(privacy).toContainText('una visita por página y por día')
    await expect(privacy).toContainText('se envían para que no se pierdan')
    await expect(privacy).toContainText('no se publican nunca, ni siquiera como promedio')
    // Y los términos, en la misma página: una sola dirección que leer antes de usar la guía.
    await expect(privacy.getByRole('heading', { name: 'Términos de uso' })).toBeVisible()
    await expect(privacy).toContainText('No tiene relación comercial')
    await expect(privacy).toContainText('sin garantía de que cada dato sea exacto hoy')
    await expect(page).toHaveURL(/\/info\/privacidad$/)
    /*
     * Todo lo que dice se cumple aquí dentro: no hay un enlace que mande a leerlo a otro sitio.
     *
     * Se mira el destino y no el elemento. Las páginas de información se enlazan entre sí (son
     * rutas de la guía, así que son enlaces de verdad), y contar `link` a secas haría fallar esto
     * por el motivo contrario al que protege.
     */
    await expect(privacy.locator('a[href^="http"]')).toHaveCount(0)

    // Desde una página se llega a las otras dos.
    await privacy.getByRole('link', { name: 'Sugiere un cambio' }).click()
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
    await about.getByRole('link', { name: 'Ver el tutorial' }).click()
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
    /*
     * El idioma es navegación: cada opción es un enlace a la misma página en el otro árbol de
     * direcciones. Se comprueba eso además del cambio, porque es lo que lo hace compartible y
     * abrible en otra pestaña, que es lo que un botón no podía dar.
     */
    const aIngles = page.getByRole('link', { name: 'English View the guide in English' })
    await expect(aIngles).toHaveAttribute('hreflang', 'en')
    await expect(aIngles).toHaveAttribute('href', /\/en$/)
    await aIngles.click()

    // El cambio alcanza a toda la interfaz, no solo a una hoja.
    await expect(page.getByRole('searchbox', { name: 'Search places' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Español Ver la guía en Español' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('searchbox', { name: 'Search places' })).toBeVisible()
  })
})
