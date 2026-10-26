import { type RefObject, useEffect, useState } from 'react'

/**
 * Ancho (en px) de un elemento, actualizado cuando cambia su tamaño.
 *
 * Devuelve `fallback` hasta la primera medida, para que el primer render —y el HTML prerenderizado—
 * no dependa del navegador. Mismo patrón que `useElementBottom`.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setWidth(Math.round(element.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
