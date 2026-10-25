import { useSyncExternalStore } from 'react'
import { t } from '../../i18n/index.ts'
import { getOpenStatus, getZonedMoment } from '../../lib/hours.ts'
import type { Hours } from '../../types/domain.ts'
import styles from './OpenStatus.module.css'

// Un único reloj compartido por todas las tarjetas (no un temporizador por tarjeta), que avanza al
// cambiar el minuto y solo corre mientras hay algún componente suscrito.
let moment = getZonedMoment(new Date())
const listeners = new Set<() => void>()
let timer: number | undefined

function tick() {
  moment = getZonedMoment(new Date())
  for (const listener of listeners) listener()
  timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (timer === undefined) {
    moment = getZonedMoment(new Date())
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.clearTimeout(timer)
      timer = undefined
    }
  }
}

/** Hora actual en Querétaro, actualizada cada minuto. */
export function useZonedNow() {
  return useSyncExternalStore(subscribe, () => moment)
}

/**
 * "Abierto" / "Cerrado". La hora de apertura o cierre no se repite aquí: la tabla de horarios que
 * acompaña al estado ya la muestra. No renderiza nada si no hay horario (nunca muestra huecos).
 */
export function OpenStatus({
  hours,
  today = false,
}: {
  hours: Hours | null
  /** En la fila de hoy, el estado se une a la etiqueta "Hoy" en una sola píldora. */
  today?: boolean
}) {
  const status = getOpenStatus(hours, useZonedNow())
  if (status.state === 'unknown') {
    return today ? <span className={styles.todayOnly}>{t('hours.today')}</span> : null
  }

  const label = status.state === 'open' ? t('hours.open') : t('hours.closed')
  return (
    <span className={styles.status} data-state={status.state} data-today={today}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{today ? `${t('hours.today')} · ${label}` : label}</span>
    </span>
  )
}
