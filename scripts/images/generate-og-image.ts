/**
 * npm run images:og -- --url http://localhost:5180/
 *
 * Genera public/og-image.png (1200×630) a partir del propio mapa: abre la app, oculta la interfaz,
 * superpone la marca y captura. Requiere el navegador de Playwright (npx playwright install
 * chromium).
 *
 * Tiene que correr contra `npm run dev`, no contra `npm run preview`: el build inyecta una CSP con
 * `style-src 'self'` y el navegador rechaza el addStyleTag de aquí abajo.
 */
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { ROOT } from '../data/lib/dataset.ts'

const { values } = parseArgs({
  options: { url: { type: 'string', default: 'http://localhost:5180/' } },
})

// El símbolo sale de public/logo.svg, igual que los iconos: una sola fuente para toda la marca.
const logo = readFileSync(`${ROOT}public/logo.svg`, 'utf8').trim()

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
try {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  })
  await context.addInitScript(() => window.localStorage.setItem('zibata:onboarding-visto', '1'))
  const page = await context.newPage()
  await page.goto(values.url)
  await page.waitForFunction(() => document.querySelectorAll('[data-mode]').length > 0, null, {
    timeout: 90_000,
  })
  await page.waitForTimeout(3000)

  await page.addStyleTag({
    content: `
      header, aside, footer, fieldset, .maplibregl-ctrl-bottom-left { display: none !important; }
      #og-card { position: fixed; inset: 0; z-index: 100; pointer-events: none;
        background: linear-gradient(90deg, rgb(248 244 237 / 0.97) 0%, rgb(248 244 237 / 0.9) 34%, rgb(248 244 237 / 0) 62%); }
      #og-card .inner { position: absolute; left: 64px; top: 50%; translate: 0 -50%; width: 440px; color: #1f2419; font-family: 'Special Gothic', sans-serif; }
      #og-card .eyebrow { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #536c2a; }
      #og-card h1 { margin: 18px 0 14px; font-family: 'Special Gothic', sans-serif; font-weight: 700; font-stretch: 75%; font-size: 76px; line-height: .95; text-wrap: balance; }
      #og-card p { margin: 0; font-size: 24px; line-height: 1.35; color: #454a3b; }
    `,
  })
  await page.evaluate((marca) => {
    const card = document.createElement('div')
    card.id = 'og-card'
    card.innerHTML = `<div class="inner">
      <div class="eyebrow">${marca}De zibateños para zibateños</div>
      <h1>Visit Zibatá</h1>
      <p>Explora el mapa 3D y descubre qué hay en cada plaza de Zibatá.</p>
    </div>`
    card.querySelector('svg')?.setAttribute('width', '46')
    card.querySelector('svg')?.setAttribute('height', '46')
    document.body.append(card)
  }, logo)
  await page.evaluate(() => document.fonts.ready)
  const shot = await page.screenshot({ type: 'png' })
  await sharp(shot)
    .png({ compressionLevel: 9, palette: false })
    .toFile(`${ROOT}public/og-image.png`)
  console.log('✓ public/og-image.png')
} finally {
  await browser.close()
}
