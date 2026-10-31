/**
 * Lo mínimo de la API de GitHub para guardar contenido desde el panel.
 *
 * El panel no escribe en producción ni en una base paralela: manda el cambio a una rama y abre una
 * pull request. El CI del repositorio valida y compila, y la persona que mantiene la guía fusiona.
 * Así el contenido pasa por las mismas puertas que cualquier otro cambio, y nada se publica sin que
 * alguien lo haya visto.
 *
 * La rama es una sola (`panel-contenido`) y la PR se acumula: varios guardados seguidos añaden
 * commits al mismo sitio. Cuando la PR se fusiona o se cierra, el siguiente guardado reinicia la
 * rama desde `main` y abre una PR nueva.
 *
 * La API se llama a mano y no con Octokit: son seis endpoints y una dependencia entera no aporta.
 */

/** Lo que el Worker necesita para hablar con GitHub. El testigo va como secreto, nunca en el repo. */
export interface EntornoGitHub {
  /** `dueno/repositorio`, por ejemplo `aurariola-studio/visit-zibata`. */
  GITHUB_REPO?: string
  /** Token de grano fino con contenidos y pull requests de escritura. */
  GITHUB_TOKEN?: string
  /** La rama donde se acumulan los cambios. Por omisión, `panel-contenido`. */
  GITHUB_RAMA?: string
}

export interface Archivo {
  ruta: string
  contenido: string
  /** Los JSON viajan como texto; las fotos, en base64. */
  codificacion?: 'utf-8' | 'base64'
}

export interface Publicacion {
  url: string
  numero: number
  /** `true` si esta publicación abrió la PR; `false` si solo añadió un commit a una abierta. */
  creada: boolean
}

const API = 'https://api.github.com'
const RAMA_POR_OMISION = 'panel-contenido'

/** La rama donde se acumulan los cambios del panel. */
export const ramaDe = (entorno: EntornoGitHub): string =>
  entorno.GITHUB_RAMA?.trim() || RAMA_POR_OMISION

const repoDe = (entorno: EntornoGitHub): { repo: string; dueno: string } => {
  const repo = entorno.GITHUB_REPO?.trim()
  const dueno = repo?.split('/')[0]
  if (!repo || !dueno || !repo.includes('/')) {
    throw new Error('falta GITHUB_REPO con la forma "dueno/repositorio"')
  }
  return { repo, dueno }
}

const faltaToken = (entorno: EntornoGitHub): boolean => !entorno.GITHUB_TOKEN?.trim()

/** La respuesta cruda de una llamada a la API. */
async function respuestaDe(
  entorno: EntornoGitHub,
  ruta: string,
  init: RequestInit = {},
): Promise<Response> {
  const { repo } = repoDe(entorno)
  const token = entorno.GITHUB_TOKEN?.trim()
  if (!token) throw new Error('falta GITHUB_TOKEN')
  const cabeceras = new Headers(init.headers)
  cabeceras.set('accept', 'application/vnd.github+json')
  cabeceras.set('authorization', `Bearer ${token}`)
  cabeceras.set('x-github-api-version', '2022-11-28')
  cabeceras.set('user-agent', 'visit-zibata-panel')
  if (init.body && !cabeceras.has('content-type')) {
    cabeceras.set('content-type', 'application/json')
  }
  return fetch(`${API}/repos/${repo}${ruta}`, { ...init, headers: cabeceras })
}

/** Una llamada a la API. Cualquier respuesta que no sea 2xx se convierte en un error con su texto. */
async function pedir<T>(entorno: EntornoGitHub, ruta: string, init: RequestInit = {}): Promise<T> {
  const respuesta = await respuestaDe(entorno, ruta, init)
  if (!respuesta.ok) {
    const detalle = await respuesta.text()
    throw new Error(`GitHub ${respuesta.status}: ${detalle.slice(0, 300)}`)
  }
  return (await respuesta.json()) as T
}

/** Como `pedir`, pero un 404 es un `null` en vez de un error. */
async function pedirOpcional<T>(
  entorno: EntornoGitHub,
  ruta: string,
  init: RequestInit = {},
): Promise<T | null> {
  const respuesta = await respuestaDe(entorno, ruta, init)
  if (respuesta.status === 404) return null
  if (!respuesta.ok) {
    const detalle = await respuesta.text()
    throw new Error(`GitHub ${respuesta.status}: ${detalle.slice(0, 300)}`)
  }
  return (await respuesta.json()) as T
}

