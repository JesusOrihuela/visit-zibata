import { t } from '../../i18n/index.ts'
import styles from './MapErrorMessage.module.css'
import type { MapStatus } from './types.ts'

type ErrorReason = Extract<MapStatus, { state: 'error' }>['reason']

/** Aviso cuando el mapa no puede mostrarse; la guía sigue disponible desde la lista de plazas. */
export function MapErrorMessage({
  reason,
  onRetry,
}: {
  reason: ErrorReason
  onRetry?: () => void
}) {
  return (
    <div className={styles.error} role="alert">
      <h2>{t('map.error.title')}</h2>
      <p>{reason === 'webgl' ? t('map.error.webgl') : t('map.error.generic')}</p>
      {onRetry && (
        <button type="button" className={styles.reintentar} onClick={onRetry}>
          {t('map.retry')}
        </button>
      )}
    </div>
  )
}
