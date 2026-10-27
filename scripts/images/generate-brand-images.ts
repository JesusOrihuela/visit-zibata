/**
 * npm run images:marca
 *
 * Las dos imágenes que no son del sitio sino de su ficha pública, y que por eso no viven en
 * `public/` ni se publican con la guía:
 *
 *  - `docs/img/social-preview.png` (1280×640), la tarjeta del repositorio en GitHub. Es lo que se ve
 *    al compartir github.com/aurariola-studio/visit-zibata en cualquier sitio. Se sube a mano en
 *    Settings → General → Social preview.
 *  - `docs/img/aurariola-oscuro.png` (512×512), el símbolo de aurariola.com para el perfil de la
 *    organización. Se sube en el perfil de la organización.
 *
 * Se componen aquí y no a mano para que salgan de la misma fuente que el resto de la marca: el
 * símbolo de `public/logo.svg` y la rejilla de `AurariolaMark.tsx`. Si la marca cambia, se vuelven a
 * generar en vez de retocarlas en un editor.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { ROOT } from '../data/lib/dataset.ts'

const SALIDA = `${ROOT}docs/img/`
/**
 * La fuente va incrustada (data URI) y no como `file://`: la página se crea con `setContent` y el navegador
 * no deja que una página en blanco cargue archivos locales, así que con `file://` el texto salía en la
 * sans genérica del sistema aunque el CSS nombrara Special Gothic.
 */
const fuente = readFileSync(
  `${ROOT}node_modules/@fontsource-variable/special-gothic/files/special-gothic-latin-wdth-normal.woff2`,
).toString('base64')
const logo = readFileSync(`${ROOT}public/logo.svg`, 'utf8').trim()

/*
 * El anillo de aurariola, con las mismas filas que src/components/brand/AurariolaMark.tsx. Se repite
 * aquí porque ese archivo es un componente de React y este script corre en Node sin transpilar; si
 * alguna vez cambian, tienen que cambiar las dos, y por eso la regla del cursor va escrita en ambos.
 */
const FILAS: [number, number[]][] = [
  [17, [81, 113, 145]],
  [49, [49, 81, 113, 145, 177]],
  [81, [17, 49, 177, 209]],
  [113, [17, 49, 177, 209]],
  [145, [17, 49, 177, 209]],
  [177, [49, 81, 113, 145]],
  [209, [81, 113, 145]],
]
/** El cursor: el único módulo en oro. Nunca hay más de uno. */
const CURSOR = { x: 177, y: 177 }

const modulos = FILAS.flatMap(([y, xs]) =>
  xs.map((x) => `<rect x="${x}" y="${y}" width="30" height="30" rx="4" />`),
).join('')

const marcaAurariola = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="240" height="240" rx="52" fill="#14161b" />
  <g fill="#f1efe9">${modulos}</g>
  <rect x="${CURSOR.x}" y="${CURSOR.y}" width="30" height="30" rx="4" fill="#d6a93e" />
</svg>`

const estilos = `
@font-face{font-family:"Special Gothic";font-weight:400 700;font-stretch:75% 125%;src:url(data:font/woff2;base64,${fuente})format("woff2")}
*{margin:0;box-sizing:border-box}
body{background:#fff;font-family:"Special Gothic",sans-serif}
.social{width:1280px;height:640px;background:#F7F4ED;position:relative;overflow:hidden;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px}
/* La misma trama de puntos del 404 y de las tarjetas de cada local. */
.social::before{content:"";position:absolute;inset:0;
  background-image:radial-gradient(#536C2A 1px,transparent 1px);background-size:30px 30px;opacity:.07}
.social > *{position:relative}
.social svg{width:132px;height:132px}
h1{font-family:"Special Gothic",sans-serif;font-weight:700;font-stretch:75%;font-size:92px;color:#22261D}
.lema{font-size:31px;color:#536C2A}
.sitio{margin-top:10px;font-size:21px;letter-spacing:.16em;text-transform:uppercase;color:#8A907C}
.avatar{width:512px;height:512px;background:#14161b;display:grid;place-items:center}
.avatar svg{width:512px;height:512px}
`

mkdirSync(SALIDA, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } })
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${estilos}</style>
<div class="social" id="social">
  ${logo}
  <h1>Visit Zibatá</h1>
  <p class="lema">La guía local</p>
  <p class="sitio">visitzibata.com</p>
</div>
<div class="avatar" id="avatar">${marcaAurariola}</div>`)
  await page.evaluate(() => document.fonts.ready)

  for (const [id, archivo] of [
    ['social', 'social-preview.png'],
    ['avatar', 'aurariola-oscuro.png'],
  ] as const) {
    const captura = await page.locator(`[id="${id}"]`).screenshot()
    await sharp(captura).png({ compressionLevel: 9 }).toFile(`${SALIDA}${archivo}`)
    console.log(`✓ docs/img/${archivo}`)
  }
} finally {
  await browser.close()
}
