import { expect, test } from '@playwright/test'
import { openApp } from './helpers.ts'

/**
 * El contrato tipográfico, fijado para que no vuelva a divergir:
 *
 *  - **Subtítulos:** un subtítulo de sección mide lo mismo y pesa lo mismo en una zona, en una página
 *    de información y en el perfil (`docs/TIPOGRAFIA.md`, "subtítulo de grupo").
 *  - **Títulos:** 700 y `letter-spacing: -0.02em` en los tres escalones (30, 24 y 22 px), sea cual sea
 *    la pantalla.
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
    expect(primero).toMatchObject({ size: '17px', weight: '600', transform: 'none' })
  })
})

test.describe('Títulos', () => {
  test('los tres escalones comparten peso y tracking', async ({ page }) => {
    const medir = async (heading: ReturnType<typeof page.getByRole>) => {
      await expect(heading).toBeVisible()
      const estilo = await heading.evaluate((el) => {
        const s = getComputedStyle(el)
        return {
          size: Number.parseFloat(s.fontSize),
          weight: s.fontWeight,
          tracking: Number.parseFloat(s.letterSpacing),
          lineHeight: Number.parseFloat(s.lineHeight) / Number.parseFloat(s.fontSize),
        }
      })
      expect(estilo.weight).toBe('700')
      // -0.02em, sin importar el escalón.
      expect(estilo.tracking / estilo.size).toBeCloseTo(-0.02, 3)
      expect([30, 24, 22]).toContain(estilo.size)
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
    expect([zona.size, ficha.size, info.size, perfil.size]).toEqual([30, 24, 24, 24])
    expect(zona.lineHeight).toBeCloseTo(1, 2)
    for (const estilo of [ficha, info, perfil]) expect(estilo.lineHeight).toBeCloseTo(1.05, 2)
  })
})
