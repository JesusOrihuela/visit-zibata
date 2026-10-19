/*
 * La lista de lugares.
 *
 * Sin animación de entrada, y es una decisión, no un olvido. Las tarjetas entraban escalonadas, 22 ms
 * por fila hasta doce. Se veía bien una vez y mal las siguientes cincuenta: la lista se vuelve a
 * dibujar en cada tecla del buscador y en cada filtro, así que el escalonado se veía decenas de veces
 * al día. Lo que se ve así de seguido no se anima, porque deja de leerse como pulido y empieza a
 * leerse como lentitud.
 */
import { useMemo, useRef } from 'react'
import { estadoDe } from '../../lib/estado.ts'
import type { Place } from '../../types/domain.ts'
import { useZonedNow } from './OpenStatus.tsx'
import { PlaceCard } from './PlaceCard.tsx'
import styles from './PlaceList.module.css'

interface PlaceListProps {
  places: readonly Place[]
  onOpen: (place: Place) => void
  showPlaza?: boolean
  label?: string
  /**
   * Sube lo que está abierto ahora, sin partir la lista.
   *
   * No va en todas: en los resultados de una búsqueda el orden lo manda la relevancia, y pelearía
   * con ella. Donde sí vale es en el índice de una zona, que es una lista de "qué hay aquí" y donde
   * lo que decide es si puedes ir ahora.
   */
  byOpenNow?: boolean
}

/**
 * El peso de cada estado en el orden. Más bajo, más arriba.
 *
 * Sin horario va segundo y no último, y esa es la decisión que importa aquí. Un local que no publicó
 * su horario no es un local cerrado: es uno del que la guía no sabe, y en Zibatá eso describe sobre
 * todo a los pequeños, que son justo los que menos pueden permitirse caer al fondo de la lista por
 * no tener a nadie que les mantenga la ficha de Google. Hundirlos sería castigarles la falta de
 * administración, no la de servicio.
 *
 * El cierre temporal cierra la lista porque es el único caso en que la guía sabe, y con bastante
 * seguridad, que ir sería un viaje perdido.
 */
const PESO = { open: 0, unknown: 1, closed: 2, temporal: 3 } as const

export function PlaceList({ places, onOpen, showPlaza, label, byOpenNow }: PlaceListProps) {
  const now = useZonedNow()
  /*
   * El reloj con el que se ordena se congela; el que leen las tarjetas sigue corriendo.
   *
   * `useZonedNow` avanza, y con él avanzaba el orden: la lista se recolocaba sola mientras alguien
   * la estaba leyendo, al cruzar la hora a la que un local abre o cierra. Aquí se guarda el momento
   * en que la lista se montó (abrir una zona, cambiar de filtro) y el orden se decide con ese. No
   * se pierde nada de verdad, porque lo que **dice** cada tarjeta lo sigue calculando el reloj vivo:
   * si un local cierra mientras lo lees, su tarjeta lo dice, solo que no salta de sitio para
   * contártelo. El orden se vuelve a decidir la próxima vez que llegues.
   */
  const alLlegar = useRef(now)

  /*
   * Ordenar, no partir. Antes esto repartía la lista en tres secciones con su rótulo y su cuenta, y
   * los rótulos no añadían nada: cada tarjeta ya dice su estado, así que lo único que aportaban eran
   * tres títulos donde había una lista. Se queda lo que servía (lo que puedes visitar ahora sale
   * primero) y se va lo que estorbaba.
   *
   * `sort` sobre una copia y estable, que es lo que garantiza el estándar: dentro de cada estado se
   * respeta el orden que venía, que es el curado de la zona con los favoritos propios ya arriba.
   */
  const ordenados = useMemo(
    () =>
      byOpenNow
        ? [...places].sort(
            (a, b) => PESO[estadoDe(a, alLlegar.current)] - PESO[estadoDe(b, alLlegar.current)],
          )
        : places,
    [places, byOpenNow],
  )

  return (
    <ul className={styles.list} aria-label={label}>
      {ordenados.map((place) => (
        <li key={place.id}>
          <PlaceCard place={place} onOpen={onOpen} showPlaza={showPlaza} />
        </li>
      ))}
    </ul>
  )
}
