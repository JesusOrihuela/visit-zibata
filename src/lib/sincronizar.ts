/**
 * El canal por el que lo que marca una persona llega a su cuenta.
 *
 * Tres cosas lo usan (favoritos, calificaciones y visitas) y las tres se comportan igual, que es lo
 * que vale la pena fijar en un solo sitio:
 *
 *  - **Nunca bloquea el gesto.** Lo que la persona hizo ya está guardado en su dispositivo antes de
 *    que esto empiece; el envío va detrás y no lo espera nadie.
 *  - **Nunca anuncia un fallo.** Si no hay red, si no hay cuenta o si el servidor responde mal, lo
 *    local sigue intacto y lo único que se pierde es que cuente fuera de este dispositivo. Avisar de
 *    eso con un cartel sería alarmar por algo que no le impide nada a nadie.
 *  - **Nunca crea cuenta por su cuenta.** La crea `cabecerasDeCuenta` solo cuando hace falta, que es
 *    la primera vez que hay algo que guardar fuera (ver lib/cuenta.ts).
 */
import { cabecerasDeCuenta } from './cuenta.ts'

/** Manda un cambio a la API. No devuelve nada porque no hay nada que hacer con el resultado. */
export function enviar(ruta: string, cuerpo: unknown): void {
  void (async () => {
    try {
      const cabeceras = await cabecerasDeCuenta()
      if (!cabeceras) return
      await fetch(ruta, {
        method: 'POST',
        headers: { ...cabeceras, 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
    } catch {
      // Lo marcado ya está en este dispositivo. Lo único que se pierde es que salga de él.
    }
  })()
}
