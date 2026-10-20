/**
 * El cambio de idioma, que no es un control: es navegación.
 *
 * La guía tiene dos árboles de direcciones, uno por idioma, y cada página existe en los dos. Así
 * que cambiar de idioma no es poner un ajuste, es ir al mismo contenido en otra dirección. Era un
 * botón que ciclaba, y eso escondía dos cosas: a dónde te lleva (no se puede abrir en otra pestaña
 * ni copiar la dirección de la versión en inglés) y en qué idioma estás ahora.
 *
 * La forma la define GOV.UK para este caso exacto: un `nav` con la lista de idiomas, el actual sin
 * enlazar y marcado con `aria-current`, y los demás como enlaces con `hreflang` y `rel="alternate"`,
 * que es lo que además le dice a un buscador que son la misma página en otro idioma.
 *
 * Lo que se ve es la bandera y el código **del idioma que estás leyendo**, no del que vas a ir. Es
 * una decisión de quien firma la guía y va contra lo que haría un enlace por su cuenta (un enlace
 * enseña su destino), así que lo que dice a dónde lleva es la etiqueta accesible, que está escrita
 * en el idioma de destino. Queda apuntado por si alguna vez se quiere al revés.
 *
 * Lo que sí cambió respecto al botón que ciclaba es lo que no se ve y sí se nota: ahora la versión
 * en inglés tiene su dirección, se abre en otra pestaña y se copia.
 */
import { LLEVA_AL_IDIOMA, NOMBRE_DEL_IDIOMA } from '../../i18n/cambioDeIdioma.ts'
import { availableLocales, type Locale, setLocale, t, useLocale } from '../../i18n/index.ts'
import { assetUrl } from '../../lib/assets.ts'
import { buildPath, parsePath } from '../../lib/url-state.ts'
import styles from './LocaleSwitch.module.css'

const BASE = import.meta.env.BASE_URL

const CORTO: Record<Locale, 'locale.shortEs' | 'locale.shortEn'> = {
  es: 'locale.shortEs',
  en: 'locale.shortEn',
}

/** Las banderas son SVG de circle-flags (MIT), servidas como archivo estático. */
const BANDERA: Record<Locale, string> = { es: 'flags/mx.svg', en: 'flags/us.svg' }

/** La misma página en el otro idioma: se lee la ruta actual y se vuelve a escribir con su locale. */
function mismaPaginaEn(locale: (typeof availableLocales)[number]): string {
  if (typeof window === 'undefined') return BASE
  const actual = parsePath(window.location.pathname, window.location.search, BASE)
  return buildPath({ ...actual, locale }, BASE)
}

export function LocaleSwitch() {
  const current = useLocale()

  return (
    <nav className={styles.switch} aria-label={t('locale.label')}>
      <ul>
        {availableLocales.map((locale) =>
          locale === current ? (
            /*
             * El idioma actual no se enlaza: ya estás en él, y `aria-current` lo dice. No se
             * dibuja, porque lo que se ve en su sitio es la bandera del enlace, que por decisión
             * del proyecto muestra este mismo idioma.
             */
            <li key={locale} className={styles.soloParaLectores}>
              <span lang={locale} aria-current="true">
                {NOMBRE_DEL_IDIOMA[locale]}
              </span>
            </li>
          ) : (
            <li key={locale}>
              <a
                className={styles.otro}
                href={mismaPaginaEn(locale)}
                lang={locale}
                hrefLang={locale}
                rel="alternate"
                /*
                 * El nombre accesible completo va en `aria-label` y no en un texto escondido
                 * dentro del enlace: el nombre se arma concatenando lo que hay dentro, y según el
                 * motor eso pega las dos frases sin separación ("EnglishView the guide in
                 * English"). Incluye el texto visible, que es lo que pide la norma para que quien
                 * dicta por voz pueda nombrar el enlace por lo que ve.
                 */
                aria-label={`${NOMBRE_DEL_IDIOMA[locale]} ${LLEVA_AL_IDIOMA[locale].replace(
                  '{language}',
                  NOMBRE_DEL_IDIOMA[locale],
                )}`}
                onClick={(event) => {
                  // Dentro de la guía se cambia sin recargar; con Ctrl, Cmd o Mayúsculas, no.
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  )
                    return
                  event.preventDefault()
                  void setLocale(locale)
                }}
              >
                {/* La bandera y el código son los del idioma que se está leyendo, no los del
                    destino: a dónde lleva lo dice la etiqueta accesible. */}
                <img
                  className={styles.flag}
                  src={assetUrl(BANDERA[current])}
                  alt=""
                  width={20}
                  height={20}
                />
                <span className={styles.code}>{t(CORTO[current])}</span>
              </a>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
