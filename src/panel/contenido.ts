/**
 * El editor de contenido del panel: negocios, categorías y giros de la guía.
 *
 * Es TypeScript sin framework, igual que el resto del panel. La página importa el mismo paquete de
 * controles que la guía, y aquí solo se compone: los campos, los botones y los estados salen del
 * catálogo, no se dibujan otra vez.
 *
 * La lista es una tabla con búsqueda y páginas; el formulario se abre en el diálogo de
 * `panel.html` y guarda con un pie fijo, para que la acción no se pierda al bajar por el horario.
 *
 * Lo que se guarda no va a producción: el Worker valida y manda el cambio a una rama con PR. El
 * panel enseña el enlace de esa PR en el rail. En desarrollo, sin testigo de GitHub, valida y avisa
 * de que no se commitea, para poder probar el formulario sin credenciales.
 *
 * Las categorías no se editan aisladas: sus giros los usan los locales, los filtros se ordenan por
 * `order` y las plazas guardan una lista derivada. El formulario enseña a cuántos locales afecta
 * antes de guardar.
 */
import { ICONOS } from '../data/iconos.ts'
import { assetUrl } from '../lib/assets.ts'
import controls from '../styles/controls.module.css'

interface Giro {
  id: string
  label: { es: string; en?: string }
  icon: string
  synonyms: string[]
  general?: boolean
}

interface Categoria {
  id: string
  slug: { es: string; en: string }
  label: { es: string; en?: string }
  icon: string
  hue?: number
  order: number
  synonyms: string[]
  giros: Giro[]
}

interface PlazaResumen {
  id: string
  name: string
  active: boolean
  comingSoon?: boolean
}

interface Foto {
  src: string
  alt: string
  width?: number
  height?: number
  variants?: number[]
  placeholder?: string
  credit?: string
}

interface Cierre {
  motivo: 'remodelacion' | 'vacaciones' | 'traspaso'
  desde: string
}

interface Negocio {
  id: string
  slug: string
  name: string
  plazaId: string
  giros: string[]
  secundarios: string[]
  description: { es: string; en?: string } | null
  hours: Record<string, string[]> | null
  location: { lat: number; lng: number } | null
  googleMapsUri: string | null
  phone: string | null
  links: Record<string, string | null>
  photos: Foto[]
  cierre?: Cierre
  active: boolean
}

interface Datos {
  ref: string
  seco: boolean
  pr: { url: string; numero: number } | null
  categories: Categoria[]
  plazas: PlazaResumen[]
  places: Negocio[]
}

/** Lo que el rail necesita saber de la rama del contenido. */
export interface EstadoContenido {
  seco: boolean
  pr: { url: string; numero: number } | null
}

export type ModoContenido = 'negocios' | 'categorias'

interface GiroElegido {
  id: string
  rol: 'principal' | 'secundario'
}

interface FormularioAbierto {
  id: string
  nombre: string
  seleccion: GiroElegido[]
  fotos: Foto[]
  sucio: boolean
  consultaGiro: string
}

const DIAS: [string, string][] = [
  ['mon', 'Lunes'],
  ['tue', 'Martes'],
  ['wed', 'Miércoles'],
  ['thu', 'Jueves'],
  ['fri', 'Viernes'],
  ['sat', 'Sábado'],
  ['sun', 'Domingo'],
]

const MOTIVOS: [Cierre['motivo'], string][] = [
  ['remodelacion', 'Remodelación u obra'],
  ['vacaciones', 'Vacaciones'],
  ['traspaso', 'Cambio de dueño'],
]

/** Con 103 locales, veinte por página dejan la lista legible sin convertirla en un archivo. */
const POR_PAGINA = 20
/** El mismo tope que valida el Worker para una foto ya reducida. */
const TOPE_FOTO = 4 * 1024 * 1024
/** El lado mayor de una foto. El original se reduce en el navegador antes de salir. */
const LADO_FOTO = 1600

const texto = (valor: unknown): string =>
  String(valor ?? '').replace(
    /[&<>"']/g,
    (caracter) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter] ??
      caracter,
  )

const numero = (valor: number): string => new Intl.NumberFormat('es-MX').format(valor)

const normalizar = (valor: string): string =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/** El mismo día que usa el Worker: Zibatá, no Greenwich. */
const hoy = (): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date())

let raiz: HTMLElement | null = null
let dialogo: HTMLDialogElement | null = null
let avisarEstado: ((estado: EstadoContenido | null) => void) | null = null
let datos: Datos | null = null
let modo: ModoContenido = 'negocios'
let consulta = ''
let pagina = 0
let aviso: string | null = null
let error: string | null = null
let visible = false
let cargando = false
let formularioActual: FormularioAbierto | null = null
let subiendoFoto = false

/** Monta el editor entre el contenedor de la vista y el diálogo que ya están en `panel.html`. */
export function montarContenido(
  contenedor: HTMLElement,
  editor: HTMLDialogElement,
  alCambiarEstado: (estado: EstadoContenido | null) => void,
): void {
  raiz = contenedor
  dialogo = editor
  avisarEstado = alCambiarEstado

  const cerrar = dialogo.querySelector<HTMLElement>('[data-editor-cerrar]')
  if (cerrar) {
    cerrar.className = `editor-cerrar ${controls.base} ${controls.boton} ${controls.fantasma}`
  }

  contenedor.addEventListener('click', alPulsar)
  contenedor.addEventListener('input', alEscribir)
  editor.addEventListener('submit', alEnviar)
  editor.addEventListener('click', alPulsarEditor)
  editor.addEventListener('input', alEscribirEditor)
  editor.addEventListener('change', alCambiarEditor)
  editor.addEventListener('cancel', (evento) => {
    if (!puedeCerrar()) evento.preventDefault()
  })
  // Al cerrar, el foco vuelve a la vista y el formulario deja de existir.
  editor.addEventListener('close', () => {
    formularioActual = null
    contenedor.focus({ preventScroll: true })
  })

  void cargar()
}

/** La vista de contenido se acaba de abrir. */
export function mostrarContenido(cual: ModoContenido): void {
  visible = true
  if (modo !== cual) {
    modo = cual
    consulta = ''
    pagina = 0
    aviso = null
  }
  pintarLista()
  if (!datos && !cargando) void cargar()
}

/** Se cambió a otra sección del panel: el diálogo no puede quedarse abierto encima. */
export function ocultarContenido(): void {
  visible = false
  if (dialogo?.open) cerrarEditor(true)
}

function estadoDeLaRama(): EstadoContenido | null {
  if (!datos) return null
  return { seco: datos.seco, pr: datos.pr }
}

