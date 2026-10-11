/**
 * Lo que dice la comunidad, de ida y de vuelta.
 *
 * **De vuelta**: `/api/senales` devuelve, por lugar, cuántas personas lo guardaron (solo si pasa el
 * umbral) y un empuje de 0 a 1 para el orden personal. El servidor ya aplicó el umbral, la edad
 * mínima y toda la calibración, así que aquí no hay reglas que repetir: lo que llega es lo que se
 * puede usar. Y lo que **no** llega, a propósito, es la media de estrellas: el empuje viene hecho
 * para que la interfaz no pueda enseñarla ni queriendo (ver worker/senales.ts).
 *
 * **De ida**: lo que esta persona guarda se manda a su cuenta por `lib/sincronizar.ts`, que nunca
 * bloquea el gesto ni anuncia un fallo.
 *
 * La guía tiene que funcionar igual sin nada de esto: sin red, sin cuenta o con el servidor caído,
 * los favoritos son los de siempre y el número sencillamente no aparece.
 */
import { hayCuenta } from '../../lib/cuenta.ts'
import { enviar } from '../../lib/sincronizar.ts'
import type { PlaceSocialStats } from './socialStats.ts'
import { setSocialStatsSource } from './socialStats.ts'
import { favoritesStore } from './useFavorites.ts'

let senales: Record<string, PlaceSocialStats> = {}
const oyentes = new Set<() => void>()
const avisar = () => {
  for (const oyente of oyentes) oyente()
}

const numeroPositivo = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isFinite(valor) && valor > 0

/**
 * Trae las señales y las publica. Se llama una vez al arrancar: cambian despacio y la respuesta se
 * cachea cinco minutos, así que no hay nada que refrescar en caliente.
 */
export async function cargarSenales(): Promise<void> {
  try {
    const respuesta = await fetch('/api/senales')
    if (!respuesta.ok) return
    const datos: unknown = await respuesta.json()
    if (typeof datos !== 'object' || datos === null) return
    const limpias: Record<string, PlaceSocialStats> = {}
    for (const [lugar, valor] of Object.entries(datos as Record<string, unknown>)) {
      if (typeof valor !== 'object' || valor === null) continue
      const { corazones, empuje } = valor as { corazones?: unknown; empuje?: unknown }
      limpias[lugar] = {
        favorites: numeroPositivo(corazones) ? corazones : null,
        // Fuera de 0 a 1 no es una señal, es un error: se ignora en vez de propagarlo al orden.
        empuje: typeof empuje === 'number' && empuje >= 0 && empuje <= 1 ? empuje : 0,
      }
    }
    senales = limpias
    avisar()
  } catch {
    // Sin señales, la ficha no dibuja nada. Es como se comportaba antes de que existieran.
  }
}

/** Registra la fuente que leen la ficha y el orden personal. */
export function registrarSenales(): void {
  setSocialStatsSource({
    get: (placeId) => senales[placeId] ?? null,
    subscribe: (oyente) => {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
  })
}

/**
 * Sube lo que ya había guardado antes de que existieran las cuentas.
 *
 * Solo la primera vez: en cuanto hay cuenta, cada gesto viaja solo. Sin esto, quien llevaba meses
 * guardando lugares empezaría de cero en el número público, que es justo lo que no debe pasar.
 */
export function subirLoQueYaHabia(): void {
  if (hayCuenta()) return
  const guardados = [...favoritesStore.read()]
  if (guardados.length === 0) return
  enviar('/api/favoritos', { anadir: guardados })
}

/** Avisa al servidor de un corazón puesto o quitado. */
export function sincronizarCorazon(placeId: string, puesto: boolean): void {
  enviar('/api/favoritos', puesto ? { anadir: [placeId] } : { quitar: [placeId] })
}
