import { describe, expect, it } from 'vitest'
import categoriasJson from '../data/commercial/categories.json' with { type: 'json' }
import lugaresJson from '../data/commercial/places.json' with { type: 'json' }
import plazasJson from '../data/commercial/plazas.json' with { type: 'json' }
import { type CommercialDataset, deriveCategoryIds } from '../src/data/relations.ts'
import { CategoriesFileSchema, PlacesFileSchema, PlazasFileSchema } from '../src/data/schemas.ts'
import type { Place, Plaza } from '../src/types/domain.ts'
import { bytesDeBase64, formatoDeImagen, prepararFoto, prepararNegocio } from './contenido.ts'

const categorias = CategoriesFileSchema.parse(categoriasJson)
const plazas = PlazasFileSchema.parse(plazasJson)
const lugares = PlacesFileSchema.parse(lugaresJson)
const dataset: CommercialDataset = {
  categories: categorias.categories,
  plazas: plazas.plazas,
  places: lugares.places,
}
const crudo = {
  categories: categoriasJson as unknown as Record<string, unknown>,
  plazas: plazasJson as unknown as Record<string, unknown>,
  places: lugaresJson as unknown as Record<string, unknown>,
}

const HOY = '2026-10-30'
const existente = dataset.places.find((fila) => fila.active && fila.description?.en) as Place
const plaza = dataset.plazas.find((fila) => fila.id === existente.plazaId) as Plaza
const giro = dataset.categories[0]?.giros[0]?.id ?? ''

const nuevo = (extra: Record<string, unknown> = {}) => ({
  nombre: `Local de prueba ${Date.now()}`,
  plazaId: plaza.id,
  giros: [giro],
  descripcionEs: 'Un local de prueba.',
  descripcionEn: 'A test place.',
  activo: true,
  ...extra,
})

const editar = (base: Place, extra: Record<string, unknown> = {}) => ({
  id: base.id,
  nombre: base.name,
  plazaId: base.plazaId,
  giros: base.giros,
  descripcionEs: base.description?.es ?? 'Texto',
  descripcionEn: base.description?.en ?? 'Text',
  activo: true,
  ...extra,
})

