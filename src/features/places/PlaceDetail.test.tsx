// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../i18n/index.ts'
import { makePlace, plazasFixture } from '../../test/fixtures.ts'
import { renderWithCatalog } from '../../test/render.tsx'
import type { Place } from '../../types/domain.ts'
import { PlaceDetail } from './PlaceDetail.tsx'

const plaza = plazasFixture[0] as (typeof plazasFixture)[number]

async function setup(place: Place) {
  const props = {
    place,
    plaza,
    backLabel: 'Volver a Plaza Norte',
    onBack: vi.fn(),
    onClose: vi.fn(),
  }
  await renderWithCatalog(<PlaceDetail {...props} />)
  return props
}

describe('PlaceDetail', () => {
  it('muestra la información básica y el botón Cómo llegar a Google Maps', async () => {
    await setup(
      makePlace({
        id: 'cafe-aurora',
        plazaId: plaza.id,
        name: 'Café Aurora',
        giros: ['cafeteria'],
      }),
    )
    // El foco lo pone un efecto, así que se espera: sin esperar, la prueba gana la carrera a veces
    // y falla sin que nada esté roto.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Café Aurora' })).toHaveFocus(),
    )
    expect(screen.getByText('Plaza Norte')).toBeInTheDocument()
    const directions = screen.getByRole('link', { name: /Cómo llegar/ })
    expect(directions).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=20.68%2C-100.32',
    )
    expect(directions).toHaveAttribute('target', '_blank')
    expect(directions).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('excluye de los fragmentos de búsqueda el texto de interfaz, no lo que dice el local', async () => {
    const { container } = await renderWithCatalog(
      <PlaceDetail
        place={makePlace({
          id: 'cafe-aurora',
          plazaId: plaza.id,
          name: 'Café Aurora',
          giros: ['cafeteria'],
          description: { es: 'Café de especialidad.', en: 'Specialty coffee.' },
        })}
        plaza={plaza}
        backLabel="Volver a Plaza Norte"
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    // Google solo reconoce `data-nosnippet` en span, div y section. (El botón de compartir no se
    // dibuja en jsdom, que no trae hoja del sistema ni portapapeles; lo cubre la prueba E2E.)
    const excluidos = [...container.querySelectorAll('[data-nosnippet]')]
    expect(excluidos.map((el) => el.tagName.toLowerCase()).sort()).toEqual(['div', 'section'])
    const dentro = (elemento: HTMLElement) => Boolean(elemento.closest('[data-nosnippet]'))
    expect(dentro(screen.getByText('Abre Google Maps en una pestaña nueva'))).toBe(true)
    expect(dentro(screen.getByRole('region', { name: 'Solo para ti' }))).toBe(true)
    expect(dentro(screen.getByText('Café de especialidad.'))).toBe(false)
    expect(dentro(screen.getByText('Plaza Norte'))).toBe(false)
  })

  it('sin datos adicionales no muestra botones vacíos y lo indica', async () => {
    await setup(makePlace({ id: 'x', plazaId: plaza.id, name: 'Sin datos' }))
    expect(screen.queryByRole('heading', { name: 'Contacto y redes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Horario' })).not.toBeInTheDocument()
    expect(screen.getByText('Aún no tenemos más información de este lugar.')).toBeInTheDocument()
    // Sin fotografías no se dibuja un hueco con una ilustración genérica.
    expect(
      screen.queryByRole('img', { name: /Ilustración de la categoría/ }),
    ).not.toBeInTheDocument()
  })

  it('muestra solo los enlaces disponibles', async () => {
    await setup(
      makePlace({
        id: 'x',
        plazaId: plaza.id,
        name: 'Con redes',
        phone: '+524421234567',
        links: {
          website: 'https://ejemplo.mx',
          instagram: 'https://www.instagram.com/ejemplo/',
          facebook: null,
          tiktok: null,
          whatsapp: '+524421234567',
        },
      }),
    )
    const contact = screen.getByRole('list')
    // Solo el icono a la vista; el nombre del enlace vive en su etiqueta accesible.
    const links = within(contact).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Llamar',
      'WhatsApp',
      'Sitio web',
      'Instagram',
    ])
    expect(screen.getByRole('link', { name: 'Llamar' })).toHaveAttribute(
      'href',
      'tel:+524421234567',
    )
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/524421234567',
    )
    expect(screen.queryByRole('link', { name: 'Facebook' })).not.toBeInTheDocument()
  })

  it('los enlaces de reparto llevan el icono de cada aplicación', async () => {
    await setup(
      makePlace({
        id: 'x',
        plazaId: plaza.id,
        name: 'Con reparto',
        links: {
          website: null,
          instagram: null,
          facebook: null,
          tiktok: null,
          whatsapp: null,
          rappi: 'https://www.rappi.com.mx/restaurantes/ejemplo',
          uberEats: 'https://www.ubereats.com/mx/store/ejemplo',
        },
      }),
    )
    const rappi = screen.getByRole('link', { name: 'Rappi' })
    const uberEats = screen.getByRole('link', { name: 'Uber Eats' })
    // La marca es una imagen decorativa: quien escucha la página oye el nombre del enlace, no dos veces.
    expect(rappi.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('brands/rappi.svg'),
    )
    expect(uberEats.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('brands/uber-eats.svg'),
    )
    expect(rappi.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('muestra descripción, horario agrupado y el logo del lugar', async () => {
    await setup(
      makePlace({
        id: 'x',
        plazaId: plaza.id,
        name: 'Completo',
        description: { es: 'Pan de masa madre.' },
        hours: {
          mon: ['08:00-14:00'],
          tue: ['08:00-14:00'],
          sun: [],
          note: 'Horario de temporada',
        },
        photos: [
          { src: 'images/places/x/fachada.webp', alt: 'Fachada del local' },
          { src: 'images/places/x/barra.webp', alt: 'Barra de café' },
        ],
      }),
    )
    expect(screen.getByText('Pan de masa madre.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Horario' })).toBeInTheDocument()
    expect(screen.getByText('Lun–Mar')).toBeInTheDocument()
    expect(screen.getByText('08:00–14:00')).toBeInTheDocument()
    expect(screen.getByText('Horario de temporada')).toBeInTheDocument()
    // La ficha muestra una sola imagen: el logo del lugar, sin galería que obligue a desplazarse.
    const logos = screen.getAllByRole('img', { name: 'Fachada del local' })
    expect(logos).toHaveLength(1)
    expect(logos[0]).toHaveAttribute('loading', 'eager')
    expect(screen.queryByRole('button', { name: /Ver foto ampliada/ })).not.toBeInTheDocument()
  })

  it('la ficha es la única vista que enseña el dibujo de los secundarios', async () => {
    await setup(
      makePlace({
        id: 'pan-con-tacos',
        plazaId: plaza.id,
        name: 'Pan con Tacos',
        giros: ['panaderia'],
        secundarios: ['taqueria'],
      }),
    )
    // Un renglón por giro, cada uno con su dibujo y los dos pintados igual: en la ficha todos son
    // lo que se vende ahí. Lo único que los separa es el orden, con los principales delante.
    const renglones = [...(screen.getByText('Panadería').parentElement?.children ?? [])]
    expect(renglones.map((fila) => fila.textContent)).toEqual(['Panadería', 'Taquería'])
    for (const fila of renglones) expect(fila.querySelectorAll('svg')).toHaveLength(1)
  })

  describe('descripción traducida', () => {
    afterEach(async () => {
      await setLocale('es')
    })

    it('en inglés se lee la traducción, marcada como generada y con el original a un clic', async () => {
      await setLocale('en')
      await setup(
        makePlace({
          id: 'pan',
          plazaId: plaza.id,
          name: 'Trigo',
          description: { es: 'Pan de masa madre.', en: 'Sourdough bread.' },
        }),
      )
      expect(screen.getByText('Sourdough bread.')).toBeInTheDocument()
      expect(screen.getByText('Automatic Translation')).toBeInTheDocument()
      const ver = screen.getByRole('button', { name: 'View the Spanish original' })
      expect(ver).toHaveAttribute('aria-pressed', 'false')
      await userEvent.click(ver)
      expect(screen.getByText('Pan de masa madre.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'View the translation' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })

    it('sin traducción se lee el original y no aparece la leyenda', async () => {
      await setLocale('en')
      await setup(
        makePlace({
          id: 'bagel',
          plazaId: plaza.id,
          name: 'Mr Bagel',
          description: { es: 'You can’t buy happiness, but you can buy bagels.' },
        }),
      )
      expect(
        screen.getByText('You can’t buy happiness, but you can buy bagels.'),
      ).toBeInTheDocument()
      expect(screen.queryByText('Automatic Translation')).not.toBeInTheDocument()
    })

    it('en español se lee el original, sin leyenda, aunque haya traducción', async () => {
      await setup(
        makePlace({
          id: 'pan',
          plazaId: plaza.id,
          name: 'Trigo',
          description: { es: 'Pan de masa madre.', en: 'Sourdough bread.' },
        }),
      )
      expect(screen.getByText('Pan de masa madre.')).toBeInTheDocument()
      expect(screen.queryByText('Traducción automática')).not.toBeInTheDocument()
    })
  })

  it('vuelve atrás y cierra', async () => {
    const props = await setup(makePlace({ id: 'x', plazaId: plaza.id, name: 'Lugar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Volver a Plaza Norte' }))
    expect(props.onBack).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar panel' }))
    expect(props.onClose).toHaveBeenCalled()
  })
})