async function cargar(): Promise<void> {
  if (cargando) return
  cargando = true
  error = null
  if (visible) pintarLista()
  try {
    const respuesta = await fetch('/api/panel/contenido')
    if (respuesta.status === 403) {
      throw new Error('Sin permiso. Revisa la regla de Cloudflare Access de /api/panel.')
    }
    if (respuesta.status === 503) throw new Error('El Worker no tiene configurado GITHUB_TOKEN.')
    if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`)
    datos = (await respuesta.json()) as Datos
    avisarEstado?.(estadoDeLaRama())
  } catch (causa) {
    error = causa instanceof Error ? causa.message : 'No se pudo cargar el contenido.'
    avisarEstado?.(null)
  } finally {
    cargando = false
    if (visible) pintarLista()
  }
}

function mapaDeGiros(): Map<string, string> {
  return new Map(
    (datos?.categories ?? []).flatMap((categoria) =>
      categoria.giros.map((giro) => [giro.id, giro.label.es] as const),
    ),
  )
}

function mapaDePlazas(): Map<string, string> {
  return new Map((datos?.plazas ?? []).map((plaza) => [plaza.id, plaza.name] as const))
}

/** La categoría de cada giro, para enseñarla junto al nombre en el selector. */
function categoriaDeGiro(id: string): string {
  return (
    datos?.categories.find((categoria) => categoria.giros.some((giro) => giro.id === id))?.label
      .es ?? ''
  )
}

function pintarLista(): void {
  if (!raiz) return
  if (error) {
    raiz.innerHTML = `<p class="estado">${texto(error)}</p>`
    raiz.setAttribute('aria-busy', 'false')
    return
  }
  if (!datos) {
    raiz.innerHTML = '<p class="estado">Cargando contenido…</p>'
    raiz.setAttribute('aria-busy', 'true')
    return
  }
  raiz.setAttribute('aria-busy', 'false')
  if (modo === 'categorias') pintarCategorias()
  else pintarNegocios()
}

function paginacion(total: number, etiqueta: string): string {
  if (total <= POR_PAGINA) return ''
  const desde = pagina * POR_PAGINA + 1
  const hasta = Math.min(total, (pagina + 1) * POR_PAGINA)
  const boton = (destino: string, rotulo: string, activo: boolean) =>
    `<button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-pagina="${destino}"${activo ? '' : ' disabled'}>${rotulo}</button>`
  return `<nav class="paginacion" aria-label="Páginas de ${texto(etiqueta)}">
    ${boton('anterior', 'Anterior', pagina > 0)}
    <p>${numero(desde)} a ${numero(hasta)} de ${numero(total)}</p>
    ${boton('siguiente', 'Siguiente', hasta < total)}
  </nav>`
}

/* ------------------------------------------------------------------ negocios */

function estadoDelNegocio(negocio: Negocio): { rotulo: string; marca: string; nota: string } {
  if (!negocio.active) return { rotulo: 'Oculto', marca: 'no', nota: 'No se publica' }
  if (negocio.cierre) {
    const motivo = MOTIVOS.find(([clave]) => clave === negocio.cierre?.motivo)?.[1] ?? ''
    return {
      rotulo: 'Cerrado temporalmente',
      marca: 'cierre',
      nota: `${motivo} · desde el ${negocio.cierre.desde}`,
    }
  }
  return { rotulo: 'Visible', marca: 'si', nota: '' }
}

function pintarNegocios(): void {
  if (!raiz || !datos) return
  const ocultos = datos.places.filter((negocio) => !negocio.active).length
  const cerrados = datos.places.filter((negocio) => negocio.active && negocio.cierre).length
  raiz.innerHTML = `
    <div class="barra-contenido">
      <input class="${controls.campo} buscar" type="search" placeholder="Buscar por nombre, plaza o giro" aria-label="Buscar negocio" value="${texto(consulta)}" data-buscar />
      <button type="button" class="${controls.base} ${controls.boton} ${controls.principal}" data-nuevo>Nuevo negocio</button>
    </div>
    <p class="meta-contenido">${numero(datos.places.length)} negocios · ${numero(ocultos)} ocultos · ${numero(cerrados)} cerrados temporalmente</p>
    ${aviso ? `<p class="aviso-contenido" role="status">${texto(aviso)}</p>` : ''}
    <div data-zona-tabla></div>
  `
  pintarZonaNegocios()
}

function pintarZonaNegocios(): void {
  const zona = raiz?.querySelector<HTMLElement>('[data-zona-tabla]')
  if (!zona || !datos) return
  const plazas = mapaDePlazas()
  const giros = mapaDeGiros()
  const buscado = normalizar(consulta)
  const filas = datos.places
    .filter((negocio) => {
      if (!buscado) return true
      return normalizar(
        [
          negocio.name,
          plazas.get(negocio.plazaId) ?? '',
          ...negocio.giros.map((giro) => giros.get(giro) ?? giro),
          ...negocio.secundarios.map((giro) => giros.get(giro) ?? giro),
        ].join(' '),
      ).includes(buscado)
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  if (filas.length === 0) {
    zona.innerHTML = '<p class="vacio">Ningún negocio coincide.</p>'
    return
  }

  const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA))
  if (pagina >= paginas) pagina = paginas - 1
  const visibles = filas.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA)

  const cuerpo = visibles
    .map((negocio) => {
      const donde = plazas.get(negocio.plazaId) ?? negocio.plazaId
      const que = negocio.giros.map((giro) => giros.get(giro) ?? giro).join(', ')
      const estado = estadoDelNegocio(negocio)
      return `<tr>
        <td><span class="negocio-nombre">${texto(negocio.name)}</span></td>
        <td class="tenue col-plaza">${texto(donde)}</td>
        <td class="tenue col-giros">${texto(que)}</td>
        <td><span class="marca-estado" data-activo="${estado.marca}" title="${texto(estado.nota)}">${texto(estado.rotulo)}</span></td>
        <td class="accion"><button type="button" class="${controls.base} ${controls.boton} ${controls.fantasma}" data-editar="${texto(negocio.id)}" aria-label="Editar ${texto(negocio.name)}">Editar</button></td>
      </tr>`
    })
    .join('')

  zona.innerHTML = `<div class="tabla"><table>
    <thead><tr>
      <th>Negocio</th>
      <th class="col-plaza">Plaza</th>
      <th class="col-giros">Giros</th>
      <th>Estado</th>
      <th class="accion"><span class="visualmente">Acciones</span></th>
    </tr></thead>
    <tbody>${cuerpo}</tbody>
  </table></div>
  ${paginacion(filas.length, 'negocios')}`
}

/* ------------------------------------------------------------------ categorías */

function pintarCategorias(): void {
  if (!raiz || !datos) return
  const giros = datos.categories.reduce((suma, categoria) => suma + categoria.giros.length, 0)
  raiz.innerHTML = `
    <div class="barra-contenido">
      <input class="${controls.campo} buscar" type="search" placeholder="Buscar categoría o giro" aria-label="Buscar categoría" value="${texto(consulta)}" data-buscar />
      <button type="button" class="${controls.base} ${controls.boton} ${controls.principal}" data-nueva-categoria>Nueva categoría</button>
    </div>
    <p class="meta-contenido">${numero(datos.categories.length)} categorías · ${numero(giros)} giros</p>
    ${aviso ? `<p class="aviso-contenido" role="status">${texto(aviso)}</p>` : ''}
    <div data-zona-tabla></div>
  `
  pintarZonaCategorias()
}

function pintarZonaCategorias(): void {
  const zona = raiz?.querySelector<HTMLElement>('[data-zona-tabla]')
  if (!zona || !datos) return
  const buscado = normalizar(consulta)
  const filas = datos.categories
    .filter((categoria) => {
      if (!buscado) return true
      return normalizar(
        [
          categoria.label.es,
          categoria.label.en ?? '',
          ...categoria.synonyms,
          ...categoria.giros.flatMap((giro) => [giro.label.es, giro.label.en ?? '']),
        ].join(' '),
      ).includes(buscado)
    })
    .sort((a, b) => a.order - b.order || a.label.es.localeCompare(b.label.es, 'es'))

  if (filas.length === 0) {
    zona.innerHTML = '<p class="vacio">Ninguna categoría coincide.</p>'
    return
  }

  const cuerpo = filas
    .map((categoria) => {
      const locales = localesVisibles(categoria.giros.map((giro) => giro.id)).length
      return `<tr>
        <td><span class="tono" data-tono="${categoria.hue ?? ''}" aria-hidden="true"></span></td>
        <td>
          <span class="negocio-nombre">${texto(categoria.label.es)}</span>
          ${locales === 0 ? '<span class="nota-tabla">sin página</span>' : ''}
        </td>
        <td class="cifra col-giros">${numero(categoria.giros.length)}</td>
        <td class="cifra">${numero(locales)}</td>
        <td class="cifra col-orden">${numero(categoria.order)}</td>
        <td class="accion"><button type="button" class="${controls.base} ${controls.boton} ${controls.fantasma}" data-editar-categoria="${texto(categoria.id)}" aria-label="Editar ${texto(categoria.label.es)}">Editar</button></td>
      </tr>`
    })
    .join('')

  zona.innerHTML = `<div class="tabla"><table>
    <thead><tr>
      <th><span class="visualmente">Tono</span></th>
      <th>Categoría</th>
      <th class="cifra col-giros">Giros</th>
      <th class="cifra">Locales</th>
      <th class="cifra col-orden">Orden</th>
      <th class="accion"><span class="visualmente">Acciones</span></th>
    </tr></thead>
    <tbody>${cuerpo}</tbody>
  </table></div>
  <p class="meta-contenido">Los locales cuentan solo si están visibles y su plaza está activa. Una categoría sin locales no publica página.</p>`
  pintarTonos()
}

function pintarTonos(): void {
  for (const punto of raiz?.querySelectorAll<HTMLElement>('[data-tono]') ?? []) {
    const hue = punto.dataset.tono
    punto.style.background = hue ? `hsl(${hue} 34% 92%)` : 'var(--color-border)'
    punto.style.boxShadow = hue ? `inset 0 0 0 1px hsl(${hue} 38% 33% / 0.35)` : 'none'
  }
}

const sinonimosDe = (valor: string): string[] => [
  ...new Set(
    valor
      .split(',')
      .map((parte) => parte.trim())
      .filter(Boolean),
  ),
]

function localesDeGiros(giros: Iterable<string>): Negocio[] {
  const buscados = new Set(giros)
  return (datos?.places ?? []).filter((negocio) =>
    [...negocio.giros, ...negocio.secundarios].some((giro) => buscados.has(giro)),
  )
}

const esVisible = (negocio: Negocio): boolean =>
  negocio.active && (datos?.plazas.find((plaza) => plaza.id === negocio.plazaId)?.active ?? false)

/** Los locales que de verdad salen en la guía: activos y en una plaza activa. */
const localesVisibles = (giros: Iterable<string>): Negocio[] =>
  localesDeGiros(giros).filter(esVisible)

/** Iconos que ya usa un giro no general, para no ofrecer el mismo dibujo dos veces. */
function iconosUsados(excepto = ''): Set<string> {
  const usados = new Set<string>()
  for (const categoria of datos?.categories ?? []) {
    for (const giro of categoria.giros) {
      if (giro.general || giro.id === excepto) continue
      usados.add(giro.icon)
    }
  }
  return usados
}

function opcionesDeIconos(seleccionado: string, usados: Set<string>): string {
  return ICONOS.map((icono) => {
    const bloqueado = usados.has(icono) && icono !== seleccionado
    return `<option value="${icono}"${icono === seleccionado ? ' selected' : ''}${bloqueado ? ' disabled' : ''}>${icono}${bloqueado ? ' (en uso)' : ''}</option>`
  }).join('')
}

function opcionesDeCategorias(seleccionada: string): string {
  return (datos?.categories ?? [])
    .map(
      (categoria) =>
        `<option value="${texto(categoria.id)}"${categoria.id === seleccionada ? ' selected' : ''}>${texto(categoria.label.es)}</option>`,
    )
    .join('')
}

/* ------------------------------------------------------------------ el diálogo */

function abrirEditor(antetitulo: string, titulo: string, html: string): void {
  if (!dialogo) return
  const campoAntetitulo = dialogo.querySelector<HTMLElement>('[data-editor-antetitulo]')
  const campoTitulo = dialogo.querySelector<HTMLElement>('[data-editor-titulo]')
  const cuerpo = dialogo.querySelector<HTMLElement>('[data-editor-cuerpo]')
  if (!cuerpo) return
  if (campoAntetitulo) campoAntetitulo.textContent = antetitulo
  if (campoTitulo) campoTitulo.textContent = titulo
  cuerpo.innerHTML = html
  aviso = null
  if (!dialogo.open) dialogo.showModal()
  cuerpo.querySelector<HTMLElement>('input, select, textarea')?.focus()
}

/** Cierra el diálogo. Con cambios sin guardar pide confirmación salvo que se fuerce. */
function cerrarEditor(forzar = false): void {
  if (!dialogo?.open) return
  if (!forzar && formularioActual?.sucio) {
    if (!confirm('Hay cambios sin guardar. ¿Cerrar de todas formas?')) return
  }
  dialogo.close()
}

function puedeCerrar(): boolean {
  return !formularioActual?.sucio || confirm('Hay cambios sin guardar. ¿Cerrar de todas formas?')
}

function pintarCategoria(categoria: Categoria | null): void {
  if (!datos) return
  formularioActual = null
  modo = 'categorias'
  const siguienteOrden = Math.max(0, ...datos.categories.map((fila) => fila.order)) + 10
  const base: Categoria = categoria ?? {
    id: '',
    slug: { es: '', en: '' },
    label: { es: '', en: '' },
    icon: ICONOS[0],
    order: siguienteOrden,
    synonyms: [],
    giros: [],
  }
  const esNueva = !categoria
  const giros = categoria?.giros ?? [
    {
      id: '',
      label: { es: '', en: '' },
      icon: base.icon,
      synonyms: [],
      general: true,
    },
  ]
  const locales = localesVisibles(giros.map((giro) => giro.id))
  const plazas = new Set(locales.map((negocio) => negocio.plazaId))
  const impacto =
    locales.length === 0
      ? 'Esta categoría no tiene locales; su página no se publica hasta que tenga alguno.'
      : `${numero(locales.length)} locales en ${numero(plazas.size)} plazas están en esta categoría. Al guardar se actualizan los filtros, el buscador y las páginas; si mueves un giro, cambian solo los locales de ese giro.`

  abrirEditor(
    'Taxonomía',
    esNueva ? 'Nueva categoría' : `Editar ${base.label.es}`,
    `<form data-editor="categoria" data-id="${texto(categoria?.id ?? '')}" novalidate>
      <section class="editor-seccion">
        <h3>Identidad</h3>
        <div class="editor-rejilla">
          <label class="campo-form">
            <span>Nombre en español</span>
            <input class="${controls.campo}" type="text" data-campo="labelEs" value="${texto(base.label.es)}" maxlength="80" required />
          </label>
          <label class="campo-form">
            <span>Nombre en inglés</span>
            <input class="${controls.campo}" type="text" data-campo="labelEn" value="${texto(base.label.en ?? '')}" maxlength="80" required />
          </label>
          <label class="campo-form">
            <span>Icono</span>
            <select class="campo-select" data-campo="icon">${opcionesDeIconos(base.icon, new Set())}</select>
          </label>
          <label class="campo-form">
            <span>Tono <span class="ayuda">0 a 359; vacío solo para Otros</span></span>
            <span class="campo-tono">
              <input class="${controls.campo}" type="number" data-campo="hue" min="0" max="359" value="${base.hue ?? ''}" placeholder="200" />
              <span class="tono-preview" data-tono-preview aria-hidden="true"></span>
            </span>
          </label>
          <label class="campo-form">
            <span>Orden</span>
            <input class="${controls.campo}" type="number" data-campo="order" min="0" max="999" value="${base.order}" required />
          </label>
          <label class="campo-form">
            <span>Sinónimos <span class="ayuda">separados por comas</span></span>
            <input class="${controls.campo}" type="text" data-campo="synonyms" value="${texto(base.synonyms.join(', '))}" />
          </label>
        </div>
      </section>

      <section class="editor-seccion">
        <h3>Giros <span class="nota">la categoría de un local sale de aquí</span></h3>
        <div class="giros-categoria" data-giros>
          ${giros.map((giro, indice) => filaDeGiroFormulario(giro, base, indice, esNueva)).join('')}
        </div>
        <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-anadir-giro>Añadir giro</button>
      </section>

      <p class="impacto-contenido" data-impacto>${texto(impacto)}</p>

      <footer class="editor-pie">
        <div class="problemas" data-problemas role="alert"></div>
        <div class="acciones">
          <button type="submit" class="${controls.base} ${controls.boton} ${controls.principal}">${esNueva ? 'Crear categoría' : 'Guardar cambios'}</button>
          <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-cancelar>Cancelar</button>
        </div>
      </footer>
    </form>`,
  )
  pintarTonosEnDialogo()
  actualizarTonoPreview()
}

function filaDeGiroFormulario(
  giro: Giro,
  categoria: Categoria,
  indice: number,
  esNueva: boolean,
): string {
  const general = giro.general === true
  const usados = iconosUsados(giro.id)
  const locales = giro.id ? localesVisibles([giro.id]).length : 0
  const destino = esNueva ? '' : categoria.id
  return `<div class="giro-ficha" data-giro data-id="${texto(giro.id)}" data-general="${String(general)}">
    <div class="giro-cabecera">
      <h4>Giro ${indice + 1}</h4>
      ${general ? '<span class="marca-general">General</span>' : ''}
      <span class="meta">${numero(locales)} locales</span>
    </div>
    <div class="giro-campos">
      <label class="campo-form"><span>Nombre en español</span><input class="${controls.campo}" type="text" data-campo="giroLabelEs" value="${texto(giro.label.es)}" maxlength="80" /></label>
      <label class="campo-form"><span>Nombre en inglés</span><input class="${controls.campo}" type="text" data-campo="giroLabelEn" value="${texto(giro.label.en ?? '')}" maxlength="80" /></label>
      <label class="campo-form"><span>Icono</span><select class="campo-select" data-campo="giroIcon"${general ? ' disabled' : ''}>${opcionesDeIconos(giro.icon, usados)}</select></label>
      <label class="campo-form"><span>Sinónimos</span><input class="${controls.campo}" type="text" data-campo="giroSynonyms" value="${texto(giro.synonyms.join(', '))}" /></label>
      ${
        esNueva
          ? ''
          : `<label class="campo-form"><span>Categoría</span><select class="campo-select" data-campo="destino"${general ? ' disabled' : ''}>${opcionesDeCategorias(destino)}</select></label>`
      }
    </div>
  </div>`
}

function pintarTonosEnDialogo(): void {
  for (const punto of dialogo?.querySelectorAll<HTMLElement>('[data-tono]') ?? []) {
    const hue = punto.dataset.tono
    punto.style.background = hue ? `hsl(${hue} 34% 92%)` : 'var(--color-border)'
    punto.style.boxShadow = hue ? `inset 0 0 0 1px hsl(${hue} 38% 33% / 0.35)` : 'none'
  }
}

function actualizarTonoPreview(): void {
  const punto = dialogo?.querySelector<HTMLElement>('[data-tono-preview]')
  if (!punto) return
  const hue = dialogo?.querySelector<HTMLInputElement>('[data-campo="hue"]')?.value ?? ''
  punto.style.background = hue ? `hsl(${hue} 34% 92%)` : 'var(--color-border)'
  punto.style.boxShadow = hue ? `inset 0 0 0 1px hsl(${hue} 38% 33% / 0.35)` : 'none'
}

function anadirGiroDeCategoria(): void {
  const contenedor = dialogo?.querySelector<HTMLElement>('[data-giros]')
  const formulario = dialogo?.querySelector<HTMLFormElement>('form[data-editor="categoria"]')
  if (!contenedor || !formulario) return
  const usados = iconosUsados()
  const libre = ICONOS.find((icono) => !usados.has(icono)) ?? ICONOS[0]
  const categoria = {
    id: formulario.dataset.id ?? '',
    slug: { es: '', en: '' },
    label: { es: '', en: '' },
    icon: formulario.querySelector<HTMLSelectElement>('[data-campo="icon"]')?.value ?? libre,
    order: 0,
    synonyms: [],
    giros: [],
  } as Categoria
  const indice = contenedor.querySelectorAll('[data-giro]').length
  contenedor.insertAdjacentHTML(
    'beforeend',
    filaDeGiroFormulario(
      { id: '', label: { es: '', en: '' }, icon: libre, synonyms: [] },
      categoria,
      indice,
      !formulario.dataset.id,
    ),
  )
  contenedor.querySelector<HTMLElement>('[data-giro]:last-of-type input')?.focus()
}

/* ------------------------------------------------------------------ el formulario de negocio */

function pintarFormulario(negocio: Negocio | null): void {
  if (!datos) return
  formularioActual = {
    id: negocio?.id ?? '',
    nombre: negocio?.name ?? '',
    seleccion: [
      ...(negocio?.giros ?? []).map((id) => ({ id, rol: 'principal' as const })),
      ...(negocio?.secundarios ?? []).map((id) => ({ id, rol: 'secundario' as const })),
    ],
    fotos: (negocio?.photos ?? []).map((foto) => ({ ...foto })),
    sucio: false,
    consultaGiro: '',
  }

  const plazas = datos.plazas
    .map(
      (plaza) =>
        `<option value="${texto(plaza.id)}"${plaza.id === negocio?.plazaId ? ' selected' : ''}>${texto(plaza.name)}${plaza.active ? '' : ' (inactiva)'}</option>`,
    )
    .join('')
  const motivos = MOTIVOS.map(
    ([clave, rotulo]) =>
      `<option value="${clave}"${negocio?.cierre?.motivo === clave ? ' selected' : ''}>${rotulo}</option>`,
  ).join('')
  const cierreDesde = negocio?.cierre?.desde ?? hoy()

  abrirEditor(
    'Contenido',
    negocio ? negocio.name : 'Nuevo negocio',
    `<form data-editor="negocio" data-id="${texto(negocio?.id ?? '')}" novalidate>
      <section class="editor-seccion">
        <h3>Identidad</h3>
        <div class="editor-rejilla">
          <label class="campo-form campo-ancho">
            <span class="campo-etiqueta"><span>Nombre</span> <span class="ayuda" data-contador-nombre></span></span>
            <input class="${controls.campo}" type="text" name="nombre" value="${texto(negocio?.name ?? '')}" maxlength="160" required />
            <span class="ayuda">Es el título de la ficha. El de la página añade la zona y el tope son 60 caracteres.</span>
          </label>
          <label class="campo-form">
            <span>Plaza</span>
            <select class="campo-select" name="plazaId" required>
              <option value="">Elige una plaza</option>
              ${plazas}
            </select>
            <span class="ayuda">Al cambiar de plaza, el local se añade al final del orden.</span>
            <span class="ayuda" data-plaza-aviso></span>
          </label>
        </div>
      </section>

      <section class="editor-seccion">
        <h3>Estado en la guía</h3>
        <div class="editor-rejilla">
          <div class="campo-form">
            <span>Visibilidad</span>
            <label class="casilla"><input type="checkbox" name="activo"${negocio?.active === false ? '' : ' checked'} /><span>Visible en la guía</span></label>
            <span class="ayuda">Oculto sale de listas, buscador y sitemap; su ficha y su enlace directo dejan de existir. Se conservan sus datos.</span>
          </div>
          <div class="campo-form" data-grupo="cierre">
            <span>Cierre temporal</span>
            <label class="casilla"><input type="checkbox" name="cierreActivo"${negocio?.cierre ? ' checked' : ''} /><span>Cerrado temporalmente</span></label>
            <span class="ayuda">Sigue en la guía y se avisa de que hoy no abre. No es lo mismo que ocultarlo.</span>
          </div>
          <div class="editor-rejilla campo-ancho cierre-campos" data-cierre-campos${negocio?.cierre ? '' : ' hidden'}>
            <label class="campo-form">
              <span>Motivo</span>
              <select class="campo-select" name="cierreMotivo">${motivos}</select>
            </label>
            <label class="campo-form">
              <span>Desde</span>
              <input class="${controls.campo}" type="date" name="cierreDesde" max="${hoy()}" value="${texto(cierreDesde)}" />
            </label>
          </div>
        </div>
      </section>

      <section class="editor-seccion">
        <h3>Giros <span class="nota">el primero manda</span></h3>
        <p class="ayuda">El primero decide el icono de la ficha y la prioridad del buscador. Los secundarios salen como texto y se buscan igual.</p>
        <div data-giros-zona data-grupo="giros"></div>
      </section>

      <section class="editor-seccion">
        <h3>Descripción</h3>
        <div class="editor-rejilla">
          <label class="campo-form campo-ancho">
            <span class="campo-etiqueta"><span>Español</span> <span class="ayuda" data-contador-es></span></span>
            <textarea class="${controls.campo} ${controls.areaTexto}" name="descripcionEs" rows="3" maxlength="2000" required>${texto(negocio?.description?.es ?? '')}</textarea>
          </label>
          <label class="campo-form campo-ancho">
            <span class="campo-etiqueta"><span>Inglés</span> <span class="ayuda" data-contador-en></span></span>
            <textarea class="${controls.campo} ${controls.areaTexto}" name="descripcionEn" rows="3" maxlength="2000" required>${texto(negocio?.description?.en ?? '')}</textarea>
            <span class="ayuda">La descripción para buscadores se recorta a 160 caracteres.</span>
          </label>
        </div>
      </section>

      <section class="editor-seccion">
        <h3>Fotos <span class="nota">la primera es la portada</span></h3>
        <p class="ayuda">Se reducen a 1600 px y se les quitan los datos de la cámara antes de subirlas. Solo fotos propias o con licencia.</p>
        <div data-fotos-zona data-grupo="fotos"></div>
      </section>

      <section class="editor-seccion">
        <h3>Contacto</h3>
        <div class="editor-rejilla">
          <label class="campo-form">
            <span>Teléfono <span class="ayuda">10 dígitos o con +52</span></span>
            <input class="${controls.campo}" type="tel" name="telefono" value="${texto(negocio?.phone ?? '')}" placeholder="4421234567" />
          </label>
          <label class="campo-form">
            <span>WhatsApp <span class="ayuda">10 dígitos o con +52</span></span>
            <input class="${controls.campo}" type="tel" name="whatsapp" value="${texto(negocio?.links?.whatsapp ?? '')}" placeholder="4421234567" />
          </label>
          <label class="campo-form">
            <span>Sitio web</span>
            <input class="${controls.campo}" type="url" name="sitio" value="${texto(negocio?.links?.website ?? '')}" placeholder="https://" />
          </label>
          <label class="campo-form">
            <span>Instagram</span>
            <input class="${controls.campo}" type="url" name="instagram" value="${texto(negocio?.links?.instagram ?? '')}" placeholder="https://instagram.com/…" />
          </label>
          <label class="campo-form">
            <span>Facebook</span>
            <input class="${controls.campo}" type="url" name="facebook" value="${texto(negocio?.links?.facebook ?? '')}" placeholder="https://facebook.com/…" />
          </label>
          <label class="campo-form">
            <span>Enlace de Google Maps <span class="ayuda">si falta, Cómo llegar usa la plaza</span></span>
            <input class="${controls.campo}" type="url" name="googleMapsUri" value="${texto(negocio?.googleMapsUri ?? '')}" placeholder="https://maps.app.goo.gl/…" />
          </label>
        </div>
      </section>

      <section class="editor-seccion">
        <h3>Ubicación y horario</h3>
        <div class="editor-rejilla">
          <label class="campo-form"><span>Latitud</span><input class="${controls.campo}" type="number" name="lat" step="any" value="${texto(negocio?.location?.lat ?? '')}" placeholder="20.6783" /></label>
          <label class="campo-form"><span>Longitud</span><input class="${controls.campo}" type="number" name="lng" step="any" value="${texto(negocio?.location?.lng ?? '')}" placeholder="-100.3128" /></label>
        </div>
        <p class="ayuda">El horario va en formato 10:00-23:00; varios tramos separados por comas. «No sé» deja el dato como está.</p>
        <div class="horario-acciones">
          <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-copiar-horario>Copiar el lunes a todos</button>
        </div>
        <div class="horario" data-grupo="horario">${DIAS.map(([dia, nombre]) => filaDeHorario(dia, nombre, negocio)).join('')}</div>
      </section>

      <footer class="editor-pie">
        <p class="aviso-contenido" data-guardado role="status" hidden></p>
        <div class="problemas" data-problemas role="alert"></div>
        <div class="acciones">
          <button type="submit" class="${controls.base} ${controls.boton} ${controls.principal}">${negocio ? 'Guardar cambios' : 'Crear negocio'}</button>
          <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-cancelar>Cancelar</button>
        </div>
      </footer>
    </form>`,
  )

  pintarGirosFormulario()
  pintarFotosFormulario()
  actualizarCierre()
  actualizarAvisoPlaza()
  actualizarContadores()
}

function filaDeHorario(dia: string, nombre: string, negocio: Negocio | null): string {
  const valor = negocio?.hours?.[dia]
  const estado = valor === undefined ? 'no' : valor.length === 0 ? 'cerrado' : 'abierto'
  const rangos = estado === 'abierto' ? (valor ?? []).join(', ') : ''
  return `<div class="horario-fila" data-dia="${dia}">
    <span>${nombre}</span>
    <select class="campo-select" data-estado aria-label="${nombre}">
      <option value="no"${estado === 'no' ? ' selected' : ''}>No sé</option>
      <option value="abierto"${estado === 'abierto' ? ' selected' : ''}>Abierto</option>
      <option value="cerrado"${estado === 'cerrado' ? ' selected' : ''}>Cerrado</option>
    </select>
    <input class="${controls.campo}" type="text" data-rangos value="${texto(rangos)}" aria-label="${nombre}, horario"${estado === 'abierto' ? '' : ' disabled'} />
  </div>`
}

/** Un local visible en una plaza inactiva no se verá: conviene decirlo antes de guardar. */
function actualizarAvisoPlaza(): void {
  const plazaId = dialogo?.querySelector<HTMLSelectElement>('select[name="plazaId"]')?.value
  const nota = dialogo?.querySelector<HTMLElement>('[data-plaza-aviso]')
  if (!nota) return
  const plaza = datos?.plazas.find((fila) => fila.id === plazaId)
  nota.textContent =
    plaza && !plaza.active ? 'La plaza está inactiva: el local no se verá aunque esté visible.' : ''
}

function actualizarCierre(): void {
  const activo = dialogo?.querySelector<HTMLInputElement>('input[name="cierreActivo"]')?.checked
  const campos = dialogo?.querySelector<HTMLElement>('[data-cierre-campos]')
  if (campos) campos.hidden = !activo
}

function actualizarContadores(): void {
  const nombre = dialogo?.querySelector<HTMLInputElement>('input[name="nombre"]')?.value ?? ''
  const nombreEl = dialogo?.querySelector<HTMLElement>('[data-contador-nombre]')
  if (nombreEl) {
    nombreEl.textContent = `${nombre.length} de 60`
    nombreEl.dataset.limite = nombre.length > 60 ? 'pasado' : 'bien'
  }
  const pares: [string, string][] = [
    ['descripcionEs', '[data-contador-es]'],
    ['descripcionEn', '[data-contador-en]'],
  ]
  for (const [campo, selector] of pares) {
    const valor = dialogo?.querySelector<HTMLTextAreaElement>(`[name="${campo}"]`)?.value ?? ''
    const destino = dialogo?.querySelector<HTMLElement>(selector)
    if (destino) destino.textContent = `${valor.length} caracteres`
  }
}

/* ------------------------------------------------------------------ giros del negocio */

function pintarGirosFormulario(): void {
  const zona = dialogo?.querySelector<HTMLElement>('[data-giros-zona]')
  if (!zona || !formularioActual) return
  const seleccion = formularioActual.seleccion
  const principales = seleccion.filter((giro) => giro.rol === 'principal')
  const secundarios = seleccion.filter((giro) => giro.rol === 'secundario')
  const total = seleccion.length
  const usados = new Set(seleccion.map((giro) => giro.id))
  const buscado = normalizar(formularioActual.consultaGiro)

  const fila = (elegido: GiroElegido, puesto: number | null) => {
    const nombre = mapaDeGiros().get(elegido.id) ?? elegido.id
    const categoria = categoriaDeGiro(elegido.id)
    const principal = elegido.rol === 'principal'
    const indice = principales.findIndex((fila) => fila.id === elegido.id)
    return `<li class="giro-elegido" data-giro-id="${texto(elegido.id)}" data-rol="${elegido.rol}">
      <span class="giro-puesto" aria-hidden="true">${puesto ?? '·'}</span>
      <span class="giro-texto">
        <span class="negocio-nombre">${texto(nombre)}</span>
        <span class="meta">${texto(categoria)}</span>
      </span>
      <span class="marca-rol">${principal ? 'Principal' : 'Secundario'}</span>
      <span class="giro-acciones">
        <button type="button" class="${controls.base} ${controls.boton} ${controls.fantasma}" data-giro-rol="${texto(elegido.id)}">${principal ? 'Hacer secundario' : 'Hacer principal'}</button>
        ${
          principal
            ? `<button type="button" class="${controls.base} ${controls.botonIcono} ${controls.mini} ${controls.fantasma}" data-giro-subir="${texto(elegido.id)}" aria-label="Subir ${texto(nombre)}" title="Subir"${indice === 0 ? ' disabled' : ''}>↑</button>
               <button type="button" class="${controls.base} ${controls.botonIcono} ${controls.mini} ${controls.fantasma}" data-giro-bajar="${texto(elegido.id)}" aria-label="Bajar ${texto(nombre)}" title="Bajar"${indice === principales.length - 1 ? ' disabled' : ''}>↓</button>`
            : ''
        }
        <button type="button" class="${controls.base} ${controls.boton} ${controls.fantasma}" data-giro-quitar="${texto(elegido.id)}">Quitar</button>
      </span>
    </li>`
  }

  const grupos = (datos?.categories ?? [])
    .map((categoria) => {
      const opciones = categoria.giros.filter((giro) => {
        if (usados.has(giro.id)) return false
        if (!buscado) return true
        return normalizar(`${giro.label.es} ${giro.label.en ?? ''} ${categoria.label.es}`).includes(
          buscado,
        )
      })
      if (opciones.length === 0) return ''
      return `<div class="grupo-giros">
        <p class="grupo-titulo">${texto(categoria.label.es)}</p>
        <div class="giros-opciones">${opciones
          .map(
            (giro) =>
              `<button type="button" class="opcion-anadir ${controls.base} ${controls.boton} ${controls.fantasma}" data-anadir-giro-id="${texto(giro.id)}"${total >= 3 ? ' disabled' : ''}>
                <span>${texto(giro.label.es)}</span>
                <span class="meta">Añadir</span>
              </button>`,
          )
          .join('')}</div>
      </div>`
    })
    .join('')

  zona.innerHTML = `
    <ol class="giros-elegidos">
      ${principales.map((giro, indice) => fila(giro, indice + 1)).join('')}
      ${secundarios.map((giro) => fila(giro, null)).join('')}
    </ol>
    <p class="giros-cuenta"><strong>${numero(principales.length)}</strong> principales y <strong>${numero(secundarios.length)}</strong> secundarios · ${numero(total)} de 3 en total${total >= 3 ? ': quita uno para añadir otro' : ''}</p>
    <div class="buscador-giro">
      <input class="${controls.campo}" type="search" data-buscar-giro placeholder="Buscar un giro para añadir" aria-label="Buscar un giro" value="${texto(formularioActual.consultaGiro)}" />
      <div class="giro-catalogo" tabindex="0" role="group" aria-label="Giros disponibles">${grupos || '<p class="vacio">No queda ningún giro que coincida.</p>'}</div>
    </div>`
}

function moverGiro(id: string, direccion: -1 | 1): void {
  if (!formularioActual) return
  const principales = formularioActual.seleccion.filter((giro) => giro.rol === 'principal')
  const indice = principales.findIndex((giro) => giro.id === id)
  const destino = indice + direccion
  if (indice < 0 || destino < 0 || destino >= principales.length) return
  const elegido = principales[indice]
  const vecino = principales[destino]
  if (!elegido || !vecino) return
  const lista = formularioActual.seleccion
  const posicionA = lista.indexOf(elegido)
  const posicionB = lista.indexOf(vecino)
  lista[posicionA] = vecino
  lista[posicionB] = elegido
  formularioActual.sucio = true
  pintarGirosFormulario()
}

function cambiarRolGiro(id: string): void {
  if (!formularioActual) return
  const giro = formularioActual.seleccion.find((fila) => fila.id === id)
  if (!giro) return
  const principales = formularioActual.seleccion.filter((fila) => fila.rol === 'principal')
  const secundarios = formularioActual.seleccion.filter((fila) => fila.rol === 'secundario')
  if (giro.rol === 'principal') {
    // Un local sin giro principal no se puede describir ni ordenar en el buscador.
    if (principales.length <= 1 || secundarios.length >= 2) return
    giro.rol = 'secundario'
  } else {
    if (principales.length >= 3) return
    giro.rol = 'principal'
  }
  formularioActual.sucio = true
  pintarGirosFormulario()
}

function quitarGiro(id: string): void {
  if (!formularioActual) return
  formularioActual.seleccion = formularioActual.seleccion.filter((giro) => giro.id !== id)
  formularioActual.sucio = true
  pintarGirosFormulario()
}

function anadirGiro(id: string): void {
  if (!formularioActual) return
  if (formularioActual.seleccion.length >= 3) return
  if (formularioActual.seleccion.some((giro) => giro.id === id)) return
  const principales = formularioActual.seleccion.filter((giro) => giro.rol === 'principal')
  formularioActual.seleccion.push({
    id,
    rol: principales.length < 3 ? 'principal' : 'secundario',
  })
  formularioActual.sucio = true
  pintarGirosFormulario()
}

/* ------------------------------------------------------------------ fotos */

function pintarFotosFormulario(): void {
  const zona = dialogo?.querySelector<HTMLElement>('[data-fotos-zona]')
  if (!zona || !formularioActual) return
  const fotos = formularioActual.fotos
  const lista = fotos
    .map(
      (foto, indice) => `<li class="foto-fila" data-foto="${indice}">
        <img class="foto-mini" src="${assetUrl(foto.src)}" alt="" width="96" height="72" loading="lazy" />
        <div class="foto-datos">
          <label class="campo-form">
            <span>Texto alternativo</span>
            <input class="${controls.campo}" type="text" data-alt-foto="${indice}" value="${texto(foto.alt)}" maxlength="300" />
          </label>
          <p class="meta">${indice === 0 ? 'Portada' : `Foto ${indice + 1}`}${foto.credit ? ` · ${texto(foto.credit)}` : ''}</p>
        </div>
        <div class="foto-acciones">
          ${indice > 0 ? `<button type="button" class="${controls.base} ${controls.boton} ${controls.fantasma}" data-foto-portada="${indice}">Portada</button>` : ''}
          ${indice > 0 ? `<button type="button" class="${controls.base} ${controls.boton} ${controls.fantasma}" data-foto-subir="${indice}">Subir</button>` : ''}
          ${indice < fotos.length - 1 ? `<button type="button" class="${controls.base} ${controls.boton} ${controls.fantasma}" data-foto-bajar="${indice}">Bajar</button>` : ''}
          <button type="button" class="${controls.base} ${controls.boton} ${controls.fantasma}" data-foto-quitar="${indice}">Quitar</button>
        </div>
      </li>`,
    )
    .join('')

  const subir = formularioActual.id
    ? `<label class="subir-foto ${controls.base} ${controls.boton} ${controls.secundario}">
        ${subiendoFoto ? 'Subiendo…' : 'Añadir foto'}
        <input class="visualmente" type="file" accept="image/*" multiple data-subir-foto${subiendoFoto ? ' disabled' : ''} />
      </label>`
    : '<p class="ayuda">Guarda el negocio una vez para poder añadir fotos.</p>'

  zona.innerHTML = `
    ${fotos.length > 0 ? `<ul class="fotos-editor">${lista}</ul>` : '<p class="vacio">Todavía no hay fotos: la ficha usa la ilustración de su categoría.</p>'}
    <div class="fotos-subir">
      ${subir}
      <p class="ayuda" data-foto-estado role="status">WebP o JPEG, máximo 1600 px de lado. Se guardan en la PR, no en producción.</p>
    </div>`
}

function moverFoto(indice: number, destino: number): void {
  if (!formularioActual) return
  const fotos = formularioActual.fotos
  if (destino < 0 || destino >= fotos.length) return
  const [foto] = fotos.splice(indice, 1)
  if (!foto) return
  fotos.splice(destino, 0, foto)
  formularioActual.sucio = true
  pintarFotosFormulario()
}

function quitarFoto(indice: number): void {
  if (!formularioActual) return
  formularioActual.fotos.splice(indice, 1)
  formularioActual.sucio = true
  pintarFotosFormulario()
}

/** El navegador reduce y reorienta la foto antes de que salga del dispositivo. */
async function comprimirFoto(archivo: File): Promise<{
  datos: string
  archivo: string
  ancho: number
  alto: number
  placeholder: string
  alt: string
}> {
  const imagen = await cargarImagen(archivo)
  const anchoBase = 'naturalWidth' in imagen ? imagen.naturalWidth : imagen.width
  const altoBase = 'naturalHeight' in imagen ? imagen.naturalHeight : imagen.height
  if (!anchoBase || !altoBase) throw new Error('No se pudo leer la imagen.')
  const escala = Math.min(1, LADO_FOTO / Math.max(anchoBase, altoBase))
  const ancho = Math.max(1, Math.round(anchoBase * escala))
  const alto = Math.max(1, Math.round(altoBase * escala))
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const contexto = lienzo.getContext('2d')
  if (!contexto) throw new Error('El navegador no pudo preparar la imagen.')
  contexto.drawImage(imagen, 0, 0, ancho, alto)

  let blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/webp', 0.82),
  )
  if (!blob || (blob.type !== 'image/webp' && blob.type !== 'image/jpeg')) {
    blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, 'image/jpeg', 0.85))
  }
  if (!blob) throw new Error('El navegador no pudo convertir la imagen.')
  if (blob.size > TOPE_FOTO) throw new Error('La foto sigue pesando demasiado; prueba con otra.')

  const mini = document.createElement('canvas')
  mini.width = 1
  mini.height = 1
  const miniContexto = mini.getContext('2d')
  let placeholder = '#f1ebe0'
  if (miniContexto) {
    miniContexto.drawImage(lienzo, 0, 0, 1, 1)
    const [rojo, verde, azul] = miniContexto.getImageData(0, 0, 1, 1).data
    if (rojo !== undefined && verde !== undefined && azul !== undefined) {
      placeholder = `#${[rojo, verde, azul].map((valor) => valor.toString(16).padStart(2, '0')).join('')}`
    }
  }

  const sinExtension = archivo.name.replace(/\.[^.]+$/, '').trim()
  const alt =
    sinExtension.replace(/[-_]+/g, ' ').trim() ||
    `Fotografía de ${formularioActual?.nombre ?? 'el negocio'}`
  const base64 = await base64DeBlob(blob)
  return { datos: base64, archivo: archivo.name, ancho, alto, placeholder, alt }
}

