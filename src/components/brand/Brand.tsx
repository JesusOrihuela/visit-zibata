import { t } from '../../i18n/index.ts'
import styles from './Brand.module.css'

/**
 * El símbolo vive en public como SVG y entra por <img>, no en línea.
 *
 * Son dos recortes del mismo dibujo, como una tipografía tiene su versión de texto: por debajo de
 * 40 px el aro y la Z van más gordos y el hueco entre las dos mitades más chico (las cuatro puntas
 * son las mismas), porque el corte grande se cierra y la Z deja de leerse. El corte chico vive en `simbolo.svg` y no
 * en `favicon.svg`, que es el mismo dibujo pero ya montado sobre su baldosa para la pestaña. Van por archivo porque en línea suman
 * cerca de 3 KB gzip al paquete inicial, que está a 119 de 120 KB de presupuesto.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src={size < 40 ? '/simbolo.svg' : '/logo.svg'}
      width={size}
      height={size}
      alt=""
      decoding="async"
    />
  )
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={styles.brand} data-compact={compact}>
      <LogoMark size={compact ? 30 : 36} />
      {/* Sin separador, NVDA lee "Visit ZibatáCOMER Y BEBER": la coma existe solo para el lector. */}
      {!compact && (
        <p className={styles.text}>
          <span className={styles.name}>{t('app.name')}</span>
          <span className="visually-hidden">, </span>
          <span className={styles.tagline}>{t('app.tagline')}</span>
        </p>
      )}
    </div>
  )
}
