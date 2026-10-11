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
    // La etiqueta habla en el idioma al que lleva: nunca mezcla los dos en una misma frase, y está
    // bien escrita desde el primer fotograma aunque su catálogo todavía no se haya descargado.
    await userEvent.click(screen.getByRole('button', { name: 'View the guide in English' }))
    // `find` y no `get`: el catálogo inglés llega en su propia petición, así que la interfaz cambia
    // un instante después del clic. Es el precio de que cada visita baje un solo idioma.
    expect(await screen.findByRole('heading', { name: 'Privacy' })).toBeInTheDocument()
    expect(window.localStorage.getItem('zibata:idioma')).toBe('en')
    expect(screen.getByRole('button', { name: 'Ver la guía en Español' })).toBeInTheDocument()
  })
})