async function cargarImagen(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    } catch {
      // Safari antiguo o un formato que el decodificador rápido no entiende.
    }
  }
  const url = URL.createObjectURL(archivo)
  try {
    return await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const imagen = new Image()
      imagen.onload = () => resolver(imagen)
      imagen.onerror = () => rechazar(new Error('No se pudo leer la imagen.'))
      imagen.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function base64DeBlob(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binario)
}

async function subirFotos(archivos: FileList): Promise<void> {
  if (!formularioActual?.id || subiendoFoto) return
  subiendoFoto = true
  pintarFotosFormulario()
  let mensajeFinal = ''
  const avisoLocal = dialogo?.querySelector<HTMLElement>('[data-foto-estado]')
  try {
    for (const archivo of [...archivos]) {
      if (avisoLocal) avisoLocal.textContent = `Preparando ${archivo.name}…`
      const preparada = await comprimirFoto(archivo)
      if (avisoLocal) avisoLocal.textContent = `Subiendo ${archivo.name}…`
      const respuesta = await fetch('/api/panel/contenido/foto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: formularioActual.id,
          archivo: preparada.archivo,
          alt: preparada.alt,
          ancho: preparada.ancho,
          alto: preparada.alto,
          placeholder: preparada.placeholder,
          datos: preparada.datos,
        }),
      })
      const resultado = (await respuesta.json().catch(() => null)) as {
        ok?: boolean
        seco?: boolean
        mensaje?: string
        problemas?: string[]
        error?: string
        foto?: Foto | null
      } | null
      if (respuesta.status === 403) throw new Error('Sin permiso. Revisa la regla de Access.')
      if (respuesta.status === 503) throw new Error('Falta GITHUB_TOKEN en el Worker.')
      if (respuesta.status === 413) {
        throw new Error('La foto es demasiado grande; el navegador no pudo reducirla.')
      }
      if (!respuesta.ok || !resultado?.ok) {
        throw new Error(
          resultado?.problemas?.join(' ') ?? resultado?.error ?? 'No se pudo subir la foto.',
        )
      }
      if (resultado.seco || !resultado.foto) {
        mensajeFinal = resultado.mensaje ?? 'En desarrollo no se guarda.'
        continue
      }
      formularioActual.fotos.push(resultado.foto)
      const negocio = datos?.places.find((fila) => fila.id === formularioActual?.id)
      if (negocio) negocio.photos = [...negocio.photos, resultado.foto]
      mensajeFinal = 'Foto añadida a la PR. Ajusta el texto si hace falta.'
    }
  } catch (causa) {
    mensajeFinal = causa instanceof Error ? causa.message : 'No se pudo subir la foto.'
  } finally {
    subiendoFoto = false
    pintarFotosFormulario()
    const estadoFinal = dialogo?.querySelector<HTMLElement>('[data-foto-estado]')
    if (estadoFinal && mensajeFinal) estadoFinal.textContent = mensajeFinal
  }
}

