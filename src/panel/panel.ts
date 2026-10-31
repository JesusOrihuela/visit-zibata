/**
 * La mesa de edición del panel: resumen, sugerencias y contenido.
 *
 * El panel no es un dashboard genérico. Tiene cuatro tareas y una sola persona: mirar cómo va la
 * guía, atender lo que escribe la gente y editar negocios o categorías. El rail dice cuál está
 * abierta y el área de trabajo muestra una decisión por pantalla.
 *
 * Todo lo que se pinta viene de `/api/panel` y `/api/panel/contenido`, detrás de la misma puerta de
 * Cloudflare Access. Si la puerta no está puesta, el Worker responde 403 y aquí se dice con esas
 * palabras.
 */
import controls from '../styles/controls.module.css'
import {
  type EstadoContenido,
  montarContenido,
  mostrarContenido,
  ocultarContenido,
} from './contenido.ts'
import './panel.css'

interface Dia {
  fecha: string
  visitas: number
}

interface Pagina {
  ruta: string
  idioma: string
  visitas: number
}

interface Idioma {
  idioma: string
  visitas: number
}

interface Compartida {
  ruta: string
  veces: number
}

interface Guardado {
  lugar: string
  corazones: number
}

interface Calificado {
  lugar: string
  notas: number
}

interface Sugerencia {
  id: string
  creada: string
  quien: string
  lugar: string
  mensaje: string
  contacto: string
  atendida: number
}

interface Datos {
  dias: number
  desde: string
  resumen: Record<string, number>
  porDia: Dia[]
  porPagina: Pagina[]
  porIdioma: Idioma[]
  compartidas: Compartida[]
  guardados: Guardado[]
  calificados: Calificado[]
  sugerencias: Sugerencia[]
  sinAtender: number
}

type Vista = 'resumen' | 'sugerencias' | 'negocios' | 'categorias'
type Filtro = 'pendientes' | 'atendidas' | 'todas'

const vistaEl = document.getElementById('vista')
const dialogo = document.getElementById('editor') as HTMLDialogElement | null
const tituloEl = document.querySelector<HTMLElement>('[data-titulo]')
const antetituloEl = document.querySelector<HTMLElement>('[data-antetitulo]')
const accionesEl = document.querySelector<HTMLElement>('[data-acciones]')
const nav = [...document.querySelectorAll<HTMLButtonElement>('[data-vista]')]
const cuentaSugerencias = document.querySelector<HTMLElement>('[data-cuenta-sugerencias]')
const estadoRama = document.querySelector<HTMLElement>('[data-estado-rama]')
const enlacePr = document.querySelector<HTMLAnchorElement>('[data-enlace-pr]')

let datos: Datos | null = null
let dias = 30
let vista: Vista = 'resumen'
let filtro: Filtro = 'pendientes'

const texto = (valor: unknown): string =>
  String(valor ?? '').replace(
    /[&<>"']/g,
    (caracter) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter] ??
      caracter,
  )

const numero = (valor: unknown): string => new Intl.NumberFormat('es-MX').format(Number(valor ?? 0))

const fechaCorta = (iso: string): string => {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime())
    ? iso.slice(0, 10)
    : new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(fecha)
}

/** Una tabla de lectura. Sin barras decorativas: el número ya dice lo que hay. */
function tabla(
  columnas: { nombre: string; cifra?: boolean }[],
  filas: { celdas: { valor: string; cifra?: boolean }[] }[],
): string {
  if (filas.length === 0) return '<p class="vacio">Todavía no hay datos en este periodo.</p>'
  const encabezados = columnas
    .map((columna) => `<th${columna.cifra ? ' class="cifra"' : ''}>${texto(columna.nombre)}</th>`)
    .join('')
  const cuerpo = filas
    .map(
      (fila) =>
        `<tr>${fila.celdas
          .map((celda) => `<td${celda.cifra ? ' class="cifra"' : ''}>${texto(celda.valor)}</td>`)
          .join('')}</tr>`,
    )
    .join('')
  return `<div class="tabla"><table><thead><tr>${encabezados}</tr></thead><tbody>${cuerpo}</tbody></table></div>`
}

