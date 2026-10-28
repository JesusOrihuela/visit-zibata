/**
 * El catálogo de interactuables, fijado contra la guía de verdad.
 *
 * Las reglas de docs/CATALOGO.md se pueden deshacer sin que nada se queje: basta un
 * `border-radius` escrito a mano en un módulo, o un botón donde tocaba un enlace. Estas pruebas
 * miran lo que el navegador calcula, no lo que el CSS dice, así que también atrapan el caso que
 * costó encontrar: una regla compartida ganándole a la del módulo por el orden del paquete.
 */
import { expect, test } from '@playwright/test'
import { isMobile, openApp, waitForMap, waitForSheet } from './helpers.ts'

/** Las cinco formas que el catálogo permite en lo que se pulsa, más las dos que no son un radio. */
const FORMAS_PERMITIDAS = new Set([
  '999px', // cápsula: elegir de un conjunto
  '6px', // control: ejecutar y escribir
  '50%', // redondo: perilla, identidad y atajos de ratón
  '0px', // sin caja: navegar, y lo que recorta su contenedor
])

/** Lo que mide un control, en píxeles. Nada que se pulse puede quedar por debajo de los 24 de WCAG. */
const ALTOS_PERMITIDOS = new Set([24, 32, 36, 40])

test.describe('catálogo de interactuables', () => {
  test('todo lo que se pulsa lleva una de las cinco formas del catálogo', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)

    const sueltos = await page.evaluate(
      (permitidas) => {
        const fuera: { pieza: string; radio: string }[] = []
        for (const el of document.querySelectorAll('button, a[href], input, select, textarea')) {
          // El panel de depuración solo existe en desarrollo y queda fuera del catálogo.
          if (el.closest('[class*="debug"]')) continue
          const c = getComputedStyle(el)
          const esquinas = [
            c.borderTopLeftRadius,
            c.borderTopRightRadius,
            c.borderBottomRightRadius,
            c.borderBottomLeftRadius,
          ]
          // Una silueta (la gota, el banderín) no es un radio: se recorta, y eso se mira aparte.
          if (c.clipPath !== 'none') continue
          for (const esquina of new Set(esquinas)) {
            if (!permitidas.includes(esquina)) {
              fuera.push({ pieza: el.className || el.tagName.toLowerCase(), radio: esquina })
            }
          }
        }
        return fuera
      },
      [...FORMAS_PERMITIDAS],
    )

    expect(sueltos, 'piezas con una esquina que no está en el catálogo').toEqual([])
  })

  test('ningún control queda por debajo del objetivo mínimo de WCAG', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)

    const pequenos = await page.evaluate(
      (permitidos) => {
        const fuera: { pieza: string; alto: number }[] = []
        for (const el of document.querySelectorAll('button, [role="switch"], select')) {
          if (el.closest('[class*="debug"]')) continue
          // Los marcadores del mapa tienen vocabulario propio: no son controles de la interfaz.
          if (el.className.includes('_marker_')) continue
          // El avatar mide lo que la barra superior, a propósito, y eso se mira en su propia prueba.
          if (el.className.includes('_avatar_')) continue
          const caja = el.getBoundingClientRect()
          // Lo que no se ve no se puede pulsar, y el velo de los diálogos ocupa la pantalla entera.
          if (caja.height === 0 || caja.height > 64) continue
          if (!permitidos.includes(Math.round(caja.height))) {
            fuera.push({
              pieza: el.className || el.tagName.toLowerCase(),
              alto: Math.round(caja.height),
            })
          }
        }
        return fuera
      },
      [...ALTOS_PERMITIDOS],
    )

    expect(pequenos, 'controles con un alto que no es del catálogo').toEqual([])
  })

  test('el avatar mide lo que la barra que lo contiene', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)

    /*
     * La única pieza con un alto propio, y es deliberado: la barra superior calcula su alto una
     * sola vez (el alto de control más el aire de la tarjeta) y el círculo del perfil lo hereda, de
     * forma que los dos miden lo mismo en cualquier pantalla. Si alguna vez dejan de coincidir, la
     * fila se ve torcida sin que se sepa por qué.
     */
    const avatar = page.getByRole('button', { name: /Tu Zibatá/ })
    const tarjeta = page.locator('[class*="_searchCard_"]')
    const a = await avatar.boundingBox()
    const t = await tarjeta.boundingBox()
    expect(Math.round(a?.height ?? 0)).toBe(Math.round(t?.height ?? -1))
  })

  test('todo control lleva la letra de su papel, no la de lo que lo rodea', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)

    /*
     * La tipografía de control vive dentro de cada familia, no en `.base`, y esta prueba es la que
     * lo sostiene. Vivió en `.base`, y un módulo que compusiera `boton principal` sin componer
     * también `base` heredaba la letra del texto que lo rodeaba: "Cómo llegar" salía a 15 px y peso
     * 400 en vez de 13 y 600. Se veía a simple vista y no lo cazó ninguna puerta, porque ninguna
     * miraba la letra.
     */
    const sueltos = await page.evaluate(() => {
      const fuera: { pieza: string; letra: number; peso: string }[] = []
      /*
       * Solo las familias que cargan tipografía. Quedan fuera `zonaPulsable` (la tarjeta de un
       * lugar, el renglón del índice: son composiciones, y cada trozo de dentro lleva su papel) y
       * `enlace` (un enlace de texto hereda el cuerpo del párrafo donde vive, que es lo correcto).
       */
      const familias = ['_pildora_', '_boton_', '_botonIcono_', '_dia_', '_campo_']
      for (const el of document.querySelectorAll('button, a[href], select, input, textarea')) {
        if (el.closest('[class*="debug"]')) continue
        const clases = String(el.className)
        if (!familias.some((f) => clases.includes(f))) continue
        const c = getComputedStyle(el)
        const letra = Math.round(Number.parseFloat(c.fontSize))
        const esCampo = clases.includes('_campo_')
        const bien = esCampo ? letra === 16 : letra === 13 && c.fontWeight === '520'
        if (!bien) fuera.push({ pieza: clases, letra, peso: c.fontWeight })
      }
      return fuera
    })

    expect(sueltos, 'controles con una letra que no es la de su papel').toEqual([])
  })

  test('los dos estados del interruptor se distinguen entre sí', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)

    const interruptor = page.getByRole('switch').first()
    await expect(interruptor).toBeVisible()
    const via = interruptor.locator('> *').first()

    /*
     * WCAG 1.4.11 pide que los estados de un control se distingan, y aquí el que los lleva es la
     * **vía**: pasa de arena apagada a olivo. La perilla refuerza con su posición y con el color de
     * su icono, pero no carga el contraste.
     *
     * Esta prueba midió antes la perilla contra la vía, y era medir lo que no tocaba: obligaba a
     * una vía oscura o a un filete en la perilla, y las dos cosas hacían que el estado de reposo se
     * viera más fuerte que el de puesto, que es lo contrario de lo que debe pasar.
     *
     * El color se lee con `expect.poll` y no tras una espera fija: la vía cambia con una transición
     * y, además, React reemplaza el nodo al cambiar de estado. Una referencia tomada antes del clic
     * se queda apuntando a un nodo desconectado que nunca cambia de color, que es como esta misma
     * prueba llegó a dar un contraste de 1 estando todo bien.
     */
    const lum = (c: string) => {
      const [r = 0, g = 0, b = 0] = (c.match(/\d+/g) ?? []).slice(0, 3).map(Number)
      const canal = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
    }
    const color = async () => via.evaluate((e) => getComputedStyle(e).backgroundColor)
    const apagado = lum(await color())

    await interruptor.click()
    await expect(interruptor).toHaveAttribute('aria-checked', 'true')

    /*
     * Se espera al contraste y no a "que el color cambie": la vía va con transición, y preguntar
     * por el primer color distinto devuelve un tono a medio camino. Así la espera y la aserción son
     * la misma cosa.
     */
    await expect
      .poll(
        async () => {
          const puesto = lum(await color())
          return (Math.max(apagado, puesto) + 0.05) / (Math.min(apagado, puesto) + 0.05)
        },
        { timeout: 5000 },
      )
      .toBeGreaterThanOrEqual(3)
  })

  test('lo que tiene dirección propia es un enlace, no un botón', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)
    await waitForSheet(page)

    /*
     * Cinco piezas eran botones teniendo ruta, y mientras lo fueron no se podían abrir en otra
     * pestaña, ni copiar, ni encontrar desde fuera. Aquí se comprueban las dos que se alcanzan
     * desde la portada en cualquier tamaño.
     *
     * En móvil la hoja llega asomada y el índice no está pintado: se abre como lo abriría
     * cualquiera, con el botón que lo dice.
     */
    const abrir = page.getByRole('button', {
      name: isMobile(page) ? 'Ver las zonas' : 'Explora Zibatá',
    })
    if (await abrir.isVisible()) {
      await abrir.click()
      await waitForSheet(page)
    }

    const renglon = page.getByRole('link', { name: /Paseo Zibatá, \d+ lugares/ })
    await expect(renglon).toHaveAttribute('href', /\/zona\/paseo-zibata$/)

    /*
     * Y las páginas de información. Van en el pie de Tu Zibatá, que existe en los dos tamaños; la
     * franja de la guía lleva las mismas pero solo se dibuja en escritorio.
     */
    await page.getByRole('button', { name: /Tu Zibatá/ }).click()
    const acerca = page.getByRole('link', { name: 'Acerca' }).first()
    await expect(acerca).toHaveAttribute('href', /\/info\/acerca$/)
  })

  test('una superficie apoyada en la esquina de otra resta su relleno', async ({ page }) => {
    await openApp(page, { path: 'info/tutorial' })

    /*
     * La concentricidad de Apple, y lo que Material pide en el fondo: dos curvas concéntricas con
     * el mismo radio se ven mal, y es de lo poco que el ojo detecta sin saber por qué. El radio de
     * dentro es el de fuera menos el relleno.
     *
     * Solo aplica donde **se ve**, que es cuando la superficie de dentro se apoya en una esquina de
     * la de fuera. Una tarjeta a mitad de una lista que se desplaza no toca ninguna esquina, así
     * que ahí manda el tamaño y no la resta. Y no aplica a los controles: su forma la decide el
     * tipo de acción, que es una regla más fuerte que esta.
     */
    const fuera = await page.evaluate(() => {
      const radio = (e: Element) =>
        Math.round(Number.parseFloat(getComputedStyle(e).borderTopLeftRadius))
      const esSuperficie = (el: Element) => {
        const c = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        const opaca =
          c.backgroundColor !== 'rgba(0, 0, 0, 0)' && !/\/\s*0\)/.test(c.backgroundColor)
        // Menos de 60 deja fuera los círculos de identidad, que no entran en la regla del tamaño.
        return opaca && radio(el) > 3 && radio(el) < 60 && r.width > 60 && r.height > 24
      }
      const esControl = (el: Element) =>
        el.matches('button, a[href], input, select, textarea') ||
        el.closest('button, a[href]') !== null

      const malas: string[] = []
      for (const el of document.querySelectorAll('*')) {
        if (!esSuperficie(el) || esControl(el)) continue
        let p = el.parentElement
        let padre: Element | null = null
        while (p && p !== document.body) {
          if (esSuperficie(p) && !esControl(p)) {
            padre = p
            break
          }
          p = p.parentElement
        }
        if (!padre) continue

        const rp = padre.getBoundingClientRect()
        const re = el.getBoundingClientRect()
        const lateral = Math.min(re.left - rp.left, rp.right - re.right)
        const vertical = Math.min(re.top - rp.top, rp.bottom - re.bottom)
        // Solo las que se apoyan en una esquina: dentro de los dos lados y cerca de arriba o abajo.
        if (!(lateral >= 0 && vertical >= 0 && vertical <= radio(padre) + 8)) continue

        const ideal = Math.max(0, radio(padre) - Math.round(lateral))
        if (radio(el) !== ideal) {
          malas.push(`${el.className}: ${radio(el)} donde tocaba ${ideal}`)
        }
      }
      return malas
    })

    expect(fuera, 'superficies anidadas que no restan su relleno').toEqual([])
  })

  test('nada de lo que flota sobre el mapa es transparente', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)

    const transparentes = await page.evaluate(() => {
      const fuera: string[] = []
      // Las cápsulas de categoría, el selector de zona y los controles del mapa.
      const sobreMapa = document.querySelectorAll(
        '[class*="_chip_"], [class*="_zone_"], [class*="_stack_"], [class*="_arrow_"]',
      )
      for (const el of sobreMapa) {
        const fondo = getComputedStyle(el).backgroundColor
        const alfa = Number(fondo.match(/[\d.]+\)$/)?.[0].slice(0, -1) ?? '1')
        if (fondo === 'rgba(0, 0, 0, 0)' || alfa < 1) fuera.push(`${el.className}: ${fondo}`)
      }
      return fuera
    })

    expect(transparentes, 'superficies translúcidas encima del mapa').toEqual([])
  })
})
