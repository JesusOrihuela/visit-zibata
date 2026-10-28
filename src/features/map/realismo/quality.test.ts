// @vitest-environment jsdom
import type { Map as MapLibreMap } from 'maplibre-gl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyLevel, bajadaAyudo, createQuality, startGovernor } from './quality.ts'

describe('bajadaAyudo', () => {
  it('da por buena una bajada que acorta el intervalo entre cuadros un 10 % o más', () => {
    expect(bajadaAyudo(50, 40)).toBe(true)
    expect(bajadaAyudo(50, 45)).toBe(true)
  })

  it('no la da por buena si el intervalo casi no cambia: el límite no es el dibujo', () => {
    // El modo de bajo consumo de iOS dio 42 ms en los tres niveles.
    expect(bajadaAyudo(42, 41)).toBe(false)
    expect(bajadaAyudo(42, 42)).toBe(false)
    expect(bajadaAyudo(42, 50)).toBe(false)
  })
})

/** Un mapa de mentira: solo lo que usa el gobernador, con los cuadros que se le pidan. */
function fakeMap() {
  const listeners: Array<() => void> = []
  const container = document.createElement('div')
  let ratio = 1
  const map = {
    on: (_: string, fn: () => void) => listeners.push(fn),
    off: () => {},
    isMoving: () => true,
    areTilesLoaded: () => true,
    getContainer: () => container,
    getPixelRatio: () => ratio,
    setPixelRatio: (value: number) => {
      ratio = value
    },
    triggerRepaint: () => {},
  } as unknown as MapLibreMap
  /** Dibuja durante `seconds` s con un intervalo entre cuadros de `ms`. */
  const run = (seconds: number, ms: number) => {
    for (let t = 0; t < seconds * 1000; t += ms) {
      vi.advanceTimersByTime(ms)
      for (const fn of listeners) fn()
    }
  }
  return { map, run }
}

describe('gobernador de calidad', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('baja de nivel cuando el dibujo es lo lento y mejora', () => {
    const { map, run } = fakeMap()
    const quality = createQuality()
    applyLevel(map, quality, 3)
    startGovernor(map, quality)
    run(6, 50)
    expect(quality.level).toBe(2)
    // Con el nivel nuevo los cuadros llegan a tiempo y no hay nada que deshacer.
    run(8, 20)
    expect(quality.level).toBe(2)
  })

  it('vuelve al nivel anterior si bajar no mejora nada (el límite lo pone el sistema)', () => {
    const { map, run } = fakeMap()
    const quality = createQuality()
    applyLevel(map, quality, 3)
    startGovernor(map, quality)
    run(30, 42)
    expect(quality.level).toBe(3)
    expect(map.getPixelRatio()).toBe(Math.min(window.devicePixelRatio, 2))
  })
})