describe('preparar un negocio nuevo', () => {
  it('lo acepta, deriva el id del nombre y lo añade a su plaza', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ nombre: 'Panadería La Esquina' }),
      HOY,
    )
    expect(preparado.ok).toBe(true)
    if (!preparado.ok) return
    expect(preparado.nuevo).toBe(true)
    expect(preparado.place.id).toBe('panaderia-la-esquina')
    expect(preparado.place.slug).toBe('panaderia-la-esquina')

    const plazasNuevas = preparado.plazas.plazas as Plaza[]
    const tocada = plazasNuevas.find((fila) => fila.id === plaza.id)
    expect(tocada?.placeIds).toContain('panaderia-la-esquina')
  })

  it('si el slug choca en otra plaza, añade un número en vez de pisar el existente', () => {
    const carls = dataset.places.find((fila) => fila.id === 'carls-jr')
    const otra = dataset.plazas.find(
      (fila) =>
        fila.active &&
        fila.id !== carls?.plazaId &&
        !dataset.places.some((place) => place.plazaId === fila.id && place.name === "Carl's Jr."),
    )
    if (!carls || !otra) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ nombre: "Carl's Jr.", plazaId: otra.id }),
      HOY,
    )
    expect(preparado.ok).toBe(true)
    if (!preparado.ok) return
    expect(preparado.place.id).toBe('carls-jr-2')
  })

  it('rechaza el mismo nombre en la misma plaza, donde la zona no lo distingue', () => {
    const otro = dataset.places.find(
      (fila) => fila.active && fila.id !== existente.id && fila.plazaId === existente.plazaId,
    )
    if (!otro) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ nombre: otro.name, plazaId: existente.plazaId }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('nombre')
  })

  it('rechaza la misma descripción en la misma plaza', () => {
    const otro = dataset.places.find(
      (fila) =>
        fila.active &&
        fila.id !== existente.id &&
        fila.plazaId === existente.plazaId &&
        fila.description?.es &&
        fila.description.en,
    )
    if (!otro?.description) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({
        plazaId: existente.plazaId,
        descripcionEs: otro.description.es,
        descripcionEn: otro.description.en ?? '',
      }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('descripción')
  })

  it('rechaza un nombre que no cabe en el título de la página', () => {
    const preparado = prepararNegocio(dataset, crudo, nuevo({ nombre: 'A'.repeat(50) }), HOY)
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('título')
  })

  it('rechaza descripciones que solo difieren después del recorte del prerender', () => {
    const conLarga = dataset.places.find(
      (fila) => fila.active && fila.plazaId === existente.plazaId,
    )
    if (!conLarga) return
    const recorte = 'A'.repeat(160)
    const datasetLargo = {
      ...dataset,
      places: dataset.places.map((fila) =>
        fila.id === conLarga.id
          ? { ...fila, description: { es: `${recorte} original`, en: `${recorte} original` } }
          : fila,
      ),
    }
    const preparado = prepararNegocio(
      datasetLargo,
      crudo,
      nuevo({
        plazaId: conLarga.plazaId,
        nombre: 'Local de descripción recortada',
        descripcionEs: `${recorte} otra`,
        descripcionEn: `${recorte} otra`,
      }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('descripción')
  })

  it('rechaza un nombre que repite el título de una página de información', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ nombre: 'Privacidad y términos' }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('página de información')
  })

  it('rechaza un nombre que repite el de una plaza', () => {
    const plazaObjetivo = dataset.plazas.find((fila) => fila.active)
    const destino = dataset.plazas.find((fila) => fila.active && fila.id !== plazaObjetivo?.id)
    if (!plazaObjetivo || !destino) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ nombre: plazaObjetivo.name, plazaId: destino.id }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('plaza')
  })

  it('rechaza una descripción que repite la de una plaza', () => {
    const plazaConTexto = dataset.plazas.find(
      (fila) => fila.active && fila.description?.es && fila.description.en,
    )
    if (!plazaConTexto?.description) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({
        descripcionEs: plazaConTexto.description.es,
        descripcionEn: plazaConTexto.description.en ?? '',
      }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('plaza')
  })

  it('permite el mismo nombre en otra plaza', () => {
    const otro = dataset.places.find((fila) => fila.active)
    const destino = dataset.plazas.find(
      (fila) =>
        fila.active &&
        fila.id !== otro?.plazaId &&
        !dataset.places.some((place) => place.plazaId === fila.id && place.name === otro?.name),
    )
    if (!otro || !destino) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ nombre: otro.name, plazaId: destino.id }),
      HOY,
    )
    expect(preparado.ok).toBe(true)
  })

  it('normaliza los espacios del nombre', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ nombre: '  Panadería   La   Esquina  ' }),
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.name).toBe('Panadería La Esquina')
    expect(preparado.place.id).toBe('panaderia-la-esquina')
  })

  it('marca la verificación de hoy con la fuente del panel', () => {
    const preparado = prepararNegocio(dataset, crudo, nuevo(), HOY)
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.verification?.lastVerifiedAt).toBe(HOY)
    expect(preparado.place.verification?.sources).toContain(`campo:${HOY}`)
    expect(preparado.place.verification?.status).toBe('active')
  })

  it('recalcula las categorías de la plaza con el giro nuevo', () => {
    const sinCategoria = dataset.categories.find(
      (categoria) => categoria.giros.length > 0 && !plaza.categories.includes(categoria.id),
    )
    if (!sinCategoria) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ giros: [sinCategoria.giros[0]?.id] }),
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    const tocada = (preparado.plazas.plazas as Plaza[]).find((fila) => fila.id === plaza.id)
    expect(tocada?.categories).toContain(sinCategoria.id)
  })

  it('avisa si se guarda un local visible en una plaza inactiva', () => {
    const inactiva = dataset.plazas.find((fila) => !fila.active)
    if (!inactiva) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      nuevo({ plazaId: inactiva.id, nombre: 'Local en plaza inactiva' }),
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.avisos.join(' ')).toContain('plaza inactiva')
  })

  it('el archivo conserva los demás locales y solo cambia el que se tocó', () => {
    const preparado = prepararNegocio(dataset, crudo, nuevo(), HOY)
    if (!preparado.ok) throw new Error('no preparó')
    const filas = preparado.lugares.places as Record<string, unknown>[]
    expect(filas).toHaveLength(dataset.places.length + 1)
    expect(filas[0]?.id).toBe(dataset.places[0]?.id)
    expect(preparado.lugares.updatedAt).toBe(HOY)
  })
})

