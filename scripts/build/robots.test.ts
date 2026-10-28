import { describe, expect, it } from 'vitest'
import { bloquea, robotsTxt } from './robots.ts'

const reglas = (texto: string) =>
  texto
    .split('\n')
    .filter((linea) => linea.startsWith('Disallow: '))
    .map((linea) => linea.slice('Disallow: '.length))
const bloqueada = (texto: string, ruta: string) => reglas(texto).some((r) => bloquea(r, ruta))

describe('robots.txt', () => {
  const texto = robotsTxt('/', 'https://visitzibata.com/sitemap.xml')

  it('permite rastrear y apunta al sitemap', () => {
    expect(texto).toMatch(/^User-agent: \*$/m)
    expect(texto).toMatch(/^Allow: \/$/m)
    expect(texto).toMatch(/^Sitemap: https:\/\/visitzibata\.com\/sitemap\.xml$/m)
  })

  it('bloquea el filtro de categoría dentro de una zona, en los dos idiomas', () => {
    expect(bloqueada(texto, '/es/zona/xentric-anahuac?categoria=italiana')).toBe(true)
    expect(bloqueada(texto, '/en/area/xentric-anahuac?category=italian')).toBe(true)
    // Y las de antes del prefijo, que el Worker redirige: no se rastrean una por una.
    expect(bloqueada(texto, '/zona/xentric-anahuac?categoria=italiana')).toBe(true)
  })

  it('no bloquea nada que sea una página', () => {
    for (const ruta of [
      '/',
      '/es',
      '/en',
      '/es/zona/xentric-anahuac',
      '/en/area/xentric-anahuac',
      '/es/lugar/tomassa',
      '/en/place/tomassa',
      '/es/categoria/italiana',
      '/en/category/italian',
      '/es/info/privacidad',
      // La portada con parámetro la redirige el Worker: el rastreador tiene que poder llegar.
      '/?categoria=italiana',
      '/es?categoria=italiana',
      '/en?category=italian',
      '/sitemap.xml',
    ]) {
      expect(bloqueada(texto, ruta), ruta).toBe(false)
    }
  })

  it('no bloquea una zona con otro parámetro (la regla es solo del filtro de categoría)', () => {
    expect(bloqueada(texto, '/es/zona/condesa?utm_source=x')).toBe(false)
  })

  it('con una subruta, las reglas llevan la base', () => {
    const sub = robotsTxt('/visit-zibata/')
    expect(bloqueada(sub, '/visit-zibata/es/zona/condesa?categoria=bar')).toBe(true)
    expect(bloqueada(sub, '/es/zona/condesa?categoria=bar')).toBe(false)
    expect(sub).not.toContain('Sitemap:')
  })

  it('el comparador entiende los comodines como Google', () => {
    expect(bloquea('/a/*?b=', '/a/x/y?b=1')).toBe(true)
    expect(bloquea('/a/*?b=', '/a/x?c=1&b=1')).toBe(false)
    expect(bloquea('/a$', '/a')).toBe(true)
    expect(bloquea('/a$', '/ab')).toBe(false)
  })
})
