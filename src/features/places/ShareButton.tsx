import { Check, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/index.ts'
import { canShare, placeUrl, type ShareOutcome, share } from '../../lib/share.ts'
import styles from './ShareButton.module.css'

/** Cuánto dura el acuse de "enlace copiado" antes de volver el botón a su estado normal. */
const ACUSE_MS = 2400

interface ShareButtonProps {
  name: string
  slug: string
  /** Los giros del lugar ya traducidos y unidos: van en el texto que se comparte. */
  giros: string
  plazaName: string
  size?: 'sm' | 'md'
  /**
   * Con nombre a la vista, para la fila de salidas de la ficha. Sin esto es solo el icono, que es
   * lo que quiere la barra de herramientas y lo que quiere una tarjeta.
   */
  conNombre?: boolean
}

/**
 * Compartir un lugar. Si el navegador no trae ni la hoja del sistema ni el portapapeles, no se
 * dibuja: un botón que no puede hacer nada estorba más de lo que ayuda.
 *
 * El acuse vive en el propio botón y no en un aviso flotante. La guía no tiene sistema de avisos, y
 * montarlo para una confirmación de dos segundos sería construir mucho para decir poco; además el
 * acuse donde estaba el dedo es donde se busca. Se anuncia con `role="status"`, que el lector de
 * pantalla lee sin robar el foco.
 */
export function ShareButton({
  name,
  slug,
  giros,
  plazaName,
  size = 'md',
  conNombre = false,
}: ShareButtonProps) {
  const [resultado, setResultado] = useState<ShareOutcome | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => clearTimeout(temporizador.current ?? undefined), [])

  if (!canShare()) return null

  const acusar = (salida: ShareOutcome) => {
    // Compartido o cancelado no dicen nada: en el primero el sistema ya dio su propia señal y en
    // el segundo no ha pasado nada.
    if (salida !== 'copied' && salida !== 'unsupported') return
    setResultado(salida)
    clearTimeout(temporizador.current ?? undefined)
    temporizador.current = setTimeout(() => setResultado(null), ACUSE_MS)
  }

  const copiado = resultado === 'copied'
  const etiqueta = copiado ? t('share.copied') : t('share.place', { name })

  return (
    <>
      <button
        type="button"
        className={styles.button}
        data-size={size}
        data-nombre={conNombre}
        data-done={copiado}
        aria-label={etiqueta}
        title={copiado ? t('share.copied') : t('share.action')}
        onClick={() => {
          // Sin await antes: `navigator.share` exige la activación del usuario y se perdería.
          void share({
            title: `${name} · ${t('app.name')}`,
            text: t('share.text', { name, giros, plaza: plazaName }),
            url: placeUrl(slug),
          }).then(acusar)
        }}
      >
        {copiado ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
        {conNombre && (
          /*
           * Las dos palabras ocupan la misma celda, y la que no toca se esconde pero sigue
           * midiendo. Así el botón vale siempre lo que la más larga y no crece ni encoge al
           * acusar: un control que cambia de tamaño al pulsarlo empuja a su vecino y se siente
           * como un error, no como una confirmación.
           */
          <span className={styles.acuse}>
            <span data-visible={!copiado}>{t('share.action')}</span>
            <span data-visible={copiado}>{t('share.copied')}</span>
          </span>
        )}
      </button>
      <span role="status" className="visually-hidden">
        {resultado === 'copied' && t('share.copied')}
        {resultado === 'unsupported' && t('share.failed')}
      </span>
    </>
  )
}
