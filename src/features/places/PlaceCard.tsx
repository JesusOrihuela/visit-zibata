import { CategoryIcon } from '../../components/icons/CategoryIcon.tsx'
import { useCatalog } from '../../data/CatalogContext.tsx'
import { localized, t, useLocale } from '../../i18n/index.ts'
import { estadoDe } from '../../lib/estado.ts'
import { rutaDeLugar } from '../../lib/url-state.ts'
import type { Place } from '../../types/domain.ts'
import { FavoriteButton } from '../favorites/FavoriteButton.tsx'
import { useZonedNow } from './OpenStatus.tsx'
import styles from './PlaceCard.module.css'
import { PlacePicture } from './PlacePicture.tsx'
import { girosOf, girosSecundariosOf } from './placeIcon.ts'

/** Lo que lee un lector de pantalla en lugar del punto, que no lleva texto a la vista. */
const ETIQUETA = {
  open: 'filters.openNowLabel',
  closed: 'filters.closedNowLabel',
  unknown: 'filters.unknownHoursLabel',
  temporal: 'filters.temporarilyClosedLabel',
} as const

interface PlaceCardProps {
  place: Place
  onOpen: (place: Place) => void
  /** Muestra la plaza (útil en resultados de búsqueda que mezclan plazas). */
  showPlaza?: boolean
}

export function PlaceCard({ place, onOpen, showPlaza = false }: PlaceCardProps) {
  const catalog = useCatalog()
  const plaza = catalog.plazaById.get(place.plazaId)
  /*
   * El punto de estado, sobre la foto y abajo a la derecha, como el de "en línea" de cualquier
   * lista de contactos. Es un sitio que la gente ya sabe leer sin que nadie se lo explique, y cae
   * siempre igual, así que una columna de cien tarjetas se recorre de un vistazo.
   *
   * Un punto y no la palabra: la ficha ya dice "Abierto" con todas sus letras, y repetirla cien
   * veces en una lista la convierte en ruido.
   *
   * **Cuatro estados.** Verde abierto, gris cerrado, hueco los once sin horario publicado, y ámbar
   * cerrado temporalmente.
   *
   * El hueco no es un adorno: de esos la guía no sabe si están abiertos, y pintarlos grises sería
   * afirmar que están cerrados. Un punto hueco dice "no se sabe", que es la verdad.
   *
   * Gris y no rojo para cerrado. Rojo dice "algo va mal", y que una panadería esté cerrada a las
   * once de la noche no tiene nada de malo. El ámbar sí avisa de algo, porque ir hoy a un local en
   * obra es perder el viaje, y por eso es el único de los cuatro que se sale del gris y el verde.
   */
  const estado = estadoDe(place, useZonedNow())
  // En la lista, el icono es de los principales; los secundarios solo se leen.
  const giros = girosOf(place, catalog)
  const secundarios = girosSecundariosOf(place, catalog)
  const iconos = giros.map((giro) => giro.icon)
  const todos = [...giros, ...secundarios]
  /*
   * Aquí solo hay una línea: se nombran los giros que caben en ella, siempre al menos uno, y el
   * resto se cuenta ("Alitas · Hamburguesas +1"). El presupuesto va en letras y no en píxeles a
   * propósito, porque medir el ancho real obligaría a observar el tamaño de cada tarjeta al
   * pintar; veinticinco es lo que entra en la línea de un teléfono de 375 px aun con letras anchas.
   * Un tope fijo de dos nombres no bastaba: "Jugos y Smoothies · Alto en Proteína" son dos y no
   * caben. La ficha los enseña todos, y el title lleva la lista entera.
   */
  const ANCHO_LINEA = 25
  const nombres: string[] = []
  let largo = 0
  for (const giro of todos) {
    const nombre = localized(giro.label)
    const suma = nombres.length > 0 ? largo + 3 + nombre.length : nombre.length
    if (nombres.length > 0 && suma > ANCHO_LINEA) break
    nombres.push(nombre)
    largo = suma
  }
  const categoryLabel = nombres.join(' · ')
  const resto = todos.length - nombres.length
  const tituloCompleto = todos.map((giro) => localized(giro.label)).join(' · ')

  // El número de local y el horario solo los publica una minoría: en la lista crearían filas desiguales
  // (unas con dato, la mayoría sin él). Se muestran en la ficha, donde el dato se entiende con su fuente.
  const idioma = useLocale()
  const meta = showPlaza && plaza ? plaza.name : null

  return (
    <article className={styles.card}>
      {/*
       * Un enlace de verdad, no un botón. Abrir un lugar es navegar: la ruta existe, se comparte
       * y funciona sin JavaScript. Siendo botón, el navegador no podía ofrecer abrir en otra
       * pestaña, copiar la dirección ni enseñar el destino antes de pulsar, y un lector anunciaba
       * "botón" donde toca "enlace".
       *
       * El `onClick` sigue ahí para que dentro de la aplicación no se recargue la página, y por
       * eso pregunta por las teclas: con Ctrl, Cmd, Mayúsculas o el botón central, el gesto es
       * "ábrelo aparte" y hay que dejar que el navegador lo haga.
       */}
      <a
        className={styles.main}
        href={rutaDeLugar(place.slug, idioma, import.meta.env.BASE_URL)}
        onClick={(event) => {
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          )
            return
          event.preventDefault()
          onOpen(place)
        }}
        aria-label={t('place.openDetail', { name: place.name })}
      >
        <span className={styles.foto}>
          <span className={styles.thumb}>
            <PlacePicture
              photo={place.photos[0]}
              category={catalog.categoryOfGiro.get(place.giros[0] ?? '')}
              icons={iconos}
              sizes="64px"
              ratio="1 / 1"
              illustrationSize="sm"
            />
          </span>
          <span className={styles.punto} data-estado={estado}>
            <span className="visually-hidden" data-nosnippet="">
              {t(ETIQUETA[estado], { name: place.name })}
            </span>
          </span>
        </span>
        <span className={styles.body}>
          <span className={styles.name}>{place.name}</span>
          <span className={styles.category} title={tituloCompleto}>
            {giros.map((giro) => (
              <CategoryIcon key={giro.id} name={giro.icon} size={14} strokeWidth={2} />
            ))}
            <span className={styles.categoryText}>{categoryLabel}</span>
            {resto > 0 && <span className={styles.mas}>+{resto}</span>}
            {meta && <span className={styles.meta}> · {meta}</span>}
          </span>
        </span>
      </a>
      <FavoriteButton placeId={place.id} placeName={place.name} size="sm" />
    </article>
  )
}