/* ------------------------------------------------------------------ errores de campo */

function limpiarProblemas(formEl: HTMLFormElement): void {
  for (const marcado of formEl.querySelectorAll('[aria-invalid]')) {
    marcado.removeAttribute('aria-invalid')
  }
  for (const descrito of formEl.querySelectorAll('[aria-describedby^="error-"]')) {
    descrito.removeAttribute('aria-describedby')
  }
  for (const mensaje of formEl.querySelectorAll('.campo-error.dinamico')) mensaje.remove()
}

function limpiarErrorDe(control: Element): void {
  const id = control.getAttribute('aria-describedby')
  if (id?.startsWith('error-')) {
    document.getElementById(id)?.remove()
    control.removeAttribute('aria-describedby')
  }
  control.removeAttribute('aria-invalid')
}

function marcarError(formEl: HTMLFormElement, ruta: string, mensaje: string): boolean {
  const [campo, indice] = ruta.split('.')
  if (!campo) return false
  let contenedor: Element | null = null
  let foco: HTMLElement | null = null

  if (campo === 'fotos' && indice !== undefined) {
    foco = formEl.querySelector<HTMLElement>(`[data-alt-foto="${indice}"]`)
    contenedor = foco?.closest('.campo-form') ?? null
  } else if (campo === 'fotos' || campo === 'giros' || campo === 'horario' || campo === 'cierre') {
    contenedor = formEl.querySelector(`[data-grupo="${campo}"]`)
    foco =
      contenedor?.querySelector<HTMLElement>('input, select, textarea, button') ??
      (contenedor as HTMLElement | null)
  } else {
    foco =
      formEl.querySelector<HTMLElement>(`[name="${campo}"]`) ??
      formEl.querySelector<HTMLElement>(`[data-campo="${campo}"]`)
    contenedor = foco?.closest('.campo-form') ?? foco
  }
  if (!contenedor) return false

  const id = `error-${campo}-${indice ?? 'uno'}`
  const parrafo = document.createElement('p')
  parrafo.className = 'campo-error dinamico'
  parrafo.id = id
  parrafo.textContent = mensaje
  if (campo === 'giros') contenedor.prepend(parrafo)
  else contenedor.append(parrafo)
  if (foco) {
    foco.setAttribute('aria-invalid', 'true')
    foco.setAttribute('aria-describedby', id)
  }
  return true
}

