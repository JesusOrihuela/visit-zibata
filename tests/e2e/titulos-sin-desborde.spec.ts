import { expect, type Page, test } from '@playwright/test'
import { longestPlaces, longestPlazas, openApp, panel, waitForSheet } from './helpers.ts'

/**
 * Los títulos usan una condensada (`--font-display`, docs/TIPOGRAFIA.md). Es más estrecha que la
 * familia del cuerpo, así que lo que podía fallar no era el ancho sino el alto: un título que se
 * parte en más líneas de las que cabe, o una firma que ya no entra en su caja. Esta prueba mide los
 * peores casos del dataset (los nombres más largos) en cada tamaño de pantalla de los proyectos.
 *
 * Se mide la caja de tinta del texto (el rango del contenido), no `scrollHeight`: el área de
 * contenido de una fuente es más alta que su interlineado y `scrollHeight` lo cuenta como desborde
 * aunque el texto no se corte en ningún sitio.
 */

/** Todo título visible cabe en sus contenedores y no empuja a la página fuera de la pantalla. */
async function sinDesborde(page: Page, donde: string) {
  await page.evaluate(() => document.fonts.ready)
  const problemas = await page.evaluate(() => {
    const salida: string[] = []
    const recorta = (valor: string) => /(hidden|clip)/.test(valor)
    const desplaza = (valor: string) => /(auto|scroll)/.test(valor)
    const titulos = document.querySelectorAll<HTMLElement>(
      '[data-panel] :is(h1, h2, h3), [role="dialog"] :is(h1, h2, h3), header :is(h1, h2, h3)',
    )
    for (const el of titulos) {
      const caja = el.getBoundingClientRect()
      if (caja.width === 0 || caja.height === 0) continue
      // Un panel apartado fuera de la pantalla (el de exploración mientras hay un diálogo abierto)
      // no se ve: no es un título que pueda desbordar. Uno a medio salir sí cuenta.
      if (caja.left >= window.innerWidth || caja.right <= 0) continue
      const rango = document.createRange()
      rango.selectNodeContents(el)
      const tinta = rango.getBoundingClientRect()
      const nombre = `"${(el.textContent ?? '').trim().slice(0, 40)}"`
      if (el.scrollWidth > el.clientWidth + 1) salida.push(`${nombre}: recortado a lo ancho`)
      if (caja.left < -1 || caja.right > window.innerWidth + 1) {
        salida.push(
          `${nombre}: sale de la pantalla (${Math.round(caja.left)}, ${Math.round(caja.right)})`,
        )
      }
      // Lo que recorta de verdad: cada contenedor con `overflow` por encima del título. A lo ancho se
      // comprueba en todos; a lo alto solo hasta el primer contenedor que se desplaza, porque más
      // allá el contenido se mueve con el scroll y no se recorta.
      let desplazado = false
      for (
        let padre = el.parentElement;
        padre && padre !== document.body;
        padre = padre.parentElement
      ) {
        const estilo = getComputedStyle(padre)
        const limite = padre.getBoundingClientRect()
        if (
          (recorta(estilo.overflowX) || desplaza(estilo.overflowX)) &&
          (tinta.right > limite.right + 1 || tinta.left < limite.left - 1)
        ) {
          salida.push(`${nombre}: sobresale de su contenedor a lo ancho`)
        }
        if (desplazado) continue
        if (
          recorta(estilo.overflowY) &&
          (tinta.top < limite.top - 1 || tinta.bottom > limite.bottom + 1)
        ) {
          salida.push(`${nombre}: recortado a lo alto por su contenedor`)
        }
        if (desplaza(estilo.overflowY)) {
          desplazado = true
          if (tinta.top < limite.top - 1) {
            salida.push(`${nombre}: cortado por arriba al empezar el scroll`)
          }
        }
      }
    }
    const ancho = document.documentElement.scrollWidth - window.innerWidth
    if (ancho > 0) salida.push(`la página desborda ${ancho} px a lo ancho`)
    return salida
  })
  expect(problemas, `desbordes en ${donde}`).toEqual([])
}

// `@mapa`: el grupo corto de CI (ci.yml). El de contenido ya es el que más tarda y estas pruebas abren la app.
test.describe('Títulos sin desborde @mapa', () => {
  for (const plaza of longestPlazas(4)) {
    test(`zona ${plaza.name}`, async ({ page }) => {
      await openApp(page, { path: `zona/${plaza.id}` })
      const titulo = panel(page).getByRole('heading', { level: 2, name: plaza.name })
      await expect(titulo).toBeVisible()
      await expect(titulo).toBeInViewport()
      await waitForSheet(page)
      await sinDesborde(page, `zona/${plaza.id}`)
    })
  }

  for (const lugar of longestPlaces(6)) {
    test(`ficha ${lugar.name}`, async ({ page }) => {
      await openApp(page, { path: `lugar/${lugar.id}` })
      const titulo = panel(page).getByRole('heading', { level: 2, name: lugar.name })
      await expect(titulo).toBeVisible()
      await expect(titulo).toBeInViewport()
      await waitForSheet(page)
      await sinDesborde(page, `lugar/${lugar.id}`)
    })
  }

  test('páginas de información', async ({ page }) => {
    // Abre dos páginas seguidas con el mapa dibujando por software detrás: en CI, con la máquina cargada, la
    // primera evaluación llegó a tardar 12 s y la segunda página 26 s, y las dos juntas rebasaban los 90 s.
    test.slow()
    await openApp(page, { path: 'info/acerca' })
    const titulo = page.getByRole('heading', { level: 2, name: 'Acerca de esta guía' })
    await expect(titulo).toBeVisible()
    await expect(titulo).toBeInViewport()
    await waitForSheet(page)
    await sinDesborde(page, 'info/acerca')

    await openApp(page, { path: 'info/privacidad' })
    await waitForSheet(page)
    await sinDesborde(page, 'info/privacidad')
  })

  test('el tutorial', async ({ page }) => {
    await openApp(page, { onboarding: true })
    await expect(page.getByRole('dialog')).toBeVisible()
    await sinDesborde(page, 'tutorial')
  })
})
