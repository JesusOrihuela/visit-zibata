/**
 * Lo que hace que un enlace interno siga siendo un enlace.
 *
 * La guía pinta sus páginas también en el servidor, así que cada lugar, cada zona y cada página de
 * información tiene dirección propia. Dentro del navegador no hace falta recargar: se intercepta el
 * clic y se cambia el estado. Pero interceptarlo a secas rompe lo que la gente espera de un enlace,
 * porque con Ctrl, Cmd, Mayúsculas o el botón central el gesto no es "ábrelo" sino "ábrelo aparte",
 * y eso lo tiene que hacer el navegador.
 *
 * Estaba escrito a mano en cada sitio que tuviera un enlace interno, que es como una de las copias
 * se queda sin una de las cuatro teclas y nadie se entera.
 */
import type { MouseEvent } from 'react'

export function alPulsarEnlace(abrir: () => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return
    }
    event.preventDefault()
    abrir()
  }
}
