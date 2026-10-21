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
