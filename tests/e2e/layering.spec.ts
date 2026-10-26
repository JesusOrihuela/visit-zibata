import { expect, test } from '@playwright/test'
import { isMobile, openApp, panel, waitForMap } from './helpers.ts'

test.describe('capas y alineación @mapa', () => {
  test('las etiquetas de las zonas quedan por debajo del panel lateral', async ({ page }) => {
    await openApp(page, { path: 'zona/paseo-zibata' })
    await waitForMap(page)
    test.skip(isMobile(page), 'El panel lateral es de escritorio; en móvil es la hoja inferior.')
    await expect(panel(page)).toBeVisible()
    // Se arrastra el mapa hacia el panel para que las etiquetas pasen por debajo de él.
    const side = await page.locator('aside[data-panel]').boundingBox()
    const y = (side?.y ?? 0) + (side?.height ?? 0) / 2
    await page.mouse.move(420, y)
    await page.mouse.down()
    await page.mouse.move(700, y, { steps: 12 })
    await page.mouse.move(820, y, { steps: 6 })
    await page.mouse.up()
    await page.waitForTimeout(900)

    const covered = await page.evaluate(() => {
      const side = document.querySelector('aside[data-panel]')?.getBoundingClientRect()
      if (!side) return { checked: 0, leaks: ['sin panel'] }
      const leaks: string[] = []
      let checked = 0
      for (const marker of document.querySelectorAll<HTMLElement>('button[data-mode]')) {
        const box = marker.getBoundingClientRect()
        const left = Math.max(box.left, side.left)
        const right = Math.min(box.right, side.right)
        const top = Math.max(box.top, side.top)
        const bottom = Math.min(box.bottom, side.bottom)
        if (right - left < 2 || bottom - top < 2) continue
        checked++
        const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2)
        if (!hit?.closest('aside[data-panel]')) leaks.push(marker.getAttribute('aria-label') ?? '?')
      }
      return { checked, leaks }
    })
    expect(covered.checked).toBeGreaterThan(0)
    expect(covered.leaks).toEqual([])
  })

  test('ninguna línea se pinta sobre una gota, en ningún nivel de zoom', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)

    /*
     * La regla: la gota manda sobre la línea. Un tallo cruzando la gota de otra plaza tapa justo el
     * objeto que señala, y pasaba de verdad (el tallo de Centro Zibatá sobre la gota de Xëni, a dos
     * niveles de zoom de la vista inicial).
     *
     * Se comprueba la regla y no el síntoma: en vez de buscar cruces, que dependen de dónde esté la
     * cámara, se mira que ningún tallo tenga un z-index que llegue al de ninguna gota. Si las bandas
     * de `PlazaMarkers` se tocan, esto falla aunque en esa vista no se solape nada.
     */
    const bandas = async () =>
      page.evaluate(() => {
        const tallos: number[] = []
        const gotas: number[] = []
        for (const marcador of document.querySelectorAll<HTMLElement>('.maplibregl-marker')) {
          const z = Number(marcador.style.zIndex) || 0
          const gota = marcador.querySelector('[class*="gota"]')
          const tallo = marcador.querySelector('[class*="stem"]')
          if (gota) gotas.push(z)
          else if (tallo) tallos.push(z)
        }
        return {
          mayorTallo: Math.max(...tallos, -1),
          menorGota: Math.min(...gotas, Infinity),
          tallos: tallos.length,
          gotas: gotas.length,
        }
      })

    const inicial = await bandas()
    expect(inicial.tallos).toBeGreaterThan(0)
    expect(inicial.gotas).toBeGreaterThan(0)
    expect(inicial.mayorTallo).toBeLessThan(inicial.menorGota)

    // Y se repite moviendo la cámara: el reparto por cercanía cambia con ella, las bandas no.
    // Se arrastra en vez de pulsar el botón de acercar porque en móvil ese botón no se dibuja.
    const caja = await page.locator('canvas').first().boundingBox()
    const centro = {
      x: (caja?.x ?? 0) + (caja?.width ?? 0) / 2,
      y: (caja?.y ?? 0) + (caja?.height ?? 0) / 2,
    }
    for (const desvio of [80, -140, 60]) {
      await page.mouse.move(centro.x, centro.y)
      await page.mouse.down()
      await page.mouse.move(centro.x + desvio, centro.y + desvio, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(700)
      const ahora = await bandas()
      expect(ahora.mayorTallo).toBeLessThan(ahora.menorGota)
    }
  })

  test('ningún marcador puede taparle el clic a los controles del mapa', async ({ page }) => {
    await openApp(page)
    await waitForMap(page)
    await expect(page.getByRole('button', { name: 'Volver a la vista de Zibatá' })).toBeVisible()

    /*
     * Los marcadores se ordenan entre sí con un z-index por cercanía que llega a ~11 000, y los
     * controles valen 10. Mientras la capa de marcadores no sea un contexto de apilamiento propio,
     * esos números compiten con los del resto de la interfaz y ganan: una gota caía sobre el botón
     * de acercar y se quedaba con el clic.
     *
     * Se comprueba metiendo en esa capa una pieza que pide el z-index más alto que puede pedir y
     * que cubre el mapa entero. Si la capa está aislada, no llega a ningún control. Con una pieza de
     * prueba y no arrastrando el mapa hasta que una gota real caiga encima, porque dónde cae depende
     * de la cámara, del zoom y del solucionador de colisiones: el mismo arrastre la deja en sitios
     * distintos en cada uno de los cuatro proyectos, y la prueba quedaría o frágil o vacía.
     */
    const tapados = await page.evaluate(() => {
      const capa = document.querySelector('.maplibregl-canvas-container')
      const controles = document.querySelector('fieldset')
      if (!capa || !controles) return ['sin capa de marcadores o sin controles']
      const intruso = document.createElement('div')
      intruso.style.cssText = 'position:absolute;inset:0;z-index:99999'
      capa.append(intruso)
      const perdidos: string[] = []
      for (const boton of controles.querySelectorAll<HTMLElement>('button')) {
        const caja = boton.getBoundingClientRect()
        if (caja.width === 0) continue
        const encima = document.elementFromPoint(
          caja.left + caja.width / 2,
          caja.top + caja.height / 2,
        )
        if (encima?.closest('button') !== boton)
          perdidos.push(boton.getAttribute('aria-label') ?? '?')
      }
      intruso.remove()
      return perdidos
    })
    expect(tapados).toEqual([])
  })

  test('en la cabecera de una zona, el enlace que baja a otra línea guarda el mismo espacio que el resto', async ({
    page,
  }) => {
    // Lo que se fija es el espacio vertical que calcula el navegador, no dónde cae el salto de línea (que
    // depende del ancho de cada pantalla): el renglón de la dirección separa sus líneas igual que la
    // cabecera separa sus bloques.
    await openApp(page, { path: 'zona/xentric-anahuac' })
    const region = panel(page)
    await expect(region.getByRole('link', { name: /Cómo llegar a la zona/ })).toBeVisible()
    const [entreBloques, entreLineas] = await region.evaluate((el) => {
      const cabecera = el.querySelector('[class*="_header_"]') as HTMLElement
      const direccion = el.querySelector('[class*="_address_"]') as HTMLElement
      return [getComputedStyle(cabecera).rowGap, getComputedStyle(direccion).rowGap]
    })
    expect(entreBloques).toBe('12px')
    expect(entreLineas).toBe(entreBloques)
  })

  test('las pastillas de categoría del panel arrancan alineadas con el resto del contenido', async ({
    page,
  }) => {
    await openApp(page, { path: 'zona/paseo-zibata' })
    await waitForMap(page)
    const region = panel(page)
    const heading = region.getByRole('heading', { level: 2 }).first()
    const firstChip = region.getByRole('list', { name: 'Categorías' }).getByRole('link').first()
    await expect(firstChip).toBeVisible()
    const [headingBox, chipBox] = [await heading.boundingBox(), await firstChip.boundingBox()]
    expect(Math.abs((chipBox?.x ?? 0) - (headingBox?.x ?? 99))).toBeLessThanOrEqual(1)
  })

  test('la flecha de desplazamiento aparece sobre el mapa y va centrada con las pastillas', async ({
    page,
  }) => {
    await openApp(page)
    await waitForMap(page)
    test.skip(isMobile(page), 'Las flechas son un atajo de ratón; con el dedo basta el gesto.')
    // La barra de filtros tiene que quedar acotada al ancho de la pantalla: si crece hasta su ancho
    // de contenido, el carril nunca desborda por dentro y la flecha no llega a aparecer.
    const rail = page.locator('[data-variant="floating"]')
    const arrow = rail.locator('[data-side="end"]')
    await expect(arrow).toBeVisible()
    const [arrowBox, chipBox] = [
      await arrow.boundingBox(),
      await rail.getByRole('link').first().boundingBox(),
    ]
    const centro = (box: { y: number; height: number } | null) =>
      (box?.y ?? 0) + (box?.height ?? 0) / 2
    expect(Math.abs(centro(arrowBox) - centro(chipBox))).toBeLessThanOrEqual(1)
    expect(Math.abs((arrowBox?.height ?? 0) - (chipBox?.height ?? 99))).toBeLessThanOrEqual(1)
  })

  test('las zonas en obra llevan insignia de obra y el texto "Próximamente" para lectores', async ({
    page,
  }) => {
    await openApp(page)
    await waitForMap(page)
    const soon = page.locator('.maplibregl-marker p:has(svg.lucide-construction)')
    await expect(soon.first()).toBeAttached()
    for (const label of await soon.all()) {
      await expect(label).toContainText('Próximamente')
      // "Próximamente" no se ve: lo dice la insignia redonda. En la vista general tampoco el nombre,
      // para que dos obras vecinas no se pisen ni tapen las cifras de las zonas abiertas.
      await expect(label.locator('span:has(svg) .visually-hidden')).toHaveText('Próximamente')
      await expect(label).toHaveAttribute('data-compact', 'true')
    }
    expect(await soon.count()).toBeGreaterThanOrEqual(2)
  })
})
