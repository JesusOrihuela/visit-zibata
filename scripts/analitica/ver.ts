/**
 * npm run analitica:ver
 *
 * Las visitas, en una tabla que se lee. Por debajo es `wrangler d1 execute`, que devuelve un JSON
 * crudo con metadatos de la consulta; aquí se queda solo lo que interesa y se le pone forma.
 *
 * No hay panel ni endpoint de lectura a propósito: una página que muestre estos números habría que
 * protegerla, y proteger algo es justo el trabajo que este proyecto no quiere tener. Los números los
 * mira quien tiene las llaves de Cloudflare, desde su propia máquina.
 *
 * Desde la v4.13 también sale el conteo de **comparticiones**: las veces que una app de mensajería
 * pidió una página para dibujar la tarjetita de un enlace. No es tráfico y por eso va aparte, pero
 * dice que alguien pegó ese enlace en algún sitio. Es un piso, no una cifra exacta.
 *
 * Con `--dias=N` se cambia la ventana (30 por omisión), y con `--local` se lee la base de desarrollo
 * en vez de la publicada.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

interface Fila {
  ruta: string
  idioma: string
  visitas: number
}

interface Compartida {
  ruta: string
  veces: number
}

const argumentos = process.argv.slice(2)
const dias = Number(argumentos.find((a) => a.startsWith('--dias='))?.slice(7) ?? 30)
const donde = argumentos.includes('--local') ? '--local' : '--remote'

const consulta = `
SELECT ruta, idioma, SUM(cuenta) AS visitas
  FROM visitas
 WHERE fecha >= date('now', '-${dias} days')
 GROUP BY ruta, idioma
 ORDER BY visitas DESC
`.trim()

/** Wrangler escribe avisos antes del JSON, así que se recorta desde el primer corchete. */
function consultar<T>(sql: string): T[] {
  /*
   * Se llama al archivo de wrangler con el propio Node, y no a `npx`. Con `shell` de por medio,
   * Windows vuelve a trocear los argumentos y parte la consulta por los espacios; y sin él, Node ya
   * no deja lanzar un `.cmd`. Así no hay intérprete que reinterprete nada, en ningún sistema.
   */
  // Por ruta y no con `import.meta.resolve`: wrangler no publica su `bin` en los `exports`.
  const wrangler = fileURLToPath(
    new URL('../../node_modules/wrangler/bin/wrangler.js', import.meta.url),
  )
  const ejecutar = () =>
    execFileSync(
      process.execPath,
      [wrangler, 'd1', 'execute', 'visit-zibata-analitica', donde, '--json', `--command=${sql}`],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    )

  let salida: string
  try {
    salida = ejecutar()
  } catch (primero) {
    // Un fallo de wrangler sale como un volcado de Node de cincuenta líneas con el comando entero
    // dentro. Aquí se queda el motivo y qué hacer: esto lo lee alguien que quiere ver un número, no
    // depurar un proceso hijo.
    //
    // El 7403 es aparte: aparece a ratos y se va solo (tres veces en una semana, siempre con el
    // permiso de D1 bien puesto y siempre bien al segundo intento), así que se reintenta una vez
    // antes de molestar a nadie. Cualquier otro fallo sale directo, sin esperas inútiles.
    if (!ES_PASAJERO.test(detalleDe(primero))) throw new Error(explicar(primero))
    try {
      salida = ejecutar()
    } catch (segundo) {
      throw new Error(explicar(segundo))
    }
  }
  const inicio = salida.indexOf('[')
  if (inicio === -1) throw new Error(`Respuesta inesperada de wrangler:\n${salida}`)
  const bloques = JSON.parse(salida.slice(inicio)) as { results: T[] }[]
  return bloques.flatMap((bloque) => bloque.results)
}

/** El rechazo de Cloudflare que no significa nada: ni permisos ni configuración, solo mala hora. */
const ES_PASAJERO = /7403|not authorized to access this service/i

