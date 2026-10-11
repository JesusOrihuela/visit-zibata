/**
 * Quién hace la guía y cómo corregirla, a la vista desde el primer segundo y sin robar mapa:
 * en escritorio, una franja discreta en el borde inferior; en móvil, donde no cabe una franja sin
 * pelearse con la hoja y la atribución, un botón en la barra superior que abre "Acerca de esta guía".
 */
import { Signature } from '../../components/brand/Signature.tsx'
import { t } from '../../i18n/index.ts'
import type { InfoPagina, InfoTopic } from '../../lib/url-state.ts'
import styles from './GuideBar.module.css'

/**
 * En la franja el nombre va corto: el ancho que ahorra se lo lleva la leyenda.
 *
 * Solo las tres páginas de texto. El tutorial también tiene ruta, pero aquí estorbaría: esta franja
 * dice quién hace la guía y cómo corregirla, y se llega a él desde cualquiera de las tres.
 */
const LABEL: Record<InfoPagina, 'about.openShort' | 'about.privacy' | 'about.fix'> = {
  acerca: 'about.openShort',
  privacidad: 'about.privacy',
  sugerir: 'about.fix',
}

const PAGINAS = Object.keys(LABEL) as InfoPagina[]

export function GuideBar({ onOpen }: { onOpen: (topic: InfoTopic) => void }) {
  return (
    <div className={styles.bar}>
      <p className={styles.legend}>{t('about.independent')}</p>
      <nav className={styles.links} aria-label={t('about.moreLabel')}>
        {PAGINAS.map((topic) => (
          <button key={topic} type="button" className={styles.link} onClick={() => onOpen(topic)}>
            {t(LABEL[topic])}
          </button>
        ))}
      </nav>
      <Signature className={styles.firma} compacta />
    </div>
  )
}
