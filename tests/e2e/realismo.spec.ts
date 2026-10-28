import { expect, type Page, test } from '@playwright/test'
import { openApp, waitForMap } from './helpers.ts'

/**
 * El mapa es el realista, pero se apaga con renderizado por software, y Playwright dibuja con SwiftShader
 * (sin GPU). Para probar el realismo, la página cree que hay una GPU de verdad: el nombre del renderizador
 * es lo único que se cambia, el dibujo sigue siendo en software.
 */
async function conGpu(page: Page): Promise<void> {
  await page.addInitScript(() => {
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const original = proto.getParameter
      proto.getParameter = function (this: WebGLRenderingContext, parametro: number) {
        // 0x9246 es UNMASKED_RENDERER_WEBGL
        return parametro === 0x9246
          ? 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)'
          : original.call(this, parametro)
      }
    }
  })
}

async function abrirConRealismo(page: Page, path = ''): Promise<void> {
  await conGpu(page)
  await openApp(page, { path })
}

function peticionesDeRealismo(page: Page): string[] {
  const pedidas: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/map/realismo/')) pedidas.push(request.url())
  })
  return pedidas
}

test.describe('Realismo del mapa @mapa', () => {
  test('con renderizado por software queda apagado: ni se pide ni se monta nada', async ({
    page,
  }, testInfo) => {
    // WebKit se presenta como "Apple GPU" aunque dibuje en software: no se puede detectar ahí.
    test.skip(testInfo.project.name === 'webkit-iphone', 'WebKit no revela el renderizador')
    // Playwright dibuja con SwiftShader: ahí el 3D propio deja el mapa inservible, y por eso se apaga solo.
    const pedidas = peticionesDeRealismo(page)
    await openApp(page)
    await waitForMap(page)
    await page.waitForTimeout(1500)
    expect(pedidas).toEqual([])
    await expect(page.locator('[data-realismo]')).toHaveCount(0)
  })

  test('con Save-Data queda apagado aunque haya GPU', async ({ page }) => {
    await conGpu(page)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true },
        configurable: true,
      })
    })
    const pedidas = peticionesDeRealismo(page)
    await openApp(page)
    await waitForMap(page)
    await page.waitForTimeout(1500)
    expect(pedidas).toEqual([])
    await expect(page.locator('[data-realismo]')).toHaveCount(0)
  })

  test('con GPU carga suelo, contexto, calles y relieve del mismo origen, con sus créditos', async ({
    page,
    baseURL,
  }) => {
    const origen = new URL(baseURL ?? 'http://localhost').origin
    const violaciones: string[] = []
    const externas: string[] = []
    const fallidas: string[] = []
    const pedidas = new Set<string>()
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`CSP-VIOLATION ${event.violatedDirective} ${event.blockedURI}`)
      })
    })
    page.on('console', (message) => {
      if (/CSP-VIOLATION|Content Security Policy/i.test(message.text())) {
        violaciones.push(message.text())
      }
    })
    page.on('request', (request) => {
      const url = request.url()
      if (/^https?:/.test(url) && !url.startsWith(origen)) externas.push(url)
    })
    page.on('response', (response) => {
      const url = response.url()
      if (!url.includes('/map/realismo/')) return
      pedidas.add(url.split('/map/realismo/')[1] ?? '')
      if (response.status() >= 400) fallidas.push(`${response.status()} ${url}`)
    })

    await abrirConRealismo(page)
    await waitForMap(page)
    // Tiempo para que el mapa pida las imágenes y las teselas de relieve de la vista.
    await page.waitForTimeout(3000)

    expect(violaciones).toEqual([])
    expect(externas).toEqual([])
    expect(fallidas).toEqual([])
    const nombres = [...pedidas]
    expect(nombres).toEqual(expect.arrayContaining(['suelo.webp', 'contexto.webp', 'vias.geojson']))
    expect(nombres.some((nombre) => /^relieve\/12\/\d+\/\d+\.webp$/.test(nombre))).toBe(true)

    const atribucion = await page.locator('.maplibregl-ctrl-attrib').textContent()
    expect(atribucion).toContain('OpenStreetMap')
    expect(atribucion).toContain('Copernicus DEM GLO-30')
    expect(atribucion).toContain('Contains modified Copernicus Sentinel data')
    expect(atribucion).toContain('Open Buildings')
  })

  test('con GPU las capas propias de edificios y árboles llegan a "completo"', async ({ page }) => {
    await abrirConRealismo(page)
    await waitForMap(page)
    // El estado se calcula de lo que está visible: si el sombreador no compilara o la capa fallara al
    // dibujar, quedaría en "degradado" o "respaldo". Las sombras en vivo dependen de un campo interno
    // de MapLibre que no cambia el estado si falta, y por eso tienen su propio atributo: si una subida
    // de MapLibre lo quita, esta prueba falla aquí.
    const mapa = page.locator('[data-realismo]')
    await expect(mapa).toHaveAttribute('data-realismo', 'completo', { timeout: 60_000 })
    await expect(mapa).toHaveAttribute('data-realismo-sombras', 'si')
  })

  test('si falla la descarga de los edificios el mapa sigue y queda degradado', async ({
    page,
  }) => {
    await page.route('**/map/realismo/edificios.bin', (route) => route.abort())
    await abrirConRealismo(page)
    await waitForMap(page)
    await expect(page.locator('[data-realismo]')).toHaveAttribute('data-realismo', 'degradado', {
      timeout: 60_000,
    })
    // Sigue habiendo mapa: los marcadores de plazas están y no se bloquea nada.
    await expect(page.locator('button[data-mode]').first()).toBeVisible()
  })

  test('si fallan las dos mallas el mapa vuelve al de siempre', async ({ page }) => {
    await page.route('**/map/realismo/{edificios,arboles}.bin', (route) => route.abort())
    await abrirConRealismo(page)
    await waitForMap(page)
    await expect(page.locator('[data-realismo]')).toHaveAttribute('data-realismo', 'respaldo', {
      timeout: 60_000,
    })
    await expect(page.locator('button[data-mode]').first()).toBeVisible()
  })

  test('la cámara fija el alejamiento máximo y arranca en calidad 3', async ({ page }) => {
    await abrirConRealismo(page)
    await waitForMap(page)
    const mapa = page.locator('[data-realismo]')
    await expect(mapa).toHaveAttribute('data-realismo', 'completo', { timeout: 60_000 })
    await expect(mapa).toHaveAttribute('data-realismo-nivel', '3')
    // El límite sale de que Zibatá quepa en el espacio libre: un zoom razonable, no el de siempre (12,6) ni uno absurdo.
    await expect
      .poll(async () => Number(await mapa.getAttribute('data-realismo-zoom-min')), {
        timeout: 30_000,
      })
      .toBeGreaterThan(9)
    const zoomMin = Number(await mapa.getAttribute('data-realismo-zoom-min'))
    expect(zoomMin).toBeLessThan(16)
  })

  test('la medición en el dispositivo (?medir=corto) recorre las tres vistas en los tres niveles', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'es una herramienta; basta probarla una vez')
    test.setTimeout(300_000)
    // Medir exige el realismo aunque el renderizado sea por software: es justo lo que se quiere medir.
    await openApp(page, { path: '?medir=corto' })
    const resultado = page.getByLabel('Resultado de la medición')
    await expect(resultado).toBeVisible({ timeout: 240_000 })
    const filas = (await resultado.inputValue())
      .split('\n')
      .filter((linea) => /^[123] \| /.test(linea))
    expect(filas).toHaveLength(9)
    const vistas = ['Panorámica', 'Barrio', 'Casas']
    expect(filas.map((fila) => fila.split(' | ')[1])).toEqual([...vistas, ...vistas, ...vistas])
    // Al terminar suelta el gobernador y deja un nivel válido. No se exige el 3: con la máquina cargada
    // el gobernador puede bajarlo con toda razón en cuanto queda libre.
    await expect(page.locator('[data-realismo]')).toHaveAttribute('data-realismo-nivel', /^[123]$/)
  })

  test('si se pierde el contexto WebGL el mapa vuelve al de siempre', async ({ page }) => {
    await abrirConRealismo(page)
    await waitForMap(page)
    const mapa = page.locator('[data-realismo]')
    await expect(mapa).toHaveAttribute('data-realismo', 'completo', { timeout: 60_000 })
    // Pedir el mismo tipo de contexto devuelve el que ya usa el mapa. Al perderlo MapLibre destruye el
    // estilo, y al recuperarlo lo monta sin las capas propias y con las nativas ocultas.
    await page.evaluate(async () => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.maplibregl-canvas')
      const lose = canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')
      lose?.loseContext()
      await new Promise((resolve) => setTimeout(resolve, 500))
      lose?.restoreContext()
    })
    await expect(mapa).toHaveAttribute('data-realismo', 'respaldo', { timeout: 60_000 })
    await expect(page.locator('button[data-mode]').first()).toBeVisible()
  })
})
