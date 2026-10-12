/**
 * Tutorial ligero de 4 pasos. Se puede cerrar o saltar y no vuelve a mostrarse en la sesión
 * (sessionStorage). Es un componente aislado: quitarlo no afecta al resto de la app.
 */
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/index.ts'
import styles from './OnboardingModal.module.css'
import { markOnboardingSeen } from './seen.ts'

const STEPS = [
  { title: 'onboarding.step1.title', body: 'onboarding.step1.body', art: 'explore' },
  { title: 'onboarding.step2.title', body: 'onboarding.step2.body', art: 'plaza' },
  { title: 'onboarding.step3.title', body: 'onboarding.step3.body', art: 'discover' },
  { title: 'onboarding.step4.title', body: 'onboarding.step4.body', art: 'marks' },
] as const

function StepArt({ kind }: { kind: (typeof STEPS)[number]['art'] }) {
  return (
    <svg viewBox="0 0 240 132" className={styles.art} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="onb-ground" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f6f1e8" />
          <stop offset="1" stopColor="#e6ddcd" />
        </linearGradient>
      </defs>
      {/* La maqueta cabe entera en el lienzo: ningún vértice queda cortado. */}
      <path d="M24 78 120 34l96 44-96 44z" fill="url(#onb-ground)" stroke="#d1c3b0" />
      <path
        d="M46 78l74-34M68 89l74-34M90 100l74-34"
        stroke="#fffdf9"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {[
        [72, 62],
        [100, 50],
        [148, 78],
        [126, 90],
        [170, 66],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M0 0l12-6 12 6v10l-12 6-12-6z" fill="#fbf8f2" stroke="#d1c3b0" />
          <path d="M0 0l12 6 12-6" fill="none" stroke="#e6ddcd" />
        </g>
      ))}
      {/* Volumen isométrico completo: cara izquierda, derecha y techo cierran en el mismo vértice
          inferior (antes la cara derecha sobresalía y el edificio parecía cortado). */}
      {kind !== 'explore' && kind !== 'marks' && (
        <g transform="translate(104 70)">
          <path d="M16 -8l16 8v16l-16 8-16-8V0z" fill={kind === 'plaza' ? '#8cba37' : '#a7c86a'} />
          <path d="M0 0l16-8 16 8-16 8z" fill="#b8d77c" />
          <path d="M32 0v16l-16 8V8z" fill="#6a8736" />
        </g>
      )}
      {kind === 'plaza' && (
        <g transform="translate(92 16)">
          <rect width="56" height="22" rx="11" fill="#536c2a" />
          <circle cx="44" cy="11" r="7" fill="#8cba37" />
          <rect x="10" y="8" width="24" height="6" rx="3" fill="#f3f8ea" />
          <path d="M28 22v24" stroke="#536c2a" strokeWidth="2" />
        </g>
      )}
      {/* Paso 1: el gesto rodea la maqueta entera (girar y arrastrar), con el punto de contacto encima. */}
      {kind === 'explore' && (
        <g fill="none" stroke="#536c2a" strokeWidth="2.5" strokeLinecap="round">
          <path d="M26 100a106 50 0 0 0 188 0" strokeLinejoin="round" />
          <path d="M207 112l7-12-13 3" strokeLinejoin="round" />
          <circle cx="120" cy="74" r="9" fill="#e7f1d4" />
        </g>
      )}
      {kind === 'discover' && (
        <g transform="translate(156 12)">
          <rect width="68" height="50" rx="10" fill="#fcfaf6" stroke="#d1c3b0" />
          <rect x="8" y="9" width="16" height="16" rx="5" fill="#e7f1d4" />
          <rect x="30" y="11" width="30" height="5" rx="2.5" fill="#435a22" />
          <rect x="30" y="20" width="20" height="4" rx="2" fill="#b9a88f" />
          <rect x="8" y="32" width="52" height="10" rx="5" fill="#536c2a" />
        </g>
      )}
      {/* Paso 4: la ficha con sus tres marcas (visita, favorito y estrellas), en grande y al centro. */}
      {kind === 'marks' && (
        <g transform="translate(62 18)">
          <rect width="116" height="84" rx="14" fill="#fcfaf6" stroke="#d1c3b0" />
          <rect x="14" y="14" width="26" height="26" rx="8" fill="#e7f1d4" />
          <rect x="48" y="16" width="52" height="7" rx="3.5" fill="#435a22" />
          <rect x="48" y="29" width="34" height="6" rx="3" fill="#b9a88f" />
          <g transform="translate(14 52)">
            <rect width="40" height="18" rx="9" fill="#536c2a" />
            <path
              d="M11 9.4l2.6 2.8 5.4-5.6"
              fill="none"
              stroke="#fcfaf6"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="24" y="7" width="10" height="4" rx="2" fill="#e7f1d4" />
          </g>
          <path
            d="M64 54c2.4-3.4 7.6-3 9 1 1.4-4 6.6-4.4 9-1 2.4 3.4-1 8.4-9 13-8-4.6-11.4-9.6-9-13z"
            fill="var(--heart-600)"
          />
          {/* La tercera marca es la calificación, y desde esta ronda son estrellas. */}
          <path
            fill="#536c2a"
            d="M99 51.5l2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.75-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"
          />
        </g>
      )}
    </svg>
  )
}

interface OnboardingModalProps {
  open: boolean
  onClose: () => void
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setStep(0)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const finish = () => {
    markOnboardingSeen()
    onClose()
  }

  // Clic en el fondo cierra el tutorial (con teclado se cierra con Escape, evento nativo del <dialog>).
  const finishRef = useRef(finish)
  useEffect(() => {
    finishRef.current = finish
  })
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === dialog) finishRef.current()
    }
    dialog.addEventListener('click', onBackdrop)
    return () => dialog.removeEventListener('click', onBackdrop)
  }, [])

  const current = STEPS[step] ?? STEPS[0]
  const isLast = step === STEPS.length - 1

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-body"
      onClose={finish}
    >
      <div className={styles.card}>
        <button
          type="button"
          className={styles.close}
          onClick={finish}
          aria-label={t('onboarding.close')}
        >
          <X aria-hidden="true" />
        </button>
        <div className={styles.artBox}>
          <StepArt kind={current.art} />
        </div>
        <p className={styles.progress}>
          {t('onboarding.progress', { current: step + 1, total: STEPS.length })}
        </p>
        <h2 id="onboarding-title" className={styles.title}>
          {t(current.title)}
        </h2>
        <p id="onboarding-body" className={styles.body}>
          {t(current.body)}
        </p>
        <div className={styles.dots} aria-hidden="true">
          {STEPS.map((item, index) => (
            <span key={item.art} data-active={index === step} />
          ))}
        </div>
        <div className={styles.actions}>
          {step === 0 ? (
            <button type="button" className={styles.secondary} onClick={finish}>
              {t('onboarding.skip')}
            </button>
          ) : (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setStep((s) => s - 1)}
            >
              {t('onboarding.back')}
            </button>
          )}
          <button
            type="button"
            className={styles.primary}
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            // biome-ignore lint/a11y/noAutofocus: el foco inicial del diálogo debe estar en la acción principal.
            autoFocus
          >
            {isLast ? t('onboarding.start') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
