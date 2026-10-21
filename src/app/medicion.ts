/**
 * Qué acciones de la guía se cuentan (ver lib/eventos.ts y worker/eventos.ts).
 *
 * Se mira la **acción** y no el estado resultante, a propósito: `syncFromUrl` es la carga inicial y
 * el botón atrás, y una ficha abierta así ya la contó el servidor al servir la página. Contar aquí
 * solo lo que la persona hace con un gesto evita contarla dos veces.
 *
 * Lo que se guarda es el identificador de lo elegido (un lugar, una zona, una categoría), nunca lo
 * que se escribió. La búsqueda tiene su propio contador en `useExperience`, porque necesita saber
 * si dio resultados.
 */
import { registrar } from '../lib/eventos.ts'
import type { AppAction, AppState } from './state.ts'

export function medirAccion(accion: AppAction, antes: AppState): void {
  switch (accion.type) {
    case 'selectPlace':
      registrar('ficha', accion.placeId)
      return
    case 'selectPlaza':
      // Una zona elegida es un filtro de la lista; volver a tocar la misma no es una elección nueva.
      if (accion.plazaId && accion.plazaId !== antes.selectedPlazaId) {
        registrar('filtro', accion.plazaId)
      }
      return
    case 'setCategory':
      if (accion.categoryId && accion.categoryId !== antes.activeCategoryId) {
        registrar('filtro', accion.categoryId)
      }
      return
    case 'toggleOpenNow':
      if (!antes.openNowOnly) registrar('filtro', 'abierto-ahora')
      return
    default:
      return
  }
}
