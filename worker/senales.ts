/**
 * Lo que la comunidad dice de cada lugar, calculado aquí y no en el navegador.
 *
 * Dos cosas salen de este módulo, y la diferencia entre ellas es la decisión de diseño que lo
 * explica todo:
 *
 *  - **Los corazones**, en crudo, porque la ficha los enseña ("12 personas lo guardaron").
 *  - **El empuje**, un número de 0 a 1 que usa el orden personal. Dentro lleva los corazones y la
 *    media de estrellas ya mezclados y ya calibrados. **La media nunca sale de aquí.** No es que la
 *    interfaz decida no enseñarla: es que no la recibe, así que no puede. Taparla en un componente
 *    habría sido una promesa; no enviarla es un hecho que no depende de que nadie se acuerde.
 *
 * El empuje solo suma. Con 101 locales y pocos votos, tres votos malintencionados hundirían a un
 * negocio que no puede verlo ni rebatirlo, porque la media no se publica. Con el tope en cero, una
 * brigada queda reducida a un empujón: puede promover algo inmerecido, que hace menos daño y se nota
 * antes, pero no puede usarse como arma.
 *
 * ## Por qué todo se calibra contra el propio catálogo
 *
 * La versión anterior llevaba tres constantes escritas a mano (dividir entre 25, confianza a los 20
 * votos, centro en 3,5 estrellas) y las tres fallaban en los dos extremos. Con cincuenta personas
 * usando la guía, ningún lugar llega a 25 corazones y la señal vale cero; con cinco mil, todo se
 * satura y deja de distinguir. Y el 3,5 era peor, porque las notas de consumo se amontonan en 4 y 5:
 * casi todo el catálogo habría quedado por encima del centro y el término se habría vuelto una
 * constante que sube a todos por igual.
 *
 * Ahora las tres salen de los datos que ya hay que leer: el divisor de corazones es el percentil 75
 * de los conteos, el centro de las notas es la media del catálogo y la escala es su desviación. La
 * señal significa lo mismo con cincuenta personas que con cinco mil, sin tocar nada.
 */

/**
 * Votos que hacen falta para que la nota de un lugar mande sobre la del catálogo.
 *
 * Es el único número a mano que queda, y es una decisión de política, no una escala: dice cuánta
 * desconfianza se le tiene a una media de tres votos. Con 10, una nota de 5,0 con tres votos pesa
 * como un 4,0 largo, y con treinta votos ya manda ella.
 */
const VOTOS_DE_REFERENCIA = 10

export interface FilaCorazones {
  lugar: string
  cuantos: number
}

export interface FilaNotas {
  lugar: string
  votos: number
  media: number
}

export interface Senal {
  /** Para la ficha: personas que lo guardaron, desde la primera. */
  corazones?: number
  /** Para el orden personal, de 0 a 1. Lleva corazones y notas dentro, ya calibrados. */
  empuje: number
}

/** El percentil 75 de una lista, o 1 si no hay con qué. Es el divisor que normaliza los corazones. */
export function percentil75(valores: number[]): number {
  if (valores.length === 0) return 1
  const orden = [...valores].sort((a, b) => a - b)
  const posicion = Math.min(orden.length - 1, Math.floor(orden.length * 0.75))
  return Math.max(1, orden[posicion] ?? 1)
}

/** Media y desviación de una lista. La desviación nunca baja de 0,25, para no dividir por casi cero. */
export function dispersion(valores: number[]): { media: number; desviacion: number } {
  if (valores.length === 0) return { media: 0, desviacion: 1 }
  const media = valores.reduce((suma, valor) => suma + valor, 0) / valores.length
  const varianza = valores.reduce((suma, valor) => suma + (valor - media) ** 2, 0) / valores.length
  return { media, desviacion: Math.max(0.25, Math.sqrt(varianza)) }
}

/**
 * Las señales de todos los lugares a partir de lo que devuelve la base.
 *
 * Función pura: recibe filas y devuelve números. Así se puede probar entera sin levantar un Worker
 * ni una base, que es lo que hace falta para fijar una aritmética con esta responsabilidad.
 */
export function senalesDe(corazones: FilaCorazones[], notas: FilaNotas[]): Record<string, Senal> {
  const divisor = percentil75(corazones.map((fila) => fila.cuantos))
  // La media del catálogo se pondera por votos: un lugar con treinta notas dice más de cómo califica
  // esta comunidad que uno con una sola.
  const votosTotales = notas.reduce((suma, fila) => suma + fila.votos, 0)
  const mediaDelCatalogo =
    votosTotales > 0
      ? notas.reduce((suma, fila) => suma + fila.media * fila.votos, 0) / votosTotales
      : 0
  const { desviacion } = dispersion(notas.map((fila) => fila.media))

  const senales: Record<string, Senal> = {}
  const deLugar = (lugar: string): Senal => {
    const previa = senales[lugar]
    if (previa) return previa
    const nueva: Senal = { empuje: 0 }
    senales[lugar] = nueva
    return nueva
  }

  for (const fila of corazones) {
    const senal = deLugar(fila.lugar)
    /*
     * Sin suelo: la ficha enseña el número desde el primer corazón. Antes había un umbral de cinco
     * para no delatar a quien guardaba un local casi vacío, pero con un catálogo de pocos movimientos
     * dejaba la ficha muda justo cuando el dato más importa. La edad mínima de la cuenta sigue siendo
     * la única regla que filtra el conteo.
     */
    senal.corazones = fila.cuantos
    senal.empuje += 0.5 * Math.tanh(fila.cuantos / divisor)
  }

  for (const fila of notas) {
    if (votosTotales === 0) break
    /*
     * Media bayesiana: la nota de un lugar se mezcla con la del catálogo en proporción a cuántos
     * votos la sostienen. Es la media ponderada de IMDb, y sustituye de una vez al factor de
     * confianza y al centro fijo que había antes. Una nota de 5,0 con dos votos apenas se mueve de
     * la media; con cincuenta, manda ella.
     */
    const ajustada =
      (fila.votos * fila.media + VOTOS_DE_REFERENCIA * mediaDelCatalogo) /
      (fila.votos + VOTOS_DE_REFERENCIA)
    const sobreLaMedia = Math.max(0, Math.tanh((ajustada - mediaDelCatalogo) / desviacion))
    deLugar(fila.lugar).empuje += 0.5 * sobreLaMedia
  }

  return senales
}

/**
 * Los corazones que pasan la edad mínima. La regla vive en el SQL y no en la interfaz, para que no
 * haya forma de pedirle al servidor un corazón que todavía no cuenta.
 */
export const CONTEO_CORAZONES = `
SELECT f.lugar_id AS lugar, COUNT(*) AS cuantos
  FROM favorito f
  JOIN cuenta c ON c.id = f.cuenta_id
 WHERE c.creada <= ?
 GROUP BY f.lugar_id
`.trim()

/** Las notas que pasan la edad mínima, agregadas. Nunca se devuelven tal cual. */
export const CONTEO_NOTAS = `
SELECT n.lugar_id AS lugar, COUNT(*) AS votos, AVG(n.estrellas) AS media
  FROM calificacion n
  JOIN cuenta c ON c.id = n.cuenta_id
 WHERE c.creada <= ?
 GROUP BY n.lugar_id
`.trim()
