// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '../../i18n/index.ts'
import { InfoDialog } from './InfoDialog.tsx'
import { LocaleSwitch } from './LocaleSwitch.tsx'

afterEach(async () => {
  await setLocale('es')
})

describe('LocaleSwitch', () => {
  it('cambia el idioma de la interfaz de un toque y lo recuerda', async () => {
    render(
      <>
        <LocaleSwitch />
        <InfoDialog topic="privacidad" onClose={() => {}} onGoTo={() => {}} />
      </>,
    )
    /*
     * El idioma es navegación, no un ajuste: cada opción es un enlace a la misma página en el otro
     * árbol de direcciones. A la vista va el nombre nativo del idioma y, para quien escucha, la
     * explicación de qué pasa al pulsarlo, escrita en el idioma de destino para no mezclar los dos
     * en una frase.
     */
    await userEvent.click(screen.getByRole('link', { name: 'English View the guide in English' }))
    // `find` y no `get`: el catálogo inglés llega en su propia petición, así que la interfaz cambia
    // un instante después del clic. Es el precio de que cada visita baje un solo idioma.
    expect(await screen.findByRole('heading', { name: 'Privacy and terms' })).toBeInTheDocument()
    expect(window.localStorage.getItem('zibata:idioma')).toBe('en')
    expect(screen.getByRole('link', { name: 'Español Ver la guía en Español' })).toBeInTheDocument()
    // Y el idioma en el que estás no se enlaza: ya estás en él, y lo dice `aria-current`.
    expect(document.querySelector('[aria-current="true"]')).toHaveAttribute('lang', 'en')
  })
})
