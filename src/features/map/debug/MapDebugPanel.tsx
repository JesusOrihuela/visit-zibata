/**
 * Modo depuración del mapa (?debug, solo en desarrollo: el build de producción no lo incluye). Muestra coordenadas, cámara, límites de teselas, IDs de
 * edificios y plazas, geometrías de plazas y el plano del cliente georreferenciado encima del mapa.
 */
import type { ImageSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { t } from '../../../i18n/index.ts'
import { SOURCE } from '../style/ids.ts'
import styles from './MapDebugPanel.module.css'

interface Georef {
  image: string
  /** [[lng, lat] arriba-izq, arriba-der, abajo-der, abajo-izq] */
  coordinates: [[number, number], [number, number], [number, number], [number, number]]
}

// Opcional: solo existe tras `npm run map:georef`.
const georefModules = import.meta.glob<{ default: Georef }>(
  '../../../../data/geographic/reference/*.georef.json',
  {
    eager: true,
  },
)
const imageModules = import.meta.glob<{ default: string }>(
  '../../../../data/geographic/reference/*.webp',
  {
    eager: true,
    query: '?url',
  },
)

const PLANO_SOURCE = 'debug-plano'
const PLANO_LAYER = 'debug-plano'
const PLAZA_OUTLINE = 'debug-plaza-outline'
const PLAZA_IDS = 'debug-plaza-ids'

export default function MapDebugPanel({ map }: { map: MapLibreMap }) {
  const [cursor, setCursor] = useState<string>('sin dato')
  const [camera, setCamera] = useState('')
  const [feature, setFeature] = useState<string>('sin dato')
  const [tiles, setTiles] = useState(false)
  const [collisions, setCollisions] = useState(false)
  const [plazas, setPlazas] = useState(true)
  const [planoOpacity, setPlanoOpacity] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  const georef = Object.values(georefModules)[0]?.default
  const planoUrl = georef
    ? Object.entries(imageModules).find(([path]) => path.endsWith(georef.image))?.[1].default
    : undefined

  useEffect(() => {
    const updateCamera = () => {
      const c = map.getCenter()
      setCamera(
        `center [${c.lng.toFixed(5)}, ${c.lat.toFixed(5)}] · zoom ${map.getZoom().toFixed(2)} · pitch ${map
          .getPitch()
          .toFixed(0)}° · bearing ${map.getBearing().toFixed(0)}°`,
      )
    }
    const onMove = (event: MapMouseEvent) => {
      setCursor(`${event.lngLat.lng.toFixed(6)}, ${event.lngLat.lat.toFixed(6)}`)
      const hit = map.queryRenderedFeatures(event.point, {
        layers: ['plaza-buildings', 'buildings', 'buildings-outside'],
      })[0]
      if (hit) {
        const p = hit.properties ?? {}
        setFeature(
          `${hit.layer.id} · id ${p.id ?? '('}${p.plazaId ? ` · plaza ${p.plazaId}` : ''} · h ${p.height ?? ')'} m · ${p.type ?? ''} · ${p.src ?? ''}`,
        )
      } else {
        setFeature('sin dato')
      }
    }
    updateCamera()
    map.on('move', updateCamera)
    map.on('mousemove', onMove)
    return () => {
      map.off('move', updateCamera)
      map.off('mousemove', onMove)
    }
  }, [map])

  useEffect(() => {
    map.showTileBoundaries = tiles
    map.showCollisionBoxes = collisions
  }, [map, tiles, collisions])

  useEffect(() => {
    if (!plazas) return
    map.addLayer({
      id: PLAZA_OUTLINE,
      type: 'line',
      source: SOURCE.plazaSites,
      paint: { 'line-color': '#d9480f', 'line-width': 2, 'line-dasharray': [2, 1] },
    })
    map.addLayer({
      id: PLAZA_IDS,
      type: 'symbol',
      source: SOURCE.plazaSites,
      layout: {
        'text-field': [
          'concat',
          ['get', 'plazaId'],
          ['case', ['get', 'active'], '', ' (inactiva)'],
        ],
        'text-font': ['Special Gothic SemiBold'],
        'text-size': 11,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#d9480f', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
    })
    return () => {
      if (map.getLayer(PLAZA_IDS)) map.removeLayer(PLAZA_IDS)
      if (map.getLayer(PLAZA_OUTLINE)) map.removeLayer(PLAZA_OUTLINE)
    }
  }, [map, plazas])

  useEffect(() => {
    if (!georef || !planoUrl) return
    if (!map.getSource(PLANO_SOURCE)) {
      map.addSource(PLANO_SOURCE, { type: 'image', url: planoUrl, coordinates: georef.coordinates })
      map.addLayer(
        { id: PLANO_LAYER, type: 'raster', source: PLANO_SOURCE, paint: { 'raster-opacity': 0 } },
        'buildings-outside',
      )
    }
    return () => {
      if (map.getLayer(PLANO_LAYER)) map.removeLayer(PLANO_LAYER)
      if (map.getSource(PLANO_SOURCE)) map.removeSource(PLANO_SOURCE)
    }
  }, [map, georef, planoUrl])

  useEffect(() => {
    if (map.getLayer(PLANO_LAYER)) map.setPaintProperty(PLANO_LAYER, 'raster-opacity', planoOpacity)
    ;(map.getSource(PLANO_SOURCE) as ImageSource | undefined)?.setCoordinates(
      georef?.coordinates ?? [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    )
  }, [map, planoOpacity, georef])

  return (
    <aside className={styles.panel} data-collapsed={collapsed} aria-label={t('debug.title')}>
      <button type="button" className={styles.toggle} onClick={() => setCollapsed((c) => !c)}>
        {t('debug.title')} {collapsed ? '▸' : '▾'}
      </button>
      {!collapsed && (
        <div className={styles.body}>
          <p>
            <strong>Cursor</strong> {cursor}
          </p>
          <p>
            <strong>Cámara</strong> {camera}
          </p>
          <p>
            <strong>Edificio</strong> {feature}
          </p>
          <label>
            <input type="checkbox" checked={tiles} onChange={(e) => setTiles(e.target.checked)} />{' '}
            Límites de teselas
          </label>
          <label>
            <input
              type="checkbox"
              checked={collisions}
              onChange={(e) => setCollisions(e.target.checked)}
            />{' '}
            Cajas de colisión de etiquetas
          </label>
          <label>
            <input type="checkbox" checked={plazas} onChange={(e) => setPlazas(e.target.checked)} />{' '}
            Geometrías e IDs de plazas
          </label>
          {georef && planoUrl ? (
            <label className={styles.range}>
              Plano del cliente ({Math.round(planoOpacity * 100)} %)
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={planoOpacity}
                onChange={(e) => setPlanoOpacity(Number(e.target.value))}
              />
            </label>
          ) : (
            <p className={styles.muted}>Plano sin georreferenciar (npm run map:georef)</p>
          )}
          <button
            type="button"
            className={styles.copy}
            onClick={() => {
              const c = map.getCenter()
              void navigator.clipboard?.writeText(
                JSON.stringify({
                  center: [Number(c.lng.toFixed(5)), Number(c.lat.toFixed(5))],
                  zoom: Number(map.getZoom().toFixed(2)),
                  pitch: Math.round(map.getPitch()),
                  bearing: Math.round(map.getBearing()),
                }),
              )
            }}
          >
            Copiar cámara (JSON)
          </button>
        </div>
      )}
    </aside>
  )
}
