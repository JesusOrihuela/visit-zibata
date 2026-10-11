import { CatalogProvider } from '../data/CatalogContext.tsx'
import { StaticPlacesRepository } from '../data/StaticPlacesRepository.ts'
import { cargarSenales, registrarSenales } from '../features/favorites/senales.ts'
import { AppStateProvider } from './AppStateContext.tsx'
import { Experience } from './Experience.tsx'

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

export function App() {
  return (
    <CatalogProvider repository={repository}>
      <AppStateProvider>
        <Experience />
      </AppStateProvider>
    </CatalogProvider>
  )
}
