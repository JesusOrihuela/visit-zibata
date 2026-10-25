import { CatalogProvider } from '../data/CatalogContext.tsx'
import { StaticPlacesRepository } from '../data/StaticPlacesRepository.ts'
import { cargarSenales, registrarSenales } from '../features/favorites/senales.ts'
import { parsePath } from '../lib/url-state.ts'
import { AppStateProvider } from './AppStateContext.tsx'
import { Experience } from './Experience.tsx'
import { initialAppState } from './state.ts'

/** Punto de composición: aquí se elige la implementación del repositorio de datos. */
const repository = new StaticPlacesRepository()

/*
 * Las señales de la comunidad, fuera del render y sin esperar a nadie.
 *
 * Se registra la fuente de inmediato (para que la ficha y el orden sepan a quién preguntar) y se
 * piden las señales en paralelo. Mientras no lleguen, `SocialStats` no dibuja nada y el orden es el
 * de siempre: ningún hueco, ningún esqueleto, ningún "0 corazones".
 */
registrarSenales()
void cargarSenales()

/*
 * La hoja inferior arranca expandida si la URL es de una ficha. Si esperásemos al catálogo para
 * aplicar la ruta, la hoja ya estaría montada colapsada y el cambio a expandida animaría el alto
 * después del primer pintado, lo que Lighthouse cuenta como CLS.
 */
const initialSheetExpanded =
  typeof window !== 'undefined' &&
  Boolean(
    parsePath(window.location.pathname, window.location.search, import.meta.env.BASE_URL).placeSlug,
  )

const initialState = {
  ...initialAppState,
  sheetExpanded: initialSheetExpanded,
}

export function App() {
  return (
    <CatalogProvider repository={repository}>
      <AppStateProvider initialState={initialState}>
        <Experience />
      </AppStateProvider>
    </CatalogProvider>
  )
}
