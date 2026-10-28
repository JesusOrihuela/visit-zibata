/**
 * MapView: el mapa es el producto. Crea MapLibre una sola vez, carga el estilo propio (teselas +
 * GeoJSON locales) y traduce el estado de la app (plaza seleccionada, filtros) a feature-state,
 * marcadores y cámara. No conoce la UI de paneles: recibe el espacio que ocupan como `padding`.
 */
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  AttributionControl,
  GPUInitializationError,
  type MapLayerMouseEvent,
  Map as MapLibreMap,
  type PaddingOptions,
} from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { MAP_ASSETS, MAP_LIMITS, MAP_LOCALE, ZIBATA_EXTENT } from '../../config/map.ts'
import { t } from '../../i18n/index.ts'
import { absoluteAssetUrl } from '../../lib/assets.ts'
import { registrar } from '../../lib/eventos.ts'
import type { Plaza } from '../../types/domain.ts'
import { createCameraConstraint } from './bounds.ts'
import { ComingSoonMarkers } from './ComingSoonMarkers.tsx'
import { focusPlaza, initialCamera, resetCamera, updatePadding } from './camera.ts'
import { MapControls } from './MapControls.tsx'
import { MapErrorMessage } from './MapErrorMessage.tsx'
import styles from './MapView.module.css'
import { ensureMapRuntime } from './mapRuntime.ts'
import { PlazaMarkers } from './PlazaMarkers.tsx'
import { opcionesRealismo } from './realismo/modo.ts'
import { buildMapStyle } from './style/buildMapStyle.ts'
import { INTERACTIVE_PLAZA_LAYERS, SOURCE } from './style/ids.ts'
import type { MapStatus } from './types.ts'

export type { MapStatus }

export interface MapViewProps {
  plazas: readonly Plaza[]
  /** Nº de lugares activos por plaza. */
  placeCounts: ReadonlyMap<string, number>
  /** Nº de lugares que cumplen búsqueda/filtros por plaza; `null` si no hay filtros. */
  matchCounts: ReadonlyMap<string, number> | null
  selectedPlazaId: string | null
  onSelectPlaza: (plazaId: string) => void
  /** Espacio ocupado por paneles (px), para centrar la cámara en el área visible. */
  padding: PaddingOptions
  compact: boolean
  /** Dibuja el suelo, el relieve y el contexto de realismo (ver features/map/realismo). */
  realismo?: boolean
  /** Medición en el dispositivo (?medir): recorre tres vistas y deja las cifras en pantalla. */
  medir?: 'si' | 'corto'
  onStatusChange?: (status: MapStatus) => void
  onMapInstance?: (map: MapLibreMap | null) => void
}

const FEATURE_SOURCES = [SOURCE.plazaSites, SOURCE.plazaBuildings] as const
/** Sin evento `load` en este tiempo (p. ej. el worker del mapa no descargó) se informa en vez de esperar sin fin. */
const MAP_LOAD_TIMEOUT_MS = 45_000

function setPlazaState(map: MapLibreMap, plazaId: string, state: Record<string, boolean>) {
  for (const source of FEATURE_SOURCES) map.setFeatureState({ source, id: plazaId }, state)
}

