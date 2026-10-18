/** Vista de exploración: resumen de Zibatá y plazas ordenadas por número de lugares. */
import { ChevronRight, Construction, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { DEFAULT_PLAZA_TONE, plazaTones } from '../../config/palette.ts'
import { useCatalog } from '../../data/CatalogContext.tsx'
import { localized, t } from '../../i18n/index.ts'
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
  /**
   * Lo que hay en una zona, en palabras y por lo que de verdad abunda.
   *
   * El orden lo decide el conteo de locales de cada categoría dentro de esa zona, no el del
   * catálogo. Con el orden del catálogo las once líneas empezaban por "Desayunos y Café, Tacos y
   * Antojitos" y se leían todas iguales: la línea ocupaba el ancho sin distinguir una zona de otra,
   * que era exactamente el defecto de la fila de iconos que vino a sustituir.
   *
   * Dos nombres y no tres: los de este catálogo son largos ("Panadería y Repostería"), y con tres
   * la línea se cortaba a media palabra en cualquier teléfono. El resto se cuenta.
   */
  const queHay = (plazaId: string) => {
    const porCategoria = new Map<string, number>()
    for (const place of catalog.placesByPlaza.get(plazaId) ?? []) {
      // Solo el giro principal: contar todos infla las zonas con locales de carta ancha.
      const categoria = catalog.categoryOfGiro.get(place.giros[0] ?? '')
      if (categoria) porCategoria.set(categoria.id, (porCategoria.get(categoria.id) ?? 0) + 1)
    }
    const nombres = [...porCategoria.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => catalog.categoryById.get(id))
      .filter((categoria) => categoria !== undefined)
      .map((categoria) => localized(categoria.label))
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
            {t('explore.openList')}
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
              <button
                type="button"
                className={styles.plazaCard}
                onClick={() => onSelectPlaza(plaza.id)}
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
              </button>
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
