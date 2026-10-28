/**
 * Nivel de calidad de las capas propias: 3 todo, 2 sin sombras proyectadas, 1 además con los árboles solo
 * en puntos. Arranca en 3; la fase de calidad adaptable lo baja si el mapa en movimiento va lento.
 */
export interface Quality {
  level: 1 | 2 | 3
}

export const createQuality = (): Quality => ({ level: 3 })
