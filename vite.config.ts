import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }
import { mapTiles } from './scripts/build/map-tiles.ts'
import { HUELLA_ESTILO_404, html404 } from './scripts/build/pagina-404.ts'
import { prerender } from './scripts/build/prerender.ts'
import { APP_ROUTE } from './src/lib/url-state.ts'

// BASE_PATH permite publicar en un subdirectorio (GitHub Pages: "/<repo>/") sin acoplar el código a
// un hosting concreto. En local y en hostings en raíz es "/".
const base = process.env.BASE_PATH ?? '/'
// SITE_URL (opcional): URL pública absoluta, para que Open Graph use enlaces absolutos a la imagen.
const siteUrl = process.env.SITE_URL?.replace(/\/?$/, '/')

/** Open Graph exige URLs absolutas; sin SITE_URL se usan rutas relativas a la base. */
function socialMeta(): Plugin {
  return {
    name: 'zibata-social-meta',
    transformIndexHtml: {
      // Después del procesamiento de Vite, que ya antepone la base a la imagen.
      order: 'post',
      handler(html) {
        const prefix = siteUrl ?? base
        let result = html.replace(
          /(property="og:image" content=")[^"]*og-image\.png"/g,
          `$1${prefix}og-image.png"`,
        )
        if (siteUrl) {
          result = result.replace(
            '<meta property="og:type"',
            `<meta property="og:url" content="${siteUrl}" />\n    <link rel="canonical" href="${siteUrl}" />\n    <meta property="og:type"`,
          )
        }
        return result
      },
    },
  }
}

/**
 * Content Security Policy en `<meta>` (GitHub Pages no permite cabeceras propias). Solo en build: el
 * servidor de desarrollo inyecta estilos en línea para HMR. **Todo es del propio origen**: sin CDN,
 * sin analítica y sin APIs externas, ni navegando ni escribiendo. Google Maps solo se abre como
 * enlace (navegación, no petición).
 * En la v4.11 hubo aquí un hueco para el desafío de Turnstile; al sustituirlo por una prueba de
 * trabajo, que no necesita a nadie de fuera, la política volvió a cerrarse (ver docs/SEGURIDAD.md).
 * `blob:`/`data:` en imágenes y workers los usa MapLibre internamente. `frame-ancestors` no se puede
 * declarar en `<meta>`: requiere cabecera del hosting (ver docs/SEGURIDAD.md).
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  /*
   * La huella del estilo en línea de la página 404, y nada más. No es `'unsafe-inline'`: permite
   * exactamente ese bloque y ningún otro.
   *
   * Tiene que estar aquí, en la política del sitio, aunque la página lleve la suya: cuando hay dos
   * políticas el navegador aplica las dos, y con `style-src 'self'` a secas la 404 salía publicada
   * sin una sola regla aplicada (ver scripts/build/pagina-404.ts).
   */
  `style-src 'self' ${HUELLA_ESTILO_404}`,
  "img-src 'self' data: blob:",
  "font-src 'self'",
  /*
   * Solo el propio origen. Desde la v4.18 no queda ningún destino externo: "Sugiere un cambio" iba
   * a Web3Forms y ahora va a nuestro servidor, así que usar la guía entera, incluido escribir, no
   * hace ni una petición fuera.
   */
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'zibata-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
        )
      },
    },
  }
}

/**
 * 404.html propio. Lo sirve el hosting cuando una ruta no existe, y desde que el enrutado salió del
 * hash eso pasa de verdad: un error de tecleo en `/lugar/...` o el enlace guardado de un local que
 * ya cerró llegan aquí. Antes era un texto suelto de cuando el proyecto no tenía identidad.
 *
 * Sin JavaScript y con el estilo en línea a propósito: es la página que aparece cuando algo falla,
 * así que no debe depender de que el resto cargue. Lo único externo es el símbolo, que es un
 * archivo del propio sitio.
 *
 * Va en los dos idiomas, porque una ruta que no existe no dice en cuál estaba la persona.
 */
function notFoundPage(): Plugin {
  let outDir = 'dist'
  return {
    name: 'zibata-404',
    // Build y preview, no desarrollo. `vite preview` resuelve la configuración como `serve`, así
    // que con `apply: 'build'` el plugin quedaba fuera y `configurePreviewServer` nunca corría.
    apply: (_config, env) => env.command === 'build' || env.isPreview === true,
    configResolved(config) {
      // `resolve` porque `outDir` puede venir relativo a la raíz del proyecto o ya absoluto.
      outDir = resolve(config.root, config.build.outDir)
    },
    /**
     * `vite preview` responde un 404 vacío en vez de servir esta página, así que sin esto la suite
     * E2E no podría comprobar lo que ve de verdad quien escribe mal un enlace.
     *
     * La función devuelta se registra justo después del middleware de reserva de Vite, que ya ha
     * traducido `/lugar/tomassa` a `/lugar/tomassa.html` si ese archivo existe, pero todavía no ha
     * respondido. Por eso "la ruta acaba en .html" equivale a "hay página": cuando no la hay, el
     * camino llega tal cual se pidió y toca contestar aquí.
     */
    configurePreviewServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return next()
          if (!req.headers.accept?.includes('text/html')) return next()
          const path = (req.url ?? '/').split('?')[0] ?? '/'
          if (path.endsWith('.html')) return next()
          const page = resolve(outDir, '404.html')
          if (!existsSync(page)) return next()
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(req.method === 'HEAD' ? undefined : readFileSync(page))
        })
      }
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '404.html', source: html404(base) })
    },
  }
}

