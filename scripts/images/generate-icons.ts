/**
 * npm run images:icons
 *
 * Genera los PNG de icono a partir de public/logo.svg, que es la única fuente del símbolo.
 *
 * Son tres formatos porque cada sitio recorta distinto:
 *  - "any" (manifiesto): esquina redondeada propia, porque el lanzador lo pone tal cual.
 *  - "maskable" (manifiesto): fondo a sangre y el símbolo dentro de la zona segura del 80 %, porque
 *    el lanzador recorta la forma que quiera. Con un único icono "any maskable" se comían las
 *    esquinas y el símbolo quedaba pegado al borde.
 *  - apple-touch: a sangre y sin esquina, porque iOS aplica su propia máscara y redondear dos veces
 *    deja un borde sucio.
 *
 * Y el favicon de la pestaña, que sale del corte chico (`public/simbolo.svg`) y no del grande: a
 * 16 px el corte grande se cierra y la Z deja de leerse. También va sobre baldosa olivo, y por la
 * misma razón que los otros: el símbolo suelto es olivo oscuro, y en una pestaña de navegador en
 * modo oscuro se pierde contra el fondo. Con baldosa se lee igual en los dos modos, y el icono deja
 * de depender del tema de quien mira.
 *
 * Sobre el olivo el símbolo va en papel y en lima clara: el lima de la marca (#8cba37) queda
 * demasiado cerca del olivo del fondo y la aguja pierde sus dos mitades.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { ROOT } from '../data/lib/dataset.ts'

const OLIVO = '#536c2a'
const LIENZO = 256

/** El dibujo de un corte, ya invertido para ir sobre olivo. */
function simboloDe(archivo: string): string {
  const fuente = readFileSync(`${ROOT}${archivo}`, 'utf8')
  const dentro = fuente.match(/<\/title>([\s\S]*)<\/svg>/)?.[1]
  if (!dentro) throw new Error(`${archivo} no tiene el formato esperado`)
  // Sobre fondo oscuro se invierte la marca: el olivo pasa a papel y el lima a su tono claro.
  const invertido = dentro.replaceAll('#536C2A', '#f7f4ed').replaceAll('#8CBA37', '#b8d77c')
  if (invertido === dentro) throw new Error(`${archivo} no usa los colores esperados`)
  return invertido
}

const simbolo = simboloDe('public/logo.svg')
const simboloChico = simboloDe('public/simbolo.svg')

/** `escala` < 1 mete el símbolo en la zona segura; `radio` 0 deja el fondo a sangre. */
const lienzo = (escala: number, radio: number, dibujo: string = simbolo) => {
  const margen = (LIENZO * (1 - escala)) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LIENZO} ${LIENZO}">
  <rect width="${LIENZO}" height="${LIENZO}" rx="${radio}" fill="${OLIVO}"/>
  <g transform="translate(${margen} ${margen}) scale(${escala})">${dibujo}</g>
</svg>`
}

/*
 * El favicon sale como SVG y no como PNG: la pestaña lo pide a 16 y a 32 px según la pantalla, y un
 * vector sirve los dos sin pesar dos archivos. La baldosa va algo más redondeada que la de los
 * iconos de aplicación (56 de 256, un 22 %, frente a 48) porque a 16 px una esquina de 48 se lee
 * casi cuadrada. Y el símbolo va al 78 % y no al 84 % de los otros: en la pestaña no hay máscara del
 * sistema que se coma el borde, así que sobra margen, pero al 84 % el aro empieza a tocar la curva
 * de la esquina. Comparados los tres a 16 y 32 px antes de elegir.
 */
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LIENZO} ${LIENZO}"><title>Visit Zibatá</title>${lienzo(
  0.78,
  56,
  simboloChico,
)
  .replace(/^<svg[^>]*>/, '')
  .replace('</svg>', '')}</svg>`
writeFileSync(
  `${ROOT}public/favicon.svg`,
  `${FAVICON}
`,
)
console.log('✓ public/favicon.svg')

const SALIDAS = [
  /*
   * Las dos del favicon en PNG. El SVG se queda como primera opción, pero quien no lo use tiene que
   * rasterizarlo él, y lo hace al tamaño que le da la gana: Search Console lo convierte a 32 px y
   * luego su interfaz lo amplia, con lo que el aro se escalona y la Z se emborrona. Con un PNG
   * declarado no hay nada que convertir.
   *
   * 48 y 96 porque Google pide que el favicon sea múltiplo de 48, y porque 96 es lo que acaba
   * usándose en las pantallas de densidad doble.
   */
  { file: 'public/favicon-48.png', size: 48, svg: lienzo(0.78, 56, simboloChico) },
  { file: 'public/favicon-96.png', size: 96, svg: lienzo(0.78, 56, simboloChico) },
  { file: 'public/icons/icon-192.png', size: 192, svg: lienzo(0.84, 48) },
  { file: 'public/icons/icon-512.png', size: 512, svg: lienzo(0.84, 48) },
  { file: 'public/icons/icon-maskable-192.png', size: 192, svg: lienzo(0.72, 0) },
  { file: 'public/icons/icon-maskable-512.png', size: 512, svg: lienzo(0.72, 0) },
  { file: 'public/apple-touch-icon.png', size: 180, svg: lienzo(0.8, 0) },
]

for (const { file, size, svg } of SALIDAS) {
  await sharp(Buffer.from(svg), { density: (72 * size) / LIENZO })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(`${ROOT}${file}`)
  console.log(`✓ ${file}`)
}
