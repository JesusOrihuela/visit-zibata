/**
 * El contenido que ya está en el HTML, antes de que arranque JavaScript.
 *
 * ## Por qué
 *
 * Hasta la v4.16 las 234 páginas tenían el mismo cuerpo: 193 bytes con un `<noscript>` y un `<div>`
 * vacío. Todo lo real (el nombre, los giros, la dirección, el horario) aparecía solo después de
 * ejecutar la aplicación. Eso tenía dos costos:
 *
 *  - **Google las veía vacías.** Las renderiza, pero lo hace en una cola aparte y la deja para el
 *    final en sitios sin autoridad. Un dominio nuevo con 234 páginas sin texto es el peor caso.
 *  - **No había enlaces.** Los de la guía los dibuja React, así que un rastreador veía 234 URL
 *    sueltas sin nada que las uniera. Search Console lo decía con todas sus letras: "Página de
 *    referencia: no se ha detectado ninguna". El sitio no tenía grafo.
 *
 * Esto lo arregla en el origen: cada página trae su texto y sus enlaces escritos, derivados de los
 * mismos datos que ya alimentan el `<head>` y los datos estructurados. No es contenido distinto del
 * que enseña la aplicación, que sería engañar a un buscador: es el mismo, servido antes.
 *
 * ## Dónde va
 *
 * Dentro de `<div id="root">`. React lo sustituye al montar, que es exactamente lo que se quiere:
 * para quien tiene JavaScript es lo que se ve mientras carga (antes era una pantalla en blanco), y
 * para quien no lo tiene, o para un rastreador, es la página entera.
 */

/** Escapa lo que venga de los datos. Son nombres de negocios: llevan comillas, ampersands y de todo. */
export const escaparHtml = (valor: string): string =>
  valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export interface Enlace {
  texto: string
  href: string
}

const lista = (enlaces: Enlace[]): string =>
  enlaces.length === 0
    ? ''
    : `<ul>${enlaces
        .map(
          (enlace) =>
            `<li><a href="${escaparHtml(enlace.href)}">${escaparHtml(enlace.texto)}</a></li>`,
        )
        .join('')}</ul>`

const parrafo = (valor: string | undefined): string => (valor ? `<p>${escaparHtml(valor)}</p>` : '')

const titulo = (valor: string): string => `<h2>${escaparHtml(valor)}</h2>`

export interface Horario {
  dia: string
  franjas: string[]
  cerrado: string
}

/**
 * El horario como lista de definiciones.
 *
 * `<dl>` y no una tabla: son pares de etiqueta y valor, no una rejilla de dos dimensiones. Es lo
 * que un lector de pantalla anuncia bien y lo que un rastreador entiende sin ayuda.
 */
const horario = (dias: Horario[]): string =>
  dias.length === 0
    ? ''
    : `<dl>${dias
        .map(
          (dia) =>
            `<dt>${escaparHtml(dia.dia)}</dt><dd>${escaparHtml(dia.franjas.length > 0 ? dia.franjas.join(', ') : dia.cerrado)}</dd>`,
        )
        .join('')}</dl>`

export interface ContenidoDeLugar {
  nombre: string
  giros: string[]
  plaza?: Enlace
  direccion?: string
  descripcion?: string
  dias: Horario[]
  tituloHorario: string
  contacto: Enlace[]
  tituloContacto: string
  vecinos: Enlace[]
  tituloVecinos: string
  volver: Enlace
}

export function contenidoDeLugar(datos: ContenidoDeLugar): string {
  return [
    '<article class="estatico">',
    `<h1>${escaparHtml(datos.nombre)}</h1>`,
    parrafo(datos.giros.join(' · ')),
    datos.plaza
      ? `<p><a href="${escaparHtml(datos.plaza.href)}">${escaparHtml(datos.plaza.texto)}</a>${datos.direccion ? ` — ${escaparHtml(datos.direccion)}` : ''}</p>`
      : parrafo(datos.direccion),
    parrafo(datos.descripcion),
    datos.dias.length > 0 ? titulo(datos.tituloHorario) + horario(datos.dias) : '',
    datos.contacto.length > 0 ? titulo(datos.tituloContacto) + lista(datos.contacto) : '',
    datos.vecinos.length > 0 ? titulo(datos.tituloVecinos) + lista(datos.vecinos) : '',
    `<p><a href="${escaparHtml(datos.volver.href)}">${escaparHtml(datos.volver.texto)}</a></p>`,
    '</article>',
  ].join('')
}

export interface ContenidoDeLista {
  nombre: string
  descripcion?: string
  tituloLista: string
  enlaces: Enlace[]
  volver?: Enlace
}

/** Una zona o la portada: un título, una entradilla y la lista de lo que contiene. */
export function contenidoDeLista(datos: ContenidoDeLista): string {
  return [
    '<article class="estatico">',
    `<h1>${escaparHtml(datos.nombre)}</h1>`,
    parrafo(datos.descripcion),
    titulo(datos.tituloLista),
    lista(datos.enlaces),
    datos.volver
      ? `<p><a href="${escaparHtml(datos.volver.href)}">${escaparHtml(datos.volver.texto)}</a></p>`
      : '',
    '</article>',
  ].join('')
}
