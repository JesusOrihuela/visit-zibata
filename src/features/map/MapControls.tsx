/** MapControls: zoom, orientación, mi ubicación y regreso a la vista de Zibatá. */
import { Compass, House, LocateFixed, Minus, Plus } from 'lucide-react'
import { type Map as MapLibreMap, Marker } from 'maplibre-gl'
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { insideCenterBounds } from '../../config/map.ts'
import { t } from '../../i18n/index.ts'
import type { Plaza } from '../../types/domain.ts'
import { initialCamera, resetCamera } from './camera.ts'
import styles from './MapControls.module.css'
import { prefersReducedMotion } from './mapRuntime.ts'

interface MapControlsProps {
  map: MapLibreMap
  plazas: readonly Plaza[]
  compact: boolean
}

export function MapControls({ map, plazas, compact }: MapControlsProps) {
  const [bearing, setBearing] = useState(map.getBearing())
  const [locating, setLocating] = useState(false)
  const [locateMessage, setLocateMessage] = useState<string | null>(null)
  const userMarker = useRef<Marker | null>(null)
  /*
   * La brújula endereza el norte **y** devuelve la inclinación de salida.
   *
   * Solo enderezaba el norte, así que con el norte ya arriba pulsarla no hacía nada aunque el mapa
   * estuviera tumbado hasta el horizonte: la única forma de recuperar la vista era el botón de
   * casa, que además mueve el centro y el zoom. Enderezar incluye volver a ver el volumen, que es
   * de lo que trata este mapa.
   */
  const inclinacionBase = initialCamera(compact).pitch
  const [girando, setGirando] = useState(false)
  const giro = useRef<{ desde: number; bearing: number; movio: boolean } | null>(null)

  /** El ángulo del puntero respecto al centro del botón, en grados. */
  const anguloDe = (event: ReactPointerEvent<HTMLElement>) => {
    const caja = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - (caja.left + caja.width / 2)
    const y = event.clientY - (caja.top + caja.height / 2)
    return (Math.atan2(y, x) * 180) / Math.PI
  }

  const empezarGiro = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    giro.current = { desde: anguloDe(event), bearing: map.getBearing(), movio: false }
  }

  const seguirGiro = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const actual = giro.current
    if (!actual) return
    const delta = anguloDe(event) - actual.desde
    // Un par de grados de margen: un dedo nunca pulsa del todo quieto, y sin esto un toque
    // limpio se contaría como giro y la brújula dejaría de enderezar.
    if (!actual.movio && Math.abs(delta) < 3) return
    actual.movio = true
    setGirando(true)
    map.setBearing(actual.bearing + delta)
  }

  const terminarGiro = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const actual = giro.current
    giro.current = null
    setGirando(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (actual && !actual.movio) map.easeTo({ bearing: 0, pitch: inclinacionBase, duration })
  }

  useEffect(() => {
    const sync = () => setBearing(map.getBearing())
    map.on('rotate', sync)
    return () => {
      map.off('rotate', sync)
    }
  }, [map])

  useEffect(
    () => () => {
      userMarker.current?.remove()
    },
    [],
  )

  useEffect(() => {
    if (!locateMessage) return
    const id = window.setTimeout(() => setLocateMessage(null), 5000)
    return () => window.clearTimeout(id)
  }, [locateMessage])

  const duration = prefersReducedMotion() ? 0 : 450

  /**
   * Geolocalización opcional: solo tras pulsar el botón. La posición se usa en memoria para centrar el
   * mapa y dibujar un punto; no se guarda ni se envía a ningún servidor.
   */
  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocateMessage(t('map.locateUnsupported'))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        const { longitude, latitude } = coords
        if (!insideCenterBounds(longitude, latitude)) {
          setLocateMessage(t('map.locateOutside'))
          return
        }
        userMarker.current?.remove()
        const dot = document.createElement('div')
        dot.className = styles.userDot ?? ''
        dot.setAttribute('role', 'img')
        dot.setAttribute('aria-label', t('map.userLocation'))
        userMarker.current = new Marker({ element: dot, pitchAlignment: 'map' })
          .setLngLat([longitude, latitude])
          .addTo(map)
        map.easeTo({
          center: [longitude, latitude],
          zoom: Math.max(map.getZoom(), 16),
          duration: duration * 2,
        })
      },
      () => {
        setLocating(false)
        setLocateMessage(t('map.locateError'))
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return (
    <fieldset className={styles.controls}>
      <legend className="visually-hidden">{t('map.controls')}</legend>
      {locateMessage && (
        <p className={styles.message} role="status">
          {locateMessage}
        </p>
      )}
      <div className={`${styles.stack} ${styles.zoomStack}`}>
        <button
          type="button"
          className={styles.button}
          onClick={() => map.zoomIn({ duration })}
          aria-label={t('map.zoomIn')}
          title={t('map.zoomIn')}
        >
          <Plus aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => map.zoomOut({ duration })}
          aria-label={t('map.zoomOut')}
          title={t('map.zoomOut')}
        >
          <Minus aria-hidden="true" />
        </button>
      </div>
      <div className={styles.stack}>
        {/*
         * La brújula gira el mapa, y además lo endereza.
         *
         * Giraba solo con el botón derecho del ratón, que no lo descubre nadie, así que en
         * escritorio la única pieza que habla de orientación servía para deshacer un giro que no
         * había forma evidente de hacer. Arrastrarla gira; soltarla sin haberla movido endereza y
         * devuelve la inclinación de salida. Con el teclado, las flechas giran de 15 en 15.
         *
         * Y ya no se deshabilita: enderezada sigue sirviendo para girar, que es su otro trabajo.
         */}
        <button
          type="button"
          className={styles.button}
          data-girando={girando}
          onPointerDown={empezarGiro}
          onPointerMove={seguirGiro}
          onPointerUp={terminarGiro}
          onPointerCancel={terminarGiro}
          onKeyDown={(event) => {
            const paso = event.key === 'ArrowLeft' ? -15 : event.key === 'ArrowRight' ? 15 : 0
            if (paso === 0) return
            event.preventDefault()
            map.setBearing(map.getBearing() + paso)
          }}
          aria-label={t('map.rotate')}
          title={t('map.rotate')}
        >
          <Compass aria-hidden="true" style={{ transform: `rotate(${-bearing - 45}deg)` }} />
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={locate}
          aria-busy={locating}
          aria-label={t('map.locate')}
          title={t('map.locate')}
        >
          <LocateFixed aria-hidden="true" className={locating ? styles.spinning : undefined} />
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => resetCamera(map, plazas, compact)}
          aria-label={t('map.reset')}
          title={t('map.reset')}
        >
          <House aria-hidden="true" />
        </button>
      </div>
    </fieldset>
  )
}
