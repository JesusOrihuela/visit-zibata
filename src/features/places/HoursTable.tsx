import { t } from '../../i18n/index.ts'
import { formatRange, groupWeek, hasAnyHours } from '../../lib/hours.ts'
import type { Hours } from '../../types/domain.ts'
import styles from './HoursTable.module.css'
import { OpenStatus, useZonedNow } from './OpenStatus.tsx'

/**
 * El horario del lugar.
 *
 * `cerrado` es el cierre temporal, y lo único que hace es callar el estado en vivo: un local en obra
 * tiene su horario de siempre bien puesto, así que `getOpenStatus` responde "Abierto" con razón y
 * aun así sería falso. La ficha ya lo dice arriba con todas sus letras y en ámbar; repetirlo aquí en
 * verde fue justo lo que salió publicado en la v4.20.
 */
export function HoursTable({ hours, cerrado = false }: { hours: Hours | null; cerrado?: boolean }) {
  const now = useZonedNow()
  if (!hasAnyHours(hours)) return null

  const groups = groupWeek(hours).filter((group) => group.ranges !== null)
  return (
    <section className={styles.section} aria-labelledby="place-hours-title">
      <div className={styles.header}>
        <h3 id="place-hours-title" className={styles.title}>
          {t('place.hours')}
        </h3>
        {!cerrado && <OpenStatus hours={hours} />}
      </div>
      <dl className={styles.table}>
        {groups.map((group) => {
          const first = group.days[0]
          const last = group.days.at(-1)
          if (!first || !last) return null
          const days =
            first === last
              ? t(`day.${first}`)
              : `${t(`dayShort.${first}`)}–${t(`dayShort.${last}`)}`
          const isToday = group.days.includes(now.day)
          return (
            <div key={group.days.join('-')} className={styles.row} data-today={isToday}>
              <dt>
                {days}
                {isToday && <span className={styles.today}>{t('hours.today')}</span>}
              </dt>
              <dd>
                {group.ranges?.length
                  ? group.ranges.map(formatRange).join(', ')
                  : t('hours.closedAllDay')}
              </dd>
            </div>
          )
        })}
      </dl>
      {hours.note && <p className={styles.note}>{hours.note}</p>}
    </section>
  )
}
