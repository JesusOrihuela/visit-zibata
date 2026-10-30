import { MapPin } from 'lucide-react'
import { type CSSProperties, useRef } from 'react'
import { CategoryIcon } from '../../components/icons/CategoryIcon.tsx'
import { DEFAULT_PLAZA_TONE, plazaTones, plazaVars } from '../../config/palette.ts'
import { useCatalog } from '../../data/CatalogContext.tsx'
import { useElementWidth } from '../../hooks/useElementWidth.ts'
import { localized, t, useLocale } from '../../i18n/index.ts'
import { estadoDe } from '../../lib/estado.ts'
import { rutaDeLugar } from '../../lib/url-state.ts'
import type { Place } from '../../types/domain.ts'
import { FavoriteButton } from '../favorites/FavoriteButton.tsx'
import { caracteresQueCaben } from './lineaDeGiros.ts'
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
  // Ancho real de la fila de giros: es lo que decide cuántas etiquetas caben. Cero hasta medir.
  const filaRef = useRef<HTMLSpanElement>(null)
  const anchoFila = useElementWidth(filaRef, 0)
  // En la lista, el icono es de los principales; los secundarios solo se leen.
  const giros = girosOf(place, catalog)
  const secundarios = girosSecundariosOf(place, catalog)
  const iconos = giros.map((giro) => giro.icon)
  const todos = [...giros, ...secundarios]
  /*
   * Aquí solo hay una línea: se nombran los giros que caben en ella, siempre al menos uno, y el
   * resto se cuenta ("Alitas · Hamburguesas +1"). Cuántos caben sale del ancho real de la fila, así
   * que en una hoja ancha se leen todas las etiquetas y en un teléfono se recortan con su cuenta.
   * Antes era un presupuesto fijo de 25 letras y por eso sobraba espacio y seguía saliendo "+1".
   */
  const etiquetas = todos.map((giro) => localized(giro.label))
  const largoTotal = etiquetas.reduce(
    (total, etiqueta, indice) => total + (indice > 0 ? 3 : 0) + etiqueta.length,
    0,
  )
  const presupuesto = (conContador: boolean) =>
    anchoFila === 0 ? 25 : caracteresQueCaben(anchoFila, iconos.length, conContador)
  // Si todo cabe sin contar nada se nombra todo; si no, se recorta y se reserva el sitio del "+N".
  const ANCHO_LINEA = largoTotal <= presupuesto(false) ? largoTotal : presupuesto(true)
  const nombres: string[] = []
  let largo = 0
  for (const nombre of etiquetas) {
    const suma = nombres.length > 0 ? largo + 3 + nombre.length : nombre.length
    if (nombres.length > 0 && suma > ANCHO_LINEA) break
    nombres.push(nombre)
    largo = suma
  }
  const categoryLabel = nombres.join(' · ')
  const resto = etiquetas.length - nombres.length
  const tituloCompleto = etiquetas.join(' · ')

  // El número de local y el horario solo los publica una minoría: en la lista crearían filas desiguales
  // (unas con dato, la mayoría sin él). Se muestran en la ficha, donde el dato se entiende con su fuente.
  const idioma = useLocale()
  // El tono de la zona, repartido igual que en el mapa (ver config/palette.ts). Solo se calcula cuando
  // la fila va a llevar zona: en el panel de una plaza sobra.
  const tone =
    showPlaza && plaza
      ? (plazaTones(catalog.plazas.filter((item) => item.active).map((item) => item.id)).get(
          plaza.id,
        ) ?? DEFAULT_PLAZA_TONE)
      : DEFAULT_PLAZA_TONE

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
          <span ref={filaRef} className={styles.category} title={tituloCompleto}>
            {giros.map((giro) => (
              <CategoryIcon key={giro.id} name={giro.icon} size={14} strokeWidth={2} />
            ))}
            <span className={styles.categoryText}>{categoryLabel}</span>
            {resto > 0 && <span className={styles.mas}>+{resto}</span>}
          </span>
          {/*
           * La zona, en su propia fila. Antes iba al final de la de giros ("Tacos · Plaza Luna") y se
           * leía como una etiqueta más: parecía que la plaza era algo que se come. Aquí separa los dos
           * datos y sigue contestando lo único que falta cuando la lista mezcla zonas: si queda lejos.
           *
           * En el color de la zona, el mismo con el que se ve en el mapa, para que la lista y el mapa
           * se lean como el mismo sitio y no como dos inventarios distintos.
           */}
          {showPlaza && plaza && (
            <span className={styles.area} style={plazaVars(tone) as CSSProperties}>
              <MapPin aria-hidden="true" />
              {plaza.name}
            </span>
          )}
        </span>
      </a>
      <FavoriteButton placeId={place.id} placeName={place.name} size="sm" />
    </article>
  )
}