describe('editar un negocio existente', () => {
  it('conserva id y slug aunque cambie el nombre', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      {
        id: existente.id,
        nombre: `${existente.name} renovado`,
        plazaId: existente.plazaId,
        giros: existente.giros,
        descripcionEs: existente.description?.es ?? 'Texto',
        descripcionEn: existente.description?.en ?? 'Text',
        activo: true,
      },
      HOY,
    )
    expect(preparado.ok).toBe(true)
    if (!preparado.ok) return
    expect(preparado.place.id).toBe(existente.id)
    expect(preparado.place.slug).toBe(existente.slug)
    expect(preparado.place.name).toBe(`${existente.name} renovado`)
  })

  it('conserva las fotos y el resto de enlaces que el formulario no toca', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      {
        id: existente.id,
        nombre: existente.name,
        plazaId: existente.plazaId,
        giros: existente.giros,
        descripcionEs: existente.description?.es ?? 'Texto',
        descripcionEn: existente.description?.en ?? 'Text',
        activo: true,
      },
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.photos).toEqual(existente.photos)
    expect(preparado.place.links.rappi).toBe(existente.links.rappi)
  })

  it('conserva el estado de verificación y solo actualiza fecha y fuentes', () => {
    const conEstado =
      dataset.places.find((fila) => fila.active && fila.verification?.status === 'likely_active') ??
      dataset.places.find((fila) => fila.active && fila.verification)
    if (!conEstado?.verification) return
    const preparado = prepararNegocio(dataset, crudo, editar(conEstado), HOY)
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.verification?.status).toBe(conEstado.verification.status)
    expect(preparado.place.verification?.confidence).toBe(conEstado.verification.confidence)
    expect(preparado.place.verification?.lastVerifiedAt).toBe(HOY)
    expect(preparado.place.verification?.sources).toContain(`campo:${HOY}`)
  })

  it('respeta el orden de los giros que manda el formulario', () => {
    const conVarios = dataset.places.find((fila) => fila.active && fila.giros.length > 1)
    if (!conVarios) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      editar(conVarios, { giros: [...conVarios.giros].reverse() }),
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.giros).toEqual([...conVarios.giros].reverse())
  })

  it('un secundario marcado se añade al final y deja de ser secundario', () => {
    const conSecundario = dataset.places.find(
      (fila) => fila.active && fila.giros.length < 3 && fila.secundarios.length > 0,
    )
    const promovido = conSecundario?.secundarios[0]
    if (!conSecundario || !promovido) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      editar(conSecundario, { giros: [...conSecundario.giros, promovido], secundarios: [] }),
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.giros).toEqual([...conSecundario.giros, promovido])
    expect(preparado.place.secundarios).not.toContain(promovido)
  })

  it('conserva los secundarios que manda el formulario, sin mezclarlos con los principales', () => {
    const conSecundario = dataset.places.find(
      (fila) => fila.active && fila.secundarios.length > 0 && fila.giros.length < 3,
    )
    if (!conSecundario) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      editar(conSecundario, {
        giros: [...conSecundario.giros].reverse(),
        secundarios: conSecundario.secundarios,
      }),
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.giros).toEqual([...conSecundario.giros].reverse())
    expect(preparado.place.secundarios).toEqual(conSecundario.secundarios)
  })

  it('rechaza un giro que va como principal y como secundario', () => {
    const conSecundario = dataset.places.find(
      (fila) => fila.active && fila.giros.length > 0 && fila.giros.length < 3,
    )
    if (!conSecundario) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      editar(conSecundario, {
        giros: [conSecundario.giros[0]],
        secundarios: [conSecundario.giros[0]],
      }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('principal y secundario')
  })

  it('rechaza pasar de tres giros entre principales y secundarios', () => {
    const disponibles = dataset.categories.flatMap((categoria) =>
      categoria.giros.map((giro) => giro.id),
    )
    const cuatro = [...new Set(disponibles)].slice(0, 4)
    if (cuatro.length < 4) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      editar(existente, {
        giros: cuatro.slice(0, 3),
        secundarios: [cuatro[3]],
      }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('tope son tres')
  })

  it('ocultar no convierte el local en cerrado', () => {
    const conEstado = dataset.places.find((fila) => fila.active && fila.verification)
    if (!conEstado?.verification) return
    const preparado = prepararNegocio(dataset, crudo, editar(conEstado, { activo: false }), HOY)
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.active).toBe(false)
    expect(preparado.place.verification?.status).toBe(conEstado.verification.status)
  })

  it('cambiar los giros actualiza las categorías de la plaza', () => {
    const plazaActual = dataset.plazas.find((fila) => fila.id === existente.plazaId)
    if (!plazaActual) return
    const sinCategoria = dataset.categories.find(
      (categoria) => categoria.giros.length > 0 && !plazaActual.categories.includes(categoria.id),
    )
    if (!sinCategoria) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      editar(existente, { giros: [sinCategoria.giros[0]?.id] }),
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    const tocada = (preparado.plazas.plazas as Plaza[]).find(
      (fila) => fila.id === existente.plazaId,
    )
    expect(tocada?.categories).toContain(sinCategoria.id)
  })

  it('ocultar un local actualiza las categorías visibles de su plaza', () => {
    const preparado = prepararNegocio(dataset, crudo, editar(existente, { activo: false }), HOY)
    if (!preparado.ok) throw new Error('no preparó')
    const tocada = (preparado.plazas.plazas as Plaza[]).find(
      (fila) => fila.id === existente.plazaId,
    )
    if (!tocada) return
    const visibles = dataset.places
      .map((fila) => (fila.id === existente.id ? { ...fila, active: false } : fila))
      .filter((fila) => fila.active && fila.plazaId === existente.plazaId)
    expect(tocada.categories).toEqual(deriveCategoryIds(visibles, dataset.categories))
  })

  it('quitar el cierre temporal lo borra al guardar', () => {
    const cerrado: Place = {
      ...existente,
      active: false,
      cierre: { motivo: 'remodelacion', desde: '2026-10-01' },
      verification: existente.verification
        ? { ...existente.verification, status: 'closed' }
        : {
            status: 'closed',
            confidence: 'high',
            lastVerifiedAt: '2026-10-01',
            sources: ['https://ejemplo.com'],
          },
    }
    const conCerrado = {
      ...dataset,
      places: dataset.places.map((fila) => (fila.id === existente.id ? cerrado : fila)),
    }
    const preparado = prepararNegocio(conCerrado, crudo, editar(cerrado, { cierre: null }), HOY)
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.active).toBe(true)
    expect(preparado.place.cierre).toBeUndefined()
  })

  it('guarda el motivo y la fecha del cierre temporal', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      editar(existente, { cierre: { motivo: 'vacaciones', desde: '2026-10-20' } }),
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.cierre).toEqual({ motivo: 'vacaciones', desde: '2026-10-20' })
  })

  it('rechaza un cierre temporal que empieza en el futuro', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      editar(existente, { cierre: { motivo: 'traspaso', desde: '2026-12-01' } }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('futuro')
  })

  it('cambia el texto de una foto y respeta su orden sin tocar el archivo', () => {
    const conFoto: Place = {
      ...existente,
      photos: [
        {
          src: 'images/places/prueba/portada.webp',
          alt: 'Fachada',
          width: 1200,
          height: 900,
          placeholder: '#aabbcc',
        },
        {
          src: 'images/places/prueba/terraza.webp',
          alt: 'Terraza',
          width: 1200,
          height: 900,
          placeholder: '#ccbbaa',
        },
      ],
    }
    const conFotos = {
      ...dataset,
      places: dataset.places.map((fila) => (fila.id === existente.id ? conFoto : fila)),
    }
    const preparado = prepararNegocio(
      conFotos,
      crudo,
      editar(conFoto, {
        fotos: [
          { src: 'images/places/prueba/terraza.webp', alt: 'Terraza al atardecer' },
          { src: 'images/places/prueba/portada.webp', alt: 'Fachada' },
        ],
      }),
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.place.photos.map((foto) => foto.src)).toEqual([
      'images/places/prueba/terraza.webp',
      'images/places/prueba/portada.webp',
    ])
    expect(preparado.place.photos[0]?.alt).toBe('Terraza al atardecer')
    expect(preparado.place.photos[0]?.width).toBe(1200)
  })

  it('rechaza una foto que ya no está en la galería', () => {
    const preparado = prepararNegocio(
      dataset,
      crudo,
      editar(existente, { fotos: [{ src: 'images/places/prueba/fantasma.webp', alt: 'Nada' }] }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('ya no existe')
  })

  it('al moverlo de plaza, sale de una y entra en la otra', () => {
    const otra = dataset.plazas.find((fila) => fila.active && fila.id !== existente.plazaId)
    if (!otra) return
    const preparado = prepararNegocio(
      dataset,
      crudo,
      {
        id: existente.id,
        nombre: existente.name,
        plazaId: otra.id,
        giros: existente.giros,
        descripcionEs: existente.description?.es ?? 'Texto',
        descripcionEn: existente.description?.en ?? 'Text',
        activo: true,
      },
      HOY,
    )
    if (!preparado.ok) throw new Error('no preparó')
    const plazasNuevas = preparado.plazas.plazas as Plaza[]
    expect(plazasNuevas.find((fila) => fila.id === existente.plazaId)?.placeIds).not.toContain(
      existente.id,
    )
    expect(plazasNuevas.find((fila) => fila.id === otra.id)?.placeIds).toContain(existente.id)
    const categoria = dataset.categories.find((fila) =>
      fila.giros.some((giro) => giro.id === existente.giros[0]),
    )
    if (categoria) {
      expect(plazasNuevas.find((fila) => fila.id === otra.id)?.categories).toContain(categoria.id)
    }
  })
})

