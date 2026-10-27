/**
 * npm run images:og -- --url http://localhost:5180/
 *
 * Genera public/og-image.png (1200×630) a partir del propio mapa: abre la app, lo encuadra, oculta
 * la interfaz, superpone la marca y captura. Requiere el navegador de Playwright (npx playwright
 * install chromium).
 *
 * Es la única imagen social de todo el sitio y de los dos idiomas (ver prerender.ts), así que lo
 * único escrito en ella es el nombre de la marca, el dominio y el lema en los dos idiomas: nada que
 * haya que traducir. Es una pieza de marca, no una captura técnica: el mapa ocupa todo el cuadro y no se
 * nombra la tecnología.
 *
 * Lo que muestra el mapa es lo que tenga la app en ese momento: hay que volver a generarla cuando
 * el mapa cambie.
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

/** Encuadre del mapa: las plazas del centro de Zibatá a la derecha, con el margen izquierdo libre para la marca. */
const CAMARA = {
  center: [-100.3225, 20.6805] as [number, number],
  zoom: 15.1,
  pitch: 42,
  bearing: -10,
  padding: { left: 440, top: 0, right: 0, bottom: 0 },
}
/** Se captura al doble y se reduce: el texto y los trazos finos del mapa salen más nítidos. */
const ESCALA = 2

// El símbolo sale de public/logo.svg, igual que los iconos: una sola fuente para toda la marca.
const logo = readFileSync(`${ROOT}public/logo.svg`, 'utf8').trim()

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
try {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: ESCALA,
  })
  await context.addInitScript(() => window.localStorage.setItem('zibata:onboarding-visto', '1'))
  const page = await context.newPage()
  await page.goto(values.url)
  await page.waitForFunction(() => document.querySelectorAll('[data-mode]').length > 0, null, {
    timeout: 90_000,
  })
  await page.waitForTimeout(3000)
  await page.evaluate((camara) => {
    const mapa = (window as unknown as { __zibataMap: { jumpTo(c: object): void } }).__zibataMap
    mapa.jumpTo(camara)
  }, CAMARA)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const mapa = (
          window as unknown as {
            __zibataMap: { once(e: string, f: () => void): void; triggerRepaint(): void }
          }
        ).__zibataMap
        const tope = setTimeout(resolve, 60_000)
        mapa.once('idle', () => {
          clearTimeout(tope)
          resolve()
        })
        mapa.triggerRepaint()
      }),
  )
  await page.waitForTimeout(3000)

  await page.addStyleTag({
    content: `
      header, aside, footer, fieldset, .maplibregl-ctrl-bottom-left { display: none !important; }
      #og-card { position: fixed; inset: 0; z-index: 100; pointer-events: none;
        background: linear-gradient(90deg, rgb(248 244 237 / 0.98) 0%, rgb(248 244 237 / 0.95) 33%, rgb(248 244 237 / 0) 52%); }
      #og-card .inner { position: absolute; left: 64px; top: 50%; translate: 0 -50%; width: 420px; color: #1f2419; font-family: 'Special Gothic', sans-serif; }
      #og-card .marca { display: flex; align-items: center; gap: 18px; }
      #og-card svg { display: block; flex: none; }
      #og-card h1 { margin: 22px 0 14px; font-family: 'Special Gothic', sans-serif; font-weight: 700; font-stretch: 75%; font-size: 104px; line-height: .92; letter-spacing: -.01em; }
      #og-card .lema { margin: 0; font-size: 27px; font-weight: 500; white-space: nowrap; color: #454a3b; }
      #og-card .lema span { color: #8a907c; padding: 0 .35em; }
      #og-card .sitio { margin: 0; font-size: 21px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #536c2a; }
    `,
  })
  await page.evaluate((marca) => {
    const card = document.createElement('div')
    card.id = 'og-card'
    card.innerHTML = `<div class="inner">
      <div class="marca">${marca}<p class="sitio">visitzibata.com</p></div>
      <h1>Visit Zibatá</h1>
      <p class="lema">La guía local<span>·</span>The local guide</p>
    </div>`
    card.querySelector('svg')?.setAttribute('width', '64')
    card.querySelector('svg')?.setAttribute('height', '64')
    document.body.append(card)
  }, logo)
  // Un pin que queda bajo el texto o cortado por el borde de la imagen estorba: solo se dejan los que caben enteros en la zona libre.
  // Cada pin con nombre lleva además un tallo, que es otro marcador (muy angosto) en la misma vertical: se oculta con él.
  await page.evaluate(
    ({ x0, x1, y0, y1 }) => {
      const marcadores = [...document.querySelectorAll<HTMLElement>('.maplibregl-marker')]
      const rect = (el: HTMLElement) => el.getBoundingClientRect()
      const esTallo = (el: HTMLElement) => rect(el).width < 8
      const ocultos = marcadores.filter((el) => {
        if (esTallo(el)) return false
        const r = rect(el)
        return r.left < x0 || r.right > x1 || r.top < y0 || r.bottom > y1
      })
      for (const el of ocultos) el.style.display = 'none'
      const centros = ocultos.map((el) => rect(el).left + rect(el).width / 2)
      for (const el of marcadores) {
        if (!esTallo(el)) continue
        const r = rect(el)
        const fuera = r.left < x0 || r.right > x1 || r.top < y0 || r.bottom > y1
        if (fuera || centros.some((c) => Math.abs(c - (r.left + r.width / 2)) < 8))
          el.style.display = 'none'
      }
    },
    { x0: 500, x1: 1176, y0: 24, y1: 606 },
  )
  // Que la tipografía sea Special Gothic y no una sustituta: si el nombre de la familia no coincide con
  // el de la app, el navegador cae en una sans cualquiera sin avisar y la imagen sale con otra letra.
  const cargadas = await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('700 104px "Special Gothic"'),
      document.fonts.load('500 30px "Special Gothic"'),
    ])
    await document.fonts.ready
    return [...document.fonts].filter(
      (f) => f.family.includes('Special Gothic') && f.status === 'loaded',
    ).length
  })
  if (cargadas === 0)
    throw new Error('Special Gothic no está cargada: la imagen saldría con otra tipografía')
  const shot = await page.screenshot({ type: 'png' })
  // Paleta reducida: es una imagen de vista previa y WhatsApp descarta las que pesan demasiado.
  await sharp(shot)
    .resize(1200, 630, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toFile(`${ROOT}public/og-image.png`)
  console.log(`✓ public/og-image.png (Special Gothic cargada, ${cargadas} archivo/s)`)
} finally {
  await browser.close()
}