/** Las visitas por día, en barras. SVG dibujado a mano: son rectángulos sobre una escala lineal. */
function grafica(porDia: Dia[], ventana: number, desde: string, ancho: number): string {
  if (porDia.length === 0) {
    return '<p class="vacio">No hay visitas en este periodo. Prueba con una ventana más larga.</p>'
  }
  const conteo = new Map(porDia.map((dia) => [dia.fecha, dia.visitas]))
  const inicio = new Date(`${desde}T12:00:00Z`)
  // `ventana + 1` y no `ventana`: la consulta filtra por `fecha >= desde`, así que incluye el día
  // de corte y el de hoy.
  const serie = Array.from({ length: ventana + 1 }, (_, indice) => {
    const fecha = new Date(inicio.getTime() + indice * 86400000).toISOString().slice(0, 10)
    return { fecha, visitas: conteo.get(fecha) ?? 0 }
  })

  const margen = 24
  const alto = 180
  const mayor = Math.max(...serie.map((dia) => dia.visitas), 1)
  const paso = (ancho - margen * 2) / serie.length
  const grosor = Math.min(24, Math.max(1, paso - 2))
  const barras = serie
    .map((dia, indice) => {
      const altura = ((alto - margen * 2) * dia.visitas) / mayor
      const x = margen + indice * paso + (paso - grosor) / 2
      return `<rect x="${x.toFixed(1)}" y="${(alto - margen - altura).toFixed(1)}" width="${grosor.toFixed(1)}" height="${altura.toFixed(1)}" rx="1" fill="currentColor"><title>${texto(dia.fecha)}: ${numero(dia.visitas)}</title></rect>`
    })
    .join('')
  const primero = serie[0]?.fecha ?? ''
  const ultimo = serie[serie.length - 1]?.fecha ?? ''
  return `<svg class="grafica" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Visitas por día, máximo ${numero(mayor)}">
    <g>${barras}</g>
    <line x1="${margen}" y1="${alto - margen}" x2="${ancho - margen}" y2="${alto - margen}" stroke="currentColor" stroke-opacity="0.2" />
    <text x="${margen}" y="${alto - 6}" font-size="12" fill="currentColor" opacity="0.6">${texto(primero)}</text>
    <text x="${ancho - margen}" y="${alto - 6}" font-size="12" fill="currentColor" opacity="0.6" text-anchor="end">${texto(ultimo)}</text>
    <text x="${margen}" y="16" font-size="12" fill="currentColor" opacity="0.6">máximo ${numero(mayor)}</text>
  </svg>`
}

function repartoDeIdiomas(idiomas: Idioma[]): string {
  const nombres: Record<string, string> = { es: 'Español', en: 'Inglés' }
  const total = idiomas.reduce((suma, fila) => suma + fila.visitas, 0)
  return idiomas
    .map(
      (fila) =>
        `${nombres[fila.idioma] ?? fila.idioma} ${Math.round((fila.visitas / Math.max(1, total)) * 100)}%`,
    )
    .join(' · ')
}

function actualizarCuentaSugerencias(): void {
  if (!cuentaSugerencias) return
  const pendientes = datos?.sinAtender ?? 0
  cuentaSugerencias.textContent = numero(pendientes)
  cuentaSugerencias.hidden = pendientes === 0
}

function actualizarEstado(estado: EstadoContenido | null): void {
  if (!estadoRama || !enlacePr) return
  enlacePr.hidden = true
  if (!estado) {
    estadoRama.textContent = 'Contenido sin cargar'
    return
  }
  if (estado.seco) {
    estadoRama.textContent = 'Desarrollo: los cambios no se commitean'
    return
  }
  if (estado.pr) {
    estadoRama.textContent = 'Cambios listos para revisar'
    enlacePr.href = estado.pr.url
    enlacePr.textContent = `PR #${estado.pr.numero}`
    enlacePr.className = `${controls.enlace ?? ''} rail-enlace`
    enlacePr.hidden = false
    return
  }
  estadoRama.textContent = 'Rama limpia, sin PR abierta'
}

function cabeceraDe(vistaActual: Vista): { antetitulo: string; titulo: string } {
  switch (vistaActual) {
    case 'resumen':
      return { antetitulo: 'La guía', titulo: 'Resumen' }
    case 'sugerencias':
      return { antetitulo: 'Lo que escribe la gente', titulo: 'Sugerencias' }
    case 'negocios':
      return { antetitulo: 'Contenido', titulo: 'Negocios' }
    case 'categorias':
      return { antetitulo: 'Taxonomía', titulo: 'Categorías y giros' }
  }
}

function accionesDe(vistaActual: Vista): string {
  if (vistaActual !== 'resumen') return ''
  return `<div class="segmentado" role="group" aria-label="Ventana de tiempo">
    ${[7, 30, 90, 365]
      .map(
        (valor) =>
          `<button type="button" class="${controls.base} ${controls.pildora}" data-dias="${valor}" aria-pressed="${valor === dias}">${valor === 365 ? '1 año' : `${valor} días`}</button>`,
      )
      .join('')}
  </div>`
}

