/**
 * La hoja de "Tu Zibatá": una foto del presente, para mirar más que para tocar.
 *
 *  - ¿Por dónde he andado? Una frase con lo que llevas y las zonas de la guía como insignias, las
 *    estrenadas llenas y las que faltan en contorno. Son un cuadro, no botones.
 *  - ¿Cuáles son mis tres? Los lugares que más te representan, en el orden que sale de tus propias
 *    marcas. El orden es interno: en pantalla solo se ve el lugar, su giro y su plaza.
 *  - ¿Qué tipo de lugar busco siempre? Los tres giros donde más marcas hay, contando solo las que
 *    pones a propósito (visitas, notas y corazones), nunca las fichas que abriste.
 *
 * Vive aparte del botón porque casi nunca se abre: así no viaja en el arranque de la guía.
 */
import { Check, X } from 'lucide-react'
import { type CSSProperties, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CategoryIcon } from '../../components/icons/CategoryIcon.tsx'
import { ProfileIcon } from '../../components/icons/ProfileIcon.tsx'
import { DEFAULT_PLAZA_TONE, plazaTones } from '../../config/palette.ts'
import { useCatalog } from '../../data/CatalogContext.tsx'
import { localized, t, useLocale } from '../../i18n/index.ts'
import { alPulsarEnlace } from '../../lib/navegacion.ts'
import { type InfoTopic, rutaDeInfo, rutaDeLugar } from '../../lib/url-state.ts'
import type { Category, Place, Plaza } from '../../types/domain.ts'
import { girosOf, placeIconName } from '../places/placeIcon.ts'
import { categoryAffinity } from '../ranking/rankPlaces.ts'
import styles from './ProfileButton.module.css'
import type { Marks } from './useMarks.ts'
import { useMarks } from './useMarks.ts'

/** Las páginas de la guía, también aquí: en un teléfono esta hoja es el camino más corto. */
const LINKS = [
  { topic: 'acerca', label: 'about.openShort' },
  { topic: 'privacidad', label: 'about.privacy' },
  { topic: 'sugerir', label: 'about.fix' },
] as const

/** Cuántos lugares y cuántos antojos se enseñan. */
const TOP = 3

/** Una zona en el pasaporte: su color del mapa, y si ya la estrenaste. */
interface Zone {
  plaza: Plaza
  visited: boolean
  accent: string
  soft: string
}

/** Un lugar de los tuyos, con todo lo que decide su puesto. Nada de esto se enseña. */
interface Ranked {
  place: Place
  rating: number
  visits: number
  favorite: boolean
  opens: number
  last: string
  plazaVisits: number
}

interface Journey {
  visitedPlaces: number
  zones: Zone[]
  zonesVisited: number
  mine: Ranked[]
  tastes: { category: Category; count: number }[]
}

/**
 * El orden de tus tres, en cascada: primero lo que dijiste a propósito (las estrellas), luego lo que
 * hiciste (visitas, corazón), después lo que miraste, y al final los desempates. Es interno: en la
 * hoja no se explica ni se numera.
 */
function byMine(a: Ranked, b: Ranked): number {
  return (
    b.rating - a.rating ||
    b.visits - a.visits ||
    Number(b.favorite) - Number(a.favorite) ||
    b.opens - a.opens ||
    b.last.localeCompare(a.last) ||
    b.plazaVisits - a.plazaVisits ||
    a.place.name.localeCompare(b.place.name, 'es')
  )
}

