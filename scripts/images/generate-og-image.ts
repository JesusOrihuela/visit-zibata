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

/** Encuadre del mapa: el centro de Zibatá, con la marca abajo para que el mapa mande en el cuadro. */
const CAMARA = {
  center: [-100.3225, 20.6805] as [number, number],
  zoom: 14.8,
  pitch: 42,
  bearing: -10,
  padding: { left: 0, top: 0, right: 0, bottom: 170 },
}
/** Zona que ocupa la marca: un pin que la pise se oculta, y también el que se salga de la imagen. */
const TEXTO = { x0: 260, x1: 940, y0: 340, y1: 630 }
/** Se captura al doble y se reduce: el texto y los trazos finos del mapa salen más nítidos. */
const ESCALA = 2

/**
 * El lockup aprobado, dibujado aquí con la misma geometría que el archivo de marca: símbolo a 2,4
 * veces la mayúscula y subido un 4 por ciento, VISIT a 600 en olivo, ZIBATÁ a 700 en tinta, 19 px
 * de hueco a la izquierda y 20 a la derecha. El texto va en SVG y no en HTML para que el bloque no
 * dependa de las métricas de la caja.
 */
const LOCKUP = {
  cuerpo: 75.4,
  izquierda: 19,
  derecha: 20,
  factorVisit: 2.14,
  factorNombre: 2.77,
  factorSimbolo: 2.4 * 0.71,
  sangradoVisit: 0.01,
  sangradoNombre: 0.02,
  recorte: { x: 20, y: 230, ancho: 590, alto: 160 },
}

function lockup(simbolo: string): string {
  const interior = simbolo
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .trim()
  const cuerpo = LOCKUP.cuerpo
  const anchoVisit = LOCKUP.factorVisit * cuerpo
  const anchoNombre = LOCKUP.factorNombre * cuerpo
  const diametro = LOCKUP.factorSimbolo * cuerpo
  const ancho = anchoVisit + LOCKUP.izquierda + diametro + LOCKUP.derecha + anchoNombre
  const x0 = (630 - ancho) / 2
  const xVisit = x0 - LOCKUP.sangradoVisit * cuerpo
  const xSimbolo = x0 + anchoVisit + LOCKUP.izquierda
  const xNombre = xSimbolo + diametro + LOCKUP.derecha - LOCKUP.sangradoNombre * cuerpo
  const base = 315 + (0.71 * cuerpo) / 2
  const cy = 315 - diametro * 0.04
  const { x, y, ancho: anchoRecorte, alto } = LOCKUP.recorte
  return `<svg class="lockup" viewBox="${x} ${y} ${anchoRecorte} ${alto}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Visit Zibatá">
    <g transform="translate(${xSimbolo.toFixed(2)} ${(cy - diametro / 2).toFixed(2)}) scale(${(diametro / 256).toFixed(4)})">${interior}</g>
    <text x="${xVisit.toFixed(2)}" y="${base.toFixed(2)}" font-size="${cuerpo}" font-weight="600" letter-spacing="${(cuerpo * 0.02).toFixed(2)}" fill="#536C2A">VISIT</text>
    <text x="${xNombre.toFixed(2)}" y="${base.toFixed(2)}" font-size="${cuerpo}" font-weight="700" letter-spacing="${(cuerpo * -0.018).toFixed(2)}" fill="#1F2419">ZIBATÁ</text>
  </svg>`
}

type Mapa = {
  jumpTo(camara: object): void
  resize(): void
  isMoving(): boolean
  once(evento: string, fn: () => void): void
  triggerRepaint(): void
}

// El símbolo sale de public/logo.svg, igual que los iconos: una sola fuente para toda la marca.
const logo = readFileSync(`${ROOT}public/logo.svg`, 'utf8').trim()

/*
 * Con la GPU de verdad y no con SwiftShader: desde que el mapa realista se apaga solo con renderizado
 * por software (modo.ts), una captura hecha con SwiftShader sale con el mapa de respaldo. En Windows
 * hay que pedir D3D11 a mano: sin eso Chromium sin cabeza cae en SwiftShader aunque haya GPU.
 */
const browser = await chromium.launch({
  args: ['--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])],
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
  // La imagen es del mapa realista: si quedó en respaldo o degradado, no se genera una imagen con otro mapa.
  await page.waitForFunction(
    () => document.querySelector('[data-realismo]')?.getAttribute('data-realismo') === 'completo',
    null,
    { timeout: 90_000 },
  )
  await page.waitForTimeout(3000)

  // Primero se oculta la interfaz y después se encuadra: al quitar la cabecera y el pie el mapa cambia de tamaño, y
  // si se encuadrara antes la cámara y los pines se recolocarían después de decidir cuáles ocultar.
  await page.addStyleTag({
    content: `
      header, aside, footer, fieldset, .maplibregl-ctrl-bottom-left { display: none !important; }
      #og-card { position: fixed; inset: 0; z-index: 100; pointer-events: none;
        background: linear-gradient(to bottom, rgb(248 244 237 / 0) 38%, rgb(248 244 237 / 0.62) 58%, rgb(248 244 237 / 0.92) 76%, rgb(248 244 237 / 1) 100%); }
      #og-card .pie { position: absolute; left: 50%; bottom: 20px; translate: -50% 0; width: 640px; text-align: center; color: #1f2419; font-family: 'Special Gothic', sans-serif; }
      #og-card .lockup { display: block; width: 540px; height: auto; margin: 0 auto 18px; font-family: 'Special Gothic', sans-serif; font-stretch: 88%; overflow: visible; }
      #og-card .descripcion { margin: 0 auto; max-width: 500px; font-size: 23px; font-weight: 400; line-height: 1.28; text-wrap: balance; color: #454a3b; }
      #og-card .sitio { margin: 12px 0 0; font-size: 15px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #536c2a; }
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

  // Un pin que se sale de la imagen o que pisa la marca se oculta, y su tallo con él. Cada pin con
  // nombre lleva un tallo, que es otro marcador (muy angosto) anclado en el mismo punto: solo se deja
  // si hay una etiqueta visible justo encima.
  const ocultos = await page.evaluate((texto) => {
    const marcadores = [...document.querySelectorAll<HTMLElement>('.maplibregl-marker')]
    const rect = (el: HTMLElement) => el.getBoundingClientRect()
    const esTallo = (el: HTMLElement) => rect(el).width < 8
    const cabe = (el: HTMLElement) => {
      const r = rect(el)
      const dentro = r.left >= 8 && r.right <= 1192 && r.top >= 8 && r.bottom <= 622
      const tapa =
        r.right > texto.x0 && r.left < texto.x1 && r.bottom > texto.y0 && r.top < texto.y1
      return dentro && !tapa
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
  }, TEXTO)
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
    card.innerHTML = `<div class="pie">
      ${marca}
      <p class="descripcion"></p>
      <p class="sitio">visitzibata.com</p>
    </div>`
    document.body.append(card)
  }, lockup(logo))

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
