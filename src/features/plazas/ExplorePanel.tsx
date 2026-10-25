/** Vista de exploración: resumen de Zibatá y plazas ordenadas por número de lugares. */
import { ChevronRight, Construction, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { DEFAULT_PLAZA_TONE, plazaTones } from '../../config/palette.ts'
import { useCatalog } from '../../data/CatalogContext.tsx'
import { localized, t, useLocale } from '../../i18n/index.ts'
import { alPulsarEnlace } from '../../lib/navegacion.ts'
import { rutaDeZona } from '../../lib/url-state.ts'
import styles from './Panel.module.css'

interface ExplorePanelProps {
  onSelectPlaza: (plazaId: string) => void
  onClose?: () => void
  /** En la hoja móvil colapsada solo se muestra un encabezado compacto con acceso a la lista. */
  headerOnly?: boolean
  onExpand?: () => void
}

export function ExplorePanel({
  onSelectPlaza,
  onClose,
  headerOnly = false,
  onExpand,
}: ExplorePanelProps) {
  const catalog = useCatalog()
  const idioma = useLocale()
  /**
   * Lo que hay en una zona: sus giros, los que más se repiten primero.
   *
   * Giros y no categorías, y la diferencia se ve. Zibatá Golf tiene un solo local, que la tarjeta
   * presenta como "Restaurante Bar" y "Desayunos"; contando categorías el renglón decía "Bar", que
   * es el cajón al que pertenece el primero de sus giros y un nombre que no aparece en ningún otro
   * sitio de esa zona. La guía enseña giros en todas partes (en la tarjeta, en la ficha), así que
   * el índice también.
   *
   * Cuentan todos los giros de cada local y no solo el principal: son lo que ese local ofrece, y
   * dejar fuera el segundo es justo lo que hacía desaparecer "Desayunos" de Zibatá Golf.
   *
   * El orden lo decide ese conteo y no el del catálogo. Con el orden del catálogo las once líneas
   * empezaban por lo mismo y se leían todas iguales, que era el defecto de la fila de iconos que
   * vino a sustituir. Dos nombres y no tres: los de este catálogo son largos y con tres la línea se
   * cortaba a media palabra en cualquier teléfono.
   */
  const queHay = (plazaId: string) => {
    const porGiro = new Map<string, number>()
    for (const place of catalog.placesByPlaza.get(plazaId) ?? []) {
      for (const giro of place.giros) porGiro.set(giro, (porGiro.get(giro) ?? 0) + 1)
    }
    const nombres = [...porGiro.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => catalog.giroById.get(id))
      .filter((giro) => giro !== undefined)
      .map((giro) => localized(giro.label))
    const restantes = nombres.length - 2
    const primeros = nombres.slice(0, 2).join(', ')
    return restantes > 0 ? t('explore.andMore', { list: primeros, count: restantes }) : primeros
  }
  const tones = plazaTones(catalog.plazas.filter((plaza) => plaza.active).map((plaza) => plaza.id))
  const comingSoon = catalog.plazas.filter((plaza) => plaza.comingSoon === true)
  const plazas = catalog.plazas
    .filter((plaza) => plaza.active)
    .map((plaza) => ({ plaza, count: catalog.placesByPlaza.get(plaza.id)?.length ?? 0 }))
    .sort((a, b) => b.count - a.count || a.plaza.name.localeCompare(b.plaza.name, 'es'))

  if (headerOnly) {
    return (
      <section className={styles.peek} aria-labelledby="explore-title">
        <div>
          <h2 id="explore-title" className={styles.peekTitle}>
            {t('explore.title')}
          </h2>
          <p className={styles.peekText}>
            {t('explore.summary', {
              plazas: t('plazas.count', { count: plazas.length }),
              places: t('places.count', { count: catalog.places.length }),
            })}
          </p>
        </div>
        {onExpand && (
          <button type="button" className={styles.peekButton} onClick={onExpand}>
            {t('explore.expand')}
          </button>
        )}
      </section>
    )
  }

  return (
    <section className={styles.panel} aria-labelledby="explore-title">
      <header className={styles.header}>
        <div className={styles.topline}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            {t('explore.list')}
          </p>
          {onClose && (
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label={t('panel.close')}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        <h2 id="explore-title" className={styles.title}>
          {t('explore.title')}
        </h2>
        <p className={styles.lead}>
          {t('explore.summary', {
            plazas: t('plazas.count', { count: plazas.length }),
            places: t('places.count', { count: catalog.places.length }),
          })}
        </p>
        {!headerOnly && <p className={styles.address}>{t('explore.hint')}</p>}
      </header>

      {!headerOnly && (
        <ul className={styles.plazaList}>
          {plazas.map(({ plaza, count }) => (
            <li key={plaza.id}>
              {/*
               * El renglón entero es el enlace a la zona. Era un botón, y la zona tiene dirección
               * propia: así se puede abrir en otra pestaña, copiar y encontrar desde fuera.
               */}
              <a
                className={styles.plazaCard}
                href={rutaDeZona(plaza.slug, idioma, import.meta.env.BASE_URL)}
                onClick={alPulsarEnlace(() => onSelectPlaza(plaza.id))}
                aria-label={`${plaza.name}, ${t('places.count', { count })}: ${plaza.categories
                  .map((id) => {
                    const category = catalog.categoryById.get(id)
                    return category ? localized(category.label) : id
                  })
                  .join(', ')}`}
              >
                {/*
                 * La misma gota que marca esta zona en el mapa, en miniatura y con su cifra dentro.
                 * Antes era un rombo de color: una forma que no existe en ningún otro sitio de la
                 * guía y que solo llevaba el tono. Con la gota, el índice deja de ser una lista
                 * aparte y pasa a ser la leyenda de lo que estás viendo arriba.
                 */}
                <span
                  className={styles.plazaGota}
                  style={
                    {
                      '--plaza-accent': (tones.get(plaza.id) ?? DEFAULT_PLAZA_TONE).accent,
                    } as CSSProperties
                  }
                  aria-hidden="true"
                >
                  <span>{count}</span>
                </span>
                <span className={styles.plazaInfo}>
                  <span className={styles.plazaName}>{plaza.name}</span>
                  {/*
                   * Lo que hay, en palabras. Antes era una fila de hasta seis iconos de 15 px que
                   * ocupaban el sitio de la respuesta sin darla: a ese tamaño no se distinguen, y
                   * "25 lugares" nunca fue lo que querías saber, querías saber si hay dónde
                   * desayunar. Ocupa lo mismo y se lee.
                   */}
                  <span className={styles.plazaMeta} aria-hidden="true">
                    {queHay(plaza.id)}
                  </span>
                </span>
                <ChevronRight className={styles.chevron} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {!headerOnly && comingSoon.length > 0 && (
        <div className={styles.soon}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>{t('plaza.comingSoonList')}</h3>
          </div>
          <ul className={styles.plazaList}>
            {comingSoon.map((plaza) => (
              <li key={plaza.id} className={styles.soonCard}>
                <span className={styles.soonName}>{plaza.name}</span>
                <span className={styles.soonBadge}>
                  <Construction aria-hidden="true" />
                  {t('plaza.comingSoon')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
