/**
 * Marcadores HTML de plazas: botones accesibles (teclado y lector de pantalla) anclados al mapa.
 * Muestran nombre y número de lugares. Nunca se superponen: los de menor prioridad prueban a desplazar
 * la etiqueta a un lado o a elevarla con un tallo más largo, o se reducen a la cifra. Solo si aun así
 * no caben se ocultan hasta que el usuario se acerca.
 * Prioridad: plaza seleccionada y luego más lugares.
 */
import { type Map as MapLibreMap, Marker } from 'maplibre-gl'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_PLAZA_TONE, plazaTones } from '../../config/palette.ts'
import { t } from '../../i18n/index.ts'
import type { Plaza } from '../../types/domain.ts'
import styles from './PlazaMarkers.module.css'

interface PlazaMarkersProps {
  map: MapLibreMap
  plazas: readonly Plaza[]
  placeCounts: ReadonlyMap<string, number>
  matchCounts: ReadonlyMap<string, number> | null
  selectedPlazaId: string | null
  hoveredPlazaId: string | null
  onHover: (plazaId: string | null) => void
  onSelect: (plazaId: string) => void
}

type Mode = 'full' | 'left' | 'compact' | 'dot' | 'hidden'
/** Niveles de elevación de la etiqueta (0 = junto al punto; cada nivel alarga el tallo). */
type Lift = 0 | 1 | 2
interface Placement {
  mode: Mode
  lift: Lift
  /** La etiqueta cuelga por debajo del punto en vez de apoyarse encima. */
  abajo?: boolean
}
interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

/** Por debajo de este zoom todas las plazas muestran solo la cifra. */
const COMPACT_BELOW_ZOOM = 14.3
const MARKER_HEIGHT = 44
/**
 * El ancho de la gota, que es la pieza anclada: no cambia en ningún modo, y por eso sirve a la vez
 * de ancho del marcador plegado y de corrección para dejarla centrada sobre el tallo.
 */
const PIN_WIDTH = 30
const COMPACT_WIDTH = PIN_WIDTH
const GAP = 4
/** Lo que sube la etiqueta por nivel de elevación (debe coincidir con PlazaMarkers.module.css). */
const LIFT_STEP = MARKER_HEIGHT + GAP

/**
 * Las dos bandas de apilamiento del mapa: todas las líneas por debajo de todas las gotas.
 *
 * Dentro de cada banda se ordena por cercanía (la coordenada Y en pantalla, que no pasa de unos
 * pocos miles) más los empujes de selección. La distancia entre bandas deja sitio de sobra para
 * esa suma sin que una banda alcance a la otra. `ComingSoonMarkers` usa las mismas.
 */
export const CAPA_TALLOS = 0
export const CAPA_ETIQUETAS = 20_000
const EDGE_RESERVED_RIGHT = 64

/** Cuánto se pisan dos sitios, en píxeles cuadrados. Cero si no se tocan. */
const solape = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right + GAP &&
  a.right > b.left - GAP &&
  a.top < b.bottom + GAP &&
  a.bottom > b.top - GAP