/**
 * `_headers` para Cloudflare Pages (y Netlify, que usa el mismo formato).
 *
 * La política de seguridad sale de la MISMA constante que el `<meta>`, a propósito: cuando las dos
 * existen, el navegador aplica la intersección, así que si se tocara una y no la otra el resultado
 * sería un bloqueo difícil de diagnosticar. Se mantienen las dos porque el `<meta>` sigue haciendo
 * falta en un hosting que no sirva cabeceras, y la cabecera añade lo que un `<meta>` no puede
 * declarar: `frame-ancestors` (ver docs/SEGURIDAD.md).
 *
 * El `Cache-Control` va por tipo: los assets llevan hash en el nombre y son inmutables, mientras que
 * el HTML y el manifiesto deben revalidarse o un despliegue nuevo tardaría un día en verse. Las
 * teselas cambian solo cuando se regenera el mapa.
 */
function cloudflareHeaders(): Plugin {
  return {
    name: 'zibata-headers',
    apply: 'build',
    generateBundle() {
      const csp = `${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: `# Generado por vite.config.ts (plugin zibata-headers). No editar a mano.
/*
  Content-Security-Policy: ${csp}
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  Cross-Origin-Opener-Policy: same-origin
  # La ubicación solo se usa al pulsar el botón de centrar el mapa; lo demás se niega de raíz.
  Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/map/*
  Cache-Control: public, max-age=86400

# Las teselas se escriben en crudo para que funcionen en cualquier hosting, y es este tipo el que
# hace que el CDN las comprima: application/x-protobuf esta en la lista que Cloudflare comprime, y
# sin declararlo viajan sin comprimir y el mapa pasa de 2 a 4,2 MB. Un hosting que no lea este
# archivo sigue sirviendo el mapa, solo que mas pesado: nunca roto.
/map/tiles/*
  Content-Type: application/x-protobuf
  Cache-Control: public, max-age=86400

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/site.webmanifest
  Cache-Control: public, max-age=3600
`,
      })
    },
  }
}

/**
 * En desarrollo, las rutas de la aplicación entregan `index.html`.
 *
 * En producción existe un archivo por ruta (lo genera el prerenderizado), pero aquí no, y el modo
 * `mpa` está puesto a propósito para que un camino inventado responda 404 de verdad, como hará el
 * servidor real. Esta pasarela reconoce **solo** las rutas que la aplicación sirve, así que un
 * error de tecleo sigue dando 404 mientras se desarrolla, igual que en producción.
 */
function devRoutes(): Plugin {
  return {
    name: 'zibata-dev-routes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? '/').split('?')[0] ?? '/'
        const relative = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, '')
        if (APP_ROUTE.test(relative.replace(/\/$/, ''))) req.url = base
        next()
      })
    },
  }
}

export default defineConfig({
  base,
  define: {
    // La versión publicada se muestra en "Acerca de": sale de package.json, no de una constante a mano.
    __APP_VERSION__: JSON.stringify(pkg.version),
    // El botón de compartir necesita la misma URL pública que Open Graph: si la guía se sirve a la
    // vez desde github.io y desde el dominio propio, sin esto cada quien compartiría el enlace del
    // sitio por el que entró y los enlaces entrantes de un mismo lugar se repartirían en dos URLs.
    // Vacía en desarrollo y en los tests, donde se usa la ubicación real del navegador.
    __SITE_URL__: JSON.stringify(siteUrl ?? ''),
  },
  // Sin fallback a index.html, igual que GitHub Pages: un asset inexistente responde 404 también en
  // `vite preview` y en los tests E2E (las rutas de la app viven en el hash).
  appType: 'mpa',
  plugins: [
    react(),
    devRoutes(),
    socialMeta(),
    contentSecurityPolicy(),
    notFoundPage(),
    cloudflareHeaders(),
    prerender({ base, siteUrl }),
    mapTiles({ base }),
  ],
  build: {
    target: 'es2022',
    // MapLibre (~800 KB min) vive en su propio chunk diferido; el aviso por defecto no aporta.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    // Lógica pura en Node (rápido); los tests de componentes declaran `@vitest-environment jsdom`.
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'worker/**/*.test.ts'],
    css: false,
  },
})
