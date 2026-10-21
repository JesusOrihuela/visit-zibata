import { describe, expect, it } from 'vitest'
import { salidaDe } from '../src/lib/eventos.ts'
import { atenderApi } from './api.ts'
import type { Base, Sentencia } from './cuenta.ts'
import {
  APUNTE_EVENTO,
  envioDe,
  eventoDe,
  MAXIMO_BYTES,
  MAXIMO_POR_ENVIO,
  origenDe,
  pideNoSerMedido,
  SALIDAS,
  TIPOS,
} from './eventos.ts'

/** Un lugar, una zona y una categoría que existen de verdad: salen de `data/`, no se inventan. */
const lugar = 'tomassa'
const zona = 'plaza-luna'
const categoria = 'desayunos-y-cafe'

describe('un evento', () => {
  it('acepta cada tipo con un destino del catálogo', () => {
    expect(eventoDe({ tipo: 'ficha', destino: lugar })).toEqual({
      tipo: 'ficha',
      destino: lugar,
      detalle: '',
    })
    expect(eventoDe({ tipo: 'compartir', destino: lugar })).toMatchObject({ tipo: 'compartir' })
    expect(eventoDe({ tipo: 'filtro', destino: categoria })).toMatchObject({ destino: categoria })
    expect(eventoDe({ tipo: 'filtro', destino: zona })).toMatchObject({ destino: zona })
    expect(eventoDe({ tipo: 'filtro', destino: 'abierto-ahora' })).not.toBeNull()
    expect(eventoDe({ tipo: 'mapa', destino: zona })).not.toBeNull()
    expect(eventoDe({ tipo: 'mapa', destino: 'explora' })).not.toBeNull()
    expect(eventoDe({ tipo: 'busqueda', destino: 'sin-resultados' })).not.toBeNull()
    expect(eventoDe({ tipo: 'idioma', destino: 'en' })).not.toBeNull()
  })

  it('las salidas llevan a dónde salen, de una lista cerrada', () => {
    for (const salida of SALIDAS) {
      expect(eventoDe({ tipo: 'salida', destino: lugar, detalle: salida })).toEqual({
        tipo: 'salida',
        destino: lugar,
        detalle: salida,
      })
    }
    // La salida de una zona es "Cómo llegar a la zona".
    expect(eventoDe({ tipo: 'salida', destino: zona, detalle: 'maps' })).not.toBeNull()
    expect(eventoDe({ tipo: 'salida', destino: lugar, detalle: 'correo' })).toBeNull()
    expect(eventoDe({ tipo: 'salida', destino: lugar })).toBeNull()
  })

  it('descarta todo lo que no está en el catálogo o en la lista de su tipo', () => {
    const malos = [
      { tipo: 'ficha', destino: 'no-existe' },
      { tipo: 'ficha', destino: zona }, // una zona no es una ficha
      { tipo: 'compartir', destino: zona },
      { tipo: 'mapa', destino: lugar },
      { tipo: 'busqueda', destino: 'pizza' },
      { tipo: 'idioma', destino: 'fr' },
      { tipo: 'origen', destino: 'buscador' }, // lo apunta el servidor, no el navegador
      { tipo: 'desconocido', destino: lugar },
      { tipo: 'ficha' },
      { destino: lugar },
      null,
      'ficha',
      42,
    ]
    for (const malo of malos) expect(eventoDe(malo)).toBeNull()
  })

  it('nunca guarda texto libre: ni como destino ni como detalle', () => {
    expect(eventoDe({ tipo: 'busqueda', destino: 'quiero una pizza para juan' })).toBeNull()
    expect(eventoDe({ tipo: 'ficha', destino: lugar, detalle: 'juan@correo.com' })).toEqual({
      tipo: 'ficha',
      destino: lugar,
      detalle: '',
    })
  })

  it('todo tipo de la lista tiene su regla', () => {
    // Si se añade un tipo y se olvida su regla, esto falla en vez de aceptar cualquier destino.
    for (const tipo of TIPOS) expect(eventoDe({ tipo, destino: '' })).toBeNull()
  })

  it('los identificadores del catálogo no chocan entre sí, que es lo que permite no guardar su clase', () => {
    const palabras = ['abierto-ahora', 'explora', 'con-resultados', 'sin-resultados', 'es', 'en']
    for (const palabra of palabras) {
      expect(eventoDe({ tipo: 'ficha', destino: palabra })).toBeNull()
    }
    // Una categoría no es una zona ni un lugar.
    expect(eventoDe({ tipo: 'ficha', destino: categoria })).toBeNull()
    expect(eventoDe({ tipo: 'mapa', destino: categoria })).toBeNull()
  })
})

