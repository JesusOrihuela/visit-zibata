/**
 * npm run images:og -- --url http://localhost:5180/
 *
 * Genera las imágenes sociales public/og-image.png (español) y public/og-image-en.png (inglés), de
 * 1200×630, a partir del propio mapa: abre la app, oculta la interfaz, lo encuadra, superpone la
 * marca y captura. Requiere el navegador de Playwright (npx playwright install chromium).
 *
 * Hay una por idioma y no una por local (ver prerender.ts): es lo que se ve al compartir cualquier
 * página del sitio, así que el texto va en el idioma de la página. Es una pieza de marca y de
 * mercadotecnia, no una captura técnica: el mapa ocupa todo el cuadro y no se nombra la tecnología.
 *
 * Lo que muestra el mapa es lo que tenga la app en ese momento: hay que volver a generarlas cuando
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

/**
 * Lo único que cambia entre las dos imágenes. La descripción es general a propósito: el catálogo va a
 * crecer (gimnasios, servicios, tiendas) y no debe quedar atada a una categoría ni a «las plazas».
 * No repite «Zibatá»: ya está en el dominio y en el título.
 */
const IMAGENES = [
  {
    archivo: 'og-image.png',
    descripcion: 'Todo lo que necesitas, cerca de casa.',
  },
  {
    archivo: 'og-image-en.png',
    descripcion: 'Everything you need, close to home.',
  },
]

/** Encuadre del mapa: las plazas del centro de Zibatá a la derecha, con el margen izquierdo libre para la marca. */
const CAMARA = {
  center: [-100.3225, 20.6805] as [number, number],
  zoom: 15.1,
  pitch: 42,
  bearing: -10,
  padding: { left: 440, top: 0, right: 0, bottom: 0 },
}
/** Zona libre de la imagen: un pin que no cabe entero aquí (bajo el texto o cortado por el borde) se oculta. */
const ZONA_LIBRE = { x0: 500, x1: 1176, y0: 24, y1: 606 }
/** Se captura al doble y se reduce: el texto y los trazos finos del mapa salen más nítidos. */
const ESCALA = 2

