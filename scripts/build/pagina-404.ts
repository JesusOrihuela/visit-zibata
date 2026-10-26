/**
 * La página que se sirve cuando una dirección no existe.
 *
 * Vive aquí y no dentro de `vite.config.ts` por una razón concreta: su hoja de estilo va en línea, y
 * eso obliga a que la política de seguridad del sitio la permita por huella. Las dos cosas (el HTML
 * y la huella) tienen que salir del mismo sitio o se separan, que es exactamente lo que pasó.
 *
 * ## Qué se rompió
 *
 * La página llevaba su propio `<meta>` con `style-src 'unsafe-inline'`, y el sitio entero sirve una
 * cabecera `Content-Security-Policy` con `style-src 'self'`. **Cuando hay dos políticas, el
 * navegador aplica las dos**, así que la intersección prohibía el estilo en línea y la página salía
 * publicada sin una sola regla aplicada: serif del sistema, enlace morado, nada de la marca.
 *
 * No lo detectó nada porque `vite preview` no sirve `_headers`: en local solo existía el `<meta>`
 * permisivo y se veía bien. La prueba E2E del 404 comprobaba el código de estado, no el aspecto.
 *
 * ## Cómo se arregla
 *
 * Con la huella SHA-256 del bloque de estilo, en las dos políticas. No hace falta `'unsafe-inline'`
 * en ninguna: solo se permite exactamente este bloque y nada más. Y sigue sin depender de que
 * cargue otro archivo, que es la razón por la que el estilo va en línea en una página de error.
 */
import { createHash } from 'node:crypto'

/**
 * El estilo de la página, en línea a propósito.
 *
 * La familia "Special Gothic" se nombra pero no se carga: es la de la guía y viaja con huella en el
 * nombre, así que aquí se usa solo si el navegador ya la tiene y si no cae a las del sistema. Una
 * página de error no debe esperar a una descarga.
 */
const ESTILO = `
      :root { --olivo: #536c2a; --tinta: #1f2419; --apagado: #62655a; --papel: #f8f4ed; }
      * { box-sizing: border-box; margin: 0; }
      body { min-height: 100svh; display: grid; place-items: center; padding: 1.5rem;
        background: var(--papel); color: var(--tinta); text-align: center;
        font: 1rem/1.55 "Special Gothic", ui-sans-serif, system-ui, sans-serif; }
      /* La misma trama de puntos del resto de la marca, muy tenue. */
      body::before { content: ""; position: fixed; inset: 0; pointer-events: none;
        background-image: radial-gradient(var(--olivo) 1px, transparent 1px);
        background-size: 26px 26px; opacity: .07; }
      main { position: relative; max-width: 30rem; display: grid; justify-items: center; gap: .75rem; }
      img { width: 72px; height: 72px; }
      h1 { font-family: "Special Gothic", ui-sans-serif, system-ui, sans-serif; font-weight: 700;
        font-size: 1.875rem; line-height: 1.15; letter-spacing: -.02em; margin-top: .5rem; }
      p { color: var(--apagado); }
      .en { font-size: .875rem; }
      /* Botón principal del catálogo de interactuables (docs/CATALOGO.md): esquina de 6, relleno de
         olivo, hover a olivo oscuro. Los valores van a mano y no por token porque esta página se
         sirve sola, sin la hoja de la guía, y tiene que pintarse aunque no cargue nada más. */
      a { margin-top: 1.25rem; padding: .75rem 1.5rem; border-radius: 6px;
        background: var(--olivo); color: #fff; font-weight: 600; text-decoration: none; }
      a:hover { background: #435a22; }
      a:focus-visible { outline: 2.5px solid #3d6b00; outline-offset: 2px; }
      @media (prefers-reduced-motion: no-preference) { a { transition: background-color .15s; } }
    `

/**
 * La huella del bloque, tal como la calcula un navegador: sobre el contenido exacto entre las
 * etiquetas, sin incluirlas. Un carácter de diferencia y el estilo queda bloqueado, así que el HTML
 * de abajo interpola esta misma constante en vez de repetirla.
 */
export const HUELLA_ESTILO_404 = `'sha256-${createHash('sha256').update(ESTILO, 'utf8').digest('base64')}'`

/** La política propia de la página, para un hosting que no sirva cabeceras. */
const CSP_404 = `default-src 'self'; style-src ${HUELLA_ESTILO_404}; img-src 'self'`

/**
 * El HTML completo. `base` permite publicar en un subdirectorio.
 *
 * Va en los dos idiomas, porque una ruta que no existe no dice en cuál estaba la persona.
 */
export function html404(base: string): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex" />
    <title>Página no encontrada · Visit Zibatá</title>
    <link rel="icon" type="image/svg+xml" href="${base}favicon.svg" />
    <meta http-equiv="Content-Security-Policy" content="${CSP_404}" />
    <style>${ESTILO}</style>
  </head>
  <body>
    <main>
      <img src="${base}logo.svg" alt="" width="72" height="72" />
      <h1>Esta página no existe</h1>
      <p>La dirección no corresponde a ningún lugar ni zona de la guía. Puede que esté mal escrita, o que ese lugar ya no esté publicado.</p>
      <p class="en" lang="en">This page doesn’t exist. The address doesn’t match any place or area in the guide: it may be mistyped, or that place may no longer be listed.</p>
      <a href="${base}">Ir a la guía</a>
    </main>
  </body>
</html>
`
}