function mostrarProblemas(formEl: HTMLFormElement, problemas: string[]): void {
  limpiarProblemas(formEl)
  const generales: string[] = []
  for (const problema of problemas) {
    const separador = problema.indexOf(':')
    const ruta = separador > 0 ? problema.slice(0, separador).trim() : ''
    const mensaje = separador > 0 ? problema.slice(separador + 1).trim() : problema
    if (ruta && marcarError(formEl, ruta, mensaje)) continue
    generales.push(problema)
  }
  const caja = formEl.querySelector<HTMLElement>('[data-problemas]')
  if (caja) caja.innerHTML = generales.map((problema) => `<p>${texto(problema)}</p>`).join('')
  const primero = formEl.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (primero) {
    primero.focus()
    primero.scrollIntoView({ block: 'nearest' })
  }
}

/* ------------------------------------------------------------------ categorías: leer y guardar */

function leerFormularioCategoria(formulario: HTMLFormElement): {
  cuerpo: { categories: unknown[] }
  problemas: string[]
} {
  const problemas: string[] = []
  const categoriaId = formulario.dataset.id ?? ''
  const esNueva = !categoriaId
  const campoDe = (nombre: string): string =>
    (
      formulario.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-campo="${nombre}"]`)
        ?.value ?? ''
    ).trim()

  const labelEs = campoDe('labelEs')
  const labelEn = campoDe('labelEn')
  const icono = campoDe('icon')
  const hueTexto = campoDe('hue')
  const ordenTexto = campoDe('order')
  const sinonimos = sinonimosDe(campoDe('synonyms'))

  if (!labelEs) problemas.push('El nombre en español es obligatorio.')
  if (!labelEn) problemas.push('El nombre en inglés es obligatorio.')
  if (categoriaId !== 'otros' && !hueTexto) {
    problemas.push('Esta categoría necesita un tono entre 0 y 359.')
  }
  if (
    hueTexto &&
    (!Number.isInteger(Number(hueTexto)) || Number(hueTexto) < 0 || Number(hueTexto) > 359)
  ) {
    problemas.push('El tono debe ser un entero entre 0 y 359.')
  }
  if (!Number.isInteger(Number(ordenTexto)) || Number(ordenTexto) < 0) {
    problemas.push('El orden debe ser un entero positivo.')
  }

  const filas = [...formulario.querySelectorAll<HTMLElement>('[data-giro]')]
  if (filas.length === 0) problemas.push('Una categoría necesita al menos un giro.')

  const leidas = filas.map((fila) => {
    const general = fila.dataset.general === 'true'
    const giroLabelEs =
      fila.querySelector<HTMLInputElement>('[data-campo="giroLabelEs"]')?.value.trim() ?? ''
    const giroLabelEn =
      fila.querySelector<HTMLInputElement>('[data-campo="giroLabelEn"]')?.value.trim() ?? ''
    const giroIcono =
      fila.querySelector<HTMLSelectElement>('[data-campo="giroIcon"]')?.value ?? icono
    const giroSinonimos = sinonimosDe(
      fila.querySelector<HTMLInputElement>('[data-campo="giroSynonyms"]')?.value ?? '',
    )
    const destino = esNueva
      ? ''
      : (fila.querySelector<HTMLSelectElement>('[data-campo="destino"]')?.value ?? categoriaId)
    if (!giroLabelEs) problemas.push('Cada giro necesita nombre en español.')
    if (!giroLabelEn) problemas.push('Cada giro necesita nombre en inglés.')
    return {
      id: fila.dataset.id || undefined,
      general,
      labelEs: giroLabelEs,
      labelEn: giroLabelEn,
      icon: general ? icono : giroIcono,
      synonyms: giroSinonimos,
      destino: destino || (esNueva ? '' : categoriaId),
    }
  })
  if (leidas.filter((fila) => fila.general).length > 1) {
    problemas.push('Solo puede haber un giro general por categoría.')
  }

  if (problemas.length > 0) {
    return { cuerpo: { categories: [] }, problemas }
  }

  const categorias = structuredClone(datos?.categories ?? []) as Categoria[]
  let actual = categoriaId
    ? categorias.find((categoria) => categoria.id === categoriaId)
    : undefined
  if (!actual) {
    actual = {
      id: '__nueva-categoria__',
      slug: { es: '', en: '' },
      label: { es: '', en: '' },
      icon: '',
      order: 0,
      synonyms: [],
      giros: [],
    }
    categorias.push(actual)
  }

  actual.label = { es: labelEs, en: labelEn }
  actual.icon = icono
  actual.hue = hueTexto ? Number(hueTexto) : undefined
  actual.order = Number(ordenTexto)
  actual.synonyms = sinonimos

  const propios: Giro[] = []
  for (const fila of leidas) {
    const giro: Giro = {
      id: fila.id ?? '',
      label: { es: fila.labelEs, en: fila.labelEn },
      icon: fila.general ? icono : fila.icon,
      synonyms: fila.synonyms,
      ...(fila.general ? { general: true } : {}),
    }
    if (!fila.id) delete (giro as Partial<Giro>).id
    const destino = fila.destino || actual.id
    if (destino === actual.id) {
      propios.push(giro)
      continue
    }
    const llegada = categorias.find((categoria) => categoria.id === destino)
    if (!llegada) {
      problemas.push(`La categoría de destino "${destino}" no existe.`)
      continue
    }
    llegada.giros.push(giro)
  }
  actual.giros = propios

  if (problemas.length > 0) return { cuerpo: { categories: [] }, problemas }
  const categories = categorias.map((categoria) => {
    if (categoria.id !== '__nueva-categoria__') return categoria
    const { id: _id, ...resto } = categoria
    return resto
  })
  return { cuerpo: { categories }, problemas }
}

async function enviarCategoria(formulario: HTMLFormElement): Promise<void> {
  mostrarProblemas(formulario, [])
  const { cuerpo, problemas } = leerFormularioCategoria(formulario)
  if (problemas.length > 0) {
    mostrarProblemas(formulario, problemas)
    return
  }

  const boton = formulario.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (boton) boton.disabled = true
  try {
    const respuesta = await fetch('/api/panel/contenido/categorias', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    const resultado = (await respuesta.json().catch(() => null)) as {
      ok?: boolean
      seco?: boolean
      pr?: { url: string; numero: number; creada: boolean } | null
      mensaje?: string
      problemas?: string[]
      afectados?: { locales: number; plazas: number }
    } | null

    if (respuesta.status === 403) {
      mostrarProblemas(formulario, ['Sin permiso. Revisa la regla de Access.'])
      return
    }
    if (respuesta.status === 503) {
      mostrarProblemas(formulario, ['Falta GITHUB_TOKEN en el Worker.'])
      return
    }
    if (!respuesta.ok || !resultado?.ok) {
      mostrarProblemas(
        formulario,
        resultado?.problemas?.length ? resultado.problemas : ['No se pudo guardar.'],
      )
      return
    }

    const alcance = resultado.afectados
      ? ` Afecta a ${numero(resultado.afectados.locales)} locales en ${numero(resultado.afectados.plazas)} plazas.`
      : ''
    aviso = resultado.pr
      ? `${resultado.mensaje ?? 'Guardado.'} ${resultado.pr.creada ? 'PR abierta' : 'Añadido a la PR'} #${resultado.pr.numero}.${alcance}`
      : `${resultado.mensaje ?? 'Validado en desarrollo. No se commitea.'}${alcance}`
    modo = 'categorias'
    dialogo?.close()
    await cargar()
  } catch {
    mostrarProblemas(formulario, ['No se pudo hablar con el servidor.'])
  } finally {
    if (boton) boton.disabled = false
  }
}

