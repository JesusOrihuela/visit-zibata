// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InfoDialog } from './InfoDialog.tsx'

describe('InfoDialog', () => {
  it('muestra una sola página y lleva a las otras dos', async () => {
    const onGoTo = vi.fn()
    render(<InfoDialog topic="privacidad" onClose={vi.fn()} onGoTo={onGoTo} />)

    expect(screen.getByRole('dialog', { name: 'Privacidad y términos' })).toBeInTheDocument()
    expect(screen.getByText(/no usa cuentas ni cookies de rastreo/)).toBeInTheDocument()
    expect(screen.getByText(/únicamente en este navegador/)).toBeInTheDocument()
    // Que los favoritos salgan del dispositivo se dice, no se calla.
    expect(screen.getByText(/se envían para que no se pierdan/)).toBeInTheDocument()
    // Lo que de verdad hay que fijar en la página: que las notas no se publican ni promediadas.
    expect(screen.getByText(/no se publican nunca, ni siquiera como promedio/)).toBeInTheDocument()
    expect(screen.getByText(/sin correo, sin nombre/)).toBeInTheDocument()
    // El conteo de visitas se declara aquí: callarlo sería mentir por omisión.
    expect(screen.getByText(/cuántas veces se abre cada página y cada lugar/)).toBeInTheDocument()
    expect(screen.getByText(/no los vendemos ni los compartimos/)).toBeInTheDocument()
    // Los términos viven en esta misma página desde la v4.18, y lo que fijan son cuatro cosas.
    expect(screen.getByRole('heading', { name: 'Términos de uso' })).toBeInTheDocument()
    expect(screen.getByText(/No tiene relación comercial/)).toBeInTheDocument()
    expect(screen.getByText(/nadie paga por estar/)).toBeInTheDocument()
    expect(screen.getByText(/sin garantía de que cada dato sea exacto hoy/)).toBeInTheDocument()
    expect(screen.getByText(/prefieres no aparecer/)).toBeInTheDocument()
    // Las otras páginas no se amontonan aquí: son enlaces a su propia ruta.
    expect(screen.queryByText(/OpenStreetMap/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Sugiere un cambio' }))
    expect(onGoTo).toHaveBeenCalledWith('sugerir')
  })

  it('la página "Acerca" incluye créditos, versión y firma, y ningún enlace muerto', () => {
    render(<InfoDialog topic="acerca" onClose={vi.fn()} onGoTo={vi.fn()} />)
    expect(screen.getByText(/OpenStreetMap/)).toBeInTheDocument()
    expect(screen.getByText(/Versión/)).toBeInTheDocument()
    /*
     * El único enlace que sale de la guía es la firma de autoría, y apunta a algún sitio: sin canal
     * de contacto abierto, cualquier otro enlace hacia fuera sería un enlace muerto.
     *
     * Se mira el destino y no el elemento: las páginas de información se enlazan entre sí, porque
     * cada una tiene su ruta, y contar `link` a secas haría fallar esto por el motivo contrario al
     * que protege.
     */
    const haciaFuera = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('http'))
    expect(haciaFuera).toHaveLength(1)
    expect(haciaFuera[0]).toHaveAttribute('href', 'https://aurariola.com')
  })

  it('desde cualquier página se llega al tutorial, que es un tema más', async () => {
    // Desde que se recuerda por dispositivo y ya no reaparece solo, esta es la forma de volver a
    // verlo. Va por `onGoTo` como los otros tres, para que tenga ruta y el botón atrás lo cierre.
    const onGoTo = vi.fn()
    render(<InfoDialog topic="acerca" onClose={vi.fn()} onGoTo={onGoTo} />)
    await userEvent.click(screen.getByRole('link', { name: 'Ver el tutorial' }))
    expect(onGoTo).toHaveBeenCalledWith('tutorial')
  })

  it('se cierra con Escape', async () => {
    const onClose = vi.fn()
    render(<InfoDialog topic="sugerir" onClose={onClose} onGoTo={vi.fn()} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
