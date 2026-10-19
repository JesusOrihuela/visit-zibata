/**
 * Registrar una visita a un lugar. Es la señal más honesta que puede dar la guía sin cuentas ni
 * servidores, porque la pone la persona a propósito: abrir una ficha no es haber ido.
 *
 * Un solo control y un solo gesto, lo registres hoy o lo registres tarde. El botón abre el
 * calendario del sistema con hoy puesto; eliges el día y queda guardado. Antes solo se podía
 * marcar el día en curso, así que quien llegaba tarde a casa y se acordaba a la mañana siguiente
 * ya no podía registrarlo: el dato se perdía por un detalle de implementación, no por una decisión.
 *
 * El calendario es `<input type="date">` y no uno dibujado aquí: lo pone el sistema operativo, con
 * su teclado, su accesibilidad y su idea del año, que es justo lo que no conviene reinventar.
 */
import { CalendarPlus, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { t } from '../../i18n/index.ts'
import { formatVisitDate, formatVisitDateLong, today, useVisits } from './useVisits.ts'
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
  const { registrar, quitar, datesOf } = useVisits()
  const fechas = datesOf(placeId)
  const ultima = fechas.at(-1)
  const [abierto, setAbierto] = useState(false)
  const [mostrarCampo, setMostrarCampo] = useState(false)
  const calendario = useRef<HTMLInputElement>(null)
  const listaId = useId()

  /*
   * `showPicker` abre el calendario del sistema sin que el campo tenga que verse.
   *
   * El campo va detrás y sin recibir punteros. Estuvo delante y transparente, pensando que así
   * recibiría el clic en los navegadores sin `showPicker`, y el resultado fue que se lo comía
   * siempre: el clic no llegaba al botón, y pulsar el texto de un campo de fecha no abre ningún
   * calendario en Chrome. El botón no hacía nada.
   *
   * Donde `showPicker` no exista, el campo se enseña y se usa tal cual, que es feo pero funciona.
   * Vale más una pieza que se ve rara en un navegador viejo que una que no responde en el actual.
   */
  const abrirCalendario = () => {
    const campo = calendario.current
    if (!campo) return
    if (typeof campo.showPicker !== 'function') {
      setMostrarCampo(true)
      return
    }
    try {
      campo.showPicker()
    } catch {
      setMostrarCampo(true)
    }
  }

  return (
    <div className={styles.visit} data-plano={sinSuperficie}>
      <span className={styles.control} data-campo={mostrarCampo}>
        {!mostrarCampo && (
          <button
            type="button"
            className={styles.button}
            onClick={abrirCalendario}
            aria-label={t('visit.mark', { name: placeName })}
          >
            <CalendarPlus aria-hidden="true" />
            <span>{t('visit.action')}</span>
          </button>
        )}
        <input
          ref={calendario}
          type="date"
          className={styles.calendario}
          max={today()}
          aria-label={t('visit.pickDay')}
          onChange={(event) => {
            if (event.target.value) registrar(placeId, event.target.value)
            event.target.value = ''
            setMostrarCampo(false)
          }}
        />
      </span>

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