describe('lo que se rechaza', () => {
  it('un giro que no existe', () => {
    const resultado = prepararNegocio(dataset, crudo, nuevo({ giros: ['no-existe'] }), HOY)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.problemas.join(' ')).toContain('no existe')
  })

  it('sin descripción en inglés, que el build exige', () => {
    const resultado = prepararNegocio(dataset, crudo, nuevo({ descripcionEn: '' }), HOY)
    expect(resultado.ok).toBe(false)
  })

  it('con una sola de las dos coordenadas', () => {
    const resultado = prepararNegocio(dataset, crudo, nuevo({ lat: 20.68 }), HOY)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.problemas).toContain('Indica las dos coordenadas o ninguna')
  })

  it('una plaza que no existe', () => {
    const resultado = prepararNegocio(dataset, crudo, nuevo({ plazaId: 'no-existe' }), HOY)
    expect(resultado.ok).toBe(false)
  })

  it('editar un id que ya no está', () => {
    const resultado = prepararNegocio(dataset, crudo, nuevo({ id: 'no-existe' }), HOY)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.problemas).toContain('Ese negocio ya no existe')
  })
})

const CABECERA_WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
])
const FOTO_BASE64 = Buffer.from(CABECERA_WEBP).toString('base64')

const fotoEntrada = (extra: Record<string, unknown> = {}) => ({
  id: existente.id,
  archivo: 'Terraza Principal.webp',
  alt: 'Terraza',
  ancho: 1600,
  alto: 1200,
  placeholder: '#aabbcc',
  datos: FOTO_BASE64,
  ...extra,
})

