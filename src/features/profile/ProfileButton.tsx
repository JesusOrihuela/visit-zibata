/**
 * El sello de "Tu Zibatá" en la barra: abre la hoja con lo que llevas hecho en la guía. Lleva la cuenta
 * de favoritos encima y se pone verde en cuanto hay algo marcado en este navegador.
 */
import { lazy, Suspense, useRef, useState } from 'react'
import { ProfileIcon } from '../../components/icons/ProfileIcon.tsx'
import { t } from '../../i18n/index.ts'
import type { InfoTopic } from '../../lib/url-state.ts'
import type { Place } from '../../types/domain.ts'
import styles from './ProfileButton.module.css'
import { useMarks } from './useMarks.ts'

/** La hoja se descarga la primera vez que alguien la abre, no en el arranque. */
const ProfileSheet = lazy(() =>
  import('./ProfileSheet.tsx').then((module) => ({ default: module.ProfileSheet })),
)

export function ProfileButton({
  onOpenInfo,
  onOpenPlace,
}: {
  onOpenInfo: (topic: InfoTopic) => void
  onOpenPlace: (place: Place) => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const marks = useMarks()
  const saved = marks.favorites.size

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.avatar}
        data-active={saved + marks.ratings.size + marks.visits.size > 0}
        onClick={() => setOpen(true)}
        aria-label={t('profile.open')}
        title={t('profile.open')}
      >
        <ProfileIcon className={styles.avatarIcon} />
      </button>
      {open && (
        <Suspense fallback={null}>
          <ProfileSheet
            onClose={close}
            // Una hoja cada vez: al ir a una página de la guía o a un lugar, esta se cierra detrás.
            onOpenInfo={(topic) => {
              setOpen(false)
              onOpenInfo(topic)
            }}
            onOpenPlace={(place) => {
              setOpen(false)
              onOpenPlace(place)
            }}
          />
        </Suspense>
      )}
    </>
  )
}
