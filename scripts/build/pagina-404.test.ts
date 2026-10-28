import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CONTENT_SECURITY_POLICY } from '../../vite.config.ts'
import { HUELLA_ESTILO_404, html404 } from './pagina-404.ts'

const html = html404('/')
const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
const huellaReal = `'sha256-${createHash('sha256').update(estilo, 'utf8').digest('base64')}'`

describe('la página 404', () => {
  it('trae su estilo en línea, que es lo que la hace no depender de nada', () => {
    expect(estilo.length).toBeGreaterThan(100)
    expect(html).not.toContain('<link rel="stylesheet"')
  })

  it('la huella que se publica es la del bloque de verdad', () => {
    // Un carácter de diferencia entre el bloque y su huella y el navegador bloquea el estilo entero.
    expect(HUELLA_ESTILO_404).toBe(huellaReal)
  })

  it('la política del sitio admite ese bloque', () => {
    /*
     * La que de verdad importa, y la que faltaba.
     *
     * El sitio sirve una cabecera `Content-Security-Policy` y la página lleva su propio `<meta>`.
     * Cuando hay dos, el navegador aplica **las dos**, así que con `style-src 'self'` en la
     * cabecera la 404 salió publicada sin una sola regla aplicada: serif del sistema y enlace
     * morado. No lo vio nadie porque `vite preview` no sirve `_headers`, así que en local solo
     * existía el `<meta>` permisivo y se veía bien, y el E2E del 404 comprueba el código de estado.
     */
    expect(CONTENT_SECURITY_POLICY).toContain(huellaReal)
  })

  it('su propia política admite ese bloque, para un hosting sin cabeceras', () => {
    const meta = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1] ?? ''
    expect(meta).toContain(huellaReal)
  })

  it('ninguna de las dos recurre a `unsafe-inline`', () => {
    const meta = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1] ?? ''
    expect(meta).not.toContain('unsafe-inline')
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-inline')
  })

  it('respeta la base para publicar en un subdirectorio', () => {
    const enSubruta = html404('/visit-zibata/')
    expect(enSubruta).toContain('href="/visit-zibata/es"')
    expect(enSubruta).toContain('src="/visit-zibata/logo.svg"')
  })

  it('no se indexa, y habla en los dos idiomas', () => {
    expect(html).toContain('name="robots" content="noindex"')
    expect(html).toContain(
      'This page doesn’t exist. The address doesn’t match any place or area in the guide: it may be mistyped, or that place may no longer be listed.',
    )
  })
})
