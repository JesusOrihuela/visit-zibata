import { useSyncExternalStore } from 'react'
import { localeFromPath } from '../lib/url-state.ts'
import type { LocalizedText } from '../types/domain.ts'
import { es, type MessageKey, type Messages } from './es.ts'

export type Locale = 'es' | 'en'
export const availableLocales: Locale[] = ['es', 'en']

/**
 * Los catálogos se cargan por separado: cada visita baja **el suyo**, no los dos.
 *
 * Hasta la v4.8.0 viajaban juntos y eso eran unos 5 KB que nadie usaba en cada carga. Lo que lo
 * impedía era el botón de idioma, que escribe su etiqueta en el otro idioma; esas cuatro cadenas
 * viven ahora en `cambioDeIdioma.ts` y el resto se aplaza.
 *
 * El español se importa de forma estática a propósito, no por pereza: es el idioma por omisión y el
 * respaldo de `localized()`, así que `t()` nunca puede quedarse sin nada que devolver. El inglés se
 * pide cuando hace falta, y `main.tsx` lo espera antes de pintar para que nadie vea un parpadeo.
 *
 * Para añadir otro idioma: crear su archivo con `satisfies Messages` (TypeScript exige todas las
 * claves), añadirlo aquí, a `Locale`, a `availableLocales` y a `cambioDeIdioma.ts`.
 */
const cargadores: Record<Locale, () => Promise<Messages>> = {
  es: async () => es,
  en: async () => (await import('./en.ts')).en,
}
const cargados = new Map<Locale, Messages>([['es', es]])

/**
 * Deja listo un idioma, y lo pone en uso si es el activo. Llamarlo dos veces no cuesta.
 *
 * Lo segundo no es un extra: al arrancar en `/en/...`, `locale` ya vale `en` pero el catálogo inglés
 * todavía no existe, así que `messages` apunta al español de respaldo. Sin esta línea la pantalla se
 * quedaba con los datos en inglés (que son datos, no catálogo) y la interfaz en español.
 */
export async function cargarIdioma(target: Locale): Promise<void> {
  if (!cargados.has(target)) cargados.set(target, await cargadores[target]())
  if (target !== locale) return
  messages = cargados.get(target) ?? es
  for (const listener of listeners) listener()
}

const DEFAULT_LOCALE: Locale = 'es'
const STORAGE_KEY = 'zibata:idioma'

const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (availableLocales as string[]).includes(value)

/** Idioma elegido a mano en esta guía (se recuerda en este dispositivo). */
function storedLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isLocale(stored) ? stored : null
  } catch {
    return null
  }
}

/**
 * Idioma activo: **manda la URL**, y si no la trae, lo elegido a mano en este dispositivo.
 *
 * Que la URL mande es la consecuencia de tener un árbol por idioma: `/en/place/x` tiene que leerse
 * en inglés aunque el dispositivo recuerde español, porque esa dirección es la versión inglesa de
 * esa página y así la indexan los buscadores.
 *
 * Ya NO se usa el idioma del navegador. Es deliberado y tiene costo: quien llegue por primera vez
 * con el navegador en inglés verá la portada en español y tendrá que tocar el botón de idioma (una
 * vez: a partir de ahí se recuerda). A cambio, `/es` es español de forma determinista (y `/`, que el
 * Worker redirige a `/es`, también). Si se dejara el idioma del navegador, un rastreador (que pide
 * inglés) sería reenviado de `/es` a `/en` y la portada en español dejaría de indexarse bien, que es
 * justo lo que este cambio vino a arreglar.
 */
function resolveLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const fromPath = localeFromPath(window.location.pathname, import.meta.env.BASE_URL)
  if (fromPath) return fromPath
  return storedLocale() ?? DEFAULT_LOCALE
}

export let locale: Locale = resolveLocale()
/** Siempre hay catálogo: el español está desde el primer instante y es el respaldo. */
let messages: Messages = cargados.get(locale) ?? es
let pluralRules = new Intl.PluralRules(locale)
const listeners = new Set<() => void>()

/**
 * Cambia el idioma de la interfaz y lo recuerda en este dispositivo.
 *
 * Es `async` desde que los catálogos se cargan por separado: si el idioma de destino todavía no está,
 * hay que esperarlo antes de cambiar, o se pintaría una pantalla con los textos del anterior. Quien
 * no necesite esperar puede llamarla y olvidarse (`void setLocale(x)`): la interfaz se re-renderiza
 * sola cuando termina.
 */
export async function setLocale(next: Locale): Promise<void> {
  if (next === locale) return
  await cargarIdioma(next)
  locale = next
  messages = cargados.get(next) ?? es
  pluralRules = new Intl.PluralRules(next)
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Sin almacenamiento (modo privado): el idioma dura lo que la sesión.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Re-renderiza al cambiar de idioma. Basta con usarlo en la raíz de la interfaz: sus hijos leen los
 * textos con `t()` al renderizar.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(
    subscribe,
    () => locale,
    () => DEFAULT_LOCALE,
  )
}

type Vars = Record<string, string | number>

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

type Message = string | { one: string; other: string }

function format(message: Message, rules: Intl.PluralRules, vars?: Vars): string {
  if (typeof message === 'string') return interpolate(message, vars)
  const count = Number(vars?.count ?? 0)
  return interpolate(rules.select(count) === 'one' ? message.one : message.other, vars)
}

export function t(key: MessageKey, vars?: Vars): string {
  return format(messages[key], pluralRules, vars)
}

/** Texto de datos (categorías, subcategorías) en el idioma activo, con español como respaldo. */
export function localized(text: LocalizedText): string {
  return (text as Partial<Record<Locale, string>>)[locale] ?? text.es
}

export const formatNumber = (value: number) => new Intl.NumberFormat(locale).format(value)
