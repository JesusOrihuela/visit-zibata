/**
 * El panel privado. JavaScript a mano, sin framework y sin build.
 *
 * Es una página que lee una persona y siempre la misma. Montarla con React la metería en el paquete
 * de la guía (que está a 120 de 122 KB de presupuesto) y pasarla por el build obligaría a inventar
 * un segundo punto de entrada para algo que son cuatro tablas y una gráfica.
 *
 * Todo lo que se pinta viene de `/api/panel`, detrás de la misma puerta de Cloudflare Access que
 * esta página. Si la puerta no está puesta, el Worker responde 403 y aquí se dice con esas palabras.
 */

const contenido = document.getElementById('contenido')
const botones = [...document.querySelectorAll('.ventana button')]

/** Escapa lo que venga de la base antes de meterlo en HTML. Son rutas y slugs, pero igual. */
const texto = (valor) =>
  String(valor ?? '').replace(
    /[&<>"']/g,
    (caracter) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter],
  )

const numero = (valor) => new Intl.NumberFormat('es-MX').format(Number(valor ?? 0))

/** Una tabla con barra proporcional a la mayor de sus filas. */
function tabla(columnas, filas, valorDe) {
  if (filas.length === 0) return '<p class="vacio">Todavía no hay datos.</p>'
  const mayor = Math.max(...filas.map(valorDe), 1)
  const encabezados = columnas.map((nombre) => `<th>${texto(nombre)}</th>`).join('')
  const cuerpo = filas
    .map((fila) => {
      const ancho = Math.max(2, Math.round((valorDe(fila) / mayor) * 100))
      const celdas = fila.celdas
        .map((celda) => `<td${celda.cifra ? ' class="cifra"' : ''}>${texto(celda.valor)}</td>`)
        .join('')
      // El ancho va en un atributo de datos y se aplica despues con CSSOM: la politica de esta
      // pagina es `style-src 'self'`, que bloquea los atributos `style` escritos en el HTML.
      return `<tr>${celdas}<td class="barra"><span data-ancho="${ancho}"></span></td></tr>`
    })
    .join('')
  return `<div class="tabla"><table><thead><tr>${encabezados}<th></th></tr></thead><tbody>${cuerpo}</tbody></table></div>`
}

/**
 * Las visitas por día, en barras.
 *
 * SVG dibujado a mano y no una librería: son rectángulos sobre una escala lineal, y traer una
 * dependencia entera para eso sería justo lo contrario de lo que hace el resto del proyecto.
 */
function grafica(porDia, dias, desde) {
  if (porDia.length === 0) return '<p class="vacio">Todavía no hay visitas.</p>'
  /*
   * La base devuelve solo los días con visitas, y pintarlos seguidos sería mentir: dos días
   * separados por una semana quedarían pegados y la gráfica diría algo que no pasó. Se rellena el
   * rango completo con ceros antes de dibujar.
   */
  const conteo = new Map(porDia.map((dia) => [dia.fecha, dia.visitas]))
  const inicio = new Date(`${desde}T12:00:00Z`)
  // `dias + 1` y no `dias`: la consulta filtra por `fecha >= desde`, así que la ventana incluye
  // tanto el día de corte como el de hoy. Con `dias` faltaba siempre el último, que es el que mas
  // se mira.
  const serie = Array.from({ length: dias + 1 }, (_, indice) => {
    const fecha = new Date(inicio.getTime() + indice * 86400000).toISOString().slice(0, 10)
    return { fecha, visitas: conteo.get(fecha) ?? 0 }
  })

  const ancho = 1000
  const alto = 180
  const margen = 24
  const mayor = Math.max(...serie.map((dia) => dia.visitas), 1)
  const paso = (ancho - margen * 2) / serie.length
  // Tope de grosor: con cuatro días de datos, una barra proporcional ocupa un cuarto del ancho y la
  // gráfica se lee como un muro en vez de como una serie.
  const grosor = Math.min(28, Math.max(1, paso - 2))
  const barras = serie
    .map((dia, indice) => {
      const altura = ((alto - margen * 2) * dia.visitas) / mayor
      const x = margen + indice * paso + (paso - grosor) / 2
      return `<rect x="${x.toFixed(1)}" y="${(alto - margen - altura).toFixed(1)}" width="${grosor.toFixed(1)}" height="${altura.toFixed(1)}" rx="2" fill="currentColor"><title>${texto(dia.fecha)}: ${numero(dia.visitas)}</title></rect>`
    })
    .join('')
  const primero = serie[0]?.fecha ?? ''
  const ultimo = serie[serie.length - 1]?.fecha ?? ''
  return `<svg class="grafica" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Visitas por día, máximo ${numero(mayor)}">
    <g>${barras}</g>
    <text x="${margen}" y="${alto - 6}" font-size="13" fill="var(--tenue)">${texto(primero)}</text>
    <text x="${ancho - margen}" y="${alto - 6}" font-size="13" fill="var(--tenue)" text-anchor="end">${texto(ultimo)}</text>
    <text x="${margen}" y="16" font-size="13" fill="var(--tenue)">máximo ${numero(mayor)}</text>
  </svg>`
}

