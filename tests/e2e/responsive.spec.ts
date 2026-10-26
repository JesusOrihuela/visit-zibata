import { expect, type Page, test } from '@playwright/test'
import { openApp, waitForMap } from './helpers.ts'

type Box = { x: number; y: number; width: number; height: number }
const overlaps = (a: Box | null, b: Box | null) =>
  Boolean(
    a &&
      b &&
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y,
  )

async function layout(page: Page) {
  const box = async (selector: string) => {
    const locator = page.locator(selector).first()
    return (await locator.count()) > 0 && (await locator.isVisible()) ? locator.boundingBox() : null
  }
  return {
    topbar: await box('header:has(input[type="search"])'),
    controls: await box('fieldset:has(legend)'),
    attribution: await box('.maplibregl-ctrl-attrib'),
    sheet: await box('section[data-panel]'),
    side: await box('aside[data-panel]'),
  }
}

// Tamaños pedidos para la versión 1.0 (más 320 px, el mínimo razonable), cada uno en el proyecto cuyo
// tipo de dispositivo le corresponde (puntero fino o táctil).
const SIZES: { width: number; height: number; project: string[] }[] = [
  { width: 1280, height: 720, project: ['desktop'] },
  { width: 1440, height: 900, project: ['desktop'] },
  { width: 1920, height: 1080, project: ['desktop'] },
  { width: 768, height: 1024, project: ['tablet'] },
  { width: 1024, height: 768, project: ['tablet'] },
  { width: 390, height: 844, project: ['mobile', 'webkit-iphone'] },
  { width: 430, height: 932, project: ['mobile', 'webkit-iphone'] },
  { width: 844, height: 390, project: ['mobile', 'webkit-iphone'] },
  { width: 320, height: 568, project: ['mobile'] },
]

for (const size of SIZES) {
  test.describe(`${size.width}×${size.height} @mapa`, () => {
    test.use({ viewport: { width: size.width, height: size.height } })

    test('sin desbordamiento horizontal ni solapes entre barra, controles, atribución y panel', async ({
      page,
    }, testInfo) => {
      test.skip(!size.project.includes(testInfo.project.name), 'Tamaño de otro tipo de dispositivo')
      for (const path of ['', 'zona/paseo-zibata']) {
        await openApp(page, { path })
        await waitForMap(page)
        await page.waitForTimeout(900)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        expect(overflow, `desbordamiento en ${path || 'inicio'}`).toBeLessThanOrEqual(0)
        const boxes = await layout(page)
        expect(boxes.attribution, 'la atribución de OpenStreetMap debe verse').not.toBeNull()
        const pairs = [
          ['topbar', 'controls'],
          ['topbar', 'attribution'],
          ['controls', 'attribution'],
          ['controls', 'sheet'],
          ['attribution', 'sheet'],
          ['topbar', 'side'],
          ['controls', 'side'],
        ] as const
        const found = pairs
          .filter(([a, b]) => overlaps(boxes[a], boxes[b]))
          .map(([a, b]) => `${a}×${b}`)
        expect(found, `solapes en ${path || 'inicio'}`).toEqual([])
      }
    })
  })
}