/* ------------------------------------------------------------------ negocio: leer y guardar */

function valorDe(formulario: HTMLFormElement, nombre: string): string {
  const campo = formulario.elements.namedItem(nombre)
  if (campo instanceof RadioNodeList) return campo.value.trim()
  if (
    campo instanceof HTMLInputElement ||
    campo instanceof HTMLTextAreaElement ||
    campo instanceof HTMLSelectElement
  ) {
    return campo.value.trim()
  }
  return ''
}

function validarHorario(formEl: HTMLFormElement): string[] {
  const problemas: string[] = []
  const formato = /^([01]?\d|2[0-3]):[0-5]\d-([01]?\d|2[0-3]):[0-5]\d$/
  for (const fila of formEl.querySelectorAll<HTMLElement>('.horario-fila')) {
    const dia = fila.dataset.dia
    const nombreDia = DIAS.find(([clave]) => clave === dia)?.[1] ?? dia ?? ''
    const estado = fila.querySelector<HTMLSelectElement>('select[data-estado]')?.value ?? 'no'
    if (estado !== 'abierto') continue
    const rangos = (fila.querySelector<HTMLInputElement>('[data-rangos]')?.value ?? '')
      .split(',')
      .map((rango) => rango.trim())
      .filter(Boolean)
    if (rangos.length === 0) {
      problemas.push(`horario: El ${nombreDia.toLowerCase()} está abierto pero no tiene horario.`)
      continue
    }
    if (rangos.some((rango) => !formato.test(rango))) {
      problemas.push(
        `horario: El ${nombreDia.toLowerCase()} tiene un horario que no es 10:00-23:00.`,
      )
    }
  }
  return problemas
}