/** Lo que wrangler escribió, sin los colores, para poder buscar dentro. */
function detalleDe(error: unknown): string {
  const fallo = error as { stderr?: string; stdout?: string }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: es el escape ANSI, y quitar los colores de wrangler es justo lo que se quiere.
  return `${fallo.stderr ?? ''}${fallo.stdout ?? ''}`.replace(/\u001b\[[0-9;]*m/g, '')
}

/** Traduce el fallo de wrangler a una frase y, cuando se reconoce, a qué hacer con él. */
function explicar(error: unknown): string {
  const salida = detalleDe(error)
  const motivo = salida.match(/"text":\s*"([^"]+)"/)?.[1]

  if (ES_PASAJERO.test(salida)) {
    return [
      'Cloudflare rechazó la consulta dos veces: la cuenta no está autorizada para D1.',
      '',
      '  Es pasajero a menudo, y ya se reintentó una vez. Prueba de nuevo en un minuto.',
      '  Si sigue: `npx wrangler whoami` y comprueba que `d1` esté entre los permisos;',
      '  si no está, `npx wrangler login` para volver a concederlos.',
    ].join('\n')
  }
  if (/no such table|SQLITE_ERROR/i.test(salida)) {
    return 'La tabla de visitas no existe todavía. Créala con `npm run analitica:esquema`.'
  }
  if (/not logged in|Unable to authenticate|credentials/i.test(salida)) {
    return 'Esta máquina no está identificada en Cloudflare. Ejecuta `npx wrangler login`.'
  }
  return `No se pudo leer la base de visitas${motivo ? `: ${motivo}` : '.'}`
}

/*
 * Se corta aquí en vez de dejar que el error suba: una pila de Node no le dice nada a quien solo
 * quería ver un número, y el mensaje de `explicar()` ya trae el motivo y el siguiente paso.
 */
const compartidas = `
SELECT ruta, SUM(cuenta) AS veces
  FROM comparticiones
 WHERE fecha >= date('now', '-${dias} days')
 GROUP BY ruta
 ORDER BY veces DESC
 LIMIT 10
`.trim()

let filas: Fila[]
let enlaces: Compartida[] = []
try {
  filas = consultar<Fila>(consulta)
  // Si la tabla todavía no existe (una base anterior a la v4.13), se sigue sin ella: el conteo de
  // visitas es lo que vino a ver quien ejecuta esto.
  try {
    enlaces = consultar<Compartida>(compartidas)
  } catch {
    enlaces = []
  }
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}

if (filas.length === 0) {
  console.log(
    `Sin visitas en los últimos ${dias} días.\n` +
      'Si el sitio acaba de publicarse, es lo esperado: los números empiezan a llegar con la gente.',
  )
  process.exit(0)
}

const total = filas.reduce((suma, fila) => suma + fila.visitas, 0)
const porIdioma = new Map<string, number>()
for (const fila of filas)
  porIdioma.set(fila.idioma, (porIdioma.get(fila.idioma) ?? 0) + fila.visitas)

const ancho = Math.max(...filas.map((fila) => fila.ruta.length), 'PÁGINA'.length)
// La barra es relativa a la página más vista, que es la primera porque vienen ordenadas.
const mayor = filas.reduce((maximo, fila) => Math.max(maximo, fila.visitas), 1)
const barra = (visitas: number) => '█'.repeat(Math.max(1, Math.round((visitas / mayor) * 24)))

console.log(`\nVisitas de los últimos ${dias} días\n`)
console.log(`  ${'PÁGINA'.padEnd(ancho)}  ${'IDIOMA'}  ${'VISITAS'.padStart(7)}`)
console.log(`  ${'-'.repeat(ancho)}  ------  -------`)
for (const fila of filas) {
  const cifra = String(fila.visitas).padStart(7)
  console.log(
    `  ${fila.ruta.padEnd(ancho)}  ${fila.idioma.padEnd(6)}  ${cifra}  ${barra(fila.visitas)}`,
  )
}

const reparto = [...porIdioma.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([idioma, visitas]) => `${idioma} ${Math.round((visitas / total) * 100)}%`)
  .join(' · ')
console.log(`\n  ${total} visitas en ${filas.length} páginas  (${reparto})\n`)

if (enlaces.length > 0) {
  const anchoEnlace = Math.max(...enlaces.map((fila) => fila.ruta.length), 'PÁGINA'.length)
  console.log(`Enlaces compartidos en los últimos ${dias} días\n`)
  console.log(`  ${'PÁGINA'.padEnd(anchoEnlace)}  ${'VECES'.padStart(5)}`)
  console.log(`  ${'-'.repeat(anchoEnlace)}  -----`)
  for (const fila of enlaces) {
    console.log(`  ${fila.ruta.padEnd(anchoEnlace)}  ${String(fila.veces).padStart(5)}`)
  }
  // Conviene recordarlo cada vez: este número no se puede comparar con el de visitas.
  console.log(
    '\n  Son vistas previas de apps de mensajería: un piso de cuántas veces se pegó el enlace,\n' +
      '  no cuánta gente lo abrió.\n',
  )
}
