/**
 * Ficha del lugar. Solo muestra los campos que existen: nunca botones vacíos ni textos de relleno.
 */
import {
  ArrowUpRight,
  ChevronLeft,
  Globe,
  MapPin,
  Navigation,
  Phone,
  TriangleAlert,
  X,
} from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { BrandIcon, type BrandName } from '../../components/icons/BrandIcons.tsx'
import { CategoryIcon } from '../../components/icons/CategoryIcon.tsx'
import { DEFAULT_PLAZA_TONE, plazaTones } from '../../config/palette.ts'
import { useCatalog } from '../../data/CatalogContext.tsx'
import { locale, localized, t } from '../../i18n/index.ts'
import { assetUrl } from '../../lib/assets.ts'
import { registrar, salidaDe } from '../../lib/eventos.ts'
import { focusPanelHeading } from '../../lib/focus.ts'
import { placeDirections, telUrl, whatsappUrl } from '../../lib/maps-url.ts'
import type { LocalizedText, Place, Plaza } from '../../types/domain.ts'
import { FavoriteButton } from '../favorites/FavoriteButton.tsx'
import { SocialStats } from '../favorites/SocialStats.tsx'
import { RatingStars } from '../ratings/RatingStars.tsx'
import { VisitButton } from '../visits/VisitButton.tsx'
import { HoursTable } from './HoursTable.tsx'
import styles from './PlaceDetail.module.css'
import { PlacePicture } from './PlacePicture.tsx'
import { girosOf, girosSecundariosOf } from './placeIcon.ts'
import { ShareButton } from './ShareButton.tsx'

/**
 * El aviso de cierre temporal, antes del horario porque es lo único que hay que leer antes de salir
 * de casa.
 *
 * El horario no se esconde ni se tacha: sigue debajo tal cual. Tacharlo daría a entender que se
 * perdió el dato, y no se perdió; volverá a valer cuando reabra.
 */
function AvisoDeCierre({ cierre }: { cierre: NonNullable<Place['cierre']> }) {
  return (
    <section className={styles.cierre} aria-labelledby="closure-title">
      <TriangleAlert aria-hidden="true" />
      <div>
        <h3 id="closure-title" className={styles.cierreTitulo}>
          {t('closure.title')}
        </h3>
        <p>
          {t(`closure.${cierre.motivo}`)} {t('closure.since', { date: fechaLarga(cierre.desde) })}{' '}
          {t('closure.noReturn')}
        </p>
      </div>
    </section>
  )
}

/** "9 de octubre de 2026" en español, "9 October 2026" en inglés. Se parte a mano porque la fecha
 * es un día sin hora y `new Date('2026-10-09')` lo leería en UTC, que en Querétaro es el día 8. */
function fechaLarga(fecha: string): string {
  const [year, month, day] = fecha.split('-').map(Number)
  if (!year || !month || !day) return fecha
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, day),
  )
}

interface PlaceDetailProps {
  place: Place
  plaza: Plaza
  backLabel: string
  onBack: () => void
  onClose: () => void
}

interface ContactLink {
  key: string
  href: string
  label: string
  icon: ReactNode
  external: boolean
  /** Enlace de reparto: el logotipo es el botón, con la misma esquina que los demás. */
  tile?: boolean
}

/**
 * La descripción la escribe el propio negocio, en español. Cuando la guía está en otro idioma se
 * lee la traducción, marcada como generada y con el original a un clic: el texto es suyo, no
 * nuestro, y quien quiera leerlo tal cual escribió debe poder hacerlo. Sin traducción se muestra el
 * original sin leyenda, que es lo que pasa con las descripciones que ya venían en inglés.
 */
function Description({ text }: { text: LocalizedText }) {
  const traducida = localized(text)
  const esTraduccion = traducida !== text.es
  const [verOriginal, setVerOriginal] = useState(false)

  return (
    <div className={styles.descriptionBlock}>
      <p className={styles.description}>{verOriginal ? text.es : traducida}</p>
      {esTraduccion && (
        <p className={styles.translationNote}>
          {t('place.machineTranslation')}
          <button
            type="button"
            className={styles.translationToggle}
            aria-pressed={verOriginal}
            onClick={() => setVerOriginal((antes) => !antes)}
          >
            {t(verOriginal ? 'place.showTranslation' : 'place.showOriginal')}
          </button>
        </p>
      )}
    </div>
  )
}

