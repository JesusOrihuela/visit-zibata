/**
 * Resumen de cuánto tarda cada archivo de pruebas E2E, en formato Markdown.
 *
 * Lo lee el CI del informe JSON de Playwright y lo escribe en el resumen del trabajo (`$GITHUB_STEP_SUMMARY`).
 * Sirve para repartir las pruebas entre los trabajos con datos del propio CI, que no coinciden con los del
 * ordenador de quien programa: un grupo que en local pesa lo mismo que otro puede tardar el doble en el runner.
 *
 * Uso: node scripts/ci/resumen-tiempos.ts [informe.json]
 */
import { existsSync, readFileSync } from 'node:fs'

interface Resultado {
  duration: number
}
interface Prueba {
  results?: Resultado[]
}
interface Especificacion {
  file: string
  tests?: Prueba[]
}
interface Suite {
  suites?: Suite[]
  specs?: Especificacion[]
}

const ruta = process.argv[2] ?? 'test-results/informe.json'
if (!existsSync(ruta)) {
  console.log(`Sin informe de tiempos (${ruta}): la ejecución terminó antes de escribirlo.`)
  process.exit(0)
}

const informe = JSON.parse(readFileSync(ruta, 'utf8')) as Suite

const msPorArchivo = new Map<string, number>()
const pruebasPorArchivo = new Map<string, number>()

function recorrer(suite: Suite): void {
  for (const especificacion of suite.specs ?? []) {
    for (const prueba of especificacion.tests ?? []) {
      // Con reintentos hay varios resultados: el tiempo gastado es la suma de todos.
      const ms = (prueba.results ?? []).reduce((total, resultado) => total + resultado.duration, 0)
      msPorArchivo.set(especificacion.file, (msPorArchivo.get(especificacion.file) ?? 0) + ms)
      pruebasPorArchivo.set(
        especificacion.file,
        (pruebasPorArchivo.get(especificacion.file) ?? 0) + 1,
      )
    }
  }
  for (const hija of suite.suites ?? []) recorrer(hija)
}
recorrer(informe)

const minutos = (ms: number) => (ms / 60_000).toFixed(1)
const filas = [...msPorArchivo].sort((a, b) => b[1] - a[1])
const total = filas.reduce((suma, [, ms]) => suma + ms, 0)

console.log('### Tiempo de prueba por archivo')
console.log('')
console.log(
  'Suma de lo que tardó cada prueba (con varios trabajadores en paralelo, el reloj corre menos que esto).',
)
console.log('')
console.log('| Archivo | Pruebas | Minutos |')
console.log('| --- | ---: | ---: |')
for (const [archivo, ms] of filas) {
  console.log(`| ${archivo} | ${pruebasPorArchivo.get(archivo) ?? 0} | ${minutos(ms)} |`)
}
console.log(
  `| **Total** | **${[...pruebasPorArchivo.values()].reduce((a, b) => a + b, 0)}** | **${minutos(total)}** |`,
)
