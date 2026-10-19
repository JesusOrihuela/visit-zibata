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
 * Lo que se ve sigue siendo la bandera y el código del idioma en el que estás, que es lo que había
 * y lo que se prefirió al verlo de las dos maneras. La fuente recomienda el nombre nativo del
 * idioma, y la objeción de fondo sigue en pie (una bandera nombra un país, no una lengua), pero eso
 * es una elección de quien firma la guía y no una regla técnica. Lo que sí cambió es lo que no se
 * ve y sí se nota: ahora se puede abrir la versión en inglés en otra pestaña y copiar su dirección.
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
            // El idioma actual no se enlaza: ya estás en él. `aria-current` es lo que lo dice.
            <li key={locale}>
              <span className={styles.actual} lang={locale} aria-current="true">
                <img
                  className={styles.flag}
                  src={assetUrl(BANDERA[locale])}
                  alt=""
                  width={20}
                  height={20}
                />
                <span className={styles.code}>{t(CORTO[locale])}</span>
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
                <img
                  className={styles.flag}
                  src={assetUrl(BANDERA[locale])}
                  alt=""
                  width={20}
                  height={20}
                />
                <span className={styles.code}>{t(CORTO[locale])}</span>
              </a>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
