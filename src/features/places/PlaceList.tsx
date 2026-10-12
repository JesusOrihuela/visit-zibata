/*
 * La lista de lugares.
 *
 * Sin animación de entrada, y es una decisión, no un olvido. Las tarjetas entraban escalonadas, 22 ms
 * por fila hasta doce. Se veía bien una vez y mal las siguientes cincuenta: la lista se vuelve a
 * dibujar en cada tecla del buscador y en cada filtro, así que el escalonado se veía decenas de veces
 * al día. Lo que se ve así de seguido no se anima, porque deja de leerse como pulido y empieza a
 * leerse como lentitud.
 */
import type { Place } from '../../types/domain.ts'
import { PlaceCard } from './PlaceCard.tsx'
import styles from './PlaceList.module.css'

interface PlaceListProps {
  places: readonly Place[]
  onOpen: (place: Place) => void
  showPlaza?: boolean
  label?: string
}

export function PlaceList({ places, onOpen, showPlaza, label }: PlaceListProps) {
  return (
    <ul className={styles.list} aria-label={label}>
      {places.map((place) => (
        <li key={place.id}>
          <PlaceCard place={place} onOpen={onOpen} showPlaza={showPlaza} />
        </li>
      ))}
    </ul>
  )
}
