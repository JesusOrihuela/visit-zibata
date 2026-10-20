/**
 * Lista todo lo que se puede pulsar, escribir o arrastrar en la guía, y dice de qué familia es.
 *
 * No es un script de producción: es la herramienta que comprueba que el catálogo de interactuables
 * (docs/CATALOGO.md) no se deja ninguna pieza fuera. Lee el JSX en crudo, saca cada elemento con el
 * archivo donde vive, y mira en el módulo de al lado si su clase compone algo de
 * `src/styles/controls.module.css`.
 *
 * Esa segunda parte es la que separa "lo miré" de "lo comprobé": una pieza que no compone nada se
 * dibujó a mano, y entonces su forma no sale de ninguna familia por mucho que se le parezca.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = 'src'
const INTERACTIVOS = /<(button|a|input|select|textarea)(\s[^>]*?)?(\/>|>)/gs

/** Lo que vive fuera del catálogo a propósito, con el motivo escrito en docs/CATALOGO.md. */
const FUERA = new Map([
  ['MapDebugPanel.tsx', 'solo existe en desarrollo'],
  ['RatingStars.tsx', 'grupo de opción única ordenada: la forma la da la estrella'],
])

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta)
    return ruta.endsWith('.tsx') && !ruta.includes('.test.') ? [ruta] : []
  })
}

/*
 * Las clases que menciona un `className`, en sus tres formas: a secas, dentro de una plantilla y
 * dentro de un condicional (`cond ? styles.a : styles.b`). Hacen falta las tres o el inventario
 * da falsos positivos justo en las piezas con más de un cuerpo, que son las que más conviene mirar.
 */
const clasesDe = (atributos) => {
  const bloque = atributos.match(/className=\{([^}]*)\}|className="([^"]*)"/)?.[0] ?? ''
  return [...bloque.matchAll(/styles\.(\w+)/g)].map((m) => m[1])
}

const pista = (atributos) => {
  const clase = clasesDe(atributos).join('/')
  const etiqueta = atributos.match(/aria-label=\{?t\('([^']+)'/)?.[1]
  const href = /href=/.test(atributos)
  return (
    [clase && `.${clase}`, etiqueta, href && 'href'].filter(Boolean).join(' · ') || '(sin pista)'
  )
}

/**
 * Las clases que componen una familia en el módulo que **ese** componente importa, y cuál.
 *
 * El módulo no siempre se llama como el componente: los tres paneles de `plazas` comparten
 * `Panel.module.css` y la hoja de Tu Zibatá usa `ProfileButton.module.css`. Buscar el archivo
 * hermano daba media docena de falsos positivos.
 */
function familiasDe(rutaTsx) {
  const tsx = readFileSync(rutaTsx, 'utf8')
  const importado = tsx.match(/import styles from '(\.[^']+\.module\.css)'/)?.[1]
  if (!importado) return new Map()
  const css = join(rutaTsx, '..', importado)
  if (!existsSync(css)) return new Map()
  const fuente = readFileSync(css, 'utf8')
  const mapa = new Map()
  const regla = /\.([\w-]+)\s*\{[^}]*?composes:\s*([^;]+?)\s+from\s+"[^"]*controls\.module\.css"/gs
  for (const [, clase, familias] of fuente.matchAll(regla)) mapa.set(clase, familias.trim())
  return mapa
}

const porArchivo = new Map()
const sinFamilia = []

for (const ruta of archivos(RAIZ)) {
  const fuente = readFileSync(ruta, 'utf8')
  const familias = familiasDe(ruta)
  const excluido = [...FUERA.keys()].some((nombre) => ruta.endsWith(nombre))
  for (const [, etiqueta, atributos = ''] of fuente.matchAll(INTERACTIVOS)) {
    // `<a>` con espacio para no capturar <article>, <aside>…
    if (etiqueta === 'a' && !/^\s/.test(atributos)) continue
    const clase = clasesDe(atributos)
    const familia =
      clase
        .map((c) => familias.get(c))
        .filter(Boolean)
        .join(' / ') || undefined
    const lista = porArchivo.get(ruta) ?? []
    lista.push(`${etiqueta.padEnd(8)} ${pista(atributos).padEnd(38)}${familia ?? ''}`)
    porArchivo.set(ruta, lista)
    /*
     * Un campo sin clase propia no es una pieza suelta: su forma la pone el contenedor que lo
     * envuelve, y ese sí compone. Son tres: el `select` dentro de la cápsula de zona, el radio
     * escondido dentro de cada opción del formulario y el campo trampa, que vive fuera de pantalla.
     */
    const laPoneElPadre = clase.length === 0 && etiqueta !== 'button' && etiqueta !== 'a'
    if (!familia && !excluido && !laPoneElPadre) {
      sinFamilia.push(`${ruta.replace(/\\/g, '/')}  ${pista(atributos)}`)
    }
  }
}

let total = 0
for (const [ruta, lista] of [...porArchivo].sort()) {
  console.log(`\n${ruta.replace(/\\/g, '/')}  (${lista.length})`)
  for (const linea of lista) console.log(`  ${linea}`)
  total += lista.length
}
console.log(`\nTOTAL: ${total} elementos interactivos en ${porArchivo.size} archivos`)

/*
 * No todo lo que sale abajo es un fallo, y por eso no rompe nada: un enlace de texto suelto, o una
 * pieza cuyo estilo vive en el módulo de otro componente, no compone nada y está bien. Lo que esta
 * lista evita es lo otro: que una pieza nueva se dibuje a mano y nadie se entere hasta que
 * desentona en una captura. Cada una se mira y, o entra en una familia, o se escribe por qué no.
 */
if (sinFamilia.length > 0) {
  console.log(`\nSIN COMPONER NINGUNA FAMILIA (${sinFamilia.length}), a revisar una por una:`)
  for (const linea of sinFamilia) console.log(`  ${linea}`)
} else {
  console.log('\nTodas componen una familia del catálogo.')
}
