import { describe, expect, it } from 'vitest'
import { contenidoDeLista, contenidoDeLugar, escaparHtml } from './contenido.ts'

const lugar = {
  nombre: 'Tomassa',
  giros: ['Pasta', 'Italiana'],
  plaza: { texto: 'Paseo Zibatá', href: '/zona/paseo-zibata' },
  direccion: 'Av. Paseo de las Pitahayas 501',
  descripcion: 'Pasta fresca todos los días.',
  dias: [
    { dia: 'Lunes', franjas: [], cerrado: 'Cerrado' },
    { dia: 'Martes', franjas: ['14:00-21:00'], cerrado: 'Cerrado' },
  ],
  tituloHorario: 'Horario',
  contacto: [{ texto: 'Instagram', href: 'https://instagram.com/x' }],
  tituloContacto: 'Contacto y redes',
  vecinos: [{ texto: 'Sinforosa Café', href: '/lugar/sinforosa' }],
  tituloVecinos: 'Más en Paseo Zibatá',
  volver: { texto: 'Ver el mapa', href: '/' },
}

describe('la ficha escrita', () => {
  it('trae el nombre como encabezado y el texto de verdad', () => {
    const html = contenidoDeLugar(lugar)
    expect(html).toContain('<h1>Tomassa</h1>')
    expect(html).toContain('Pasta · Italiana')
    expect(html).toContain('Pasta fresca todos los días.')
  })

  it('trae enlaces de verdad, que es lo que un rastreador sigue', () => {
    // Sin esto el sitio eran 234 URL sueltas sin nada que las uniera, y Search Console lo decía:
    // "Página de referencia: no se ha detectado ninguna".
    const html = contenidoDeLugar(lugar)
    expect(html).toContain('href="/zona/paseo-zibata"')
    expect(html).toContain('href="/lugar/sinforosa"')
    expect(html).toContain('href="/"')
  })

  it('el horario dice qué días cierra, no los esconde', () => {
    const html = contenidoDeLugar(lugar)
    expect(html).toContain('<dt>Lunes</dt><dd>Cerrado</dd>')
    expect(html).toContain('<dt>Martes</dt><dd>14:00-21:00</dd>')
  })

  it('no dibuja secciones vacías', () => {
    const html = contenidoDeLugar({
      ...lugar,
      contacto: [],
      vecinos: [],
      dias: [],
      descripcion: undefined,
    })
    expect(html).not.toContain('Contacto y redes')
    expect(html).not.toContain('Más en Paseo Zibatá')
    expect(html).not.toContain('Horario')
  })
})

describe('el escapado', () => {
  it('neutraliza lo que viene de los datos', () => {
    // Son nombres de negocios reales: llevan comillas, ampersands y apóstrofos.
    expect(escaparHtml(`D'Lu Coffee & Bakery`)).toBe('D&#39;Lu Coffee &amp; Bakery')
    expect(escaparHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('un nombre con etiquetas no se convierte en etiquetas', () => {
    const html = contenidoDeLugar({ ...lugar, nombre: '<img src=x onerror=alert(1)>' })
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('un enlace con comillas no se sale de su atributo', () => {
    const html = contenidoDeLista({
      nombre: 'Zona',
      tituloLista: 'Qué hay',
      enlaces: [{ texto: 'x', href: '/a" onclick="alert(1)' }],
    })
    expect(html).toContain('href="/a&quot; onclick=&quot;alert(1)"')
  })
})

describe('la lista escrita', () => {
  it('sirve para una zona y para la portada', () => {
    const html = contenidoDeLista({
      nombre: 'Paseo Zibatá',
      descripcion: 'Plaza con terrazas.',
      tituloLista: 'Qué hay aquí',
      enlaces: [{ texto: 'Tomassa', href: '/lugar/tomassa' }],
      volver: { texto: 'Ver el mapa', href: '/' },
    })
    expect(html).toContain('<h1>Paseo Zibatá</h1>')
    expect(html).toContain('href="/lugar/tomassa"')
    expect(html).toContain('href="/"')
  })
})
