import { expect, type Page, test } from '@playwright/test'
import { openApp, panel } from './helpers.ts'

/*
 * La medición propia (worker/eventos.ts y lib/eventos.ts), vista desde el navegador: qué sale, con
 * qué forma y qué no sale nunca. Lo que no se prueba aquí es el Worker real ni la base: `vite preview`
 * no los tiene, así que `/api/evento` se intercepta y se mira el cuerpo que habría recibido.
 *
 * Los límites de lo que esto demuestra están en docs/PRUEBAS.md: que el navegador envía lo esperado,
 * no que producción lo guarde.
 */

interface Envio {
  idioma: string
  eventos: { tipo: string; destino: string; detalle?: string }[]
}

/** Intercepta el endpoint, recuerda los cuerpos y contesta 204 como el Worker. */
async function capturar(page: Page): Promise<Envio[]> {
  const envios: Envio[] = []
  await page.route('**/api/evento', async (route) => {
    envios.push(JSON.parse(route.request().postData() ?? '{}') as Envio)
    await route.fulfill({ status: 204 })
  })
  return envios
}

/** Hace lo que el navegador al ocultar la pestaña: es lo que vacía la cola. */
const ocultarPestana = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })

const todos = (envios: Envio[]) => envios.flatMap((envio) => envio.eventos)

test.describe('Medición de uso', () => {
  test('abrir una ficha desde la lista y salir por Cómo llegar se cuentan, sin identificar a nadie', async ({
    page,
    context,
  }) => {
    await context.route(/^https:\/\/(www\.google\.com\/maps|maps\.app\.goo\.gl)/, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Maps</title>' }),
    )
    const envios = await capturar(page)
    await openApp(page, { path: 'zona/condesa' })
    const region = panel(page)
    await region.getByRole('link', { name: 'Ver detalles de Bendito Bocado' }).click()
    await expect(region.getByRole('heading', { level: 2, name: 'Bendito Bocado' })).toBeVisible()

    const popup = page.waitForEvent('popup')
    await region.getByRole('link', { name: /Cómo llegar/ }).click()
    await (await popup).close()

    await ocultarPestana(page)
    await expect.poll(() => todos(envios).length).toBeGreaterThan(0)

    expect(todos(envios)).toEqual(
      expect.arrayContaining([
        { tipo: 'ficha', destino: 'bendito-bocado' },
        { tipo: 'salida', destino: 'bendito-bocado', detalle: 'maps' },
      ]),
    )
    // Solo el idioma y los eventos: nada que identifique ni texto libre.
    for (const envio of envios) expect(Object.keys(envio).sort()).toEqual(['eventos', 'idioma'])
    expect(envios[0]?.idioma).toBe('es')
  })

  test('abrir la guía directamente en una ficha no cuenta una apertura interna: ya la cuenta el servidor', async ({
    page,
  }) => {
    const envios = await capturar(page)
    await openApp(page, { path: 'lugar/bendito-bocado' })
    await expect(
      panel(page).getByRole('heading', { level: 2, name: 'Bendito Bocado' }),
    ).toBeVisible()
    await ocultarPestana(page)
    // Si no hubo ningún evento, no hay envío en absoluto.
    await page.waitForTimeout(300)
    expect(todos(envios).filter((evento) => evento.tipo === 'ficha')).toEqual([])
  })

  test('escribir en el buscador cuenta solo si hubo resultados, nunca el texto', async ({
    page,
  }) => {
    const envios = await capturar(page)
    await openApp(page)
    const buscador = page.getByRole('searchbox')
    await buscador.fill('zzqxjvk')
    // El conteo espera a que la búsqueda se asiente.
    await page.waitForTimeout(1800)
    await ocultarPestana(page)
    await expect.poll(() => todos(envios).length).toBeGreaterThan(0)
    expect(todos(envios)).toContainEqual({ tipo: 'busqueda', destino: 'sin-resultados' })
    // Ni rastro de lo escrito en nada de lo enviado.
    expect(JSON.stringify(envios)).not.toContain('zzqxjvk')
  })

  test('con Global Privacy Control no sale ninguna petición', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }),
    )
    const envios = await capturar(page)
    await openApp(page, { path: 'zona/condesa' })
    await panel(page).getByRole('link', { name: 'Ver detalles de Bendito Bocado' }).click()
    await ocultarPestana(page)
    await page.waitForTimeout(500)
    expect(envios).toHaveLength(0)
  })

  test('no deja cookies ni almacenamiento nuevo', async ({ page, context }) => {
    await capturar(page)
    await openApp(page, { path: 'zona/condesa' })
    const antes = await page.evaluate(() => Object.keys(window.localStorage).sort())
    await panel(page).getByRole('link', { name: 'Ver detalles de Bendito Bocado' }).click()
    await ocultarPestana(page)
    await page.waitForTimeout(300)
    expect(await context.cookies()).toEqual([])
    const despues = await page.evaluate(() => Object.keys(window.localStorage).sort())
    // La ficha abierta alimenta el orden personal (otra función, ya existente); la medición no añade claves.
    expect(despues.filter((clave) => /evento|medicion|analit/i.test(clave))).toEqual([])
    expect(
      despues.filter((clave) => !antes.includes(clave)).every((c) => c.startsWith('zibata:')),
    ).toBe(true)
  })

  test('el idioma se cuenta al cambiarlo, en el idioma de destino', async ({ page }) => {
    const envios = await capturar(page)
    await openApp(page)
    await page
      .getByRole('link', { name: /English/ })
      .first()
      .click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await ocultarPestana(page)
    await expect.poll(() => todos(envios).length).toBeGreaterThan(0)
    expect(todos(envios)).toContainEqual({ tipo: 'idioma', destino: 'en' })
    expect(envios.at(-1)?.idioma).toBe('en')
  })
})
