/**
 * El panel privado: los números de la guía, para quien la mantiene.
 *
 * ## Por qué ahora sí hay una página con estos datos
 *
 * El proyecto decía que no habría panel "porque una página que muestre estos números habría que
 * protegerla, y proteger algo es justo el trabajo que este proyecto no quiere tener". La objeción
 * era buena y dejó de aplicar: con Cloudflare Access la protección es una regla en un panel, no
 * código nuestro. Nadie escribe aquí un inicio de sesión, ni guarda contraseñas, ni mantiene
 * sesiones. Lo que llega al Worker ya pasó por esa puerta.
 *
 * ## Cómo se protege
 *
 * Access se pone delante de `/panel` y de `/api/panel`, y a lo que deja pasar le añade un testigo
 * firmado en la cabecera `Cf-Access-Jwt-Assertion`. La firma se verifica en `worker/acceso.ts`, que
 * explica por qué mirar solo que la cabecera exista no bastaba.
 *
 * ## Qué no enseña
 *
 * La media de estrellas, igual que no la enseña nadie. Podría discutirse (quien mantiene la guía no
 * es el público), pero la regla de que la media no sale del servidor vale más entera que con una
 * excepción, y una excepción aquí sería justo la que alguien copiaría mañana. Lo que sí sale es
 * cuántas notas hay y el empuje que producen.
 */

/** Cuántos días mira el panel. Se pide por `?dias=`, con un tope para no barrer la tabla entera. */
export function diasDe(url: URL): number {
  // El valor crudo antes de `Number`: sin parámetro, `get` devuelve null y `Number(null)` es 0, que
  // es finito y se habría quedado en un día. Lo cazo una prueba.
  const crudo = url.searchParams.get('dias')
  if (!crudo) return 30
  const pedidos = Number(crudo)
  if (!Number.isFinite(pedidos)) return 30
  return Math.min(365, Math.max(1, Math.trunc(pedidos)))
}

/** La fecha desde la que se mira, en el formato de la columna. `dias` incluye hoy. */
export function desdeHace(dias: number, ahora = new Date()): string {
  const limite = new Date(ahora.getTime() - (dias - 1) * 24 * 60 * 60 * 1000)
  return limite.toISOString().slice(0, 10)
}

/**
 * Si la petición la escribió una página de este mismo sitio.
 *
 * La cookie de Access viaja sola en cuanto la persona inició sesión, así que sin esta comprobación
 * cualquier página de fuera podría hacer que su navegador marcase sugerencias como atendidas. Lo que
 * la frena es `Sec-Fetch-Site`, que pone el navegador y una página no puede falsificar; y para quien
 * no lo mande, se compara el `Origin` con el host. Sin ninguno de los dos, se niega: adivinar aquí no
 * aporta nada.
 */
export function origenPropio(peticion: Request): boolean {
  const sitio = peticion.headers.get('sec-fetch-site')
  if (sitio) return sitio === 'same-origin' || sitio === 'none'
  const origen = peticion.headers.get('origin')
  if (!origen) return false
  try {
    return new URL(origen).host === new URL(peticion.url).host
  } catch {
    return false
  }
}

export const RESUMEN = `
SELECT
  (SELECT COALESCE(SUM(cuenta), 0) FROM visitas WHERE fecha >= ?1)        AS visitas,
  (SELECT COUNT(DISTINCT ruta) FROM visitas WHERE fecha >= ?1)            AS paginas,
  (SELECT COALESCE(SUM(cuenta), 0) FROM comparticiones WHERE fecha >= ?1) AS comparticiones,
  (SELECT COUNT(*) FROM cuenta)                                           AS cuentas,
  (SELECT COUNT(*) FROM favorito)                                         AS corazones,
  (SELECT COUNT(*) FROM calificacion)                                     AS notas,
  (SELECT COUNT(*) FROM visita_marcada)                                   AS visitasMarcadas
`.trim()

export const POR_DIA = `
SELECT fecha, SUM(cuenta) AS visitas
  FROM visitas
 WHERE fecha >= ?
 GROUP BY fecha
 ORDER BY fecha
`.trim()

export const POR_PAGINA = `
SELECT ruta, idioma, SUM(cuenta) AS visitas
  FROM visitas
 WHERE fecha >= ?
 GROUP BY ruta, idioma
 ORDER BY visitas DESC
 LIMIT 40
`.trim()

export const POR_IDIOMA = `
SELECT idioma, SUM(cuenta) AS visitas
  FROM visitas
 WHERE fecha >= ?
 GROUP BY idioma
`.trim()

export const COMPARTIDAS = `
SELECT ruta, SUM(cuenta) AS veces
  FROM comparticiones
 WHERE fecha >= ?
 GROUP BY ruta
 ORDER BY veces DESC
 LIMIT 20
`.trim()

/**
 * Los lugares más guardados.
 *
 * Incluye los conteos chicos porque el panel sirve para ver qué empieza a moverse antes de que se
 * note en la guía. No hay a quién delatar: lo que se guarda es una cuenta sin correo ni nombre.
 */
export const MAS_GUARDADOS = `
SELECT lugar_id AS lugar, COUNT(*) AS corazones
  FROM favorito
 GROUP BY lugar_id
 ORDER BY corazones DESC
 LIMIT 40
`.trim()

/** Cuántas notas tiene cada lugar. El promedio no sale de aquí (ver la cabecera de este archivo). */
export const MAS_CALIFICADOS = `
SELECT lugar_id AS lugar, COUNT(*) AS notas
  FROM calificacion
 GROUP BY lugar_id
 ORDER BY notas DESC
 LIMIT 40
`.trim()
