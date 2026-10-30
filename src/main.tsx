import './styles/fonts.css'
// Solo para la firma de autoría: la guía de marca de aurariola.com pide esta monoespaciada para su
// wordmark, y es lo único del proyecto que la usa.
import '@fontsource/kode-mono/600.css'
import './styles/tokens.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import { AppErrorBoundary } from './app/AppErrorBoundary.tsx'
import { cargarIdioma, locale } from './i18n/index.ts'
import { iniciarMedicion } from './lib/eventos.ts'

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el elemento #root')

// El idioma del documento sigue al idioma activo: lo usan lectores de pantalla y el propio navegador.
document.documentElement.lang = locale

// Los eventos de uso salen juntos cuando la pestaña se oculta (ver lib/eventos.ts).
iniciarMedicion()

/*
 * Se espera al catálogo antes de pintar. Desde que cada idioma viaja por su cuenta, el inglés llega
 * en su propia petición; sin esta espera, quien abre `/en/place/x` vería un primer fotograma en
 * español. El español ya está en el paquete, así que para la mayoría esto no espera a nada.
 *
 * Si el idioma no llega, se pinta igual en español: dejar la página en blanco por una traducción es
 * peor que enseñarla en el idioma equivocado. Y el árbol va dentro de una red que convierte cualquier
 * fallo de render en un mensaje con botón de recargar (ver AppErrorBoundary).
 *
 * Encadenado y no con `await` de nivel superior: ese `await` vuelve asíncrono el módulo de entrada y
 * Rollup reparte el código de otra manera, con más fragmentos iniciales y más CSS por delante.
 * Medido: el paquete inicial no bajaba y el CSS pasaba de 9,8 a 10,7 KB.
 */
void cargarIdioma(locale)
  .catch((error: unknown) => console.error('[idioma]', error))
  .then(() => {
    createRoot(root).render(
      <StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </StrictMode>,
    )
  })
