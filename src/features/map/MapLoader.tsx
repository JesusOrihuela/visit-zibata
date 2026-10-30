import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/index.ts'
import styles from './MapLoader.module.css'

/**
 * La pantalla de espera: el símbolo de la guía con el agua subiendo por encima. Lo que queda por
 * debajo del agua va a color; lo que falta, en escala de grises. La línea del agua es el borde de la
 * máscara, así que el símbolo no se rellena: se revela.
 *
 * ## Por qué este tipo de indicador
 *
 * Los tiempos de espera se juzgan en tres tramos (Nielsen): por debajo de 0,1 s la respuesta se
 * siente instantánea, hasta 1 s no hace falta nada, de 1 a 10 s pide un indicador en bucle y a partir
 * de 10 s pide un porcentaje. Aquí la carga típica es de uno a tres segundos (un trozo de 1 MB más
 * las teselas), así que toca el tramo del bucle. Un esqueleto no vale: un mapa no tiene una silueta
 * que enseñar de antemano, y lo que llega se pinta solo debajo.
 *
 * ## Por qué el agua no miente
 *
 * MapLibre solo avisa de dos cosas: empezó y terminó. No hay un porcentaje que enseñar, así que el
 * nivel no pretende ser uno: sube con el tiempo hacia el 92 % y solo llega arriba cuando el mapa está
 * listo. Sin cifras y sin marcas, es un indicador en bucle dibujado con el símbolo de la casa.
 *
 * ## Por qué no hay desenfoque
 *
 * Detrás no hay nada que desenfocar: el lienzo está vacío o a medio pintar. Un `backdrop-filter` a
 * pantalla completa obligaría al compositor a desenfocar el lienzo WebGL en cada fotograma justo
 * mientras el mapa carga, que es el peor momento para pedirle trabajo a la GPU.
 *
 * ## Por qué espera 400 ms para aparecer
 *
 * Un indicador que entra y sale en menos de un segundo se lee como un parpadeo y hace pensar que algo
 * falló (Nielsen). Si el mapa llega antes, no se enseña nada.
 */

/** Las frases describen lo que está pasando de verdad, en ambos lados de la espera. */
const FASES = ['map.loading.preparing', 'map.loading.areas', 'map.loading.streets'] as const
const ESPERA_ANTES_DE_APARECER = 400
const FUNDIDO = 360
const RITMO_DE_FRASE = 2600
/** Techo del nivel mientras no hay mapa: el último tramo se reserva para cuando está listo. */
const TECHO = 0.92

export function MapLoader({
  visible,
  variant = 'mapa',
}: {
  visible: boolean
  /** `mapa` cubre el mapa con su velo; `pantalla` ocupa la página entera antes de que haya mapa. */
  variant?: 'mapa' | 'pantalla'
}) {
  const [aparece, setAparece] = useState(false)
  const [dentro, setDentro] = useState(true)
  const [nivel, setNivel] = useState(0.04)
  const [fase, setFase] = useState(0)
  const inicio = useRef(0)

  // Espera antes de enseñarse: si el mapa llega antes, esto no llega a verse.
  useEffect(() => {
    const id = window.setTimeout(() => {
      inicio.current = performance.now()
      setAparece(true)
    }, ESPERA_ANTES_DE_APARECER)
    return () => window.clearTimeout(id)
  }, [])

  // Salida: se deja el fundido y después se retira del árbol.
  useEffect(() => {
    if (visible) return
    const id = window.setTimeout(() => setDentro(false), FUNDIDO)
    return () => window.clearTimeout(id)
  }, [visible])

  // Nivel: sube con el tiempo hacia el techo. Se actualiza cuatro veces por segundo y el CSS suaviza
  // el resto, que es más barato que un fotograma por segundo con React.
  useEffect(() => {
    if (!visible) {
      setNivel(1)
      return
    }
    // Sin movimiento, el agua se queda a media altura: no hay animación que enseñar.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setNivel(0.6)
      return
    }
    const id = window.setInterval(() => {
      const segundos = (performance.now() - inicio.current) / 1000
      setNivel(Math.max(0.04, TECHO * (1 - Math.exp(-segundos / 2.2))))
    }, 40)
    return () => window.clearInterval(id)
  }, [visible])

  useEffect(() => {
    const id = window.setInterval(() => setFase((n) => (n + 1) % FASES.length), RITMO_DE_FRASE)
    return () => window.clearInterval(id)
  }, [])

  if (!aparece || !dentro) return null

  return (
    <div
      className={styles.loader}
      data-visible={visible}
      data-variant={variant}
      role="status"
      style={{ '--nivel': nivel } as CSSProperties}
    >
      <span className={styles.marca} aria-hidden="true">
        {/* Lo que falta, en escala de grises. */}
        <img className={styles.gris} src="/simbolo.svg" alt="" width={96} height={96} />
        {/* Lo que el agua ya cubrió, a color. */}
        <img className={styles.color} src="/simbolo.svg" alt="" width={96} height={96} />
      </span>
      {/*
       * La frase cambia cada 2,6 s, así que no se anuncia: sería un lector de pantalla hablando solo.
       * Lo que se anuncia una vez es el estado, que va debajo y no cambia.
       */}
      <p className={styles.frase} aria-hidden="true" key={fase}>
        {t(FASES[fase] as (typeof FASES)[number])}
      </p>
      <span className="visually-hidden">{t('map.loading')}</span>
    </div>
  )
}
