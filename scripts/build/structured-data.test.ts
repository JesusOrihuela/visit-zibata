import { describe, expect, it } from 'vitest'
import type { Category, Place, Plaza } from '../../src/types/domain.ts'
import { bloque, listado, negocio } from './structured-data.ts'

/*
 * Datos de prueba propios en vez de `src/test/fixtures.ts`: ese archivo arrastra el catálogo y con
 * él la configuración del mapa, que importa un JSON con las reglas de módulo de la aplicación y no
 * las de Node, bajo las que corre este script. Son tres literales, y mantienen la frontera donde
 * está: `structured-data.ts` es puro y solo necesita las formas, no el catálogo entero.
 */
const categoria = (id: string): Category =>
  ({
    id,
    slug: { es: id, en: id },
    label: { es: id },
    icon: 'coffee',
    order: 1,
    synonyms: [],
    giros: [],
  }) as Category

const hacerPlaza = (extra: Partial<Plaza> = {}): Plaza =>
  ({
    id: 'condesa',
    slug: 'condesa',
    name: 'Plaza Condesa',
    address: null,
    active: true,
    ...extra,
  }) as Plaza

const hacerLugar = (extra: Partial<Place> = {}): Place =>
  ({
    id: 'x',
    slug: 'x',
    name: 'x',
    plazaId: 'condesa',
    giros: ['pizza'],
    secundarios: [],
    description: null,
    hours: null,
    location: null,
    googleMapsUri: null,
    googlePlaceId: null,
    phone: null,
    photos: [],
    links: { website: null, instagram: null, facebook: null, tiktok: null, whatsapp: null },
    active: true,
    ...extra,
  }) as Place

const base = {
  plaza: hacerPlaza({ address: 'Av. Paseo de las Pitahayas 9-B, Zibatá' }),
  giros: ['Pizza'],
  url: 'https://visitzibata.com/lugar/x',
  plazaUrl: 'https://visitzibata.com/zona/condesa',
  image: 'https://visitzibata.com/og-image.png',
  locale: 'es' as const,
}

describe('datos estructurados de un local', () => {
  it('el tipo sale de la categoría, no todo es un restaurante', () => {
    const place = hacerLugar()
    const tipo = (id: string) => negocio({ ...base, place, category: categoria(id) })['@type']
    expect(tipo('panaderia-y-reposteria')).toBe('Bakery')
    expect(tipo('bar')).toBe('BarOrPub')
    expect(tipo('desayunos-y-cafe')).toBe('CafeOrCoffeeShop')
    expect(tipo('mexicana')).toBe('Restaurant')
    // "Otros" puede no ser comida: la guía va más allá, así que se queda en el tipo general.
    expect(tipo('otros')).toBe('LocalBusiness')
    // Una categoría que no esté en la tabla tampoco miente hacia abajo.
    expect(tipo('inventada')).toBe('LocalBusiness')
  })

  it('no dice que sirve comida lo que no es un establecimiento de comida', () => {
    const place = hacerLugar()
    expect(negocio({ ...base, place, category: categoria('mexicana') })).toHaveProperty(
      'servesCuisine',
      ['Pizza'],
    )
    expect(negocio({ ...base, place, category: categoria('otros') })).not.toHaveProperty(
      'servesCuisine',
    )
  })

  it('nunca publica horario, medias ni precios, aunque el dato exista', () => {
    const place = hacerLugar({ hours: { mon: [{ open: '09:00', close: '20:00' }] } as never })
    const datos = negocio({ ...base, place, category: categoria('mexicana') })
    // El horario es el único dato de la ficha que se pudre solo: un "Abierto ahora" equivocado
    // manda a alguien a una puerta cerrada. Entra cuando haya una segunda verificación.
    expect(datos).not.toHaveProperty('openingHours')
    expect(datos).not.toHaveProperty('openingHoursSpecification')
    expect(datos).not.toHaveProperty('aggregateRating')
    expect(datos).not.toHaveProperty('priceRange')
  })

  it('un campo que falta se omite, no se publica vacío', () => {
    const place = hacerLugar()
    const datos = negocio({
      ...base,
      place,
      plaza: hacerPlaza(),
      plazaUrl: undefined,
      image: undefined,
      category: categoria('mexicana'),
    })
    for (const clave of [
      'telephone',
      'geo',
      'hasMap',
      'sameAs',
      'address',
      'image',
      'description',
    ]) {
      expect(datos).not.toHaveProperty(clave)
    }
    // Lo que sí hay sigue estando: omitir no es quedarse sin marcado.
    expect(datos).toMatchObject({ '@type': 'Restaurant', name: 'x', url: base.url })
  })

  it('la dirección de la zona es la del local, con la localidad del propio proyecto', () => {
    const place = hacerLugar({ location: { lat: 20.68, lng: -100.31 } })
    expect(negocio({ ...base, place, category: categoria('mexicana') })).toMatchObject({
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Av. Paseo de las Pitahayas 9-B, Zibatá',
        addressLocality: 'El Marqués',
        addressRegion: 'Querétaro',
        addressCountry: 'MX',
      },
      geo: { '@type': 'GeoCoordinates', latitude: 20.68, longitude: -100.31 },
      containedInPlace: { '@type': 'Place', url: 'https://visitzibata.com/zona/condesa' },
    })
  })

  it('los enlaces de reparto no son perfiles del negocio', () => {
    const place = hacerLugar({
      links: {
        website: 'https://ejemplo.mx/',
        instagram: null,
        facebook: 'https://facebook.com/ejemplo',
        tiktok: null,
        whatsapp: null,
        rappi: 'https://rappi.com.mx/ejemplo',
      },
    })
    const datos = negocio({ ...base, place, category: categoria('mexicana') })
    expect(datos.sameAs).toEqual(['https://ejemplo.mx/', 'https://facebook.com/ejemplo'])
  })
})

describe('listado', () => {
  it('numera desde uno y no repite los datos de cada destino', () => {
    const datos = listado('Plaza Condesa', [
      { name: 'Uno', url: 'https://visitzibata.com/lugar/uno' },
      { name: 'Dos', url: 'https://visitzibata.com/lugar/dos' },
    ])
    expect(datos).toMatchObject({ '@type': 'ItemList', numberOfItems: 2 })
    expect(datos.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Uno', url: 'https://visitzibata.com/lugar/uno' },
      { '@type': 'ListItem', position: 2, name: 'Dos', url: 'https://visitzibata.com/lugar/dos' },
    ])
  })
})

describe('bloque', () => {
  it('una descripción con </script> no cierra la etiqueta antes de tiempo', () => {
    const html = bloque({ description: 'Mira esto </script><img onerror=alert(1)>' })
    expect(html).not.toContain('</script><img')
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    // Y sigue siendo JSON válido: `<` se lee como "<" al interpretarlo.
    const json = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    expect(JSON.parse(json)).toEqual({
      description: 'Mira esto </script><img onerror=alert(1)>',
    })
  })
})
