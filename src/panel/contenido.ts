/**
 * El editor de contenido del panel: negocios, categorías y giros de la guía.
 *
 * Es TypeScript sin framework, igual que el resto del panel. La página importa el mismo paquete de
 * controles que la guía, y aquí solo se compone: los campos, los botones y los estados salen del
 * catálogo, no se dibujan otra vez.
 *
 * Lo que se guarda no va a producción: el Worker valida y manda el cambio a una rama con PR. El
 * panel enseña el enlace de esa PR y el estado de la rama. En desarrollo, sin testigo de GitHub,
 * valida y avisa de que no se commitea, para poder probar el formulario sin credenciales.
 *
 * Las categorías no se editan aisladas: sus giros los usan los locales, los filtros se ordenan por
 * `order` y las plazas guardan una lista derivada. El formulario enseña a cuántos locales afecta
 * antes de guardar.
 */
import { ICONOS } from '../data/iconos.ts'
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

const DIAS: [string, string][] = [
  ['mon', 'Lunes'],
  ['tue', 'Martes'],
  ['wed', 'Miércoles'],
  ['thu', 'Jueves'],
  ['fri', 'Viernes'],
  ['sat', 'Sábado'],
  ['sun', 'Domingo'],
]

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

let raiz: HTMLElement | null = null
let datos: Datos | null = null
let consulta = ''
let aviso: string | null = null
let vista: 'negocios' | 'categorias' = 'negocios'
/** Orden en que se marcaron los giros. El primero es el que manda en la ficha y la búsqueda. */
let ordenGiros: string[] = []

/** Monta el editor dentro del contenedor que ya está en `panel.html`. */
export function montarEditor(contenedor: HTMLElement): void {
  raiz = contenedor
  contenedor.addEventListener('click', alPulsar)
  contenedor.addEventListener('submit', alEnviar)
  contenedor.addEventListener('input', alEscribir)
  contenedor.addEventListener('change', alCambiar)
  void cargar()
}

async function cargar(): Promise<void> {
  if (!raiz) return
  raiz.setAttribute('aria-busy', 'true')
  raiz.innerHTML = '<p class="estado">Cargando contenido…</p>'
  try {
    const respuesta = await fetch('/api/panel/contenido')
    if (respuesta.status === 403) {
      fallar('Sin permiso. Revisa la regla de Cloudflare Access de /api/panel.')
      return
    }
    if (respuesta.status === 503) {
      fallar('El Worker no tiene configurado GITHUB_TOKEN.')
      return
    }
    if (!respuesta.ok) {
      fallar(`El servidor respondió ${respuesta.status}.`)
      return
    }
    datos = (await respuesta.json()) as Datos
    pintarLista()
  } catch {
    fallar('No se pudo cargar el contenido.')
  } finally {
    raiz.setAttribute('aria-busy', 'false')
  }
}