describe('preparar una foto', () => {
  it('la registra en el local con su ruta y su texto alternativo', () => {
    const preparado = prepararFoto(dataset, crudo, fotoEntrada(), HOY)
    expect(preparado.ok).toBe(true)
    if (!preparado.ok) return
    expect(preparado.foto.src).toBe(`images/places/${existente.id}/terraza-principal.webp`)
    const lugares = preparado.lugares as { places: Place[] }
    expect(lugares.places.find((fila) => fila.id === existente.id)?.photos.at(-1)?.alt).toBe(
      'Terraza',
    )
  })

  it('no pisa una foto que ya usa ese nombre', () => {
    const conFoto: Place = {
      ...existente,
      photos: [
        {
          src: `images/places/${existente.id}/terraza-principal.webp`,
          alt: 'Vieja',
          width: 10,
          height: 10,
        },
      ],
    }
    const conFotos = {
      ...dataset,
      places: dataset.places.map((fila) => (fila.id === existente.id ? conFoto : fila)),
    }
    const preparado = prepararFoto(conFotos, crudo, fotoEntrada(), HOY)
    if (!preparado.ok) throw new Error('no preparó')
    expect(preparado.foto.src.endsWith('terraza-principal-2.webp')).toBe(true)
  })

  it('rechaza lo que no es una imagen', () => {
    const preparado = prepararFoto(
      dataset,
      crudo,
      fotoEntrada({ datos: Buffer.from('no soy una imagen').toString('base64') }),
      HOY,
    )
    expect(preparado.ok).toBe(false)
    if (preparado.ok) return
    expect(preparado.problemas.join(' ')).toContain('no es una imagen')
  })

  it('rechaza un negocio que ya no existe', () => {
    const preparado = prepararFoto(dataset, crudo, fotoEntrada({ id: 'no-existe' }), HOY)
    expect(preparado.ok).toBe(false)
  })
})

describe('los formatos de imagen', () => {
  it('se reconocen por los bytes, no por la extensión', () => {
    expect(formatoDeImagen(CABECERA_WEBP)).toBe('webp')
    expect(formatoDeImagen(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      'jpg',
    )
    expect(formatoDeImagen(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      'png',
    )
    expect(formatoDeImagen(new Uint8Array([1, 2, 3]))).toBeNull()
  })

  it('el base64 inválido se rechaza en vez de decodificarse a medias', () => {
    expect(bytesDeBase64('no-es-base64!')).toBeNull()
    expect(bytesDeBase64('')).not.toBeNull()
  })
})