/**
 * Las sugerencias, en bloques y no en tabla: lo que importa es el mensaje, que es un párrafo, y
 * meterlo en una celda lo obligaría a competir por el ancho con la fecha y el lugar.
 */
function sugerencias(filas) {
  if (filas.length === 0) return '<p class="vacio">Todavía no ha escrito nadie.</p>'
  return `<div class="recados">${filas
    .map((fila) => {
      const quien =
        { vecino: 'Vecino', negocio: 'El negocio', otro: 'Otro' }[fila.quien] ?? fila.quien
      const cabecera = [texto(fila.creada).slice(0, 10), texto(quien), texto(fila.lugar)]
        .filter(Boolean)
        .join(' · ')
      const contacto = fila.contacto ? `<p class="contacto">${texto(fila.contacto)}</p>` : ''
      return `<article class="recado"><p class="meta">${cabecera}</p><p>${texto(fila.mensaje)}</p>${contacto}</article>`
    })
    .join('')}</div>`
}

function pintar(datos) {
  const r = datos.resumen ?? {}
  const tarjetas = [
    ['Visitas', r.visitas],
    ['Páginas vistas', r.paginas],
    ['Enlaces compartidos', r.comparticiones],
    ['Cuentas', r.cuentas],
    ['Corazones', r.corazones],
    ['Calificaciones', r.notas],
    ['Visitas marcadas', r.visitasMarcadas],
    ['Sugerencias sin leer', datos.sinAtender],
  ]
    .map(
      ([nombre, valor]) => `<div class="tarjeta"><dt>${nombre}</dt><dd>${numero(valor)}</dd></div>`,
    )
    .join('')

  const idiomas = (datos.porIdioma ?? []).reduce((suma, fila) => suma + fila.visitas, 0)
  const reparto = (datos.porIdioma ?? [])
    .map((fila) => `${fila.idioma} ${Math.round((fila.visitas / Math.max(1, idiomas)) * 100)}%`)
    .join(' · ')

  contenido.innerHTML = `
    <dl class="tarjetas">${tarjetas}</dl>

    <section>
      <h2>Visitas por día <span class="nota">${texto(reparto)}</span></h2>
      ${grafica(datos.porDia ?? [], datos.dias ?? 30, datos.desde ?? '')}
    </section>

    <section>
      <h2>Páginas más abiertas</h2>
      ${tabla(
        ['Página', 'Idioma', 'Visitas'],
        (datos.porPagina ?? []).map((fila) => ({
          celdas: [
            { valor: fila.ruta },
            { valor: fila.idioma },
            { valor: numero(fila.visitas), cifra: true },
          ],
          visitas: fila.visitas,
        })),
        (fila) => fila.visitas,
      )}
    </section>

    <section>
      <h2>Enlaces compartidos <span class="nota">vistas previas de apps de mensajería</span></h2>
      ${tabla(
        ['Página', 'Veces'],
        (datos.compartidas ?? []).map((fila) => ({
          celdas: [{ valor: fila.ruta }, { valor: numero(fila.veces), cifra: true }],
          veces: fila.veces,
        })),
        (fila) => fila.veces,
      )}
    </section>

    <section>
      <h2>Lugares más guardados <span class="nota">sin umbral, a diferencia de la ficha</span></h2>
      ${tabla(
        ['Lugar', 'Corazones'],
        (datos.guardados ?? []).map((fila) => ({
          celdas: [{ valor: fila.lugar }, { valor: numero(fila.corazones), cifra: true }],
          corazones: fila.corazones,
        })),
        (fila) => fila.corazones,
      )}
    </section>

    <section>
      <h2>Sugerencias <span class="nota">lo último que ha escrito la gente</span></h2>
      ${sugerencias(datos.sugerencias ?? [])}
    </section>

    <section>
      <h2>Lugares más calificados <span class="nota">cuántas notas, nunca el promedio</span></h2>
      ${tabla(
        ['Lugar', 'Notas'],
        (datos.calificados ?? []).map((fila) => ({
          celdas: [{ valor: fila.lugar }, { valor: numero(fila.notas), cifra: true }],
          notas: fila.notas,
        })),
        (fila) => fila.notas,
      )}
    </section>
  `
  // Los anchos, ya en el documento. Ver el comentario de `tabla`: no pueden ir en el HTML.
  for (const barra of contenido.querySelectorAll('.barra span[data-ancho]')) {
    barra.style.width = `${barra.dataset.ancho}%`
  }
  contenido.setAttribute('aria-busy', 'false')
}

function fallar(mensaje) {
  contenido.innerHTML = `<p class="estado">${texto(mensaje)}</p>`
  contenido.setAttribute('aria-busy', 'false')
}

async function cargar(dias) {
  contenido.setAttribute('aria-busy', 'true')
  contenido.innerHTML = '<p class="estado">Cargando…</p>'
  for (const boton of botones) {
    boton.setAttribute('aria-current', String(Number(boton.dataset.dias) === dias))
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
    pintar(await respuesta.json())
  } catch {
    fallar('No se pudo hablar con el servidor.')
  }
}

for (const boton of botones) {
  boton.addEventListener('click', () => cargar(Number(boton.dataset.dias)))
}

void cargar(30)
