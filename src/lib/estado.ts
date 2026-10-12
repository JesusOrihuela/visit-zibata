/**
 * En qué estado está un lugar ahora mismo: la única respuesta a esa pregunta en toda la guía.
 *
 * `getOpenStatus` solo sabe de horarios, y eso no alcanza desde que un local puede estar cerrado
 * temporalmente por obra. Si cada sitio preguntara por su cuenta, el filtro de "abierto ahora"
 * acabaría incluyendo un local en remodelación porque su horario dice que a esta hora abre.
 *
 * Son cuatro estados y los cuatro significan cosas distintas:
 *
 *  - `open` y `closed`: hay horario publicado y dice eso.
 *  - `unknown`: no hay horario. La guía no sabe, y no es lo mismo que saber que está cerrado.
 *  - `temporal`: cerrado por obra, vacaciones o traspaso. La guía sí sabe, y bastante bien.
 */
import type { Place } from '../types/domain.ts'
import { getOpenStatus, type ZonedMoment } from './hours.ts'

export type EstadoLugar = 'open' | 'closed' | 'unknown' | 'temporal'

/**
 * El cierre temporal manda sobre el horario.
 *
 * Es deliberado y es el punto entero: un local en obra puede tener su horario de siempre bien
 * puesto, y precisamente por eso hay que taparlo. El horario no se borra porque volverá a valer
 * cuando reabra, y borrarlo perdería un dato verificado para no decir nada.
 */
export function estadoDe(place: Place, now: ZonedMoment): EstadoLugar {
  if (place.cierre) return 'temporal'
  return getOpenStatus(place.hours ?? null, now).state
}

/** ¿Se puede ir ahora? Lo que de verdad pregunta el filtro y lo que pesa en el orden. */
export const estaAbierto = (place: Place, now: ZonedMoment): boolean =>
  estadoDe(place, now) === 'open'
