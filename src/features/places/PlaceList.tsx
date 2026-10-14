/*
 * La lista de lugares.
 *
 * Sin animación de entrada, y es una decisión, no un olvido. Las tarjetas entraban escalonadas, 22 ms
 * por fila hasta doce. Se veía bien una vez y mal las siguientes cincuenta: la lista se vuelve a
 * dibujar en cada tecla del buscador y en cada filtro, así que el escalonado se veía decenas de veces
 * al día. Lo que se ve así de seguido no se anima, porque deja de leerse como pulido y empieza a
 * leerse como lentitud.
 */
import { t } from '../../i18n/index.ts'
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
   * Parte la lista en abiertos, cerrados y sin horario, cada grupo con su rótulo y su cuenta.
   *
   * No va en todas las listas: en los resultados de una búsqueda el orden lo manda la relevancia, y
   * partirlo por horario pelearía con ella. Donde sí vale es en el índice de una zona, que es una
   * lista de "qué hay aquí" y donde lo que decide es si puedes ir ahora.
   */
  byOpenNow?: boolean
}

/** El orden de los grupos es el de la utilidad: lo que está abierto primero. */
const GRUPOS = [
  { estado: 'open', clave: 'places.groupOpen' },
  { estado: 'closed', clave: 'places.groupClosed' },
  { estado: 'temporal', clave: 'places.groupTemporary' },
  { estado: 'unknown', clave: 'places.groupUnknown' },
] as const

export function PlaceList({ places, onOpen, showPlaza, label, byOpenNow }: PlaceListProps) {
  const now = useZonedNow()

  if (!byOpenNow) {
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

  return (
    <div className={styles.grupos}>
      {GRUPOS.map(({ estado, clave }) => {
        const delGrupo = places.filter((place) => estadoDe(place, now) === estado)
        // Un grupo vacío no se anuncia: en una zona de tres locales sobran los rótulos.
        if (delGrupo.length === 0) return null
        const titulo = t(clave)
        return (
          <section key={estado} className={styles.grupo}>
            <p className={styles.rotulo}>
              {titulo}
              <span>{delGrupo.length}</span>
            </p>
            <ul className={styles.list} aria-label={titulo} data-estado={estado}>
              {delGrupo.map((place) => (
                <li key={place.id}>
                  <PlaceCard place={place} onOpen={onOpen} showPlaza={showPlaza} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
