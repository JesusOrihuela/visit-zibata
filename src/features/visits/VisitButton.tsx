/**
 * Registrar una visita a un lugar. Es la señal más honesta que puede dar la guía sin cuentas ni
 * servidores, porque la pone la persona a propósito: abrir una ficha no es haber ido.
 *
 * Un solo control y un solo gesto, lo registres hoy o lo registres tarde. El botón despliega el
 * calendario y ahí se marca el día. Antes solo se podía marcar el día en curso, así que quien
 * llegaba tarde a casa y se acordaba a la mañana siguiente ya no podía registrarlo: el dato se
 * perdía por un detalle de implementación, no por una decisión.
 *
 * El calendario es propio (`VisitCalendar`) y no el del sistema, que es lo que había. El del
 * sistema sale gratis y trae su accesibilidad puesta, pero no sabe nada de tus visitas: abría un
 * mes en blanco donde no se veía si ya habías venido ese día. Y sale en el idioma del teléfono, no
 * en el de la guía. Ver lo que ya marcaste es justo lo que esta función tiene que dar.
 */
import { CalendarPlus, X } from 'lucide-react'
import { lazy, Suspense, useId, useState } from 'react'
import { t } from '../../i18n/index.ts'
import { formatVisitDate, formatVisitDateLong, useVisits } from './useVisits.ts'
import styles from './VisitButton.module.css'

/*
 * Diferido: un calendario que casi nadie abre no tiene por qué viajar en la primera carga. Son
 * unos 2 KB que solo bajan cuando alguien pulsa, y el presupuesto del paquete inicial iba al
 * límite (122 de 122 KB), así que esto no es una optimización opcional sino la condición para que
 * la función quepa.
 */
const VisitCalendar = lazy(() =>
  import('./VisitCalendar.tsx').then((module) => ({ default: module.VisitCalendar })),
)

export function VisitButton({
  placeId,
  placeName,
  sinSuperficie = false,
}: {
  placeId: string
  placeName: string
  /**
   * Sin caja, para el bloque personal de la ficha. Ahí lo que separa este control de "Cómo llegar"
   * no es su esquina sino que no tiene superficie: una no sale de la guía y la otra sí.
   */
  sinSuperficie?: boolean
}) {
  const { registrar, quitar, datesOf } = useVisits()
  const fechas = datesOf(placeId)
  const ultima = fechas.at(-1)
  const [abierto, setAbierto] = useState(false)
  const [calendarioAbierto, setCalendarioAbierto] = useState(false)
  const listaId = useId()

  return (
    <div className={styles.visit} data-plano={sinSuperficie}>
      <span className={styles.control}>
        <button
          type="button"
          className={styles.button}
          aria-expanded={calendarioAbierto}
          onClick={() => setCalendarioAbierto((previo) => !previo)}
          aria-label={t('visit.mark', { name: placeName })}
        >
          <CalendarPlus aria-hidden="true" />
          <span>{t('visit.action')}</span>
        </button>
      </span>

      {calendarioAbierto && (
        <Suspense fallback={null}>
          <VisitCalendar
            fechas={fechas}
            onToggle={(fecha: string) =>
              fechas.includes(fecha) ? quitar(placeId, fecha) : registrar(placeId, fecha)
            }
            onClose={() => setCalendarioAbierto(false)}
          />
        </Suspense>
      )}

      {fechas.length > 0 && (
        <p className={styles.hint}>
          <span>
            {t('visit.been', { count: fechas.length })}
            {ultima && t('visit.lastOne', { date: formatVisitDateLong(ultima) })}
          </span>{' '}
          <button
            type="button"
            className={styles.verTodas}
            aria-expanded={abierto}
            aria-controls={listaId}
            onClick={() => setAbierto((previo) => !previo)}
          >
            {abierto ? t('visit.hideAll') : t('visit.seeAll')}
          </button>
        </p>
      )}

      {fechas.length === 0 && <p className={styles.hint}>{t('visit.first')}</p>}

      {abierto && fechas.length > 0 && (
        <ul id={listaId} className={styles.lista}>
          {/* De la más reciente a la más antigua: lo último que hiciste es lo que buscas. */}
          {[...fechas].reverse().map((fecha) => (
            <li key={fecha}>
              <span>{formatVisitDate(fecha)}</span>
              <button
                type="button"
                onClick={() => quitar(placeId, fecha)}
                aria-label={t('visit.remove', { date: formatVisitDate(fecha) })}
              >
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