function pintarVista(): void {
  if (!vistaEl || !tituloEl || !antetituloEl) return
  const cabecera = cabeceraDe(vista)
  tituloEl.textContent = cabecera.titulo
  antetituloEl.textContent = cabecera.antetitulo
  if (accionesEl) accionesEl.innerHTML = accionesDe(vista)
  for (const boton of nav) {
    const activa = boton.dataset.vista === vista
    boton.toggleAttribute('aria-current', activa)
    if (activa) boton.setAttribute('aria-current', 'page')
  }
  actualizarCuentaSugerencias()

  if (vista === 'negocios' || vista === 'categorias') {
    mostrarContenido(vista)
    return
  }
  ocultarContenido()
  if (vista === 'sugerencias') pintarSugerencias()
  else pintarResumen()
}

function pintarResumen(): void {
  if (!vistaEl || !datos) return
  const r = datos.resumen ?? {}
  const idiomas = repartoDeIdiomas(datos.porIdioma ?? [])
  const ancho = Math.max(320, vistaEl.clientWidth || 920)
  vistaEl.innerHTML = `
    <section class="resumen">
      <div class="cifras">
        <div class="cifra-grande">
          <p class="rotulo">Visitas</p>
          <p class="dato">${numero(r.visitas)}</p>
          <p class="nota">${numero(datos.dias)} días · ${numero(r.paginas)} páginas vistas</p>
        </div>
        <div class="cifra-accion">
          <p class="rotulo">Sugerencias sin atender</p>
          <p class="dato">${numero(datos.sinAtender)}</p>
          <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-ir="sugerencias">Revisar</button>
        </div>
        <dl class="cifras-menores">
          <div><dt>Enlaces compartidos</dt><dd>${numero(r.comparticiones)}</dd></div>
          <div><dt>Cuentas</dt><dd>${numero(r.cuentas)}</dd></div>
          <div><dt>Corazones</dt><dd>${numero(r.corazones)}</dd></div>
          <div><dt>Calificaciones</dt><dd>${numero(r.notas)}</dd></div>
          <div><dt>Visitas marcadas</dt><dd>${numero(r.visitasMarcadas)}</dd></div>
        </dl>
      </div>

      <figure class="figura-grafica">
        <figcaption>
          <h2>Visitas por día</h2>
          <p>${texto(idiomas)}</p>
        </figcaption>
        ${grafica(datos.porDia ?? [], datos.dias ?? 30, datos.desde ?? '', ancho)}
      </figure>

      <div class="rejilla-dos">
        <section class="bloque">
          <h2>Páginas más abiertas</h2>
          ${tabla(
            [{ nombre: 'Página' }, { nombre: 'Idioma' }, { nombre: 'Visitas', cifra: true }],
            (datos.porPagina ?? []).map((fila) => ({
              celdas: [
                { valor: fila.ruta },
                { valor: fila.idioma },
                { valor: numero(fila.visitas), cifra: true },
              ],
            })),
          )}
        </section>
        <section class="bloque">
          <h2>Enlaces compartidos <span class="nota">vistas previas</span></h2>
          ${tabla(
            [{ nombre: 'Página' }, { nombre: 'Veces', cifra: true }],
            (datos.compartidas ?? []).map((fila) => ({
              celdas: [{ valor: fila.ruta }, { valor: numero(fila.veces), cifra: true }],
            })),
          )}
        </section>
      </div>

      <div class="rejilla-dos">
        <section class="bloque">
          <h2>Lugares más guardados</h2>
          ${tabla(
            [{ nombre: 'Lugar' }, { nombre: 'Corazones', cifra: true }],
            (datos.guardados ?? []).map((fila) => ({
              celdas: [{ valor: fila.lugar }, { valor: numero(fila.corazones), cifra: true }],
            })),
          )}
        </section>
        <section class="bloque">
          <h2>Lugares más calificados <span class="nota">cuántas notas, nunca el promedio</span></h2>
          ${tabla(
            [{ nombre: 'Lugar' }, { nombre: 'Notas', cifra: true }],
            (datos.calificados ?? []).map((fila) => ({
              celdas: [{ valor: fila.lugar }, { valor: numero(fila.notas), cifra: true }],
            })),
          )}
        </section>
      </div>
    </section>
  `
  vistaEl.setAttribute('aria-busy', 'false')
}

