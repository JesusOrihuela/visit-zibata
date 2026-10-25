/**
 * Búsqueda del lado del cliente con Fuse.js: tolera errores menores de escritura, ignora acentos y
 * usa los sinónimos definidos en categories.json ("cafe" → café, cafetería, coffee).
 * Consultas de varias palabras exigen que cada palabra coincida ("tacos zielo").
 * Si una palabra aparece literalmente al inicio de alguna palabra de un lugar, solo cuentan esas coincidencias
 * ("pasta" no trae "pastor", "bar" no trae "parrilla" ni "barista"... salvo que no haya ninguna al inicio: entonces
 * cuentan las que la contienen ("ron" → "camarón"), y la tolerancia a errores solo cuando no hay ninguna literal.
 */
import Fuse, { type IFuseOptions } from 'fuse.js'
import { localized } from '../../i18n/index.ts'
import { searchTerms, wordText } from '../../lib/text.ts'
import type { Catalog, Place } from '../../types/domain.ts'
import { allGiroIds } from '../places/placeIcon.ts'

interface SearchDocument {
  id: string
  name: string
  plaza: string
  category: string
  categorySynonyms: string[]
  giros: string
  giroSynonyms: string[]
  description: string
}

const OPTIONS: IFuseOptions<SearchDocument> = {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'category', weight: 1.6 },
    { name: 'giros', weight: 1.4 },
    { name: 'plaza', weight: 1.2 },
    { name: 'categorySynonyms', weight: 1.1 },
    { name: 'giroSynonyms', weight: 1 },
    { name: 'description', weight: 0.4 },
  ],
  ignoreDiacritics: true,
  ignoreLocation: true,
  includeScore: true,
  threshold: 0.34,
  minMatchCharLength: 2,
}

export interface SearchIndex {
  /** IDs de lugares ordenados por relevancia; `null` si la consulta está vacía. */
  search(query: string): string[] | null
}

function toDocument(place: Place, catalog: Catalog): SearchDocument {
  // Todos los giros del local se buscan, principales y secundarios, no solo el primero: "pizza"
  // encuentra a la parrilla que hace pizzas. Y con ellos, sus categorías: "italiana" encuentra las
  // pizzerías.
  const ids = allGiroIds(place)
  const giros = ids.map((id) => catalog.giroById.get(id)).filter((giro) => giro !== undefined)
  const categorias = [
    ...new Set(ids.map((id) => catalog.categoryOfGiro.get(id)).filter((c) => c !== undefined)),
  ]
  return {
    id: place.id,
    name: place.name,
    plaza: catalog.plazaById.get(place.plazaId)?.name ?? '',
    category: categorias.map((c) => localized(c.label)).join(' '),
    categorySynonyms: categorias.flatMap((c) => c.synonyms),
    giros: giros.map((giro) => localized(giro.label)).join(' '),
    giroSynonyms: giros.flatMap((giro) => giro.synonyms),
    description: [place.description?.es, place.description?.en].filter(Boolean).join(' '),
  }
}

/**
 * Posición de un giro que no coincide con la búsqueda. Va después de cualquier giro real, sin
 * importar cuántos tenga el local: un número fijo y no la cuenta de giros, que si no un local con
 * cinco etiquetas quedaría detrás de uno con dos por el simple hecho de tener más.
 */
const SIN_GIRO = 99

