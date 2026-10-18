/**
 * Registrar una visita a un lugar. Es la señal más honesta que puede dar la guía sin cuentas ni
 * servidores, porque la pone la persona a propósito: abrir una ficha no es haber ido.
 *
 * Una sola pieza: la cuenta va dentro del botón, como la cifra de las pastillas de categoría, para
 * que se lea como parte de la misma acción y no como un dato suelto al lado. A la derecha, en letra
 * pequeña, la fecha de la última visita, el aviso de que hoy todavía se puede deshacer, o la
 * invitación a registrar la primera.
 */
import { CalendarCheck, CalendarPlus } from 'lucide-react'
import { t } from '../../i18n/index.ts'
import { formatVisitDate, useVisits } from './useVisits.ts'
import styles from './VisitButton.module.css'

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
  const { toggleToday, datesOf, visitedToday } = useVisits()
  const dates = datesOf(placeId)
  const count = dates.length
  const marked = visitedToday(placeId)
  const last = dates.at(-1)

  const hint = marked
    ? t('visit.undoHint')
    : count === 0
      ? t('visit.first')
      : t('visit.last', { date: formatVisitDate(last ?? '') })

  const label = marked ? t('visit.undo', { name: placeName }) : t('visit.mark', { name: placeName })

  return (
    <div className={styles.visit} data-plano={sinSuperficie}>
      <button
        type="button"
        className={styles.button}
        data-marked={marked}
        aria-pressed={marked}
        onClick={() => toggleToday(placeId)}
        aria-label={label}
        title={label}
      >
        {marked ? <CalendarCheck aria-hidden="true" /> : <CalendarPlus aria-hidden="true" />}
        <span>{marked ? t('visit.registered') : t('visit.action')}</span>
        {count > 0 && (
          <span className={styles.count}>
            <span aria-hidden="true">{count}</span>
            <span className="visually-hidden">{t('visit.count', { count })}</span>
          </span>
        )}
      </button>
      <p className={styles.hint}>{hint}</p>
    </div>
  )
}