/** Lo que llevas hecho, leído del catálogo vigente: lo que ya no existe no cuenta. */
function useJourney(marks: Marks): Journey {
  const catalog = useCatalog()
  return useMemo(() => {
    const find = (id: string) => catalog.placeById.get(id)
    const exists = (place: Place | undefined): place is Place => Boolean(place)
    const visited = [...marks.visits.keys()].map(find).filter(exists)

    // Las zonas llevan su color del mapa: la insignia verde de aquí es la misma plaza de allá.
    const visitedZones = new Set(visited.map((place) => place.plazaId))
    const open = catalog.plazas.filter((plaza) => plaza.active)
    const tones = plazaTones(open.map((plaza) => plaza.id))
    const zones: Zone[] = open.map((plaza) => {
      const tone = tones.get(plaza.id) ?? DEFAULT_PLAZA_TONE
      return {
        plaza,
        visited: visitedZones.has(plaza.id),
        accent: tone.accent,
        soft: tone.soft,
      }
    })

    // Cuántas visitas llevas a cada plaza: el penúltimo desempate.
    const plazaVisits = new Map<string, number>()
    for (const [id, dates] of marks.visits) {
      const place = find(id)
      if (!place) continue
      plazaVisits.set(place.plazaId, (plazaVisits.get(place.plazaId) ?? 0) + dates.length)
    }

    // Para el orden entra todo, también las fichas abiertas: así siempre hay tres.
    const seen = [
      ...new Set([
        ...marks.favorites,
        ...marks.ratings.keys(),
        ...marks.visits.keys(),
        ...marks.interactions.keys(),
      ]),
    ]
      .map(find)
      .filter(exists)

    const mine = seen
      .map((place) => ({
        place,
        rating: marks.ratings.get(place.id) ?? 0,
        visits: marks.visits.get(place.id)?.length ?? 0,
        favorite: marks.favorites.has(place.id),
        opens: marks.interactions.get(place.id)?.opens ?? 0,
        last: marks.visits.get(place.id)?.at(-1) ?? '',
        plazaVisits: plazaVisits.get(place.plazaId) ?? 0,
      }))
      .sort(byMine)
      .slice(0, TOP)

    /*
     * Para los antojos, en cambio, solo cuentan las marcas que pones a propósito: abrir una ficha es
     * curiosidad, no gusto. Se reusa el mismo cálculo que ordena las pastillas de categoría, con las
     * aperturas vacías.
     */
    const marked = [
      ...new Set([...marks.favorites, ...marks.ratings.keys(), ...marks.visits.keys()]),
    ]
      .map(find)
      .filter(exists)
    const affinity = categoryAffinity(
      {
        favorites: marks.favorites,
        ratings: marks.ratings,
        interactions: new Map(),
        visits: marks.visits,
      },
      find,
      Date.now(),
      (giro) => catalog.categoryOfGiro.get(giro)?.id,
    )
    const tastes = [...affinity]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({
        category: catalog.categoryById.get(id),
        count: marked.filter((place) =>
          place.giros.some((giro) => catalog.categoryOfGiro.get(giro)?.id === id),
        ).length,
      }))
      .filter((entry): entry is { category: Category; count: number } =>
        Boolean(entry.category && entry.count > 0),
      )
      .slice(0, TOP)

    return {
      visitedPlaces: visited.length,
      zones,
      zonesVisited: zones.filter((zone) => zone.visited).length,
      mine,
      tastes,
    }
  }, [catalog, marks])
}

/**
 * El nombre corto de la zona para la insignia: "Plaza Luna" se lee "Luna". El nombre completo no se
 * pierde: el mapa y el resto de la guía lo llevan entero.
 */
function shortZoneName(name: string): string {
  return name.replace(/^Plaza\s+/i, '')
}

/**
 * Un escalón del podio: el icono del giro en el color de su plaza, el nombre, el giro y, abajo, el
 * bloque con el puesto y la plaza. El primero va al centro y más alto, como en cualquier podio; el
 * orden del documento sigue siendo 1, 2, 3, que es el que se lee y el que se recorre con el teclado.
 */
function PodiumStep({
  entry,
  position,
  onOpen,
}: {
  entry: Ranked
  position: number
  onOpen: (place: Place) => void
}) {
  const catalog = useCatalog()
  const idioma = useLocale()
  const { place } = entry
  /*
   * La lista completa de plazas activas, no solo la de este lugar.
   *
   * `plazaTones` reparte los tonos **por posición** en la lista que recibe, así que pedirle una sola
   * devolvía siempre el índice 0: diez de las once zonas se pintaban con el verde de la primera. El
   * mismo lugar salía verde aquí y de su color en el mapa.
   */
  const tone =
    plazaTones(catalog.plazas.filter((item) => item.active).map((item) => item.id)).get(
      place.plazaId,
    ) ?? DEFAULT_PLAZA_TONE
  const giro = girosOf(place, catalog)
    .map((entry) => localized(entry.label))
    .join(' · ')
  return (
    <li className={styles.step} data-place={position}>
      {/* La columna entera es el enlace a la ficha: el lugar tiene dirección propia. */}
      <a
        className={styles.stepButton}
        href={rutaDeLugar(place.slug, idioma, import.meta.env.BASE_URL)}
        onClick={alPulsarEnlace(() => onOpen(place))}
        title={place.name}
        aria-label={`${t('profile.position', { position })}. ${t('place.openDetail', {
          name: place.name,
        })}`}
      >
        <span
          className={styles.stepIcon}
          style={{ '--zone-accent': tone.accent, '--zone-soft': tone.soft } as CSSProperties}
          aria-hidden="true"
        >
          <CategoryIcon name={placeIconName(place, catalog)} size={18} />
        </span>
        <span className={styles.stepName}>{place.name}</span>
        <span className={styles.stepGiro}>{giro}</span>
        <span className={styles.stepBlock} data-place={position}>
          <span className={styles.stepNumber} aria-hidden="true">
            {position}
          </span>
        </span>
      </a>
    </li>
  )
}

