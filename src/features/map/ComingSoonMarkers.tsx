/**
 * Zonas confirmadas y en obra: se muestran en el mapa con una insignia de obra (redonda, como la cifra
 * de locales de las plazas abiertas; el texto "Próximamente" queda para lectores de pantalla), sin
 * ser pulsables (todavía no tienen locales que abrir). Van aparte de `PlazaMarkers` a propósito: no
 * compiten por sitio con las plazas abiertas ni entran en su colocación.
 */
import { Construction } from 'lucide-react'
import { type Map as MapLibreMap, Marker } from 'maplibre-gl'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../../i18n/index.ts'
import type { Plaza } from '../../types/domain.ts'
import styles from './ComingSoonMarkers.module.css'
import { CAPA_ETIQUETAS, CAPA_TALLOS } from './PlazaMarkers.tsx'

/**
 * Por debajo de este zoom solo se ve la insignia redonda: con la vista general, dos obras vecinas se
 * pisaban entre sí y tapaban las cifras de las zonas abiertas. El nombre sigue disponible para
 * lectores de pantalla.
 */
const NAME_MIN_ZOOM = 15.4

export function ComingSoonMarkers({ map, plazas }: { map: MapLibreMap; plazas: readonly Plaza[] }) {
  const soon = useMemo(() => plazas.filter((plaza) => plaza.comingSoon === true), [plazas])
  const [elements, setElements] = useState<Map<string, HTMLElement>>(new Map())
  const [stemElements, setStemElements] = useState<Map<string, HTMLElement>>(new Map())
  const [showNames, setShowNames] = useState(() => map.getZoom() >= NAME_MIN_ZOOM)

  useEffect(() => {
    const sync = () => setShowNames(map.getZoom() >= NAME_MIN_ZOOM)
    map.on('zoomend', sync)
    return () => {
      map.off('zoomend', sync)
    }
  }, [map])

  useEffect(() => {
    const created = new Map<string, HTMLElement>()
    const createdStems = new Map<string, HTMLElement>()
    const markers = soon.flatMap((plaza) => {
      const element = document.createElement('div')
      element.className = styles.anchor ?? ''
      // Las dos bandas de PlazaMarkers: el tallo por debajo de cualquier gota, la gota por encima
      // de cualquier tallo. Sin reparto por cercanía, que estas no se mueven ni se seleccionan.
      element.style.zIndex = String(CAPA_ETIQUETAS)
      created.set(plaza.id, element)
      const stem = document.createElement('div')
      stem.className = styles.anchor ?? ''
      stem.style.zIndex = String(CAPA_TALLOS)
      createdStems.set(plaza.id, stem)
      const punto: [number, number] = [plaza.coordinates.lng, plaza.coordinates.lat]
      return [
        new Marker({ element: stem, anchor: 'bottom' }).setLngLat(punto).addTo(map),
        new Marker({ element, anchor: 'bottom' }).setLngLat(punto).addTo(map),
      ]
    })
    setElements(created)
    setStemElements(createdStems)
    return () => {
      for (const marker of markers) marker.remove()
    }
  }, [map, soon])

  return (
    <>
      {soon.map((plaza) => {
        const element = elements.get(plaza.id)
        if (!element) return null
        const etiqueta = createPortal(
          <>
            {/* Igual que una plaza abierta: la gota primero y el nombre a su lado, no al revés. */}
            <p className={styles.label} data-compact={!showNames}>
              <span className={styles.gota}>
                <span className={styles.badge}>
                  <Construction aria-hidden="true" />
                  <span className="visually-hidden">{t('plaza.comingSoon')}</span>
                </span>
              </span>
              <span className={showNames ? styles.name : 'visually-hidden'}>{plaza.name}</span>
            </p>
            {/* Separador: lo que sube la gota sobre el punto. El que se ve va en su propio marcador. */}
            <span className={styles.stem} data-fantasma="true" aria-hidden="true" />
          </>,
          element,
          plaza.id,
        )
        const tallo = stemElements.get(plaza.id)
        return tallo
          ? [
              etiqueta,
              createPortal(
                <span className={styles.stem} aria-hidden="true" />,
                tallo,
                `${plaza.id}-tallo`,
              ),
            ]
          : etiqueta
      })}
    </>
  )
}
