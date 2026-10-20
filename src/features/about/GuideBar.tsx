/**
 * Quién hace la guía y cómo corregirla, a la vista desde el primer segundo y sin robar mapa:
 * en escritorio, una franja discreta en el borde inferior; en móvil, donde no cabe una franja sin
 * pelearse con la hoja y la atribución, un botón en la barra superior que abre "Acerca de esta guía".
 */
import { Signature } from '../../components/brand/Signature.tsx'
import { t, useLocale } from '../../i18n/index.ts'
import { alPulsarEnlace } from '../../lib/navegacion.ts'
import { type InfoPagina, type InfoTopic, rutaDeInfo } from '../../lib/url-state.ts'
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
  const idioma = useLocale()
  return (
    <div className={styles.bar}>
      <p className={styles.legend}>{t('about.independent')}</p>
      {/*
       * Enlaces y no botones. Las tres tienen ruta propia, y mientras se abrían con un botón no se
       * podían abrir en otra pestaña ni copiar, y un buscador no encontraba ninguna.
       */}
      <nav className={styles.links} aria-label={t('about.moreLabel')}>
        {PAGINAS.map((topic) => (
          <a
            key={topic}
            className={styles.link}
            href={rutaDeInfo(topic, idioma, import.meta.env.BASE_URL)}
            onClick={alPulsarEnlace(() => onOpen(topic))}
          >
            {t(LABEL[topic])}
          </a>
        ))}
      </nav>
      <Signature className={styles.firma} compacta />
    </div>
  )
}