interface SheetProps {
  onClose: () => void
  onOpenInfo: (topic: InfoTopic) => void
  onOpenPlace: (place: Place) => void
}

export function ProfileSheet({ onClose, onOpenInfo, onOpenPlace }: SheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const idioma = useLocale()
  const catalog = useCatalog()
  const marks = useMarks()
  const journey = useJourney(marks)

  // Al abrir, el foco entra en la hoja (y Escape la cierra desde cualquier parte, como las demás).
  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const started = marks.visits.size + marks.favorites.size + marks.ratings.size > 0

  // Igual que las hojas de información: fuera del panel, porque la barra superior crea contexto de
  // apilamiento (backdrop-filter) y un `position: fixed` dentro de ella se ancla a la barra.
  return createPortal(
    <div className={styles.veil}>
      <button
        type="button"
        className={styles.veilButton}
        aria-label={t('about.close')}
        onClick={onClose}
      />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className={styles.head}>
          <div className={styles.identity}>
            <span className={styles.bigAvatar} aria-hidden="true">
              <ProfileIcon />
            </span>
            <div>
              <h2 id="profile-title" className={styles.title}>
                {t('profile.title')}
              </h2>
              <p className={styles.subtitle}>{t('profile.subtitle')}</p>
            </div>
          </div>
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

        {started ? (
          <>
            <section className={styles.journey} aria-labelledby="profile-journey">
              <h3 id="profile-journey" className={styles.blockTitle}>
                {t('profile.journey')}
              </h3>
              <p className={styles.summary}>
                {journey.visitedPlaces > 0
                  ? t('profile.visitsSummary', {
                      count: journey.visitedPlaces,
                      zones: journey.zonesVisited,
                      total: journey.zones.length,
                    })
                  : t('profile.noVisits', {
                      total: journey.zones.length,
                      places: catalog.places.length,
                    })}
              </p>
              {/* Las insignias son un cuadro, no controles: llenas las estrenadas, en contorno el resto. */}
              <ul className={styles.zones} aria-label={t('profile.zonesLabel')}>
                {journey.zones.map((zone) => (
                  <li
                    key={zone.plaza.id}
                    className={styles.zone}
                    data-visited={zone.visited}
                    style={
                      {
                        '--zone-accent': zone.accent,
                        '--zone-soft': zone.soft,
                      } as CSSProperties
                    }
                  >
                    {zone.visited && <Check aria-hidden="true" className={styles.zoneCheck} />}
                    {shortZoneName(zone.plaza.name)}
                    {zone.visited && (
                      <span className="visually-hidden">, {t('profile.zoneDone')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {journey.mine.length > 0 && (
              <section className={styles.block} aria-labelledby="profile-mine">
                <h3 id="profile-mine" className={styles.blockTitle}>
                  {t('profile.podium')}
                </h3>
                <ol className={styles.podium} data-steps={journey.mine.length}>
                  {journey.mine.map((entry, index) => (
                    <PodiumStep
                      key={entry.place.id}
                      entry={entry}
                      position={index + 1}
                      onOpen={onOpenPlace}
                    />
                  ))}
                </ol>
              </section>
            )}

            {journey.tastes.length > 0 && (
              <section className={styles.block} aria-labelledby="profile-tastes">
                <h3 id="profile-tastes" className={styles.blockTitle}>
                  {t('profile.tastes')}
                </h3>
                <ul className={styles.tastes}>
                  {journey.tastes.map((taste) => (
                    <li key={taste.category.id} className={styles.taste}>
                      <CategoryIcon name={taste.category.icon} size={16} strokeWidth={2} />
                      <span className={styles.tasteName}>{localized(taste.category.label)}</span>
                      <span className={styles.tasteCount}>
                        {t('profile.tasteCount', { count: taste.count })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <p className={styles.empty}>{t('profile.empty')}</p>
        )}

        <p className={styles.storage}>{t('profile.storage')}</p>

        <nav className={styles.links} aria-label={t('about.moreLabel')}>
          {LINKS.map((link) => (
            <a
              key={link.topic}
              className={styles.link}
              href={rutaDeInfo(link.topic, idioma, import.meta.env.BASE_URL)}
              onClick={alPulsarEnlace(() => onOpenInfo(link.topic))}
            >
              {t(link.label)}
            </a>
          ))}
        </nav>
      </div>
    </div>,
    document.body,
  )
}