export default function MapView({
  plazas,
  placeCounts,
  matchCounts,
  selectedPlazaId,
  onSelectPlaza,
  padding,
  compact,
  realismo,
  medir,
  onStatusChange,
  onMapInstance,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [status, setStatus] = useState<MapStatus>({ state: 'loading' })
  const [hoveredPlazaId, setHoveredPlazaId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Valores recientes para callbacks del mapa registrados una sola vez.
  const latest = useRef({
    onSelectPlaza,
    onStatusChange,
    onMapInstance,
    plazas,
    padding,
    compact,
    realismo,
    medir,
  })
  useEffect(() => {
    latest.current = {
      onSelectPlaza,
      onStatusChange,
      onMapInstance,
      plazas,
      padding,
      compact,
      realismo,
      medir,
    }
  })

  // ── Creación del mapa (una vez por intento: "Reintentar" incrementa `attempt`) ──────────────
  //
  // `attempt` no se lee aquí dentro: está en las dependencias **para** que el efecto se vuelva a
  // ejecutar, que es lo que rehace el mapa al pulsar "Reintentar". Sin él, el botón no haría nada.
  // biome-ignore lint/correctness/useExhaustiveDependencies: es el disparador del reintento, no un valor que el efecto consulte.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    ensureMapRuntime()
    const update = (next: MapStatus) => {
      setStatus(next)
      latest.current.onStatusChange?.(next)
    }
    update({ state: 'loading' })

    const constraint = createCameraConstraint(
      ZIBATA_EXTENT.bbox,
      ZIBATA_EXTENT.boundary.coordinates[0],
    )
    let instance: MapLibreMap
    try {
      instance = new MapLibreMap({
        container,
        transformConstrain: constraint.constrain,
        style: buildMapStyle({
          tilesUrl: absoluteAssetUrl(MAP_ASSETS.tiles),
          plazaBuildingsUrl: absoluteAssetUrl(MAP_ASSETS.plazaBuildings),
          plazas: latest.current.plazas,
          boundary: ZIBATA_EXTENT.boundary,
          areaBbox: ZIBATA_EXTENT.areaBbox,
          center: ZIBATA_EXTENT.center,
          realismo: opcionesRealismo(
            latest.current.realismo === true,
            absoluteAssetUrl(MAP_ASSETS.realismo),
          ),
        }),
        ...initialCamera(latest.current.compact),
        minZoom: MAP_LIMITS.minZoom,
        maxZoom: MAP_LIMITS.maxZoom,
        maxPitch: MAP_LIMITS.maxPitch,
        attributionControl: false,
        // Etiquetas del propio MapLibre (atribución, teclado) en español, como el resto de la interfaz.
        locale: MAP_LOCALE,
        canvasContextAttributes: { antialias: true },
        renderWorldCopies: false,
        fadeDuration: 180,
      })
    } catch (error) {
      update({
        state: 'error',
        reason: error instanceof GPUInitializationError ? 'webgl' : 'generic',
      })
      return
    }

    // El mapa no se aleja de Zibatá: la restricción ya está en la cámara (ver bounds.ts), así que ni a
    // mitad de un gesto se puede dejar a Zibatá fuera de la pantalla.
    constraint.attach(instance)

    // Si el mapa 3D se usa: el primer gesto de la persona (arrastrar, girar, inclinar o acercar),
    // una vez por carga. Los movimientos de la propia guía no traen `originalEvent`.
    const GESTOS = ['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'] as const
    const alPrimerGesto = (evento: { originalEvent?: unknown }) => {
      if (!evento.originalEvent) return
      registrar('mapa', 'explora')
      for (const nombre of GESTOS) instance.off(nombre, alPrimerGesto)
    }
    for (const nombre of GESTOS) instance.on(nombre, alPrimerGesto)

    instance.getCanvas().setAttribute('aria-label', t('app.mapLabel'))
    instance.addControl(new AttributionControl({ compact: true }), 'bottom-left')
    /**
     * MapLibre despliega la atribución compacta en cuanto el estilo trae sus créditos (no al añadir
     * el control), y la guía la quiere plegada: a la vista queda la ⓘ y el texto aparece al pulsarla.
     * Basta con plegarla la primera vez que se despliega; después, el control ya no la reabre y quien
     * quiera leerla la abre cuando quiera.
     */
    const collapseAttribution = () => {
      const attribution = instance.getContainer().querySelector('.maplibregl-ctrl-attrib')
      if (!attribution?.classList.contains('maplibregl-compact-show')) return
      attribution.classList.remove('maplibregl-compact-show')
      instance.off('styledata', collapseAttribution)
      instance.off('sourcedata', collapseAttribution)
    }
    instance.on('styledata', collapseAttribution)
    instance.on('sourcedata', collapseAttribution)
    collapseAttribution()
    // Vista inicial: las zonas comerciales encuadradas en el espacio que dejan libre los paneles. El
    // padding vive en el mapa y el encuadre solo añade su margen (igual que "Volver a la vista").
    instance.setPadding(latest.current.padding)
    resetCamera(instance, latest.current.plazas, latest.current.compact, 0)

    let loaded = false
    let baseFailed = false
    const timeout = window.setTimeout(() => {
      if (!loaded && !baseFailed) update({ state: 'error', reason: 'generic' })
    }, MAP_LOAD_TIMEOUT_MS)
    instance.once('load', () => {
      loaded = true
      window.clearTimeout(timeout)
      if (!baseFailed) update({ state: 'ready' })
      if (latest.current.realismo) {
        // Edificios y árboles propios: un chunk aparte que el mapa de siempre no descarga. Si no
        // carga, no se ha ocultado nada nativo y el mapa sigue como estaba.
        void import('./realismo/install.ts')
          .then(({ installRealism }) =>
            installRealism(instance, absoluteAssetUrl(MAP_ASSETS.realismo), {
              boundary: ZIBATA_EXTENT.boundary,
              constraint,
              benchmark: latest.current.medir,
            }),
          )
          .catch((error) => console.error('[realismo]', error))
      }
    })
    instance.on('error', (event) => {
      console.error('[mapa]', event.error)
      // Sin la cartografía base (el TileJSON no se pudo leer) solo quedarían marcadores flotando: se
      // informa y se ofrece reintentar. Una tesela suelta o una capa secundaria (edificios de
      // plazas, tipografías) no bloquean el mapa, y por eso se mira que el error no traiga `tile`.
      const { sourceId, tile } = event as typeof event & { sourceId?: string; tile?: unknown }
      if (sourceId === SOURCE.base && !tile && !baseFailed) {
        baseFailed = true
        update({ state: 'error', reason: 'generic' })
      }
    })

    if (import.meta.env.DEV)
      (window as unknown as { __zibataMap?: MapLibreMap }).__zibataMap = instance

    setMap(instance)
    latest.current.onMapInstance?.(instance)
    return () => {
      window.clearTimeout(timeout)
      latest.current.onMapInstance?.(null)
      setMap(null)
      instance.remove()
    }
  }, [attempt])

  // ── Interacción con plazas: hover y clic sobre edificios y sitios ───────────────────────────
  useEffect(() => {
    if (!map || status.state !== 'ready') return
    const canvas = map.getCanvas()
    const plazaFrom = (event: MapLayerMouseEvent) =>
      event.features?.[0]?.properties?.plazaId as string | undefined

    /*
     * Un marcador es un elemento del DOM encima del lienzo, no un dibujo del mapa, así que el clic
     * llega a los dos: al botón del marcador y, por debajo, al polígono que haya en ese píxel. Con
     * la etiqueta centrada sobre su propia plaza daba igual, porque los dos decían lo mismo. Desde
     * que la etiqueta sale hacia un lado de la gota, el píxel de debajo puede ser de la plaza vecina,
     * y entonces pulsar un nombre abría otro: se vio como un clic que abría la plaza equivocada.
     *
     * Lo que manda es lo que se pulsa, así que el mapa ignora lo que pase sobre un marcador.
     */
    const sobreUnMarcador = (event: MapLayerMouseEvent) => {
      const destino = event.originalEvent.target
      return destino instanceof Element && destino.closest('.maplibregl-marker') !== null
    }

    const onMove = (event: MapLayerMouseEvent) => {
      if (sobreUnMarcador(event)) return
      const plazaId = plazaFrom(event)
      canvas.style.cursor = plazaId ? 'pointer' : ''
      setHoveredPlazaId(plazaId ?? null)
    }
    const onLeave = () => {
      canvas.style.cursor = ''
      setHoveredPlazaId(null)
    }
    const onClick = (event: MapLayerMouseEvent) => {
      if (sobreUnMarcador(event)) return
      const plazaId = plazaFrom(event)
      if (plazaId) latest.current.onSelectPlaza(plazaId)
    }
    for (const layer of INTERACTIVE_PLAZA_LAYERS) {
      map.on('mousemove', layer, onMove)
      map.on('mouseleave', layer, onLeave)
      map.on('click', layer, onClick)
    }
    return () => {
      for (const layer of INTERACTIVE_PLAZA_LAYERS) {
        map.off('mousemove', layer, onMove)
        map.off('mouseleave', layer, onLeave)
        map.off('click', layer, onClick)
      }
    }
  }, [map, status.state])

  // ── feature-state: hover, selección y atenuado por filtros ──────────────────────────────────
  useEffect(() => {
    if (!map || status.state !== 'ready' || !hoveredPlazaId) return
    setPlazaState(map, hoveredPlazaId, { hover: true })
    return () => setPlazaState(map, hoveredPlazaId, { hover: false })
  }, [map, status.state, hoveredPlazaId])

  useEffect(() => {
    if (!map || status.state !== 'ready' || !selectedPlazaId) return
    setPlazaState(map, selectedPlazaId, { selected: true })
    return () => setPlazaState(map, selectedPlazaId, { selected: false })
  }, [map, status.state, selectedPlazaId])

  useEffect(() => {
    if (!map || status.state !== 'ready') return
    for (const plaza of plazas) {
      const dimmed = matchCounts !== null && (matchCounts.get(plaza.id) ?? 0) === 0
      setPlazaState(map, plaza.id, { dimmed })
    }
  }, [map, status.state, plazas, matchCounts])

  // ── Cámara ──────────────────────────────────────────────────────────────────────────────────
  // Selección y padding se resuelven juntos: una segunda animación cancelaría la primera.
  const previousSelection = useRef<string | null>(null)
  const paddingKey = `${padding.top}-${padding.right}-${padding.bottom}-${padding.left}`
  // biome-ignore lint/correctness/useExhaustiveDependencies: se reacciona a los valores del padding, no a la referencia del objeto.
  useEffect(() => {
    if (!map || status.state !== 'ready') return
    const selectionChanged = previousSelection.current !== selectedPlazaId
    previousSelection.current = selectedPlazaId
    const plaza = selectedPlazaId
      ? latest.current.plazas.find((p) => p.id === selectedPlazaId)
      : undefined
    // Si el padding cambia mientras la cámara aún vuela hacia la plaza, se reencuadra en vez de cortar el vuelo.
    if (plaza && (selectionChanged || map.isMoving()))
      focusPlaza(map, plaza.coordinates, latest.current.padding)
    else updatePadding(map, latest.current.padding)
  }, [map, status.state, selectedPlazaId, paddingKey])

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={styles.canvas} data-testid="map-canvas" />
      {status.state === 'loading' && (
        <div className={styles.loading} role="status">
          <span className={styles.loadingDots} aria-hidden="true">
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
          </span>
          {t('map.loading')}
        </div>
      )}
      {status.state === 'error' && (
        <MapErrorMessage
          reason={status.reason}
          onRetry={status.reason === 'generic' ? () => setAttempt((n) => n + 1) : undefined}
        />
      )}
      {map && status.state === 'ready' && (
        <>
          <PlazaMarkers
            map={map}
            plazas={plazas}
            placeCounts={placeCounts}
            matchCounts={matchCounts}
            selectedPlazaId={selectedPlazaId}
            hoveredPlazaId={hoveredPlazaId}
            onHover={setHoveredPlazaId}
            onSelect={(plazaId) => {
              // Una zona elegida en el mapa (la misma elección también cuenta como filtro).
              registrar('mapa', plazaId)
              onSelectPlaza(plazaId)
            }}
          />
          <ComingSoonMarkers map={map} plazas={plazas} />
          <MapControls map={map} plazas={plazas} compact={compact} />
        </>
      )}
    </div>
  )
}
