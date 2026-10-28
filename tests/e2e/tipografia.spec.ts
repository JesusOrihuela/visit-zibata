import { expect, test } from '@playwright/test'
import { openApp, waitForMap } from './helpers.ts'

/**
 * El contrato tipográfico, fijado para que no vuelva a divergir:
 *
 *  - **Subtítulos:** un subtítulo de sección mide lo mismo y pesa lo mismo en una zona, en una página
 *    de información y en el perfil (`docs/TIPOGRAFIA.md`, "subtítulo de grupo").
 *  - **Títulos:** Special Gothic 700 al 75 % de ancho y sin tracking, en los tres escalones (34, 28 y
 *    24 px), sea cual sea la pantalla, y con la fuente de verdad cargada: si no cargara, el título
 *    caería a una sans del sistema y la medida de la guía dejaría de valer.
 *  - **El ancho se aplica de verdad:** `getComputedStyle` dice 75 % aunque la regla `@font-face` no
 *    declare el rango de ancho y el navegador pinte el título a ancho completo. Por eso se mide el
 *    mismo texto a 75 % y a 100 % y se exige una diferencia real.
 */
test.describe('Subtítulos', () => {
  test('el mismo nivel en zonas, información y perfil', async ({ page }) => {
    const estilos: Record<string, unknown>[] = []

    const medir = async (heading: ReturnType<typeof page.getByRole>) => {
      await expect(heading).toBeVisible()
      estilos.push(
        await heading.evaluate((el) => {
          const s = getComputedStyle(el)
          return {
            size: s.fontSize,
            weight: s.fontWeight,
            lineHeight: s.lineHeight,
            color: s.color,
            transform: s.textTransform,
          }
        }),
      )
    }

    await openApp(page, { path: 'zona/xentric-zibata' })
    await medir(page.getByRole('heading', { level: 3, name: 'Lugares en esta zona' }))

    await openApp(page, { path: 'info/acerca' })
    await medir(page.getByRole('heading', { level: 3, name: 'Datos y créditos' }))

    await openApp(page, { path: 'info/privacidad' })
    await medir(page.getByRole('heading', { level: 3, name: 'Términos de uso' }))

    // El perfil solo enseña sus bloques cuando hay algo guardado.
    await page.addInitScript(() =>
      window.localStorage.setItem('zibata:favoritos', JSON.stringify(['tomassa'])),
    )
    await openApp(page)
    await page.getByRole('button', { name: 'Tu Zibatá' }).click()
    await medir(page.getByRole('heading', { level: 3, name: 'Tu paso por Zibatá' }))

    const [primero] = estilos
    for (const estilo of estilos) expect(estilo).toEqual(primero)
    expect(primero).toMatchObject({ size: '17px', weight: '520', transform: 'none' })
  })
})

