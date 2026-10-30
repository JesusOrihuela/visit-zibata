/**
 * El editor de contenido del panel: negocios de la guía.
 *
 * Es TypeScript sin framework, igual que el resto del panel. La página importa el mismo paquete de
 * controles que la guía, y aquí solo se compone: los campos, los botones y los estados salen del
 * catálogo, no se dibujan otra vez.
 *
 * Lo que se guarda no va a producción: el Worker valida y manda el cambio a una rama con PR. El
 * panel enseña el enlace de esa PR y el estado de la rama. En desarrollo, sin testigo de GitHub,
 * valida y avisa de que no se commitea, para poder probar el formulario sin credenciales.
 */
import controls from '../styles/controls.module.css'

interface Giro {
  id: string
  label: { es: string; en?: string }
}

interface Categoria {
  id: string
  label: { es: string; en?: string }
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

function pintarLista(): void {
  if (!raiz || !datos) return
  const plazas = mapaDePlazas()
  const giros = mapaDeGiros()
  const pr = datos.pr
    ? `<a class="enlace-contenido" href="${texto(datos.pr.url)}" target="_blank" rel="noreferrer">PR #${datos.pr.numero}</a>`
    : 'sin PR abierta'
  const desarrollo = datos.seco ? ' · desarrollo: los cambios se validan, no se commitean' : ''
  raiz.innerHTML = `
    <div class="barra-contenido">
      <input class="${controls.campo} buscar" type="search" placeholder="Buscar negocio, plaza o giro" aria-label="Buscar negocio" value="${texto(consulta)}" data-buscar />
      <button type="button" class="${controls.base} ${controls.boton} ${controls.principal}" data-nuevo>Nuevo negocio</button>
    </div>
    <p class="meta-contenido">${numero(datos.places.length)} negocios · ${pr}${desarrollo}</p>
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

function pintarFormulario(negocio: Negocio | null): void {
  if (!raiz || !datos) return
  aviso = null
  const seleccionados = new Set(negocio?.giros ?? [])
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
              `<label class="opcion-giro"><input type="checkbox" name="giros" value="${texto(giro.id)}"${seleccionados.has(giro.id) ? ' checked' : ''} /><span>${texto(giro.label.es)}</span></label>`,
          )
          .join('')}</div>
      </div>`,
    )
    .join('')

  const horario = DIAS.map(([dia, nombre]) => filaDeHorario(dia, nombre, negocio)).join('')

  raiz.innerHTML = `
    <form class="formulario" data-editor data-id="${texto(negocio?.id ?? '')}" novalidate>
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
      </label>

      <fieldset class="campo-ancho giros">
        <legend>Giros <span class="ayuda">de uno a tres</span></legend>
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
        <span>Enlace de Google Maps</span>
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
        <span>Visible en la guía. Al guardar se marca la verificación de hoy.</span>
      </label>

      <div class="problemas" data-problemas role="alert"></div>
      <div class="acciones">
        <button type="submit" class="${controls.base} ${controls.boton} ${controls.principal}">${negocio ? 'Guardar cambios' : 'Crear negocio'}</button>
        <button type="button" class="${controls.base} ${controls.boton} ${controls.secundario}" data-cancelar>Cancelar</button>
      </div>
    </form>
  `
  limitarGiros()
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
  const formulario = raiz?.querySelector<HTMLFormElement>('form[data-editor]')
  if (!formulario) return
  const cajas = [...formulario.querySelectorAll<HTMLInputElement>('input[name="giros"]')]
  const marcados = cajas.filter((caja) => caja.checked).length
  const lleno = marcados >= 3
  for (const caja of cajas) caja.disabled = lleno && !caja.checked
  const nota = formulario.querySelector<HTMLElement>('[data-giros-aviso]')
  if (nota) nota.textContent = lleno ? 'Máximo tres giros.' : ''
}

function alPulsar(evento: Event): void {
  const objetivo = evento.target as HTMLElement | null
  if (!objetivo) return
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
  const buscar = objetivo?.closest<HTMLInputElement>('[data-buscar]')
  if (!buscar || !datos) return
  consulta = buscar.value
  const lista = raiz?.querySelector<HTMLElement>('.lista-negocios')
  if (lista) lista.innerHTML = filasDeNegocios(mapaDePlazas(), mapaDeGiros())
}

function alCambiar(evento: Event): void {
  const objetivo = evento.target as HTMLElement | null
  if (!objetivo) return
  if (objetivo.matches('input[name="giros"]')) {
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
  const giros = [
    ...formulario.querySelectorAll<HTMLInputElement>('input[name="giros"]:checked'),
  ].map((caja) => caja.value)
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

    aviso = resultado.pr
      ? `${resultado.mensaje ?? 'Guardado.'} ${resultado.pr.creada ? 'PR abierta' : 'Añadido a la PR'} #${resultado.pr.numero}.`
      : (resultado.mensaje ?? 'Validado en desarrollo. No se commitea.')
    await cargar()
  } catch {
    mostrarProblemas(formulario, ['No se pudo hablar con el servidor.'])
  } finally {
    if (boton) boton.disabled = false
  }
}