export function PlaceDetail({ place, plaza, backLabel, onBack, onClose }: PlaceDetailProps) {
  const catalog = useCatalog()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const directions = placeDirections(place, plaza)
  /**
   * Los giros del local en una sola línea, en su orden y con el icono de cada uno: aquí hay sitio
   * para todos, principales y secundarios, así que esta es la única vista que los enseña completos.
   * El logo redondo, en cambio, lleva solo los principales.
   */
  const giros = girosOf(place, catalog)
  const secundarios = girosSecundariosOf(place, catalog)
  const todos = [...giros, ...secundarios]
  const giroLabels = todos.map((giro) => localized(giro.label))

  // biome-ignore lint/correctness/useExhaustiveDependencies: el foco se mueve al título cada vez que cambia el lugar mostrado.
  useEffect(() => {
    focusPanelHeading(headingRef.current)
  }, [place.id])

  const brand = (name: BrandName) => <BrandIcon name={name} />
  /**
   * Reparto: su icono de aplicación a todo color y sin la superficie de los demás enlaces, pero con
   * la misma esquina. Es como se reconocen de un vistazo; las redes siguen con su silueta en el
   * verde de la guía.
   */
  const appTile = (file: string) => (
    <img
      className={styles.tile}
      src={assetUrl(`brands/${file}.svg`)}
      alt=""
      width={40}
      height={40}
    />
  )
  const links: ContactLink[] = []
  const { phone } = place
  const { whatsapp, website, instagram, facebook, tiktok, rappi, uberEats, didiFood } = place.links
  if (phone) {
    links.push({
      key: 'phone',
      href: telUrl(phone),
      label: t('place.call'),
      icon: <Phone aria-hidden="true" />,
      external: false,
    })
  }
  if (whatsapp) {
    links.push({
      key: 'whatsapp',
      href: whatsappUrl(whatsapp),
      label: t('place.whatsapp'),
      icon: brand('whatsapp'),
      external: true,
    })
  }
  if (website) {
    links.push({
      key: 'website',
      href: website,
      label: t('place.website'),
      icon: <Globe aria-hidden="true" />,
      external: true,
    })
  }
  if (instagram) {
    links.push({
      key: 'instagram',
      href: instagram,
      label: t('place.instagram'),
      icon: brand('instagram'),
      external: true,
    })
  }
  if (facebook) {
    links.push({
      key: 'facebook',
      href: facebook,
      label: t('place.facebook'),
      icon: brand('facebook'),
      external: true,
    })
  }
  if (tiktok) {
    links.push({
      key: 'tiktok',
      href: tiktok,
      label: t('place.tiktok'),
      icon: brand('tiktok'),
      external: true,
    })
  }
  if (rappi) {
    links.push({
      key: 'rappi',
      href: rappi,
      label: t('place.rappi'),
      icon: appTile('rappi'),
      external: true,
      tile: true,
    })
  }
  if (uberEats) {
    links.push({
      key: 'uber-eats',
      href: uberEats,
      label: t('place.uberEats'),
      icon: appTile('uber-eats'),
      external: true,
      tile: true,
    })
  }
  if (didiFood) {
    links.push({
      key: 'didi-food',
      href: didiFood,
      label: t('place.didiFood'),
      icon: appTile('didi-food'),
      external: true,
      tile: true,
    })
  }

  const hasExtraInfo = Boolean(
    place.description || place.hours || links.length > 0 || place.photos.length > 0,
  )

  /*
   * El color de su plaza, el mismo con el que se ve en el mapa. Lo heredan el aro del logo y el
   * alfiler de la dirección, que es lo único de la ficha que habla de dónde está y no de qué hacer.
   */
  const tono =
    plazaTones(catalog.plazas.filter((item) => item.active).map((item) => item.id)).get(plaza.id) ??
    DEFAULT_PLAZA_TONE

  return (
    <article
      className={styles.detail}
      style={{ '--plaza-accent': tono.accent } as CSSProperties}
      aria-labelledby="place-detail-title"
    >
      <div className={styles.toolbar}>
        <button type="button" className={styles.back} onClick={onBack}>
          <ChevronLeft aria-hidden="true" />
          <span>{backLabel}</span>
        </button>
        <div className={styles.toolbarActions}>
          {/*
           * Compartir ya no vive aquí: se fue a la fila de salidas, junto a "Cómo llegar". Las dos
           * entregan el lugar a algo que no es esta guía, y separadas una arriba y otra abajo no se
           * leían como la misma clase de cosa. El favorito se queda: es de un toque y está también
           * en la tarjeta, así que su sitio es el mismo en los dos lados.
           */}
          <FavoriteButton placeId={place.id} placeName={place.name} />
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            aria-label={t('panel.close')}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      <header className={styles.header}>
        <div className={styles.identity}>
          {/* Logo del lugar (o su ilustración de categoría): redondo, como en las redes. */}
          <span className={styles.logo}>
            <PlacePicture
              photo={place.photos[0]}
              category={catalog.categoryOfGiro.get(place.giros[0] ?? '')}
              icons={giros.map((giro) => giro.icon)}
              sizes="88px"
              ratio="1 / 1"
              illustrationSize="sm"
              eager
            />
          </span>
          <div className={styles.identityText}>
            <h2 id="place-detail-title" ref={headingRef} tabIndex={-1} className={styles.title}>
              {place.name}
            </h2>
            {/*
             * Los giros van debajo del nombre, uno por renglón: son el detalle del lugar, no su
             * antetítulo. Un renglón por giro y no uno por nivel, porque repartirlos dos y uno
             * partía la lista por donde no hay junta. Los dos niveles se pintan igual: en la ficha
             * todos son lo que se vende ahí, y el orden ya dice cuál manda. Es un párrafo y no una
             * lista: la única lista de la ficha es la de contacto.
             */}
            <p className={styles.giros} title={giroLabels.join(' · ')}>
              {todos.map((giro) => (
                <span key={giro.id}>
                  <CategoryIcon name={giro.icon} size={14} />
                  {localized(giro.label)}
                </span>
              ))}
            </p>
          </div>
        </div>
        <SocialStats placeId={place.id} />
        <p className={styles.location}>
          <MapPin aria-hidden="true" />
          <span>
            {plaza.name}
            {plaza.address && <span className={styles.address}>{plaza.address}</span>}
          </span>
        </p>
      </header>

      {/*
       * Antes del botón de "Cómo llegar", no después. Es lo único que hay que leer antes de salir
       * de casa, y un aviso que aparece debajo del botón que te manda allí llega tarde.
       */}
      {place.cierre && <AvisoDeCierre cierre={place.cierre} />}

      {/*
       * Las dos salidas, juntas: las dos entregan el lugar a algo que no es esta guía. Comparten
       * alto y esquina porque hacen lo mismo; lo que las separa es el relleno, que dice cuál es la
       * principal. "Cómo llegar" lleva la flecha de enlace externo y "Compartir" no: la primera
       * abre una página y la segunda la hoja del sistema, y una flecha que promete una página
       * donde no la hay miente.
       */}
      {/*
       * `data-nosnippet`: texto de interfaz que Google no debe usar como fragmento. Sin esto, el
       * resultado de una ficha llegó a abrirse con "Cómo llegar Abre Google Maps en una pestaña
       * nueva" en lugar de con lo que dice el local. El atributo solo vale en `div`, `span` y
       * `section`, y no cambia nada de lo que se ve ni de lo que lee un lector de pantalla.
       */}
      <div className={styles.salidas} data-nosnippet="">
        <a
          className={styles.directions}
          href={directions.url}
          onClick={() => registrar('salida', place.id, 'maps')}
          target="_blank"
          rel="noopener noreferrer"
          aria-describedby="directions-hint"
          aria-label={
            directions.toPlace
              ? t('place.directionsToPlace', { name: place.name })
              : t('place.directionsToPlaza', { plaza: plaza.name })
          }
        >
          <Navigation aria-hidden="true" />
          {/*
           * Siempre "Cómo llegar", también cuando el destino es la zona porque el local no publicó
           * su punto. "Cómo llegar a la zona" no cabe en un renglón y partía el botón en dos, que
           * al lado de "Compartir" se lee como un error. Lo que se quita de la vista no se pierde:
           * el destino completo sigue en la etiqueta accesible, de donde nunca se fue.
           */}
          {t('place.directions')}
          <ArrowUpRight aria-hidden="true" className={styles.external} />
        </a>
        <span id="directions-hint" className="visually-hidden">
          {t('place.directionsHint')}
        </span>
        <ShareButton
          name={place.name}
          slug={place.slug}
          giros={giroLabels.join(' · ')}
          plazaName={plaza.name}
          conNombre
        />
      </div>

      {/*
       * Y lo que no sale de aquí. Calificar y registrar una visita solo cambian tu relación con el
       * lugar: ninguna de las dos se publica, ni siquiera como media.
       *
       * Las dos acciones se agrupan por proximidad y por su propia forma. El nombre accesible
       * sigue siendo "Solo para ti", pero no hace falta repetirlo a la vista.
       */}
      <section className={styles.personal} aria-label={t('place.onlyYou')} data-nosnippet="">
        <RatingStars placeId={place.id} placeName={place.name} />
        <VisitButton placeId={place.id} placeName={place.name} sinSuperficie />
      </section>

      {place.description && <Description text={place.description} />}

      <HoursTable hours={place.hours} cerrado={place.cierre !== undefined} />

      {links.length > 0 && (
        <section className={styles.contact} aria-label={t('place.contact')} data-nosnippet="">
          <ul className={styles.links}>
            {links.map((link) => (
              <li key={link.key}>
                {/* Solo el icono: así los enlaces caben en una fila y hay sitio para los que falten. */}
                <a
                  className={styles.link}
                  data-tile={link.tile === true}
                  href={link.href}
                  onClick={() => {
                    const salida = salidaDe(link.key)
                    if (salida) registrar('salida', place.id, salida)
                  }}
                  aria-label={link.label}
                  title={link.label}
                  {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {link.icon}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hasExtraInfo && <p className={styles.missing}>{t('place.missingInfo')}</p>}
    </article>
  )
}