describe('lo que la ficha manda y lo que el Worker acepta', () => {
  // Las claves de los enlaces de contacto de PlaceDetail.tsx. Si se añade uno allí, hay que añadirlo aquí
  // y en `salidaDe`; esta prueba existe porque un nombre distinto en cada lado se descarta sin avisar.
  const CLAVES = [
    'phone',
    'whatsapp',
    'website',
    'instagram',
    'facebook',
    'tiktok',
    'rappi',
    'uber-eats',
    'didi-food',
  ]

  it('cada enlace de contacto se cuenta con un nombre que el Worker guarda', () => {
    for (const clave of CLAVES) {
      const salida = salidaDe(clave)
      expect(salida, `${clave} no tiene nombre de salida`).not.toBeNull()
      expect(
        eventoDe({ tipo: 'salida', destino: lugar, detalle: salida }),
        `${clave} -> ${salida} se descarta`,
      ).not.toBeNull()
    }
  })

  it('y las salidas que el Worker conoce se alcanzan todas: contacto o Cómo llegar', () => {
    const alcanzables = new Set([...CLAVES.map((clave) => salidaDe(clave)), 'maps'])
    for (const salida of SALIDAS) expect(alcanzables.has(salida), salida).toBe(true)
  })

  it('una clave desconocida no se cuenta', () => {
    expect(salidaDe('myspace')).toBeNull()
  })
})

describe('un envío', () => {
  it('conserva solo los eventos válidos y no se cae por uno malo', () => {
    const envio = envioDe({
      idioma: 'es',
      eventos: [
        { tipo: 'ficha', destino: lugar },
        { tipo: 'ficha', destino: 'no-existe' },
        { tipo: 'filtro', destino: categoria },
      ],
    })
    expect(envio?.eventos).toHaveLength(2)
    expect(envio?.idioma).toBe('es')
  })

  it('exige la forma: idioma conocido y una lista', () => {
    expect(envioDe({ idioma: 'fr', eventos: [] })).toBeNull()
    expect(envioDe({ idioma: 'es' })).toBeNull()
    expect(envioDe({ idioma: 'es', eventos: 'ficha' })).toBeNull()
    expect(envioDe(null)).toBeNull()
    expect(envioDe([])).toBeNull()
  })

  it('corta por arriba: más de veinte no entran', () => {
    const muchos = Array.from({ length: 200 }, () => ({ tipo: 'ficha', destino: lugar }))
    expect(envioDe({ idioma: 'en', eventos: muchos })?.eventos).toHaveLength(MAXIMO_POR_ENVIO)
  })
})

describe('de dónde llegó una entrada', () => {
  const sitio = 'visitzibata.com'

  it('sin referente es directo', () => {
    expect(origenDe(null, sitio)).toBe('directo')
    expect(origenDe('', sitio)).toBe('directo')
  })

  it('reconoce buscadores, redes y mensajería', () => {
    expect(origenDe('https://www.google.com/', sitio)).toBe('buscador')
    expect(origenDe('https://www.google.com.mx/', sitio)).toBe('buscador')
    expect(origenDe('https://duckduckgo.com/', sitio)).toBe('buscador')
    expect(origenDe('android-app://com.google.android.googlequicksearchbox', sitio)).toBe(
      'buscador',
    )
    expect(origenDe('https://l.facebook.com/l.php?u=algo', sitio)).toBe('redes')
    expect(origenDe('https://l.instagram.com/', sitio)).toBe('redes')
    expect(origenDe('https://t.co/abc', sitio)).toBe('redes')
    expect(origenDe('https://web.whatsapp.com/', sitio)).toBe('mensajeria')
    expect(origenDe('https://t.me/canal', sitio)).toBe('mensajeria')
  })

  it('lo demás es otro, y un referente roto no tira nada', () => {
    expect(origenDe('https://un-blog.example/post', sitio)).toBe('otro')
    expect(origenDe('android-app://com.google.android.gm', sitio)).toBe('otro')
    expect(origenDe('esto no es una url', sitio)).toBe('otro')
  })

  it('un dominio que solo se parece no cuenta', () => {
    expect(origenDe('https://notgoogle.com/', sitio)).toBe('otro')
    expect(origenDe('https://google.com.estafa.example/', sitio)).toBe('otro')
    expect(origenDe('https://facebook.com.estafa.example/', sitio)).toBe('otro')
  })

  it('la propia guía no es un origen', () => {
    expect(origenDe('https://visitzibata.com/zona/plaza-luna', sitio)).toBeNull()
    expect(origenDe('https://www.visitzibata.com/', sitio)).toBeNull()
  })
})

describe('la señal de privacidad en el servidor', () => {
  it('Sec-GPC y DNT piden no ser medido; su ausencia o un 0, no', () => {
    expect(pideNoSerMedido(new Headers({ 'sec-gpc': '1' }))).toBe(true)
    expect(pideNoSerMedido(new Headers({ dnt: '1' }))).toBe(true)
    expect(pideNoSerMedido(new Headers({ dnt: '0' }))).toBe(false)
    expect(pideNoSerMedido(new Headers())).toBe(false)
  })
})

