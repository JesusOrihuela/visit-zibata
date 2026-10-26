/**
 * Páginas de información: "Acerca de esta guía", "Privacidad y términos" y "Sugiere un cambio". Cada
 * una tiene su propia ruta (#/info/…), así que se puede enlazar y compartir por separado; al cerrarlas
 * se vuelve a lo que había debajo. Desde cada una se salta a las otras dos, sin volver a buscarlas en
 * la interfaz.
 *
 * Son tres y no cuatro porque privacidad y términos van juntas desde la v4.18. La dirección no
 * cambió (/info/privacidad): ya estaba indexada, y partirla en dos habría dejado dos páginas cortas
 * que se repiten.
 */
import { X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Signature } from '../../components/brand/Signature.tsx'
import { APP_VERSION } from '../../config/site.ts'
import { t, useLocale } from '../../i18n/index.ts'
import { alPulsarEnlace } from '../../lib/navegacion.ts'
import { INFO_TOPICS, type InfoPagina, type InfoTopic, rutaDeInfo } from '../../lib/url-state.ts'
import styles from './InfoDialog.module.css'

/** Pesa lo suyo y casi nadie lo abre: viaja en su propio trozo, no en el arranque de la guía. */
const SuggestForm = lazy(() =>
  import('./SuggestForm.tsx').then((module) => ({ default: module.SuggestForm })),
)

type TopicKey = 'about' | 'privacy' | 'contribute'

const TOPIC: Record<InfoPagina, TopicKey> = {
  acerca: 'about',
  privacidad: 'privacy',
  sugerir: 'contribute',
}

/** El nombre de cada tema en la fila de enlaces. El tutorial no es página de texto, pero sí enlace. */
const ENLACE = {
  acerca: 'about.open',
  privacidad: 'about.privacyTitle',
  sugerir: 'about.fix',
  tutorial: 'about.tutorial',
} as const satisfies Record<InfoTopic, string>

/**
 * Cada página se lee en capas: un titular con lo esencial, el cuerpo y un detalle para quien siga
 * leyendo. Es la forma recomendada para avisos de privacidad y se aplica igual a las tres.
 */
const PAGE = {
  about: {
    title: 'about.title',
    lead: 'about.aboutLead',
    body: 'about.aboutBody',
    detail: 'about.aboutSources',
    extra: null,
    link: 'about.open',
  },
  privacy: {
    title: 'about.privacyTitle',
    lead: 'about.privacyLead',
    body: 'about.privacyBody',
    detail: 'about.privacyLocation',
    // La cuarta: desde que se cuentan visitas, callarlo sería mentir por omisión.
    extra: 'about.privacyCounts',
    link: 'about.privacy',
  },
  contribute: {
    title: 'about.contribute',
    lead: 'about.contributeLead',
    body: 'about.contributeBody',
    detail: 'about.contributeMeanwhile',
    extra: null,
    link: 'about.fix',
  },
} as const

interface InfoDialogProps {
  topic: InfoPagina
  onClose: () => void
  onGoTo: (topic: InfoTopic) => void
}

export function InfoDialog({ topic, onClose, onGoTo }: InfoDialogProps) {
  // La hoja se redibuja al cambiar de idioma aunque se abra sola (p. ej. en una prueba).
  const idioma = useLocale()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const key = TOPIC[topic]
  const page = PAGE[key]

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      // Foco atrapado dentro de la hoja mientras está abierta.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0] as HTMLElement
      const last = focusable[focusable.length - 1] as HTMLElement
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Se monta en el cuerpo del documento: dentro del panel, su `transform` de animación haría que el
  // velo se posicionara respecto al panel y no respecto a la pantalla.
  return createPortal(
    <div className={styles.veil}>
      {/* Tocar fuera cierra: es un botón de verdad, con nombre, y no un div que escucha clics. */}
      <button
        type="button"
        className={styles.veilButton}
        aria-label={t('about.close')}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
      >
        {/*
         * Lo que se desplaza es esto y no la hoja. La hoja lleva el borde redondeado y recorta, así
         * que al llegar al final del texto el gesto se queda aquí dentro en vez de arrastrar la
         * página de detrás, y el texto se desvanece en el borde en vez de quedar cortado en seco
         * contra la curva.
         */}
        <div className={styles.scroller}>
          <div className={styles.head}>
            <h2 id="info-title" className={styles.title}>
              {t(page.title)}
            </h2>
            <button
              ref={closeRef}
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label={t('about.close')}
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <p className={styles.lead}>{t(page.lead)}</p>
          <p className={styles.body}>{t(page.body)}</p>
          {/*
           * En "Sugiere un cambio" el formulario ocupa el sitio del detalle. Desde la v4.18 siempre
           * está: ya no depende de una clave de terceros que podía faltar, así que no hay caso en el
           * que la página tenga que explicar que el canal no existe.
           */}
          {key === 'contribute' ? (
            <Suspense fallback={null}>
              <SuggestForm />
            </Suspense>
          ) : (
            <p className={styles.body}>{t(page.detail)}</p>
          )}
          {page.extra && <p className={styles.body}>{t(page.extra)}</p>}

          {/*
           * Los términos, en la misma página y debajo de la privacidad. Se leen en el mismo orden en
           * que importan: qué es esta guía, qué tan fiable es el dato, cómo pedir que se corrija o se
           * quite, y de quién es cada cosa.
           */}
          {key === 'privacy' && (
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>{t('about.termsTitle')}</h3>
              <p className={styles.body}>{t('about.termsWhat')}</p>
              <p className={styles.body}>{t('about.termsData')}</p>
              <p className={styles.body}>{t('about.termsFix')}</p>
              <p className={styles.body}>{t('about.termsContent')}</p>
            </div>
          )}

          {key === 'about' && (
            <>
              <div className={styles.block}>
                <h3 className={styles.blockTitle}>{t('about.credits')}</h3>
                <p className={styles.body}>{t('about.creditsBody')}</p>
              </div>
              <p className={styles.colophon}>
                <Signature />
                <span className={styles.version}>
                  {t('about.version', { version: APP_VERSION })}
                </span>
              </p>
            </>
          )}

          {/*
           * Enlaces y no botones, como en la franja de la guía y en el pie de Tu Zibatá: cada una
           * de estas páginas tiene su ruta, el tutorial incluido.
           */}
          <nav className={styles.more} aria-label={t('about.moreLabel')}>
            {INFO_TOPICS.filter((other) => other !== topic).map((other) => (
              <a
                key={other}
                className={styles.moreLink}
                href={rutaDeInfo(other, idioma, import.meta.env.BASE_URL)}
                onClick={alPulsarEnlace(() => onGoTo(other))}
              >
                {t(ENLACE[other])}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </div>,
    document.body,
  )
}