function validarNegocio(formEl: HTMLFormElement): string[] {
  const problemas: string[] = []
  const nombre = valorDe(formEl, 'nombre')
  const plazaId = valorDe(formEl, 'plazaId')
  const descripcionEs = valorDe(formEl, 'descripcionEs')
  const descripcionEn = valorDe(formEl, 'descripcionEn')
  const lat = valorDe(formEl, 'lat')
  const lng = valorDe(formEl, 'lng')
  const principales =
    formularioActual?.seleccion.filter((giro) => giro.rol === 'principal').length ?? 0
  const total = formularioActual?.seleccion.length ?? 0

  if (!nombre) problemas.push('nombre: El nombre es obligatorio.')
  if (!plazaId) problemas.push('plazaId: Elige una plaza.')
  if (principales === 0) problemas.push('giros: Elige al menos un giro principal.')
  if (total > 3) problemas.push('giros: Entre principales y secundarios el tope son tres.')
  if (formularioActual && formularioActual.seleccion.length > 0) {
    const ids = formularioActual.seleccion.map((giro) => giro.id)
    if (new Set(ids).size !== ids.length) problemas.push('giros: Hay un giro repetido.')
  }
  if (!descripcionEs) problemas.push('descripcionEs: Falta la descripción en español.')
  if (!descripcionEn) problemas.push('descripcionEn: Falta la descripción en inglés.')
  if (Boolean(lat) !== Boolean(lng)) {
    problemas.push('lat: Indica la latitud y la longitud, o ninguna de las dos.')
  }
  if (formEl.querySelector<HTMLInputElement>('input[name="cierreActivo"]')?.checked) {
    const desde = valorDe(formEl, 'cierreDesde')
    if (!desde) problemas.push('cierre: Indica desde cuándo está cerrado.')
    else if (desde > hoy()) problemas.push('cierre: El cierre no puede empezar en el futuro.')
  }
  formularioActual?.fotos.forEach((foto, indice) => {
    if (!foto.alt.trim()) problemas.push(`fotos.${indice}.alt: Escribe el texto alternativo.`)
  })
  problemas.push(...validarHorario(formEl))
  return problemas
}

function leerFormulario(formulario: HTMLFormElement): {
  cuerpo: Record<string, unknown>
  problemas: string[]
} {
  const problemas = validarNegocio(formulario)
  if (problemas.length > 0) return { cuerpo: {}, problemas }

  const nombre = valorDe(formulario, 'nombre')
  const plazaId = valorDe(formulario, 'plazaId')
  const descripcionEs = valorDe(formulario, 'descripcionEs')
  const descripcionEn = valorDe(formulario, 'descripcionEn')
  const latTexto = valorDe(formulario, 'lat')
  const lngTexto = valorDe(formulario, 'lng')
  const principales =
    formularioActual?.seleccion.filter((giro) => giro.rol === 'principal').map((giro) => giro.id) ??
    []
  const secundarios =
    formularioActual?.seleccion
      .filter((giro) => giro.rol === 'secundario')
      .map((giro) => giro.id) ?? []

  const horario: Record<string, string[]> = {}
  for (const fila of formulario.querySelectorAll<HTMLElement>('.horario-fila')) {
    const dia = fila.dataset.dia
    if (!dia) continue
    const estado = fila.querySelector<HTMLSelectElement>('select[data-estado]')?.value ?? 'no'
    if (estado === 'no') continue
    if (estado === 'cerrado') {
      horario[dia] = []
      continue
    }
    horario[dia] = (fila.querySelector<HTMLInputElement>('[data-rangos]')?.value ?? '')
      .split(',')
      .map((rango) => rango.trim())
      .filter(Boolean)
  }

  const cierreActivo =
    formulario.querySelector<HTMLInputElement>('input[name="cierreActivo"]')?.checked ?? false
  const cierre = cierreActivo
    ? {
        motivo: valorDe(formulario, 'cierreMotivo') as Cierre['motivo'],
        desde: valorDe(formulario, 'cierreDesde'),
      }
    : null

  const cuerpo = {
    id: formulario.dataset.id || undefined,
    nombre,
    plazaId,
    giros: principales,
    secundarios,
    descripcionEs,
    descripcionEn,
    telefono: valorDe(formulario, 'telefono'),
    sitio: valorDe(formulario, 'sitio'),
    instagram: valorDe(formulario, 'instagram'),
    facebook: valorDe(formulario, 'facebook'),
    whatsapp: valorDe(formulario, 'whatsapp'),
    googleMapsUri: valorDe(formulario, 'googleMapsUri'),
    lat: latTexto ? Number(latTexto) : null,
    lng: lngTexto ? Number(lngTexto) : null,
    horario: Object.keys(horario).length > 0 ? horario : null,
    cierre,
    fotos: formularioActual?.fotos.map((foto) => ({ src: foto.src, alt: foto.alt })) ?? [],
    activo: formulario.querySelector<HTMLInputElement>('input[name="activo"]')?.checked ?? true,
  }
  return { cuerpo, problemas }
}

async function alEnviar(evento: Event): Promise<void> {
  const formulario = (evento.target as HTMLElement | null)?.closest<HTMLFormElement>(
    'form[data-editor]',
  )
  if (!formulario) return
  evento.preventDefault()
  if (formulario.dataset.editor === 'categoria') {
    await enviarCategoria(formulario)
    return
  }
  await enviarNegocio(formulario)
}