describe('el apunte', () => {
  it('es un UPSERT sobre la clave completa: el contador sube y la tabla no crece', () => {
    expect(APUNTE_EVENTO).toContain('ON CONFLICT(fecha, tipo, destino, detalle, idioma)')
    expect(APUNTE_EVENTO).toContain('cuenta = cuenta + 1')
  })

  it('no guarda nada que identifique: solo estas columnas', () => {
    const columnas = APUNTE_EVENTO.match(/INSERT INTO eventos \(([^)]+)\)/)?.[1]
    expect(columnas?.split(',').map((columna) => columna.trim())).toEqual([
      'fecha',
      'tipo',
      'destino',
      'detalle',
      'idioma',
      'cuenta',
    ])
  })
})

/** Una base falsa que recuerda lo que se le pidió. */
function baseFalsa(falla = false) {
  const apuntes: unknown[][] = []
  const base: Base = {
    prepare: (sql: string): Sentencia => {
      const sentencia: Sentencia & { valores: unknown[]; sql: string } = {
        sql,
        valores: [],
        bind(...valores) {
          this.valores = valores
          return this
        },
        run: async () => ({}),
        first: async () => null,
        all: async () => ({ results: [] }),
      }
      return sentencia
    },
    batch: async (sentencias) => {
      if (falla) throw new Error('no such table: eventos')
      for (const sentencia of sentencias) {
        apuntes.push((sentencia as unknown as { valores: unknown[] }).valores)
      }
      return []
    },
  }
  return { base, apuntes }
}

const enviar = (cuerpo: string, extra: HeadersInit = {}) =>
  new Request('https://visitzibata.com/api/evento', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extra },
    body: cuerpo,
  })

describe('POST /api/evento', () => {
  const valido = JSON.stringify({
    idioma: 'es',
    eventos: [
      { tipo: 'ficha', destino: lugar },
      { tipo: 'salida', destino: lugar, detalle: 'whatsapp' },
    ],
  })

  it('guarda un contador por evento y responde 204', async () => {
    const { base, apuntes } = baseFalsa()
    const respuesta = await atenderApi(enviar(valido), { ANALITICA: base })
    expect(respuesta?.status).toBe(204)
    expect(apuntes).toHaveLength(2)
    expect(apuntes[0]).toEqual([
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      'ficha',
      lugar,
      '',
      'es',
    ])
    expect(apuntes[1]?.slice(1)).toEqual(['salida', lugar, 'whatsapp', 'es'])
  })

  it('no mira quién lo manda: la credencial, el user agent y la IP no entran', async () => {
    const { base, apuntes } = baseFalsa()
    await atenderApi(
      enviar(valido, {
        'x-zibata-cuenta': 'a'.repeat(43),
        'user-agent': 'Mozilla/5.0',
        'cf-connecting-ip': '203.0.113.7',
      }),
      { ANALITICA: base },
    )
    const guardado = JSON.stringify(apuntes)
    expect(guardado).not.toContain('a'.repeat(43))
    expect(guardado).not.toContain('Mozilla')
    expect(guardado).not.toContain('203.0.113.7')
  })

  it('responde 204 aunque la tabla no exista: contar no puede romper nada', async () => {
    const { base } = baseFalsa(true)
    const respuesta = await atenderApi(enviar(valido), { ANALITICA: base })
    expect(respuesta?.status).toBe(204)
  })

  it('un envío sin eventos válidos no toca la base', async () => {
    const { base, apuntes } = baseFalsa()
    const vacio = JSON.stringify({ idioma: 'es', eventos: [{ tipo: 'ficha', destino: 'x' }] })
    expect((await atenderApi(enviar(vacio), { ANALITICA: base }))?.status).toBe(204)
    expect(apuntes).toHaveLength(0)
  })

  it('rechaza lo que no es un envío', async () => {
    const { base } = baseFalsa()
    expect((await atenderApi(enviar('no es json'), { ANALITICA: base }))?.status).toBe(400)
    expect(
      (await atenderApi(enviar('{"idioma":"fr","eventos":[]}'), { ANALITICA: base }))?.status,
    ).toBe(400)
  })

  it('rechaza un cuerpo demasiado grande sin leerlo entero', async () => {
    const { base } = baseFalsa()
    const grande = JSON.stringify({ idioma: 'es', eventos: [], relleno: 'x'.repeat(MAXIMO_BYTES) })
    expect((await atenderApi(enviar(grande), { ANALITICA: base }))?.status).toBe(413)
  })

  it('solo acepta POST', async () => {
    const { base } = baseFalsa()
    const get = new Request('https://visitzibata.com/api/evento')
    expect((await atenderApi(get, { ANALITICA: base }))?.status).toBe(404)
  })
})
