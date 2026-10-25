/**
 * npm run images:og-places
 *
 * Una imagen de vista previa por local, en dist/og/. Es lo que se ve al compartir la ficha de un
 * lugar en WhatsApp o en redes: sin esto, los 101 enlaces mostraban la misma imagen de la portada.
 *
 * No se guardan en el repositorio: se componen al publicar, a partir de data/commercial/places.json.
 * Así, añadir un local, cambiarle el nombre o ponerle foto se refleja solo en la siguiente
 * publicación, sin que nadie tenga que abrir un editor de imágenes.
 *
 * Hoy ningún local tiene foto, así que la cara derecha de la tarjeta usa el tono de su categoría
 * (el campo `hue`, el mismo que colorea sus plazas en el mapa). El día que haya fotos, esa misma
 * cara las usa: la rama ya está escrita.
 *
 * Se renderiza con el navegador de Playwright, que ya es dependencia de desarrollo, y no con la
 * composición de texto de sharp: esa depende de las fuentes instaladas en el sistema, y Archivo no
 * está en los runners de CI. Para que no cueste 101 navegaciones, se pinta una sola página con las
 * 101 tarjetas y se captura cada una por separado.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import type { Category, Place, Plaza } from '../../src/types/domain.ts'
import { ROOT } from '../data/lib/dataset.ts'

const OUT = `${ROOT}dist/og/`
const read = <T>(file: string): T => JSON.parse(readFileSync(`${ROOT}${file}`, 'utf8')) as T

const { categories } = read<{ categories: Category[] }>('data/commercial/categories.json')
const { plazas } = read<{ plazas: Plaza[] }>('data/commercial/plazas.json')
const { places } = read<{ places: Place[] }>('data/commercial/places.json')

const plazaById = new Map(plazas.map((plaza) => [plaza.id, plaza]))
const giroLabel = new Map<string, string>()
const hueOfGiro = new Map<string, number>()
for (const category of categories) {
  for (const giro of category.giros) {
    giroLabel.set(giro.id, giro.label.es)
    if (category.hue !== undefined) hueOfGiro.set(giro.id, category.hue)
  }
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const logo = readFileSync(`${ROOT}public/logo.svg`, 'utf8').trim()
const fuentes = `${ROOT}node_modules/@fontsource`

/** La cara derecha: la foto del local si la tiene, y si no el tono de su categoría. */
function face(place: Place): string {
  const photo = place.photos[0]
  if (photo && !/^https?:/.test(photo.src)) {
    return `<img class="foto" src="${pathToFileURL(`${ROOT}public/${photo.src}`).href}" alt="" />`
  }
  const hue = hueOfGiro.get(place.giros[0] ?? '') ?? 84
  return `<div class="tono" style="--h:${hue}"></div>`
}

const tarjetas = places
  .map((place) => {
    const plaza = plazaById.get(place.plazaId)
    const giros = place.giros.map((id) => giroLabel.get(id) ?? id).join(' · ')
    return `<article class="c" id="og-${place.slug}">
    <div class="txt">
      <div class="marca">${logo}<span>Visit Zibatá</span></div>
      <h1>${escapeHtml(place.name)}</h1>
      <p class="giros">${escapeHtml(giros)}</p>
      <p class="plaza">${escapeHtml(plaza ? plaza.name : 'Zibatá')}</p>
    </div>
    ${face(place)}
  </article>`
  })
  .join('\n')

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Archivo;font-weight:700;src:url("file:///${fuentes}/archivo/files/archivo-latin-700-normal.woff2")format("woff2")}
@font-face{font-family:Archivo;font-weight:500;src:url("file:///${fuentes}/archivo/files/archivo-latin-500-normal.woff2")format("woff2")}
*{margin:0;box-sizing:border-box}
body{background:#fff;font-family:Archivo,sans-serif}
.c{width:1200px;height:630px;display:grid;grid-template-columns:1fr 440px;background:#F7F4ED;
  position:relative;overflow:hidden}
.c::before{content:"";position:absolute;inset:0;
  background-image:radial-gradient(#536C2A 1px,transparent 1px);background-size:26px 26px;opacity:.07}
.txt{position:relative;padding:72px;display:flex;flex-direction:column;justify-content:center;gap:18px}
.marca{display:flex;align-items:center;gap:12px;font-size:21px;letter-spacing:.14em;
  text-transform:uppercase;color:#536C2A;margin-bottom:10px}
.marca svg{width:46px;height:46px}
h1{font-family:Archivo,sans-serif;font-weight:700;font-size:68px;line-height:1.02;letter-spacing:-.02em;
  color:#22261D;text-wrap:balance}
.giros{font-size:30px;color:#536C2A}
.plaza{font-size:25px;color:#8A907C}
/* Sin foto, la cara derecha lleva el tono de la categoría: el mismo que colorea su plaza. */
.tono{background:linear-gradient(160deg,hsl(var(--h) 42% 80%),hsl(var(--h) 38% 66%))}
.foto{width:100%;height:100%;object-fit:cover}
</style>
${tarjetas}
`

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  for (const place of places) {
    // Las capturas de Playwright salen en PNG sin comprimir: 101 sumaban 20 MB. Se pasan por sharp
    // a JPEG, que es lo que esperan los robots de las redes y pesa una quinta parte.
    const shot = await page.locator(`[id="og-${place.slug}"]`).screenshot()
    await sharp(shot).jpeg({ quality: 82, mozjpeg: true }).toFile(`${OUT}${place.slug}.jpg`)
  }
  console.log(`✓ ${places.length} imágenes en dist/og/`)
} finally {
  await browser.close()
}
