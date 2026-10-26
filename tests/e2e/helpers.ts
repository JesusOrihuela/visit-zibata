import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Locator, Page } from '@playwright/test'

/**
 * Conteos tomados del dataset publicado, no escritos a mano: los locales cambian cada vez que se
 * verifica la guía y las pruebas no deberían romperse por una alta o una baja, solo por un fallo.
 */
const dataPath = (file: string) =>
  fileURLToPath(new URL(`../../data/commercial/${file}`, import.meta.url))
const read = <T>(file: string): T => JSON.parse(readFileSync(dataPath(file), 'utf8')) as T

interface DatasetPlace {
  id: string
  plazaId: string
  name: string
  giros: string[]
  secundarios: string[]
  googleMapsUri: string | null
}

interface DatasetCategory {
  id: string
  giros: { id: string }[]
}

const dataset = {
  places: read<{ places: DatasetPlace[] }>('places.json').places,
  plazas: read<{ plazas: { id: string; name: string; active: boolean }[] }>('plazas.json').plazas,
  categories: read<{ categories: DatasetCategory[] }>('categories.json').categories,
}

/** La categoría de cada giro, que es de donde sale en qué pastillas aparece un local. */
const categoryOfGiro = new Map(
  dataset.categories.flatMap((category) =>
    category.giros.map((giro) => [giro.id, category.id] as const),
  ),
)

/** Nº de lugares publicados en una plaza, por su nombre visible. */
export function placesInPlaza(name: string): number {
  const plaza = dataset.plazas.find((candidate) => candidate.name === name)
  if (!plaza) throw new Error(`No hay ninguna plaza llamada "${name}" en el dataset`)
  return dataset.places.filter((place) => place.plazaId === plaza.id).length
}

export const activePlazas = () => dataset.plazas.filter((plaza) => plaza.active)

/** Los `n` locales de nombre más largo: el peor caso para un título que debe caber en su columna. */
export const longestPlaces = (n: number) =>
  [...dataset.places].sort((a, b) => b.name.length - a.name.length).slice(0, n)

/** Las `n` zonas activas de nombre más largo. */
export const longestPlazas = (n: number) =>
  [...activePlazas()].sort((a, b) => b.name.length - a.name.length).slice(0, n)

/** Las categorías en las que aparece un local: las de todos sus giros, de los dos niveles. */
const categoriesOf = (place: DatasetPlace) =>
  [...place.giros, ...place.secundarios]
    .map((giro) => categoryOfGiro.get(giro))
    .filter((id) => id !== undefined)

/** Nº de lugares de una categoría (opcionalmente dentro de una plaza), leído del dataset. */
export function placesInCategory(categoryId: string, plazaName?: string): number {
  const plazaId = plazaName
    ? dataset.plazas.find((plaza) => plaza.name === plazaName)?.id
    : undefined
  return dataset.places.filter(
    (place) => categoriesOf(place).includes(categoryId) && (!plazaId || place.plazaId === plazaId),
  ).length
}

/** Un local del dataset, por id: para no escribir a mano datos que cambian al verificarlos. */
export function placeById(id: string): DatasetPlace {
  const place = dataset.places.find((candidate) => candidate.id === id)
  if (!place) throw new Error(`No hay ningún local con id "${id}" en el dataset`)
  return place
}

/**
 * Abre la app sin el tutorial, salvo que se pida lo contrario.
 *
 * `path` va relativo a la base (`zona/condesa`, no `/zona/condesa`), que es lo que hace que la
 * suite valga igual publicada en la raíz que en un subdirectorio.
 */
export async function openApp(page: Page, { path = '', onboarding = false } = {}): Promise<void> {
  if (!onboarding) {
    await page.addInitScript(() => window.localStorage.setItem('zibata:onboarding-visto', '1'))
  }
  await page.goto(`./${path}`)
}

/** Espera a que el mapa haya cargado (los marcadores de plazas solo aparecen con el mapa listo). */
export async function waitForMap(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelectorAll('button[data-mode]').length > 0,
    null,
    {
      timeout: 60_000,
    },
  )
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 900

/**
 * Espera a que la hoja inferior deje de moverse. Su alto se anima (420 ms) y, con la máquina cargada,
 * medir o pulsar a media animación hace que el gesto caiga fuera del asa. No oculta ningún fallo del
 * producto: solo evita medir un elemento que todavía se mueve.
 */
export async function waitForSheet(page: Page): Promise<void> {
  let previous = -1
  for (let attempt = 0; attempt < 20; attempt++) {
    const height = await page.evaluate(
      () => document.querySelector('section[data-panel]')?.getBoundingClientRect().height ?? 0,
    )
    if (height > 0 && height === previous) return
    previous = height
    await page.waitForTimeout(150)
  }
}

/** El panel de lugares: lateral en escritorio, hoja inferior en móvil (misma región accesible). */
export const panel = (page: Page) =>
  page
    .getByRole('region', { name: 'Información de lugares' })
    .or(page.getByRole('complementary', { name: 'Información de lugares' }))

/**
 * Marcador de una zona tal como lo alcanzaría una persona. Cuando el espacio no da ni para el punto
 * (pantallas muy estrechas con la vista alejada) se acerca la cámara con el selector de zonas, igual
 * que haría alguien que la busca, y se cierra el panel para dejar el mapa como estaba.
 */
export async function plazaMarker(page: Page, name: string): Promise<Locator> {
  const marker = page.locator(`button[data-mode][aria-label^="${name}, "]`)
  await marker.waitFor({ state: 'attached' })
  for (let attempt = 0; attempt < 3; attempt++) {
    // La colocación de marcadores se estabiliza cuando termina el movimiento de la cámara.
    await page.waitForTimeout(1200)
    if ((await marker.getAttribute('data-mode')) !== 'hidden') return marker
    await page.getByRole('combobox', { name: 'Filtrar por zona' }).selectOption({ label: name })
    await page.waitForTimeout(1500)
    await page
      .getByRole('button', { name: 'Cerrar panel' })
      .first()
      .click({ timeout: 5000 })
      .catch(() => {})
  }
  throw new Error(`La plaza "${name}" no llega a tener marcador propio`)
}