type Mapa = {
  jumpTo(camara: object): void
  resize(): void
  isMoving(): boolean
  once(evento: string, fn: () => void): void
  triggerRepaint(): void
}

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

  // Primero se oculta la interfaz y después se encuadra: al quitar la cabecera y el pie el mapa cambia de tamaño, y
  // si se encuadrara antes la cámara y los pines se recolocarían después de decidir cuáles ocultar.
  await page.addStyleTag({
    content: `
      header, aside, footer, fieldset, .maplibregl-ctrl-bottom-left { display: none !important; }
      #og-card { position: fixed; inset: 0; z-index: 100; pointer-events: none;
        background: linear-gradient(90deg, rgb(248 244 237 / 0.98) 0%, rgb(248 244 237 / 0.95) 33%, rgb(248 244 237 / 0) 52%); }
      #og-card .inner { position: absolute; left: 64px; top: 50%; translate: 0 -50%; width: 430px; color: #1f2419; font-family: 'Special Gothic', sans-serif; }
      #og-card .marca { display: flex; align-items: center; gap: 18px; }
      #og-card svg { display: block; flex: none; }
      #og-card h1 { margin: 22px 0 16px; font-family: 'Special Gothic', sans-serif; font-weight: 700; font-stretch: 75%; font-size: 104px; line-height: .92; letter-spacing: -.01em; }
      #og-card .descripcion { margin: 0; font-size: 25px; font-weight: 400; line-height: 1.3; text-wrap: balance; color: #454a3b; }
      #og-card .sitio { margin: 0; font-size: 21px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #536c2a; }
    `,
  })
  const quieto = () =>
    page.waitForFunction(
      () => !(window as unknown as { __zibataMap: Mapa }).__zibataMap.isMoving(),
      null,
      { timeout: 60_000 },
    )
  await page.evaluate(() => (window as unknown as { __zibataMap: Mapa }).__zibataMap.resize())
  await page.waitForTimeout(1500)
  await quieto()
  await page.evaluate((camara) => {
    ;(window as unknown as { __zibataMap: Mapa }).__zibataMap.jumpTo(camara)
  }, CAMARA)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const mapa = (window as unknown as { __zibataMap: Mapa }).__zibataMap
        const tope = setTimeout(resolve, 60_000)
        mapa.once('idle', () => {
          clearTimeout(tope)
          resolve()
        })
        mapa.triggerRepaint()
      }),
  )
  await page.waitForTimeout(3000)
  await quieto()

  // Un pin que no cabe entero en la zona libre se oculta, y su tallo con él. Cada pin con nombre lleva un tallo, que es otro
  // marcador (muy angosto) anclado en el mismo punto: solo se deja si hay una etiqueta visible justo encima.
  const ocultos = await page.evaluate((zona) => {
    const marcadores = [...document.querySelectorAll<HTMLElement>('.maplibregl-marker')]
    const rect = (el: HTMLElement) => el.getBoundingClientRect()
    const esTallo = (el: HTMLElement) => rect(el).width < 8
    const cabe = (el: HTMLElement) => {
      const r = rect(el)
      return r.left >= zona.x0 && r.right <= zona.x1 && r.top >= zona.y0 && r.bottom <= zona.y1
    }
    const etiquetas = marcadores.filter((el) => !esTallo(el))
    for (const el of etiquetas) if (!cabe(el)) el.style.display = 'none'
    const visibles = etiquetas.filter((el) => el.style.display !== 'none')
    for (const tallo of marcadores.filter(esTallo)) {
      const t = rect(tallo)
      const centro = t.left + t.width / 2
      const conEtiqueta = visibles.some((el) => {
        const r = rect(el)
        return Math.abs(r.left + r.width / 2 - centro) < 8 && Math.abs(r.bottom - t.bottom) < 3
      })
      if (!conEtiqueta || !cabe(tallo)) tallo.style.display = 'none'
    }
    return marcadores.filter((el) => el.style.display === 'none').length
  }, ZONA_LIBRE)
  console.log(`  pines y tallos ocultos: ${ocultos}`)

  // Que la tipografía sea Special Gothic y no una sustituta: si el nombre de la familia no coincide con
  // el de la app, el navegador cae en una sans cualquiera sin avisar y la imagen sale con otra letra.
  const cargadas = await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('700 104px "Special Gothic"'),
      document.fonts.load('400 25px "Special Gothic"'),
    ])
    await document.fonts.ready
    return [...document.fonts].filter(
      (f) => f.family.includes('Special Gothic') && f.status === 'loaded',
    ).length
  })
  if (cargadas === 0)
    throw new Error('Special Gothic no está cargada: la imagen saldría con otra tipografía')

  await page.evaluate((marca) => {
    const card = document.createElement('div')
    card.id = 'og-card'
    card.innerHTML = `<div class="inner">
      <div class="marca">${marca}<p class="sitio">visitzibata.com</p></div>
      <h1>Visit Zibatá</h1>
      <p class="descripcion"></p>
    </div>`
    card.querySelector('svg')?.setAttribute('width', '64')
    card.querySelector('svg')?.setAttribute('height', '64')
    document.body.append(card)
  }, logo)

  for (const { archivo, descripcion } of IMAGENES) {
    await page.evaluate((texto) => {
      const p = document.querySelector('#og-card .descripcion')
      if (p) p.textContent = texto
    }, descripcion)
    const shot = await page.screenshot({ type: 'png' })
    // Paleta reducida: es una imagen de vista previa y WhatsApp descarta las que pesan demasiado.
    await sharp(shot)
      .resize(1200, 630, { kernel: 'lanczos3' })
      .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
      .toFile(`${ROOT}public/${archivo}`)
    console.log(`✓ public/${archivo} (Special Gothic cargada)`)
  }
} finally {
  await browser.close()
}