export function PlazaMarkers({
  map,
  plazas,
  placeCounts,
  matchCounts,
  selectedPlazaId,
  hoveredPlazaId,
  onHover,
  onSelect,
}: PlazaMarkersProps) {
  const activePlazas = useMemo(() => plazas.filter((plaza) => plaza.active), [plazas])
  // Mismo reparto de tonos que el estilo del mapa (buildMapStyle): la etiqueta y su plaza combinan.
  const tones = useMemo(() => plazaTones(activePlazas.map((plaza) => plaza.id)), [activePlazas])
  const [elements, setElements] = useState<Map<string, HTMLElement>>(new Map())
  const [stemElements, setStemElements] = useState<Map<string, HTMLElement>>(new Map())
  const [modes, setModes] = useState<ReadonlyMap<string, Placement>>(new Map())
  const [focusedPlazaId, setFocusedPlazaId] = useState<string | null>(null)
  /** La plaza bajo el cursor, para el orden de capas, sin rehacer la colocación al pasar por encima. */
  const hoveredIdRef = useRef(hoveredPlazaId)
  hoveredIdRef.current = hoveredPlazaId
  const fullWidths = useRef(new Map<string, number>())
  /**
   * Cuántos anchos reales de etiqueta se han aprendido. La pasada extra tras cambiar de modo solo tiene
   * sentido mientras aparezcan anchos nuevos; sin este contador, dos plazas podían turnarse la etiqueta
   * (una cabe con el ancho estimado pero no con el real, la otra al revés) y el mapa se quedaba
   * recolocando marcadores en bucle, que es lo que se veía como animación trabada.
   */
  const widthsVersion = useRef(0)
  const relayout = useRef(() => {})

  /*
   * Dos marcadores por plaza, en el mismo punto: uno lleva el tallo y otro la etiqueta.
   *
   * Es lo que hace cumplir la regla de que la gota manda sobre la línea. MapLibre coloca cada
   * marcador con un `transform`, que crea contexto de apilamiento, así que el tallo y la etiqueta
   * que viven en el mismo marcador no se pueden ordenar por separado: el tallo de una plaza
   * cercana se pintaba encima de la gota de una lejana, y una línea tapando el objeto que señala
   * es exactamente al revés de lo que tiene que pasar.
   *
   * Separados, cada uno cae en su banda (CAPA_TALLOS y CAPA_ETIQUETAS) y dentro de su banda
   * siguen ordenándose por cercanía. El tallo que queda dentro del marcador de la etiqueta no
   * desaparece: se queda de separador, porque es su alto lo que sube la etiqueta sobre el punto,
   * y así el alto no se calcula en dos sitios que luego hay que mantener a la par.
   */
  useEffect(() => {
    const created = new Map<string, HTMLElement>()
    const createdStems = new Map<string, HTMLElement>()
    const markers = activePlazas.flatMap((plaza) => {
      const element = document.createElement('div')
      element.className = styles.anchor ?? ''
      created.set(plaza.id, element)
      const stem = document.createElement('div')
      stem.className = styles.anchor ?? ''
      createdStems.set(plaza.id, stem)
      const punto: [number, number] = [plaza.coordinates.lng, plaza.coordinates.lat]
      // El del tallo primero: con la misma z gana el último, y aquí el último tiene que ser la gota.
      return [
        new Marker({ element: stem, anchor: 'bottom', subpixelPositioning: true })
          .setLngLat(punto)
          .addTo(map),
        new Marker({ element, anchor: 'bottom', subpixelPositioning: true })
          .setLngLat(punto)
          .addTo(map),
      ]
    })
    setElements(created)
    setStemElements(createdStems)
    return () => {
      for (const marker of markers) marker.remove()
    }
  }, [map, activePlazas])

  // La colocación se recalcula al mover el mapa y también cuando cambian selección o conteos (búsqueda y
  // filtros cambian el ancho de las etiquetas y la prioridad).
  useEffect(() => {
    const count = (id: string) => matchCounts?.get(id) ?? placeCounts.get(id) ?? 0
    const priority = [...activePlazas]
      .sort((a, b) => {
        if (a.id === selectedPlazaId) return -1
        if (b.id === selectedPlazaId) return 1
        return count(b.id) - count(a.id)
      })
      .map((plaza) => plaza.id)
    let frame = 0
    const layout = () => {
      frame = 0
      const allCompact = map.getZoom() < COMPACT_BELOW_ZOOM
      const container = map.getContainer().getBoundingClientRect()
      // Margen derecho reservado a los controles del mapa; superior e inferior, a la barra de búsqueda y
      // filtros y a la hoja (el padding del mapa): una etiqueta tapada no se puede pulsar ni leer. Con el
      // zoom mínimo (móvil en horizontal) no todas las plazas caben entre ambas.
      const { top = 0, bottom = 0 } = map.getPadding()
      const topBar = container.top + top
      const bottomBar = container.bottom - bottom
      const insideView = (rect: Rect) =>
        rect.left >= container.left + 8 &&
        rect.right <= container.right - EDGE_RESERVED_RIGHT &&
        rect.top >= topBar &&
        rect.bottom <= bottomBar
      const placed = new Map<string, Rect>()
      /** Plazas reducidas a un punto: un punto puede rozar una etiqueta, pero no a otro punto. */
      const dots = new Set<string>()
      // Puntos colocados sin hueco limpio: van por delante para poder pulsarse.
      const forzados = new Set<string>()
      const next = new Map<string, Placement>()
      const collides = (rect: Rect, onlyDots = false) =>
        [...placed].some(([id, other]) => (!onlyDots || dots.has(id)) && overlaps(rect, other))
      /*
       * Un sitio está libre si cabe en la vista y no pisa a nadie. También el punto, que antes solo
       * se comparaba contra otros puntos.
       *
       * Esa excepción tenía un costo que se vio al crecer la barra de filtros: un punto podía quedar
       * bajo la insignia de la vecina y entonces no se podía pulsar, aunque se viera. Pero quitarla a
       * secas rompe algo más importante, que `map.spec.ts` fija: **todas las plazas activas tienen
       * que estar representadas en la vista inicial**.
       *
       * Así que se cumplen las dos: el punto prefiere un sitio limpio y, si no hay ninguno, se coloca
       * igual (`forzados`) y se dibuja por encima. Antes de eso, eso sí, la etiqueta que estorba cede
       * su nombre: ver `cedeElNombre` más abajo.
       */
      const free =
        (_kind: 'named' | 'compact' | 'dot') =>
        ([, rect]: [Placement, Rect]) =>
          insideView(rect) && !collides(rect)

      // Posibles colocaciones de cada marcador, según su punto en pantalla y el ancho de su etiqueta.
      const options = new Map<
        string,
        (kind: 'named' | 'compact' | 'dot', lift: Lift) => [Placement, Rect][]
      >()
      const anchors = new Map<string, { x: number; y: number }>()
      for (const id of priority) {
        const element = elements.get(id)
        const button = element?.firstElementChild as HTMLElement | null | undefined
        if (!element || !button) continue
        // El contenedor (botón + tallo) está anclado por su base al punto de la plaza.
        const box = element.getBoundingClientRect()
        const label = button.firstElementChild as HTMLElement | null
        const currentMode = button.dataset.mode
        if (
          label &&
          currentMode !== 'compact' &&
          currentMode !== 'dot' &&
          currentMode !== 'hidden'
        ) {
          const width = label.offsetWidth
          if (fullWidths.current.get(id) !== width) {
            fullWidths.current.set(id, width)
            widthsVersion.current += 1
          }
        }
        const anchorX = box.left + box.width / 2
        /*
         * MapLibre ancla el contenedor por su base, así que el punto de la plaza es su borde
         * inferior. Salvo cuando cuelga hacia abajo: ahí el contenedor se baja su propio alto, y
         * entonces el punto es su borde superior.
         *
         * Sin esta línea la siguiente pasada del solucionador lee el contenedor ya desplazado, se
         * cree que la plaza está un marcador más abajo de donde está, y a partir de ahí coloca todo
         * mal. Se vio como un clic que abría la plaza equivocada.
         */
        const anchorY = element.dataset.abajo === 'true' ? box.top : box.bottom
        anchors.set(id, { x: anchorX, y: anchorY })
        const name = activePlazas.find((plaza) => plaza.id === id)?.name ?? ''
        const width = fullWidths.current.get(id) ?? name.length * 7.6 + 58
        const rect = (left: number, right: number, lift: Lift): Rect => ({
          left,
          right,
          top: anchorY - MARKER_HEIGHT - lift * LIFT_STEP,
          bottom: anchorY - lift * LIFT_STEP,
        })
        const abajoRect = (left: number, right: number, lift: Lift): Rect => ({
          left,
          right,
          top: anchorY + lift * LIFT_STEP,
          bottom: anchorY + MARKER_HEIGHT + lift * LIFT_STEP,
        })
        /*
         * Hacia qué lado conviene sacar la cinta.
         *
         * Con la gota anclada, una etiqueta ya no se reparte a los dos lados del punto: ocupa entero
         * uno de ellos. Y el solucionador es glotón, así que el primero que pide sitio se queda con
         * él: si todos piden hacia la derecha, el de más a la izquierda tapa a sus cuatro vecinos y
         * ellos acaban de punto, aunque del otro lado hubiera sitio de sobra para todos.
         *
         * Por eso cada marcador prueba primero el lado donde tiene menos vecinos cerca, contando solo
         * los que están al alcance de su cinta y a una altura parecida. No garantiza el reparto
         * óptimo (eso ya no es un problema de colocar etiquetas, es de empaquetado), pero quita el
         * caso que se daba siempre: una fila de plazas vecinas estorbándose todas en la misma
         * dirección.
         */
        const ordenarPorHueco = (
          propio: string,
          x: number,
          y: number,
          opciones: [Placement, Rect][],
        ): [Placement, Rect][] => {
          let haciaLaDerecha = 0
          for (const [otro, punto] of anchors) {
            if (otro === propio) continue
            if (Math.abs(punto.y - y) > LIFT_STEP) continue
            if (Math.abs(punto.x - x) > width) continue
            haciaLaDerecha += punto.x > x ? 1 : -1
          }
          return haciaLaDerecha > 0 ? [...opciones].reverse() : opciones
        }

        options.set(id, (kind, lift) =>
          kind === 'dot'
            ? [
                /*
                 * El punto ocupa exactamente lo mismo que la gota plegada, porque es la gota plegada.
                 *
                 * Antes era un círculo de 12 px centrado sobre el punto de la plaza, y por eso tenía
                 * su propia caja, más pequeña y corrida hacia abajo. Con la gota eso dejó de ser
                 * cierto: una gota girada 45 grados pinta 41 px de alto, su caja medía 34 y además
                 * bajaba 17, así que el solucionador la creía 14 px más arriba de donde estaba y dos
                 * marcadores podían solaparse sin que él lo supiera. El de encima se quedaba con las
                 * pulsaciones del de debajo.
                 *
                 * Lo que distingue al punto ya no es su forma ni su sitio: es que puede colocarse sin
                 * hueco limpio cuando no queda otra.
                 */
                [
                  { mode: 'dot', lift },
                  rect(anchorX - PIN_WIDTH / 2, anchorX + PIN_WIDTH / 2, lift),
                ],
              ]
            : kind === 'compact'
              ? [
                  [
                    { mode: 'compact', lift },
                    rect(anchorX - COMPACT_WIDTH / 2, anchorX + COMPACT_WIDTH / 2, lift),
                  ],
                ]
              : [
                  ...ordenarPorHueco(id, anchorX, anchorY, [
                    // La gota se queda sobre el punto en los dos: lo que cambia es hacia dónde sale la cinta.
                    [
                      { mode: 'full', lift },
                      rect(anchorX - PIN_WIDTH / 2, anchorX - PIN_WIDTH / 2 + width, lift),
                    ],
                    [
                      { mode: 'left', lift },
                      rect(anchorX + PIN_WIDTH / 2 - width, anchorX + PIN_WIDTH / 2, lift),
                    ],
                  ]),
                  /*
                   * Y si arriba no cabe, la etiqueta cuelga por debajo del punto.
                   *
                   * Con la gota anclada la etiqueta ocupa entero uno de los dos lados, así que donde
                   * hay plazas vecinas se quitan sitio unas a otras y acaban sin nombre. Colgar
                   * hacia abajo abre una banda que antes no se usaba, y el tallo sigue diciendo a
                   * qué punto pertenece: lo único que cambia es de qué lado del punto nace.
                   *
                   * Va después de las dos de arriba a propósito: una etiqueta encima del punto es la
                   * convención de cualquier mapa, y esto es el plan B.
                   */
                  ...ordenarPorHueco(id, anchorX, anchorY, [
                    [
                      { mode: 'full', lift, abajo: true },
                      abajoRect(anchorX - PIN_WIDTH / 2, anchorX - PIN_WIDTH / 2 + width, lift),
                    ],
                    [
                      { mode: 'left', lift, abajo: true },
                      abajoRect(anchorX + PIN_WIDTH / 2 - width, anchorX + PIN_WIDTH / 2, lift),
                    ],
                  ]),
                ],
        )
      }

      // Pasadas de mayor a menor calidad: que todas las plazas se vean pesa más que mostrar el nombre,
      // y ambas cosas más que mantener la etiqueta junto al punto. La última deja un punto pulsable:
      // ninguna plaza desaparece del mapa por falta de sitio.
      const passes: ['named' | 'compact' | 'dot', Lift[]][] = [
        ['named', [0]],
        ['compact', [0]],
        ['named', [1]],
        ['compact', [1, 2]],
        ['dot', [0, 1, 2]],
      ]
      for (const [kind, lifts] of passes) {
        for (const id of priority) {
          const optionsFor = options.get(id)
          if (!optionsFor || next.has(id)) continue
          const selected = id === selectedPlazaId
          // La plaza seleccionada siempre lleva su nombre; las demás, solo con zoom suficiente.
          if (kind === 'named' ? allCompact && !selected : selected) continue
          // Un punto tapado por la hoja no se señala con una etiqueta elevada: se agrupa con una visible.
          const covered = (anchors.get(id)?.y ?? 0) > bottomBar
          const fitting = covered
            ? undefined
            : lifts.flatMap((lift) => optionsFor(kind, lift)).find(free(kind))
          if (fitting) {
            next.set(id, fitting[0])
            placed.set(id, fitting[1])
            if (kind === 'dot') dots.add(id)
          } else if (kind === 'dot' && !covered) {
            /*
             * Última pasada y sin hueco limpio. Antes de meter el punto encima de lo que haya, las
             * etiquetas que estorban ceden su nombre y se quedan en gota sola.
             *
             * Esto no es una preferencia estética, es la prioridad que ya estaba escrita arriba: que
             * todas las plazas se vean pesa más que mostrar el nombre. Y desde que la cinta sale
             * entera hacia un lado, un punto colocado encima ya no roza una esquina de la etiqueta:
             * puede caerle en mitad del cuerpo y robarle las pulsaciones, así que ahí no se ven las
             * dos, se ve una. Cediendo el nombre se ven las dos y las dos se pueden pulsar.
             */
            const estorbo = optionsFor('dot', 0)[0] as [Placement, Rect]
            for (const [otro, suRect] of [...placed]) {
              const suyo = next.get(otro)
              if (!suyo || (suyo.mode !== 'full' && suyo.mode !== 'left')) continue
              if (!overlaps(estorbo[1], suRect)) continue
              const encogido = options.get(otro)?.('compact', suyo.lift)[0]
              if (!encogido) continue
              next.set(otro, encogido[0])
              placed.set(otro, encogido[1])
            }
            // Con el sitio liberado casi siempre hay hueco limpio; si no, entra igual y por delante.
            const limpio = optionsFor('dot', 0).find(free('dot'))
            /*
             * Y si ni así: el nivel que menos pise, no siempre el de abajo.
             *
             * Forzar todas las gotas al nivel 0 las amontonaba unas sobre otras en el único rincón
             * donde esto pasa, y entonces la de encima se queda con las pulsaciones de las de debajo.
             * Repartiéndolas por niveles el montón se deshace: cada una sube hasta donde estorba
             * menos, y el tallo sigue diciendo a qué punto pertenece.
             */
            const apilado = ([0, 1, 2] as Lift[])
              .map((nivel) => optionsFor('dot', nivel)[0] as [Placement, Rect])
              .filter(([, caja]) => insideView(caja))
              .map(
                (opcion) =>
                  [
                    opcion,
                    [...placed].reduce((suma, [, otra]) => suma + solape(opcion[1], otra), 0),
                  ] as const,
              )
              .sort((a, b) => a[1] - b[1])[0]?.[0]
            const [placement, rect] = limpio ?? apilado ?? estorbo
            next.set(id, placement)
            placed.set(id, rect)
            dots.add(id)
            if (!limpio) forzados.add(id)
          } else if (selected) {
            // Va primera: solo no cabe fuera de la vista; se coloca igualmente.
            const [placement, rect] = optionsFor('named', 0)[0] as [Placement, Rect]
            next.set(id, placement)
            placed.set(id, rect)
          }
        }
      }

      // Sin superponer botones (cada uno conserva su área táctil): lo que no cabe se oculta y se agrupa.
      for (const id of priority) {
        if (options.has(id) && !next.has(id)) next.set(id, { mode: 'hidden', lift: 0 })
      }

      // Quien está más abajo en pantalla está más cerca del observador: va por encima. Sin esto el tallo
      // de una plaza lejana podía cruzar por encima de la etiqueta de una plaza que tiene delante.
      // La cercanía ordena dentro de cada banda; entre bandas manda siempre la gota sobre la línea.
      for (const [id, anchor] of anchors) {
        const element = elements.get(id)
        if (!element) continue
        const front = id === selectedPlazaId || id === hoveredIdRef.current
        const abajo = next.get(id)?.abajo === true
        const cercania = Math.round(anchor.y)
        if (abajo) element.dataset.abajo = 'true'
        else delete element.dataset.abajo
        element.style.zIndex = String(
          CAPA_ETIQUETAS + cercania + (forzados.has(id) ? 5_000 : 0) + (front ? 10_000 : 0),
        )
        const stem = stemElements.get(id)
        if (!stem) continue
        if (abajo) stem.dataset.abajo = 'true'
        else delete stem.dataset.abajo
        stem.style.zIndex = String(CAPA_TALLOS + cercania)
      }

      setModes((previous) =>
        previous.size === next.size &&
        [...next].every(([id, placement]) => {
          const before = previous.get(id)
          return before?.mode === placement.mode && before.lift === placement.lift
        })
          ? previous
          : next,
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout)
    }
    schedule()
    relayout.current = schedule
    map.on('move', schedule)
    map.on('resize', schedule)
    return () => {
      relayout.current = () => {}
      map.off('move', schedule)
      map.off('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [map, elements, stemElements, selectedPlazaId, activePlazas, matchCounts, placeCounts])

  // Tras un render que cambia modos, las etiquetas con nombre ya se pueden medir: otra pasada sustituye los
  // anchos estimados por los reales. Solo se repite mientras se aprendan anchos nuevos; en cuanto la pasada
  // no descubre ninguno, se para (si no, dos plazas pueden turnarse la etiqueta indefinidamente).
  const relayoutedAt = useRef(-1)
  // biome-ignore lint/correctness/useExhaustiveDependencies: se reacciona a cada cambio de modos.
  useEffect(() => {
    if (relayoutedAt.current === widthsVersion.current) return
    relayoutedAt.current = widthsVersion.current
    relayout.current()
  }, [modes])

  return (
    <>
      {activePlazas.map((plaza) => {
        const element = elements.get(plaza.id)
        if (!element) return null
        const total = placeCounts.get(plaza.id) ?? 0
        const count = matchCounts?.get(plaza.id) ?? (matchCounts ? 0 : total)
        const dimmed = matchCounts !== null && count === 0
        const selected = plaza.id === selectedPlazaId
        const state = selected
          ? 'selected'
          : plaza.id === hoveredPlazaId
            ? 'hover'
            : dimmed
              ? 'dimmed'
              : 'idle'
        const placement = modes.get(plaza.id)
        const layoutMode = placement?.mode
        // El marcador con foco de teclado nunca se oculta: lo perdería (p. ej. al devolverlo tras cerrar el
        // panel mientras la cámara se mueve) y el lector de pantalla quedaría sin contexto.
        const mode: Mode =
          selected && (layoutMode === 'compact' || layoutMode === 'hidden' || !layoutMode)
            ? 'full'
            : layoutMode === 'hidden' && plaza.id === focusedPlazaId
              ? 'dot'
              : (layoutMode ?? 'compact')
        const lift = mode === 'hidden' ? 0 : (placement?.lift ?? 0)
        const tone = tones.get(plaza.id) ?? DEFAULT_PLAZA_TONE
        const toneStyle = {
          '--plaza-accent': tone.accent,
          '--plaza-soft': tone.soft,
        } as CSSProperties
        const etiqueta = createPortal(
          <>
            <button
              type="button"
              className={styles.marker}
              style={toneStyle}
              data-state={state}
              data-mode={mode}
              data-lift={lift}
              tabIndex={mode === 'hidden' ? -1 : 0}
              aria-hidden={mode === 'hidden' ? true : undefined}
              aria-pressed={selected}
              aria-label={t('plaza.select', {
                name: plaza.name,
                places: t('places.count', { count }),
              })}
              onMouseEnter={() => onHover(plaza.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => {
                setFocusedPlazaId(plaza.id)
                onHover(plaza.id)
              }}
              onBlur={() => {
                setFocusedPlazaId(null)
                onHover(null)
              }}
              onClick={() => onSelect(plaza.id)}
            >
              <span className={styles.label}>
                <span className={styles.gota}>
                  <span className={styles.count}>{count}</span>
                </span>
                <span className={styles.name}>{plaza.name}</span>
              </span>
            </button>
            {/*
             * El tallo va fuera del botón: el área pulsable es solo la etiqueta.
             *
             * Este de aquí no se pinta, solo ocupa: es su alto el que sube la etiqueta sobre el
             * punto. El que se ve vive en el marcador de al lado, en la capa de los tallos, y
             * comparte clase y `data-lift` con este para que los dos midan igual siempre.
             */}
            <span
              className={styles.stem}
              data-lift={lift}
              data-fantasma="true"
              aria-hidden="true"
            />
          </>,
          element,
          plaza.id,
        )
        const tallo = stemElements.get(plaza.id)
        return tallo
          ? [
              etiqueta,
              createPortal(
                <span
                  className={styles.stem}
                  style={toneStyle}
                  data-state={state}
                  data-lift={lift}
                  data-mode={mode}
                  aria-hidden="true"
                />,
                tallo,
                `${plaza.id}-tallo`,
              ),
            ]
          : etiqueta
      })}
    </>
  )
}
