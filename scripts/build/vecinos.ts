/**
 * A qué otros locales enlaza cada ficha en el HTML servido ("Más en {zona}").
 *
 * ## Qué resuelve
 *
 * El bloque listaba los **primeros 8** locales de la zona **en el orden del dataset**. En una zona de
 * 24 o 25 locales eso significa que los mismos ocho recibían el enlace de todos los demás y el resto
 * solo tenía el de su zona: 37 de las 101 fichas tenían un único enlace entrante. Todas están a dos
 * clics de la portada, así que ninguna es huérfana, pero la señal interna iba toda a las mismas.
 *
 * ## Cómo se reparte
 *
 * Solo cambia cuando la zona tiene **más de 8 vecinos posibles** (más de 9 locales): si caben todos,
 * se enlazan todos y en el mismo orden de siempre. Cuando no caben, cada ficha elige 8 con este
 * criterio, en este orden:
 *
 *  1. el vecino que **menos enlaces entrantes lleva** hasta ese momento (reparte la señal);
 *  2. a igualdad, el que **comparte alguna categoría** con la ficha (el más relacionado);
 *  3. a igualdad, el primero del dataset (para que sea determinista).
 *
 * Solo depende de los ids, las zonas y las categorías, no del idioma: la ficha en español y la
 * inglesa enlazan a los mismos locales.
 *
 * Esto es el bloque que ya existía en el HTML servido: no añade enlaces nuevos ni toca la interfaz.
 */

/** Cuántos vecinos lista una ficha. */
export const MAX_VECINOS = 8

export interface Local {
  id: string
  plazaId: string
  /** Los ids de las categorías en las que aparece el local (de todos sus giros). */
  categorias: string[]
}

/** Los ids de los vecinos de cada local, en el orden en que se listan. */
export function repartirVecinos(locales: Local[], max = MAX_VECINOS): Map<string, string[]> {
  const orden = new Map(locales.map((local, indice) => [local.id, indice]))
  const porZona = new Map<string, Local[]>()
  for (const local of locales) {
    porZona.set(local.plazaId, [...(porZona.get(local.plazaId) ?? []), local])
  }

  const vecinos = new Map<string, string[]>()
  for (const zona of porZona.values()) {
    const entrantes = new Map(zona.map((local) => [local.id, 0]))
    for (const local of zona) {
      const otros = zona.filter((otro) => otro.id !== local.id)
      if (otros.length <= max) {
        vecinos.set(
          local.id,
          otros.map((otro) => otro.id),
        )
        continue
      }
      const comparte = (otro: Local) => otro.categorias.some((c) => local.categorias.includes(c))
      const elegidos = [...otros]
        .sort(
          (a, b) =>
            (entrantes.get(a.id) ?? 0) - (entrantes.get(b.id) ?? 0) ||
            Number(comparte(b)) - Number(comparte(a)) ||
            (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0),
        )
        .slice(0, max)
      for (const elegido of elegidos)
        entrantes.set(elegido.id, (entrantes.get(elegido.id) ?? 0) + 1)
      // Se listan los de su categoría primero y, dentro de cada grupo, en el orden del dataset.
      elegidos.sort(
        (a, b) =>
          Number(comparte(b)) - Number(comparte(a)) ||
          (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0),
      )
      vecinos.set(
        local.id,
        elegidos.map((elegido) => elegido.id),
      )
    }
  }
  return vecinos
}