function pintarSugerencias(): void {
  if (!vistaEl || !datos) return
  const todas = datos.sugerencias ?? []
  const pendientes = todas.filter((fila) => fila.atendida === 0)
  const atendidas = todas.filter((fila) => fila.atendida === 1)
  const filas = filtro === 'pendientes' ? pendientes : filtro === 'atendidas' ? atendidas : todas
  const opcion = (clave: Filtro, etiqueta: string, cuenta: number) =>
    `<button type="button" class="${controls.base} ${controls.pildora}" data-filtro="${clave}" aria-pressed="${filtro === clave}">${etiqueta} <span class="${controls.cifra}">${numero(cuenta)}</span></button>`

  vistaEl.innerHTML = `
    <section class="sugerencias">
      <div class="segmentado" role="group" aria-label="Filtrar sugerencias">
        ${opcion('pendientes', 'Pendientes', pendientes.length)}
        ${opcion('atendidas', 'Atendidas', atendidas.length)}
        ${opcion('todas', 'Todas', todas.length)}
      </div>
      ${
        filas.length === 0
          ? `<p class="vacio">${filtro === 'pendientes' ? 'No queda nada por atender.' : 'No hay sugerencias en este filtro.'}</p>`
          : `<div class="cola-sugerencias">${filas
              .map((fila) => {
                const quien =
                  { vecino: 'Vecino', negocio: 'El negocio', otro: 'Otro' }[fila.quien] ??
                  fila.quien
                const cabecera = [fechaCorta(fila.creada), quien, fila.lugar]
                  .filter(Boolean)
                  .join(' · ')
                const contacto = fila.contacto
                  ? `<p class="solicitud-contacto">${texto(fila.contacto)}</p>`
                  : ''
                const accion =
                  fila.atendida === 0
                    ? `<button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-atender="${texto(fila.id)}">Marcar como atendida</button>`
                    : '<p class="hecha">Atendida</p>'
                return `<article class="solicitud" data-atendida="${fila.atendida === 1}">
                  <p class="solicitud-meta">${texto(cabecera)}</p>
                  <p class="solicitud-mensaje">${texto(fila.mensaje)}</p>
                  ${contacto}
                  ${accion}
                </article>`
              })
              .join('')}</div>`
      }
    </section>
  `
  vistaEl.setAttribute('aria-busy', 'false')
}

async function cargar(ventana = dias): Promise<void> {
  if (!vistaEl) return
  dias = ventana
  if (vista === 'resumen') {
    vistaEl.setAttribute('aria-busy', 'true')
    vistaEl.innerHTML = '<p class="estado">Cargando los números…</p>'
  }
  try {
    const respuesta = await fetch(`/api/panel?dias=${dias}`)
    if (respuesta.status === 403) {
      fallar(
        'Sin permiso. Falta la regla de Cloudflare Access delante de /panel y de /api/panel, o ' +
          'falta poner ACCESS_TEAM y ACCESS_AUD en wrangler.jsonc.',
      )
      return
    }
    if (respuesta.status === 503) {
      fallar('No hay base de datos enlazada a este Worker.')
      return
    }
    if (!respuesta.ok) {
      fallar(`El servidor respondió ${respuesta.status}.`)
      return
    }
    datos = (await respuesta.json()) as Datos
    actualizarCuentaSugerencias()
    pintarVista()
  } catch {
    fallar('No se pudo hablar con el servidor.')
  }
}

function fallar(mensaje: string): void {
  if (!vistaEl) return
  vistaEl.innerHTML = `<p class="estado">${texto(mensaje)}</p>`
  vistaEl.setAttribute('aria-busy', 'false')
}

async function atender(id: string, boton: HTMLButtonElement): Promise<void> {
  boton.disabled = true
  try {
    const respuesta = await fetch(`/api/panel/sugerencias/${id}`, { method: 'POST' })
    if (!respuesta.ok) throw new Error(String(respuesta.status))
    const { sinAtender } = (await respuesta.json()) as { sinAtender: number }
    const sugerencia = datos?.sugerencias.find((fila) => fila.id === id)
    if (sugerencia) sugerencia.atendida = 1
    if (datos) datos.sinAtender = sinAtender
    pintarSugerencias()
    actualizarCuentaSugerencias()
  } catch {
    boton.disabled = false
    boton.textContent = 'No se pudo. Reintentar'
  }
}

for (const boton of nav) {
  boton.addEventListener('click', () => {
    vista = (boton.dataset.vista as Vista | undefined) ?? 'resumen'
    pintarVista()
  })
}

vistaEl?.addEventListener('click', (evento) => {
  const objetivo = evento.target as HTMLElement | null
  if (!objetivo) return
  const ir = objetivo.closest<HTMLElement>('[data-ir]')
  if (ir?.dataset.ir) {
    vista = ir.dataset.ir as Vista
    pintarVista()
    return
  }
  const periodo = objetivo.closest<HTMLButtonElement>('[data-dias]')
  if (periodo?.dataset.dias) {
    void cargar(Number(periodo.dataset.dias))
    return
  }
  const filtroBoton = objetivo.closest<HTMLButtonElement>('[data-filtro]')
  if (filtroBoton?.dataset.filtro) {
    filtro = filtroBoton.dataset.filtro as Filtro
    pintarSugerencias()
    return
  }
  const atenderBoton = objetivo.closest<HTMLButtonElement>('[data-atender]')
  if (atenderBoton?.dataset.atender) {
    void atender(atenderBoton.dataset.atender, atenderBoton)
  }
})

if (vistaEl && dialogo) {
  montarContenido(vistaEl, dialogo, actualizarEstado)
}
actualizarEstado(null)
void cargar(30)