test.describe('Etiquetas del mapa', () => {
  test('las etiquetas de zona usan la fuente de la guía y no la del contenedor del mapa', async ({
    page,
  }) => {
    await openApp(page)
    await waitForMap(page)
    // MapLibre le pone `font: 12px "Helvetica Neue"` a todo su contenedor y los marcadores HTML viven dentro.
    const familias = await page.evaluate(async () => {
      await document.fonts.ready
      const salida: string[] = []
      for (const marcador of document.querySelectorAll('button[data-mode]')) {
        if ((marcador as HTMLElement).dataset.mode === 'hidden') continue
        for (const el of marcador.querySelectorAll('*')) {
          const tieneTexto = [...el.childNodes].some(
            (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
          )
          if (tieneTexto) salida.push(getComputedStyle(el).fontFamily)
        }
      }
      return salida
    })
    expect(familias.length).toBeGreaterThan(0)
    for (const familia of familias) expect(familia).toContain('Special Gothic')
  })
})

test.describe('Rótulos de formulario', () => {
  test('el rótulo de un campo es un subtítulo y no queda por debajo del cuerpo', async ({
    page,
  }) => {
    await openApp(page, { path: 'info/sugerir' })
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible()
    const medir = (locator: ReturnType<typeof page.locator>) =>
      locator.evaluate((el) => {
        const s = getComputedStyle(el)
        return { size: Number.parseFloat(s.fontSize), weight: s.fontWeight }
      })
    const cuerpo = await medir(dialogo.locator('p').first())
    for (const nombre of ['¿Quién escribe?', 'Tu mensaje']) {
      const rotulo = await medir(dialogo.getByText(nombre, { exact: true }))
      expect(rotulo, nombre).toMatchObject({ size: 17, weight: '520' })
      expect(rotulo.size, nombre).toBeGreaterThan(cuerpo.size)
    }
  })
})

test.describe('Títulos', () => {
  test('los tres escalones comparten familia, peso y tracking', async ({ page }) => {
    const medir = async (heading: ReturnType<typeof page.getByRole>) => {
      await expect(heading).toBeVisible()
      const estilo = await heading.evaluate(async (el) => {
        const s = getComputedStyle(el)
        await document.fonts.ready
        return {
          size: Number.parseFloat(s.fontSize),
          weight: s.fontWeight,
          stretch: s.fontStretch,
          family: s.fontFamily,
          // `letter-spacing: normal` se resuelve a "normal", que no es un número.
          tracking: s.letterSpacing === 'normal' ? 0 : Number.parseFloat(s.letterSpacing),
          lineHeight: Number.parseFloat(s.lineHeight) / Number.parseFloat(s.fontSize),
          cargada: document.fonts.check(`${s.fontWeight} ${s.fontSize} "Special Gothic"`),
        }
      })
      expect(estilo.family).toContain('Special Gothic')
      expect(estilo.cargada, 'la fuente de los títulos debe estar cargada').toBe(true)
      expect(estilo.weight).toBe('700')
      expect(estilo.stretch).toBe('80%')
      expect(estilo.tracking).toBe(0)
      expect([34, 28, 24]).toContain(estilo.size)
      return estilo
    }

    await openApp(page, { path: 'zona/xentric-zibata' })
    const zona = await medir(page.getByRole('heading', { level: 2, name: 'Xentric Zibatá' }))

    await openApp(page, { path: 'lugar/al-grano' })
    const ficha = await medir(
      page.getByRole('heading', { level: 2, name: 'Al Grano Maíz & Snacks' }),
    )

    await openApp(page, { path: 'info/acerca' })
    const info = await medir(page.getByRole('heading', { level: 2, name: 'Acerca de esta guía' }))

    await page.addInitScript(() =>
      window.localStorage.setItem('zibata:favoritos', JSON.stringify(['tomassa'])),
    )
    await openApp(page)
    await page.getByRole('button', { name: 'Tu Zibatá' }).click()
    const perfil = await medir(page.getByRole('heading', { level: 2, name: 'Tu Zibatá' }))

    // El escalón lo decide la pantalla; el interlineado, el escalón.
    expect([zona.size, ficha.size, info.size, perfil.size]).toEqual([34, 28, 28, 28])
    expect(zona.lineHeight).toBeCloseTo(1, 2)
    for (const estilo of [ficha, info, perfil]) expect(estilo.lineHeight).toBeCloseTo(1.05, 2)
  })

  test('el eje de ancho se aplica de verdad: el mismo texto mide menos al 80 % que al 100 %', async ({
    page,
  }) => {
    await openApp(page, { path: 'zona/xentric-zibata' })
    await expect(page.getByRole('heading', { level: 2, name: 'Xentric Zibatá' })).toBeVisible()
    const anchos = await page.evaluate(async () => {
      await document.fonts.ready
      const medir = (ancho: string) => {
        const span = document.createElement('span')
        span.textContent = 'Wake Cup Panadería y Cafetería'
        span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-family:var(--font-display);font-weight:700;font-size:28px;font-stretch:${ancho}`
        document.body.append(span)
        const { width } = span.getBoundingClientRect()
        span.remove()
        return width
      }
      return { condensado: medir('80%'), normal: medir('100%') }
    })
    // El eje de ancho de Special Gothic recorta el texto mucho más de un 5 %.
    expect(anchos.condensado / anchos.normal).toBeLessThan(0.95)
  })
})