function fallar(mensaje: string): void {
  if (!raiz) return
  raiz.innerHTML = `<p class="estado">${texto(mensaje)}</p>`
  raiz.setAttribute('aria-busy', 'false')
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

/** Las dos pestañas del contenido. La activa se marca con `aria-selected`, no con una clase. */
function pestanas(): string {
  const opcion = (clave: 'negocios' | 'categorias', etiqueta: string) =>
    `<button type="button" role="tab" data-vista="${clave}" aria-selected="${String(vista === clave)}">${etiqueta}</button>`
  return `<div class="pestanas-contenido" role="tablist" aria-label="Tipo de contenido">
    ${opcion('negocios', 'Negocios')}${opcion('categorias', 'Categorías')}
  </div>`
}

function resumenDeLaRama(): string {
  if (!datos) return ''
  const pr = datos.pr
    ? `<a class="enlace-contenido" href="${texto(datos.pr.url)}" target="_blank" rel="noreferrer">PR #${datos.pr.numero}</a>`
    : 'sin PR abierta'
  const desarrollo = datos.seco ? ' · desarrollo: los cambios se validan, no se commitean' : ''
  return `${pr}${desarrollo}`
}

function pintarLista(): void {
  if (!datos) return
  if (vista === 'categorias') pintarCategorias()
  else pintarNegocios()
}

function pintarNegocios(): void {
  if (!raiz || !datos) return
  const plazas = mapaDePlazas()
  const giros = mapaDeGiros()
  raiz.innerHTML = `
    ${pestanas()}
    <div class="barra-contenido">
      <input class="${controls.campo} buscar" type="search" placeholder="Buscar negocio, plaza o giro" aria-label="Buscar negocio" value="${texto(consulta)}" data-buscar />
      <button type="button" class="${controls.base} ${controls.boton} ${controls.principal}" data-nuevo>Nuevo negocio</button>
    </div>
    <p class="meta-contenido">${numero(datos.places.length)} negocios · ${resumenDeLaRama()}</p>
    ${aviso ? `<p class="aviso-contenido" role="status">${texto(aviso)}</p>` : ''}
    <div class="lista-negocios">${filasDeNegocios(plazas, giros)}</div>
  `
}

function filasDeNegocios(plazas: Map<string, string>, giros: Map<string, string>): string {
  if (!datos) return ''
  const buscado = normalizar(consulta)
  const filas = datos.places
    .filter((negocio) => {
      if (!buscado) return true
      const textoDelNegocio = normalizar(
        [
          negocio.name,
          plazas.get(negocio.plazaId) ?? '',
          ...negocio.giros.map((giro) => giros.get(giro) ?? giro),
        ].join(' '),
      )
      return textoDelNegocio.includes(buscado)
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  if (filas.length === 0) return '<p class="vacio">Ningún negocio coincide.</p>'

  return filas
    .map((negocio) => {
      const donde = plazas.get(negocio.plazaId) ?? negocio.plazaId
      const que = negocio.giros.map((giro) => giros.get(giro) ?? giro).join(', ')
      return `<article class="negocio">
        <div class="negocio-texto">
          <h3>${texto(negocio.name)}</h3>
          <p class="meta">${texto(donde)} · ${texto(que)}</p>
        </div>
        <span class="marca-estado" data-activo="${negocio.active ? 'si' : 'no'}">${negocio.active ? 'Visible' : 'Oculto'}</span>
        <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-editar="${texto(negocio.id)}" aria-label="Editar ${texto(negocio.name)}">Editar</button>
      </article>`
    })
    .join('')
}

const sinonimosDe = (texto: string): string[] => [
  ...new Set(
    texto
      .split(',')
      .map((valor) => valor.trim())
      .filter(Boolean),
  ),
]

function localesDeGiros(giros: Iterable<string>): Negocio[] {
  const buscados = new Set(giros)
  return (datos?.places ?? []).filter((negocio) =>
    [...negocio.giros, ...negocio.secundarios].some((giro) => buscados.has(giro)),
  )
}

const localesDeCategoria = (categoria: Categoria): Negocio[] =>
  localesDeGiros(categoria.giros.map((giro) => giro.id))

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

function pintarCategorias(): void {
  if (!raiz || !datos) return
  const giros = datos.categories.reduce((suma, categoria) => suma + categoria.giros.length, 0)
  raiz.innerHTML = `
    ${pestanas()}
    <div class="barra-contenido">
      <input class="${controls.campo} buscar" type="search" placeholder="Buscar categoría o giro" aria-label="Buscar categoría" value="${texto(consulta)}" data-buscar />
      <button type="button" class="${controls.base} ${controls.boton} ${controls.principal}" data-nueva-categoria>Nueva categoría</button>
    </div>
    <p class="meta-contenido">${numero(datos.categories.length)} categorías · ${numero(giros)} giros · ${resumenDeLaRama()}</p>
    ${aviso ? `<p class="aviso-contenido" role="status">${texto(aviso)}</p>` : ''}
    <div class="lista-categorias">${filasDeCategorias()}</div>
  `
  pintarTonos()
}

function filasDeCategorias(): string {
  if (!datos) return ''
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

  if (filas.length === 0) return '<p class="vacio">Ninguna categoría coincide.</p>'
  return filas
    .map((categoria) => {
      const locales = localesDeCategoria(categoria).length
      return `<article class="categoria-fila">
        <span class="tono" data-tono="${categoria.hue ?? ''}" aria-hidden="true"></span>
        <div class="categoria-texto">
          <h3>${texto(categoria.label.es)}</h3>
          <p class="meta">${numero(categoria.giros.length)} giros · ${numero(locales)} locales · orden ${categoria.order}</p>
        </div>
        <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-editar-categoria="${texto(categoria.id)}" aria-label="Editar ${texto(categoria.label.es)}">Editar</button>
      </article>`
    })
    .join('')
}

function pintarTonos(): void {
  for (const punto of raiz?.querySelectorAll<HTMLElement>('[data-tono]') ?? []) {
    const hue = punto.dataset.tono
    punto.style.background = hue ? `hsl(${hue} 34% 92%)` : 'var(--color-border)'
    punto.style.boxShadow = hue ? `inset 0 0 0 1px hsl(${hue} 38% 33% / 0.35)` : 'none'
  }
}

function pintarCategoria(categoria: Categoria | null): void {
  if (!raiz || !datos) return
  vista = 'categorias'
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
  const locales = localesDeCategoria(base)
  const plazas = new Set(locales.map((negocio) => negocio.plazaId))
  const impacto =
    locales.length === 0
      ? 'Una categoría nueva no afecta a ningún local hasta que le asignes un giro que ya se use.'
      : `${numero(locales.length)} locales en ${numero(plazas.size)} plazas están en esta categoría. Al guardar se actualizan los filtros, el buscador y las páginas; si mueves un giro, cambian solo los locales de ese giro.`

  raiz.innerHTML = `
    <form class="formulario formulario-categoria" data-editor="categoria" data-id="${texto(categoria?.id ?? '')}" novalidate>
      <h3 class="titulo-formulario">${esNueva ? 'Nueva categoría' : `Editar ${texto(base.label.es)}`}</h3>
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
      <label class="campo-form campo-ancho">
        <span>Sinónimos <span class="ayuda">separados por comas</span></span>
        <input class="${controls.campo}" type="text" data-campo="synonyms" value="${texto(base.synonyms.join(', '))}" />
      </label>

      <fieldset class="campo-ancho giros">
        <legend>Giros <span class="ayuda">los usa cada local; la categoría de un local sale de aquí</span></legend>
        <div class="giros-categoria" data-giros>
          ${giros.map((giro, indice) => filaDeGiroFormulario(giro, base, indice, esNueva)).join('')}
        </div>
        <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-anadir-giro>Añadir giro</button>
      </fieldset>

      <p class="impacto-contenido" data-impacto>${texto(impacto)}</p>

      <div class="problemas" data-problemas role="alert"></div>
      <div class="acciones">
        <button type="submit" class="${controls.base} ${controls.boton} ${controls.principal}">${esNueva ? 'Crear categoría' : 'Guardar cambios'}</button>
        <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-cancelar>Cancelar</button>
      </div>
    </form>
  `
  pintarTonos()
  actualizarTonoPreview()
  raiz.querySelector<HTMLInputElement>('[data-campo="labelEs"]')?.focus()
}

function filaDeGiroFormulario(
  giro: Giro,
  categoria: Categoria,
  indice: number,
  esNueva: boolean,
): string {
  const general = giro.general === true
  const usados = iconosUsados(giro.id)
  const locales = giro.id ? localesDeGiros([giro.id]).length : 0
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

function actualizarTonoPreview(): void {
  const punto = raiz?.querySelector<HTMLElement>('[data-tono-preview]')
  if (!punto) return
  const hue = raiz?.querySelector<HTMLInputElement>('[data-campo="hue"]')?.value ?? ''
  punto.style.background = hue ? `hsl(${hue} 34% 92%)` : 'var(--color-border)'
  punto.style.boxShadow = hue ? `inset 0 0 0 1px hsl(${hue} 38% 33% / 0.35)` : 'none'
}

function anadirGiro(): void {
  const contenedor = raiz?.querySelector<HTMLElement>('[data-giros]')
  const formulario = raiz?.querySelector<HTMLFormElement>('form[data-editor="categoria"]')
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
}

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
    vista = 'categorias'
    await cargar()
  } catch {
    mostrarProblemas(formulario, ['No se pudo hablar con el servidor.'])
  } finally {
    if (boton) boton.disabled = false
  }
}

function pintarFormulario(negocio: Negocio | null): void {
  if (!raiz || !datos) return
  aviso = null
  const seleccionados = new Set(negocio?.giros ?? [])
  const secundarios = new Set(negocio?.secundarios ?? [])
  ordenGiros = [...(negocio?.giros ?? [])]
  const plazas = datos.plazas
    .map(
      (plaza) =>
        `<option value="${texto(plaza.id)}"${plaza.id === negocio?.plazaId ? ' selected' : ''}>${texto(plaza.name)}${plaza.active ? '' : ' (inactiva)'}</option>`,
    )
    .join('')

  const giros = datos.categories
    .map(
      (categoria) => `<div class="grupo-giros">
        <p class="grupo-titulo">${texto(categoria.label.es)}</p>
        <div class="giros-opciones">${categoria.giros
          .map(
            (giro) =>
              `<label class="opcion-giro"><input type="checkbox" name="giros" value="${texto(giro.id)}"${seleccionados.has(giro.id) ? ' checked' : ''} /><span>${texto(giro.label.es)}${secundarios.has(giro.id) ? ' <span class="marca-secundario">secundario</span>' : ''}</span></label>`,
          )
          .join('')}</div>
      </div>`,
    )
    .join('')

  const horario = DIAS.map(([dia, nombre]) => filaDeHorario(dia, nombre, negocio)).join('')

  raiz.innerHTML = `
    <form class="formulario" data-editor="negocio" data-id="${texto(negocio?.id ?? '')}" novalidate>
      <label class="campo-form">
        <span>Nombre</span>
        <input class="${controls.campo}" type="text" name="nombre" value="${texto(negocio?.name ?? '')}" maxlength="160" required />
      </label>
      <label class="campo-form">
        <span>Plaza</span>
        <select class="campo-select" name="plazaId" required>
          <option value="">Elige una plaza</option>
          ${plazas}
        </select>
        <span class="ayuda" data-plaza-aviso></span>
      </label>

      <fieldset class="campo-ancho giros">
        <legend>Giros <span class="ayuda">de uno a tres; el primero marca el icono y la prioridad. Marcar un secundario lo asciende; los demás se conservan.</span></legend>
        <div class="giros-caja">${giros}</div>
        <p class="ayuda" data-giros-aviso></p>
      </fieldset>

      <label class="campo-form campo-ancho">
        <span>Descripción en español</span>
        <textarea class="${controls.campo} ${controls.areaTexto}" name="descripcionEs" rows="3" maxlength="2000" required>${texto(negocio?.description?.es ?? '')}</textarea>
      </label>
      <label class="campo-form campo-ancho">
        <span>Descripción en inglés</span>
        <textarea class="${controls.campo} ${controls.areaTexto}" name="descripcionEn" rows="3" maxlength="2000" required>${texto(negocio?.description?.en ?? '')}</textarea>
      </label>

      <label class="campo-form">
        <span>Teléfono</span>
        <input class="${controls.campo}" type="tel" name="telefono" value="${texto(negocio?.phone ?? '')}" placeholder="4421234567" />
      </label>
      <label class="campo-form">
        <span>WhatsApp</span>
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

      <div class="campo-ancho coordenadas">
        <span class="campo-titulo">Ubicación</span>
        <label class="campo-form"><span>Latitud</span><input class="${controls.campo}" type="number" name="lat" step="any" value="${texto(negocio?.location?.lat ?? '')}" placeholder="20.6783" /></label>
        <label class="campo-form"><span>Longitud</span><input class="${controls.campo}" type="number" name="lng" step="any" value="${texto(negocio?.location?.lng ?? '')}" placeholder="-100.3128" /></label>
      </div>

      <fieldset class="campo-ancho horario">
        <legend>Horario <span class="ayuda">formato 10:00-23:00; varios tramos separados por comas</span></legend>
        ${horario}
      </fieldset>

      <label class="campo-ancho casilla">
        <input type="checkbox" name="activo"${negocio?.active === false ? '' : ' checked'} />
        <span>Visible en la guía. Oculto sale de listas, buscador y sitemap, y su ficha deja de publicarse. Se actualiza la fecha de verificación sin cambiar el estado.</span>
      </label>

      <div class="problemas" data-problemas role="alert"></div>
      <div class="acciones">
        <button type="submit" class="${controls.base} ${controls.boton} ${controls.principal}">${negocio ? 'Guardar cambios' : 'Crear negocio'}</button>
        <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-cancelar>Cancelar</button>
      </div>
    </form>
  `
  limitarGiros()
  actualizarAvisoPlaza()
  raiz.querySelector<HTMLInputElement>('input[name="nombre"]')?.focus()
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

function limitarGiros(): void {
  const formulario = raiz?.querySelector<HTMLFormElement>('form[data-editor="negocio"]')
  if (!formulario) return
  const cajas = [...formulario.querySelectorAll<HTMLInputElement>('input[name="giros"]')]
  const marcados = cajas.filter((caja) => caja.checked).length
  const lleno = marcados >= 3
  for (const caja of cajas) caja.disabled = lleno && !caja.checked
  const nota = formulario.querySelector<HTMLElement>('[data-giros-aviso]')
  if (nota) nota.textContent = lleno ? 'Máximo tres giros.' : ''
}

/** Un local visible en una plaza inactiva no se verá: conviene decirlo antes de guardar. */
function actualizarAvisoPlaza(): void {
  const plazaId = raiz?.querySelector<HTMLSelectElement>('select[name="plazaId"]')?.value
  const nota = raiz?.querySelector<HTMLElement>('[data-plaza-aviso]')
  if (!nota) return
  const plaza = datos?.plazas.find((fila) => fila.id === plazaId)
  nota.textContent =
    plaza && !plaza.active ? 'La plaza está inactiva: el local no se verá aunque esté visible.' : ''
}

function alPulsar(evento: Event): void {
  const objetivo = evento.target as HTMLElement | null
  if (!objetivo) return

  const pestana = objetivo.closest<HTMLElement>('[data-vista]')
  if (pestana) {
    vista = pestana.dataset.vista === 'categorias' ? 'categorias' : 'negocios'
    consulta = ''
    aviso = null
    pintarLista()
    return
  }

  if (objetivo.closest('[data-nueva-categoria]')) {
    vista = 'categorias'
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
  if (objetivo.closest('[data-anadir-giro]')) {
    anadirGiro()
    return
  }

  const editar = objetivo.closest<HTMLElement>('[data-editar]')
  if (editar && datos) {
    const negocio = datos.places.find((fila) => fila.id === editar.dataset.editar)
    if (negocio) pintarFormulario(negocio)
    return
  }
  if (objetivo.closest('[data-nuevo]')) {
    pintarFormulario(null)
    return
  }
  if (objetivo.closest('[data-cancelar]')) {
    aviso = null
    pintarLista()
  }
}

function alEscribir(evento: Event): void {
  const objetivo = evento.target as HTMLElement | null
  if (objetivo?.matches('[data-campo="hue"]')) actualizarTonoPreview()
  const buscar = objetivo?.closest<HTMLInputElement>('[data-buscar]')
  if (!buscar || !datos) return
  consulta = buscar.value
  if (vista === 'categorias') {
    const lista = raiz?.querySelector<HTMLElement>('.lista-categorias')
    if (lista) lista.innerHTML = filasDeCategorias()
    return
  }
  const lista = raiz?.querySelector<HTMLElement>('.lista-negocios')
  if (lista) lista.innerHTML = filasDeNegocios(mapaDePlazas(), mapaDeGiros())
}

function alCambiar(evento: Event): void {
  const objetivo = evento.target as HTMLElement | null
  if (!objetivo) return
  if (objetivo.matches('[data-campo="hue"]')) {
    actualizarTonoPreview()
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
  if (objetivo.matches('select[name="plazaId"]')) {
    actualizarAvisoPlaza()
    return
  }
  if (objetivo.matches('input[name="giros"]')) {
    const caja = objetivo as HTMLInputElement
    if (caja.checked) {
      if (!ordenGiros.includes(caja.value)) ordenGiros.push(caja.value)
    } else {
      ordenGiros = ordenGiros.filter((giro) => giro !== caja.value)
    }
    limitarGiros()
    return
  }
  const estado = objetivo.closest<HTMLSelectElement>('select[data-estado]')
  if (estado) {
    const fila = estado.closest<HTMLElement>('.horario-fila')
    const rangos = fila?.querySelector<HTMLInputElement>('[data-rangos]')
    if (rangos) rangos.disabled = estado.value !== 'abierto'
  }
}

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

function leerFormulario(formulario: HTMLFormElement): {
  cuerpo: Record<string, unknown>
  problemas: string[]
} {
  const problemas: string[] = []
  const nombre = valorDe(formulario, 'nombre')
  const plazaId = valorDe(formulario, 'plazaId')
  const marcados = [
    ...formulario.querySelectorAll<HTMLInputElement>('input[name="giros"]:checked'),
  ].map((caja) => caja.value)
  // El orden de marcado manda: el primero es el icono y la prioridad de búsqueda.
  const giros = [
    ...ordenGiros.filter((giro) => marcados.includes(giro)),
    ...marcados.filter((giro) => !ordenGiros.includes(giro)),
  ]
  const descripcionEs = valorDe(formulario, 'descripcionEs')
  const descripcionEn = valorDe(formulario, 'descripcionEn')
  const latTexto = valorDe(formulario, 'lat')
  const lngTexto = valorDe(formulario, 'lng')

  if (!nombre) problemas.push('El nombre es obligatorio.')
  if (!plazaId) problemas.push('Elige una plaza.')
  if (giros.length === 0) problemas.push('Elige al menos un giro.')
  if (giros.length > 3) problemas.push('Máximo tres giros.')
  if (!descripcionEs) problemas.push('Falta la descripción en español.')
  if (!descripcionEn) problemas.push('Falta la descripción en inglés.')
  if (Boolean(latTexto) !== Boolean(lngTexto)) {
    problemas.push('Indica la latitud y la longitud, o ninguna de las dos.')
  }

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
    const rangos = (fila.querySelector<HTMLInputElement>('[data-rangos]')?.value ?? '')
      .split(',')
      .map((rango) => rango.trim())
      .filter(Boolean)
    if (rangos.length === 0) {
      const nombre = DIAS.find(([clave]) => clave === dia)?.[1] ?? dia
      problemas.push(`El ${nombre.toLowerCase()} está marcado como abierto pero no tiene horario.`)
    }
    horario[dia] = rangos
  }

  const cuerpo = {
    id: formulario.dataset.id || undefined,
    nombre,
    plazaId,
    giros,
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
    activo: formulario.querySelector<HTMLInputElement>('input[name="activo"]')?.checked ?? true,
  }
  return { cuerpo, problemas }
}

function mostrarProblemas(formulario: HTMLFormElement, problemas: string[]): void {
  const caja = formulario.querySelector<HTMLElement>('[data-problemas]')
  if (caja) caja.innerHTML = problemas.map((problema) => `<p>${texto(problema)}</p>`).join('')
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
    aviso =
      (resultado.pr
        ? `${resultado.mensaje ?? 'Guardado.'} ${resultado.pr.creada ? 'PR abierta' : 'Añadido a la PR'} #${resultado.pr.numero}.`
        : (resultado.mensaje ?? 'Validado en desarrollo. No se commitea.')) + avisos
    await cargar()
  } catch {
    mostrarProblemas(formulario, ['No se pudo hablar con el servidor.'])
  } finally {
    if (boton) boton.disabled = false
  }
}