async function enviarNegocio(formulario: HTMLFormElement): Promise<void> {
  mostrarProblemas(formulario, [])
  const { cuerpo, problemas } = leerFormulario(formulario)
  if (problemas.length > 0) {
    mostrarProblemas(formulario, problemas)
    return
  }

  const boton = formulario.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (boton) boton.disabled = true
  try {
    const respuesta = await fetch('/api/panel/contenido/negocio', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    const resultado = (await respuesta.json().catch(() => null)) as {
      ok?: boolean
      seco?: boolean
      pr?: { url: string; numero: number; creada: boolean } | null
      mensaje?: string
      problemas?: string[]
      avisos?: string[]
      negocio?: { id: string; nombre: string; nuevo: boolean }
    } | null

    if (respuesta.status === 403) {
      mostrarProblemas(formulario, ['Sin permiso. Revisa la regla de Access.'])
      return
    }
    if (respuesta.status === 503) {
      mostrarProblemas(formulario, ['Falta GITHUB_TOKEN en el Worker.'])
      return
    }
    if (!respuesta.ok || !resultado?.ok) {
      mostrarProblemas(
        formulario,
        resultado?.problemas?.length ? resultado.problemas : ['No se pudo guardar.'],
      )
      return
    }

    const avisos = resultado.avisos?.length ? ` Avisos: ${resultado.avisos.join(' · ')}` : ''
    if (formularioActual) formularioActual.sucio = false

    // Un negocio nuevo se queda abierto: así se le pueden subir fotos en el mismo gesto.
    if (resultado.negocio?.nuevo && !resultado.seco && formularioActual) {
      formularioActual.id = resultado.negocio.id
      formularioActual.nombre = resultado.negocio.nombre
      formulario.dataset.id = resultado.negocio.id
      const titulo = dialogo?.querySelector<HTMLElement>('[data-editor-titulo]')
      if (titulo) titulo.textContent = resultado.negocio.nombre
      const guardado = formulario.querySelector<HTMLElement>('[data-guardado]')
      if (guardado) {
        guardado.hidden = false
        guardado.textContent =
          'Negocio creado. Ya puedes añadir fotos; el resto de cambios van a la misma PR.'
      }
      pintarFotosFormulario()
      formularioActual.sucio = false
      await cargar()
      return
    }

    aviso =
      (resultado.pr
        ? `${resultado.mensaje ?? 'Guardado.'} ${resultado.pr.creada ? 'PR abierta' : 'Añadido a la PR'} #${resultado.pr.numero}.`
        : (resultado.mensaje ?? 'Validado en desarrollo. No se commitea.')) + avisos
    cerrarEditor(true)
    await cargar()
  } catch {
    mostrarProblemas(formulario, ['No se pudo hablar con el servidor.'])
  } finally {
    if (boton) boton.disabled = false
  }
}

/* ------------------------------------------------------------------ eventos */

function alPulsar(evento: Event): void {
  const objetivo = evento.target as HTMLElement | null
  if (!objetivo) return

  const nuevaPagina = objetivo.closest<HTMLButtonElement>('[data-pagina]')
  if (nuevaPagina?.dataset.pagina) {
    pagina += nuevaPagina.dataset.pagina === 'siguiente' ? 1 : -1
    if (modo === 'categorias') pintarZonaCategorias()
    else pintarZonaNegocios()
    return
  }

  if (objetivo.closest('[data-nueva-categoria]')) {
    pintarCategoria(null)
    return
  }
  const editarCategoria = objetivo.closest<HTMLElement>('[data-editar-categoria]')
  if (editarCategoria && datos) {
    const categoria = datos.categories.find(
      (fila) => fila.id === editarCategoria.dataset.editarCategoria,
    )
    if (categoria) pintarCategoria(categoria)
    return
  }

  const editar = objetivo.closest<HTMLElement>('[data-editar]')
  if (editar && datos) {
    const negocio = datos.places.find((fila) => fila.id === editar.dataset.editar)
    if (negocio) pintarFormulario(negocio)
    return
  }
  if (objetivo.closest('[data-nuevo]')) pintarFormulario(null)
}

function alEscribir(evento: Event): void {
  const buscar = (evento.target as HTMLElement | null)?.closest<HTMLInputElement>('[data-buscar]')
  if (!buscar) return
  consulta = buscar.value
  pagina = 0
  if (modo === 'categorias') pintarZonaCategorias()
  else pintarZonaNegocios()
}

function alPulsarEditor(evento: Event): void {
  const objetivo = evento.target as HTMLElement | null
  if (!objetivo) return
  // El clic en el fondo del diálogo llega con el propio <dialog> como destino.
  if (objetivo === dialogo) {
    cerrarEditor()
    return
  }
  if (objetivo.closest('[data-editor-cerrar], [data-cancelar]')) {
    cerrarEditor()
    return
  }
  if (objetivo.closest('[data-anadir-giro]')) {
    anadirGiroDeCategoria()
    return
  }
  if (!formularioActual) return

  const anadir = objetivo.closest<HTMLElement>('[data-anadir-giro-id]')
  if (anadir?.dataset.anadirGiroId) {
    anadirGiro(anadir.dataset.anadirGiroId)
    return
  }
  const quitar = objetivo.closest<HTMLElement>('[data-giro-quitar]')
  if (quitar?.dataset.giroQuitar) {
    quitarGiro(quitar.dataset.giroQuitar)
    return
  }
  const rol = objetivo.closest<HTMLElement>('[data-giro-rol]')
  if (rol?.dataset.giroRol) {
    cambiarRolGiro(rol.dataset.giroRol)
    return
  }
  const subirGiro = objetivo.closest<HTMLElement>('[data-giro-subir]')
  if (subirGiro?.dataset.giroSubir) {
    moverGiro(subirGiro.dataset.giroSubir, -1)
    return
  }
  const bajarGiro = objetivo.closest<HTMLElement>('[data-giro-bajar]')
  if (bajarGiro?.dataset.giroBajar) {
    moverGiro(bajarGiro.dataset.giroBajar, 1)
    return
  }

  const portada = objetivo.closest<HTMLElement>('[data-foto-portada]')
  if (portada?.dataset.fotoPortada) {
    moverFoto(Number(portada.dataset.fotoPortada), 0)
    return
  }
  const subirFoto = objetivo.closest<HTMLElement>('[data-foto-subir]')
  if (subirFoto?.dataset.fotoSubir) {
    const indice = Number(subirFoto.dataset.fotoSubir)
    moverFoto(indice, indice - 1)
    return
  }
  const bajarFoto = objetivo.closest<HTMLElement>('[data-foto-bajar]')
  if (bajarFoto?.dataset.fotoBajar) {
    const indice = Number(bajarFoto.dataset.fotoBajar)
    moverFoto(indice, indice + 1)
    return
  }
  const quitarFotoBoton = objetivo.closest<HTMLElement>('[data-foto-quitar]')
  if (quitarFotoBoton?.dataset.fotoQuitar) {
    quitarFoto(Number(quitarFotoBoton.dataset.fotoQuitar))
    return
  }

  if (objetivo.closest('[data-copiar-horario]')) {
    copiarLunes()
  }
}

function alEscribirEditor(evento: Event): void {
  const objetivo = evento.target as HTMLElement | null
  if (!objetivo) return

  const buscarGiro = objetivo.closest<HTMLInputElement>('[data-buscar-giro]')
  if (buscarGiro && formularioActual) {
    formularioActual.consultaGiro = buscarGiro.value
    formularioActual.sucio = true
    pintarGirosFormulario()
    const nuevo = dialogo?.querySelector<HTMLInputElement>('[data-buscar-giro]')
    nuevo?.focus()
    nuevo?.setSelectionRange(nuevo.value.length, nuevo.value.length)
    return
  }
  if (objetivo.matches('[data-campo="hue"]')) {
    actualizarTonoPreview()
    return
  }
  if (objetivo.matches('[data-alt-foto]') && formularioActual) {
    const indice = Number((objetivo as HTMLInputElement).dataset.altFoto)
    const foto = formularioActual.fotos[indice]
    if (foto) {
      foto.alt = (objetivo as HTMLInputElement).value
      formularioActual.sucio = true
    }
    limpiarErrorDe(objetivo)
    return
  }
  if (formularioActual) {
    formularioActual.sucio = true
    actualizarContadores()
    limpiarErrorDe(objetivo)
  }
}

function alCambiarEditor(evento: Event): void {
  const objetivo = evento.target as HTMLElement | null
  if (!objetivo) return

  const archivos = objetivo.closest<HTMLInputElement>('[data-subir-foto]')
  if (archivos?.files?.length) {
    void subirFotos(archivos.files)
    return
  }
  const icono = objetivo.closest<HTMLSelectElement>('[data-campo="icon"]')
  if (icono) {
    // El giro general comparte el icono con su categoría; al cambiarlo, la fila lo sigue.
    const formulario = icono.closest<HTMLFormElement>('form[data-editor="categoria"]')
    const general = formulario?.querySelector<HTMLSelectElement>(
      '[data-giro][data-general="true"] [data-campo="giroIcon"]',
    )
    if (general) general.value = icono.value
    return
  }
  if (!formularioActual) return

  if (objetivo.matches('select[name="plazaId"]')) {
    actualizarAvisoPlaza()
    formularioActual.sucio = true
    return
  }
  if (objetivo.matches('input[name="cierreActivo"]')) {
    actualizarCierre()
    formularioActual.sucio = true
    return
  }
  if (objetivo.matches('input[name="activo"]')) {
    formularioActual.sucio = true
    return
  }
  const estado = objetivo.closest<HTMLSelectElement>('select[data-estado]')
  if (estado) {
    const fila = estado.closest<HTMLElement>('.horario-fila')
    const rangos = fila?.querySelector<HTMLInputElement>('[data-rangos]')
    if (rangos) rangos.disabled = estado.value !== 'abierto'
    formularioActual.sucio = true
    return
  }
  if (objetivo.matches('[data-rangos]') || objetivo.matches('[name="cierreDesde"]')) {
    formularioActual.sucio = true
  }
}

function copiarLunes(): void {
  const lunes = dialogo?.querySelector<HTMLElement>('[data-dia="mon"]')
  if (!lunes) return
  const estado = lunes.querySelector<HTMLSelectElement>('select[data-estado]')?.value ?? 'no'
  const rangos = lunes.querySelector<HTMLInputElement>('[data-rangos]')?.value ?? ''
  for (const fila of dialogo?.querySelectorAll<HTMLElement>('.horario-fila') ?? []) {
    if (fila.dataset.dia === 'mon') continue
    const select = fila.querySelector<HTMLSelectElement>('select[data-estado]')
    const input = fila.querySelector<HTMLInputElement>('[data-rangos]')
    if (select) select.value = estado
    if (input) {
      input.value = estado === 'abierto' ? rangos : ''
      input.disabled = estado !== 'abierto'
    }
  }
  if (formularioActual) formularioActual.sucio = true
}
