import { describe, expect, it } from 'vitest'
import { redireccionDeCategoria } from './redireccion.ts'

const aDonde = (direccion: string) => redireccionDeCategoria(new URL(direccion))

describe('los enlaces antiguos de categoría', () => {
  it('la portada con una categoría pasa a su página, en cada idioma', () => {
    expect(aDonde('https://visitzibata.com/?categoria=italiana')).toBe('/categoria/italiana')
    expect(aDonde('https://visitzibata.com/en?category=italian')).toBe('/en/category/italian')
    expect(aDonde('https://visitzibata.com/en/?category=italian')).toBe('/en/category/italian')
  })

  it('no toca la zona con su filtro, que sigue siendo un filtro', () => {
    expect(aDonde('https://visitzibata.com/zona/condesa?categoria=bebidas')).toBeNull()
    expect(aDonde('https://visitzibata.com/en/area/condesa?category=drinks')).toBeNull()
  })

  it('no redirige a una página que no existe', () => {
    expect(aDonde('https://visitzibata.com/?categoria=no-existe')).toBeNull()
    expect(aDonde('https://visitzibata.com/?categoria=')).toBeNull()
    // El slug del otro idioma no vale en este árbol.
    expect(aDonde('https://visitzibata.com/?categoria=italian')).toBeNull()
    expect(aDonde('https://visitzibata.com/en?category=italiana')).toBeNull()
    // Ni el parámetro de un idioma en el árbol del otro.
    expect(aDonde('https://visitzibata.com/en?categoria=italiana')).toBeNull()
  })

  it('solo con ese parámetro: con otros se sirve como siempre', () => {
    expect(aDonde('https://visitzibata.com/?categoria=italiana&utm_source=x')).toBeNull()
    expect(aDonde('https://visitzibata.com/?utm_source=x')).toBeNull()
    expect(aDonde('https://visitzibata.com/')).toBeNull()
  })

  it('no se activa en otras rutas ni en la propia página de la categoría', () => {
    expect(aDonde('https://visitzibata.com/categoria/italiana')).toBeNull()
    expect(aDonde('https://visitzibata.com/lugar/tomassa?categoria=italiana')).toBeNull()
  })
})