/** Lee un archivo de una rama. Devuelve `null` si no existe. */
export async function leerArchivo(
  entorno: EntornoGitHub,
  ruta: string,
  ref: string,
): Promise<string | null> {
  const datos = await pedirOpcional<{ content?: string; encoding?: string }>(
    entorno,
    `/contents/${ruta}?ref=${encodeURIComponent(ref)}`,
  )
  if (!datos) return null
  if (datos.encoding !== 'base64' || !datos.content) {
    throw new Error(`GitHub devolvió ${ruta} sin contenido base64`)
  }
  const binario = atob(datos.content.replace(/\s/g, ''))
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** La PR abierta de la rama del panel, si la hay. */
export async function prAbierta(entorno: EntornoGitHub): Promise<Publicacion | null> {
  if (faltaToken(entorno)) return null
  const { dueno } = repoDe(entorno)
  const rama = ramaDe(entorno)
  const abiertas = await pedirOpcional<{ number: number; html_url: string }[]>(
    entorno,
    `/pulls?state=open&head=${encodeURIComponent(`${dueno}:${rama}`)}`,
  )
  const primera = abiertas?.[0]
  return primera ? { url: primera.html_url, numero: primera.number, creada: false } : null
}

/**
 * Commitea varios archivos en un solo commit y abre o reutiliza la PR.
 *
 * Se usa la API de datos y no la de contenidos para que los dos archivos entren juntos: `places.json`
 * y `plazas.json` tienen que cambiar a la vez, o el estado intermedio no valida.
 */
export async function publicar(
  entorno: EntornoGitHub,
  archivos: Archivo[],
  mensaje: string,
): Promise<Publicacion> {
  const rama = ramaDe(entorno)

  const principal = await pedir<{ object: { sha: string } }>(entorno, '/git/ref/heads/main')
  let cabeza = principal.object.sha
  const referencia = await pedirOpcional<{ object: { sha: string } }>(
    entorno,
    `/git/ref/heads/${rama}`,
  )
  if (referencia) cabeza = referencia.object.sha

  const abierta = await prAbierta(entorno)

  // Si la rama existe pero su PR ya se fusionó o se cerró, se reinicia desde main. Si no, el commit
  // nuevo arrastraría los cambios viejos y la PR aparecería con un diff que no es el de este guardado.
  if (referencia && !abierta) {
    await pedir(entorno, `/git/refs/heads/${rama}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: principal.object.sha, force: true }),
    })
    cabeza = principal.object.sha
  }

  const commitBase = await pedir<{ tree: { sha: string } }>(entorno, `/git/commits/${cabeza}`)

  const blobs = await Promise.all(
    archivos.map(async (archivo) => {
      const blob = await pedir<{ sha: string }>(entorno, '/git/blobs', {
        method: 'POST',
        body: JSON.stringify({
          content: archivo.contenido,
          encoding: archivo.codificacion ?? 'utf-8',
        }),
      })
      return { path: archivo.ruta, mode: '100644', type: 'blob', sha: blob.sha }
    }),
  )

  const arbol = await pedir<{ sha: string }>(entorno, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: commitBase.tree.sha, tree: blobs }),
  })

  const nuevo = await pedir<{ sha: string }>(entorno, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message: mensaje, tree: arbol.sha, parents: [cabeza] }),
  })

  if (referencia) {
    await pedir(entorno, `/git/refs/heads/${rama}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: nuevo.sha, force: true }),
    })
  } else {
    await pedir(entorno, '/git/refs', {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${rama}`, sha: nuevo.sha }),
    })
  }

  if (abierta) return abierta

  const pull = await pedir<{ number: number; html_url: string }>(entorno, '/pulls', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Contenido desde el panel',
      head: rama,
      base: 'main',
      body:
        'Cambios hechos desde el panel privado. Revisa el diff y fusiona cuando el CI esté en verde.\n\n' +
        'Cada guardado añade un commit a esta misma rama mientras la PR siga abierta.',
    }),
  })
  return { url: pull.html_url, numero: pull.number, creada: true }
}

/** El nombre del repositorio y la rama, para mostrarlos en el panel. */
export function destino(entorno: EntornoGitHub): { repo: string; rama: string } | null {
  const repo = entorno.GITHUB_REPO?.trim()
  if (!repo) return null
  return { repo, rama: ramaDe(entorno) }
}
