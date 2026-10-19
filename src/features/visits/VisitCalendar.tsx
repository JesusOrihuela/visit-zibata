/**
 * El calendario de visitas de un lugar: un mes, con los días que ya registraste marcados.
 *
 * Esto lo hacía el calendario del sistema, y se cambió por dos razones que el del sistema no puede
 * resolver. La primera es la que importa: **no sabe nada de tus visitas**, así que abría un mes en
 * blanco donde no se veía si ya habías venido ese día, y marcar dos veces el mismo día no se podía
 * distinguir de marcarlo la primera. La segunda es que sale en el idioma del teléfono, no en el de
 * la guía: alguien leyendo en español se encontraba "October 2026" y "Su Mo Tu We Th Fr Sa".
 *
 * El precio de construirlo es el teclado y el lector de pantalla, que en un calendario son trabajo
 * de verdad. Aquí se resuelve con la cuadrícula de días como un grupo de botones: cada día es un
 * botón que alterna (`aria-pressed` dice si esa visita está registrada), las flechas mueven el foco
 * por la rejilla como en cualquier tabla, y el mes se anuncia al cambiar.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { locale, t } from '../../i18n/index.ts'
import { today } from './useVisits.ts'
import styles from './VisitCalendar.module.css'

/** "2026-10-05" sin pasar por Date, que al parsear una fecha suelta la interpreta en UTC. */
const clave = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** Lunes primero: es como se lee un calendario en México y en España, no domingo primero. */
const PRIMER_DIA = 1

export function VisitCalendar({
  fechas,
  onToggle,
  onClose,
}: {
  fechas: readonly string[]
  onToggle: (fecha: string) => void
  onClose: () => void
}) {
  const hoy = today()
  const [year, setYear] = useState(() => Number(hoy.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(hoy.slice(5, 7)) - 1)
  const rejilla = useRef<HTMLDivElement>(null)
  const tituloId = useId()

  // Al abrirse, el foco entra en la rejilla: quien navega con teclado no tiene que buscarla.
  useEffect(() => {
    rejilla.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus()
  }, [])

  const nombreDelMes = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  )
  /*
   * Las iniciales de los días, en el idioma de la guía. La semana de referencia arranca en domingo
   * (el 7 de junio de 2026 lo fue) para que el índice del array coincida con `getDay()`, que es
   * como JavaScript numera los días: así `(PRIMER_DIA + i) % 7` rota la fila sin desalinearla.
   */
  const diasDeLaSemana = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 5, 7 + i)),
  )

  const primero = new Date(year, month, 1).getDay()
  // Cuántas casillas vacías van antes del día 1 para que caiga en su columna.
  const hueco = (primero - PRIMER_DIA + 7) % 7
  const dias = new Date(year, month + 1, 0).getDate()

  const mover = (delta: number) => {
    const destino = new Date(year, month + delta, 1)
    setYear(destino.getFullYear())
    setMonth(destino.getMonth())
  }

  /*
   * Las flechas mueven el foco por la rejilla, no el mes: es lo que se espera de una cuadrícula, y
   * deja Re Pág y Av Pág (o los dos botones) para cambiar de mes.
   */
  const porTeclado = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const pasos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    const paso = pasos[event.key]
    if (paso === undefined) return
    const botones = [...(rejilla.current?.querySelectorAll('button[data-dia]') ?? [])]
    const actual = botones.indexOf(document.activeElement as HTMLButtonElement)
    const siguiente = botones[actual + paso]
    if (!(siguiente instanceof HTMLButtonElement)) return
    event.preventDefault()
    siguiente.focus()
  }

  return (
    <div className={styles.calendario} role="dialog" aria-labelledby={tituloId}>
      <div className={styles.cabecera}>
        <button type="button" onClick={() => mover(-1)} aria-label={t('visit.prevMonth')}>
          <ChevronLeft aria-hidden="true" />
        </button>
        {/* `aria-live`: al cambiar de mes se anuncia sin mover el foco de donde estaba. */}
        <h3 id={tituloId} aria-live="polite">
          {nombreDelMes}
        </h3>
        <button type="button" onClick={() => mover(1)} aria-label={t('visit.nextMonth')}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className={styles.semana} aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={diasDeLaSemana[(PRIMER_DIA + i) % 7]}>
            {diasDeLaSemana[(PRIMER_DIA + i) % 7]}
          </span>
        ))}
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: la rejilla es de botones, no una tabla de datos. */}
      <div
        ref={rejilla}
        className={styles.rejilla}
        role="group"
        aria-label={nombreDelMes}
        onKeyDown={porTeclado}
      >
        {/* Las casillas vacías antes del día 1. Se nombran por el día del mes anterior que les
            correspondería, que es un dato estable y no una posición. */}
        {Array.from({ length: hueco }, (_, i) => clave(year, month, i - hueco + 1)).map((vacia) => (
          <span key={vacia} />
        ))}
        {Array.from({ length: dias }, (_, i) => {
          const fecha = clave(year, month, i + 1)
          const visitado = fechas.includes(fecha)
          const futuro = fecha > hoy
          return (
            <button
              key={fecha}
              type="button"
              data-dia
              data-hoy={fecha === hoy}
              // Un solo día entra en el orden de tabulación; dentro se anda con las flechas.
              tabIndex={
                fecha === hoy || (i === 0 && month !== Number(hoy.slice(5, 7)) - 1) ? 0 : -1
              }
              aria-pressed={visitado}
              // Los días que no han llegado no se pueden visitar.
              disabled={futuro}
              onClick={() => onToggle(fecha)}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      <button type="button" className={styles.cerrar} onClick={onClose}>
        {t('visit.closeCalendar')}
      </button>
    </div>
  )
}