export function createSearchIndex(catalog: Catalog): SearchIndex {
  const documents = catalog.places.map((place) => toDocument(place, catalog))
  const fuse = new Fuse(documents, OPTIONS)
  /*
   * La etiqueta de cada giro de un local, en su orden, como texto normalizado. El orden es la
   * prioridad: quien busca "café" ve primero los locales cuyo primer giro es Café, después los que
   * lo tienen de segundo y después los de tercero. Es el mismo orden que enseña la tarjeta, así que
   * la lista se lee igual que la ficha y no hay que adivinar por qué un local salió antes que otro.
   *
   * Solo la etiqueta, no los sinónimos. Un sinónimo nombra a veces a otro giro ("pan y café" es un
   * sinónimo de Brunch), y contarlo hacía que un local con Brunch de primer giro empatara con uno
   * que de verdad lleva Café. El sinónimo sigue sirviendo para encontrar; lo que no hace es decidir
   * la posición.
   */
  const giroText = new Map(
    catalog.places.map((place) => [
      place.id,
      allGiroIds(place).map((id) => {
        const giro = catalog.giroById.get(id)
        return giro ? wordText(localized(giro.label)) : ''
      }),
    ]),
  )
  /** Posición del primer giro que coincide con algún término; `SIN_GIRO` si ninguno lo hace. */
  const positionOfGiro = (id: string, terms: string[]): number => {
    const textos = giroText.get(id) ?? []
    for (const [index, texto] of textos.entries()) {
      // Inicio de palabra primero y subcadena después, igual que la búsqueda: "ron" cae en "camarón".
      if (terms.some((term) => texto.includes(` ${term}`) || texto.includes(term))) return index
    }
    return SIN_GIRO
  }
  // Palabras normalizadas de cada lugar para reconocer coincidencias literales por inicio de palabra.
  const literalText = new Map(
    documents.map((doc) => [
      doc.id,
      wordText(
        [
          doc.name,
          doc.plaza,
          doc.category,
          doc.giros,
          ...doc.categorySynonyms,
          ...doc.giroSynonyms,
          doc.description,
        ].join(' | '),
      ),
    ]),
  )
  // Cada cambio de filtros consulta el índice varias veces con la misma búsqueda (resultados y conteos por
  // categoría): se reutiliza el último resultado.
  let last: { key: string; result: string[] | null } | null = null
  return {
    search(query) {
      const terms = searchTerms(query)
      const key = terms.join(' ')
      if (last?.key === key) return last.result
      const result = rank(terms)
      last = { key, result }
      return result
    },
  }

  function rank(terms: string[]): string[] | null {
    if (terms.length === 0) return null

    // Cada término aporta su puntuación; un lugar debe coincidir con todos.
    let scores: Map<string, number> | null = null
    for (const term of terms) {
      const results = fuse.search(term)
      // Prioridad: inicio de palabra ("bar" → "Golf Bar"), luego dentro de palabra ("ron" → "camarón"),
      // y solo si no hay ninguna literal, la coincidencia aproximada de Fuse.
      const prefix = wordText(term)
      const inside = prefix.trim()
      const atWordStart = results.filter((r) => literalText.get(r.item.id)?.includes(prefix))
      const withinWord = results.filter((r) => literalText.get(r.item.id)?.includes(inside))
      const chosen =
        atWordStart.length > 0 ? atWordStart : withinWord.length > 0 ? withinWord : results
      const current = new Map<string, number>()
      for (const result of chosen) {
        current.set(result.item.id, result.score ?? 1)
      }
      if (scores === null) {
        scores = current
      } else {
        const previous: Map<string, number> = scores
        scores = new Map(
          [...current]
            .filter(([id]) => previous.has(id))
            .map(([id, score]) => [id, score + (previous.get(id) ?? 0)]),
        )
      }
    }
    /*
     * Dos criterios, en este orden: primero la posición del giro que coincide (el primero manda) y
     * después la puntuación de Fuse, que sigue decidiendo entre locales empatados en posición. Sin
     * esto la lista quedaba en el orden en que Fuse los devolvía, que mezcla un local cuyo primer
     * giro es Café con otro que solo lo menciona en la descripción.
     */
    return [...(scores ?? new Map<string, number>())]
      .map(([id, score]) => ({ id, score, giro: positionOfGiro(id, terms) }))
      .sort((a, b) => a.giro - b.giro || a.score - b.score)
      .map((entry) => entry.id)
  }
}
