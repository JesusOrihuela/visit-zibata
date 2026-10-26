/**
 * Las páginas de categoría, sin plataforma: qué locales entran en cada una y cómo se dicen.
 *
 * Una categoría reúne a los locales cuyo giro, principal o secundario, es suyo. Es la misma regla que
 * aplica el filtro de la aplicación (`categoriesOf` en features/filters/filters.ts), a propósito: la
 * página de una categoría tiene que listar lo mismo que se ve al elegir su cápsula.
 *
 * Todo sale de los datos. No hay "abierto ahora" (el HTML se genera una vez por despliegue) ni cifras
 * de los locales que el dato no trae.
 */
import type { Category, Place } from '../../src/types/domain.ts'

/** Las categorías de un local, sin repetir y en el orden en que aparecen sus giros. */
export function categoriasDe(place: Place, categoryOfGiro: Map<string, Category>): Category[] {
  const vistas = new Set<string>()
  const resultado: Category[] = []
  for (const giro of [...place.giros, ...(place.secundarios ?? [])]) {
    const categoria = categoryOfGiro.get(giro)
    if (categoria && !vistas.has(categoria.id)) {
      vistas.add(categoria.id)
      resultado.push(categoria)
    }
  }
  return resultado
}

/** Los locales de cada categoría, en el orden del dataset. Una categoría sin locales no aparece. */
export function lugaresPorCategoria(
  places: readonly Place[],
  categoryOfGiro: Map<string, Category>,
): Map<string, Place[]> {
  const porCategoria = new Map<string, Place[]>()
  for (const place of places) {
    for (const categoria of categoriasDe(place, categoryOfGiro)) {
      const lista = porCategoria.get(categoria.id) ?? []
      lista.push(place)
      porCategoria.set(categoria.id, lista)
    }
  }
  return porCategoria
}

/** Un mensaje que puede venir en singular y plural ({one, other}) o ya como texto. */
export type Mensaje = string | { one: string; other: string }

export function conCantidad(mensaje: Mensaje, cantidad: number, idioma: string): string {
  const texto =
    typeof mensaje === 'string'
      ? mensaje
      : new Intl.PluralRules(idioma).select(cantidad) === 'one'
        ? mensaje.one
        : mensaje.other
  return texto.replace(/\{count\}/g, String(cantidad))
}

/** "A, B y C" / "A, B, and C", en el idioma de la página. */
export function lista(nombres: readonly string[], idioma: string): string {
  return new Intl.ListFormat(idioma, { style: 'long', type: 'conjunction' }).format(nombres)
}

/** Un giro con un solo local no representa a la categoría: no se nombra en el título. */
export const MIN_LOCALES_POR_GIRO = 2

const sinAcentos = (valor: string): string =>
  valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Los giros que de verdad hay en una categoría, de más a menos locales, sin los que la etiqueta ya
 * dice. Sirve para que el título nombre lo que la gente busca ("hamburguesas", "alitas") cuando la
 * etiqueta de la interfaz es más general ("Comida Rápida"). Todo sale de los datos.
 */
export function girosDeCategoria(
  categoria: Category,
  places: readonly Place[],
  idioma: 'es' | 'en',
): string[] {
  const etiqueta = sinAcentos(categoria.label[idioma] ?? categoria.label.es)
  const cuenta = new Map<string, number>()
  for (const place of places) {
    for (const giro of new Set([...place.giros, ...(place.secundarios ?? [])])) {
      cuenta.set(giro, (cuenta.get(giro) ?? 0) + 1)
    }
  }
  return categoria.giros
    .map((giro, orden) => ({
      texto: giro.label[idioma] ?? giro.label.es,
      veces: cuenta.get(giro.id) ?? 0,
      orden,
    }))
    .filter(({ texto, veces }) => {
      const normal = sinAcentos(texto)
      return (
        veces >= MIN_LOCALES_POR_GIRO && !etiqueta.includes(normal) && !normal.includes(etiqueta)
      )
    })
    .sort((a, b) => b.veces - a.veces || a.orden - b.orden)
    .map(({ texto }) => texto.toLocaleLowerCase(idioma))
}
