import { expect, test } from '@playwright/test'

/**
 * La guía sin JavaScript.
 *
 * Es lo que ve un rastreador de buscador, lo que ve quien tiene JavaScript bloqueado, y lo que se ve
 * durante el instante que tarda la aplicación en montar. Hasta la v4.16 era una pantalla en blanco:
 * el cuerpo de las 234 páginas eran 193 bytes con un `<div>` vacío.
 *
 * Estas pruebas no comprueban que la guía funcione sin JavaScript (no funciona, es un mapa), sino
 * que la información y los enlaces estén en el HTML. Esa es la diferencia entre 234 páginas sueltas
 * y un sitio.
 */
test.use({ javaScriptEnabled: false })

test.describe('Sin JavaScript', () => {
  test('una ficha trae su nombre, su horario, su contacto y sus enlaces', async ({
    page,
    baseURL,
  }) => {
    await page.goto(new URL('lugar/tomassa', baseURL).href)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Tomassa/)
    await expect(page.getByRole('heading', { name: 'Horario' })).toBeVisible()
    await expect(page.getByText('14:00-21:00').first()).toBeVisible()

    // Los enlaces son lo que de verdad importa: sin ellos el sitio no tiene grafo que rastrear.
    await expect(page.getByRole('link', { name: 'Paseo Zibatá' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Instagram' })).toBeVisible()
    const internos = page.locator('a[href^="/lugar/"], a[href^="/zona/"]')
    expect(await internos.count()).toBeGreaterThan(3)
  })

  test('una zona lista sus locales, y la portada sus zonas', async ({ page, baseURL }) => {
    await page.goto(new URL('zona/paseo-zibata', baseURL).href)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Paseo Zibatá/)
    expect(await page.locator('a[href^="/lugar/"]').count()).toBeGreaterThan(3)

    await page.goto(new URL('', baseURL).href)
    expect(await page.locator('a[href^="/zona/"]').count()).toBeGreaterThan(5)
  })

  test('la política de privacidad se puede leer', async ({ page, baseURL }) => {
    // Una política que solo existe si se ejecuta JavaScript no se puede citar ni archivar.
    await page.goto(new URL('info/privacidad', baseURL).href)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Privacidad/)
    await expect(page.getByText(/no usa cuentas ni cookies de rastreo/)).toBeVisible()
  })

  test('el árbol inglés también, con sus propias rutas', async ({ page, baseURL }) => {
    await page.goto(new URL('en/place/tomassa', baseURL).href)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Tomassa/)
    expect(
      await page.locator('a[href^="/en/place/"], a[href^="/en/area/"]').count(),
    ).toBeGreaterThan(3)
  })
})
