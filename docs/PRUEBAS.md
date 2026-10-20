# Pruebas

Qué se prueba, con qué y qué queda fuera. Lo que no se ha podido verificar se declara aquí y en
[release/FINAL_REMEDIATION_CHECKLIST.md](release/FINAL_REMEDIATION_CHECKLIST.md).

## Comandos

```bash
npm run check          # lint + tipos + tests unitarios + validación de datos + build
npm test               # solo Vitest
npm run test:e2e       # Playwright contra dist/ (requiere npm run build)
npm run perf:budget    # presupuesto de peso del build
npm run data:validate  # estructura, relaciones, coordenadas, fotos y variantes
```

Antes de los E2E, el puerto 4173 debe estar libre: Playwright reutiliza un servidor existente fuera de CI
y podría medir otra aplicación.

## Niveles

**Unitarios y de componentes (Vitest, 257 pruebas).** Lógica pura y componentes con Testing Library:
esquemas y validación de datos (Zod y la validación ligera de runtime, en paridad), relaciones entre
colecciones, catálogo, horarios, búsqueda, filtros, rutas, cámara, hoja inferior, enlaces a Google Maps del
dataset publicado y componentes de la ficha.

Las de datos estructurados (`scripts/build/structured-data.test.ts`) cubren sobre todo lo que **no**
debe salir: horario, medias y precios, aunque el dato exista en el registro. Un marcado de más es
peor que uno de menos, porque el buscador lo publica como hecho.

Las de rutas (`src/lib/urls.test.ts`) cubren los dos árboles de idioma, el parámetro de categoría
traducido y la traducción de un enlace antiguo con hash. Corren con la base `/visit-zibata/` y nunca
con la raíz, a propósito: así una ruta construida sin tener en cuenta la base falla la prueba en vez
de pasar por casualidad.

**End to end (Playwright, 4 proyectos).** Contra el build de producción servido como en el hosting:

| Proyecto | Motor | Emulación |
| --- | --- | --- |
| `desktop` | Chromium | 1440×900, puntero fino |
| `mobile` | Chromium | Pixel 7, táctil |
| `tablet` | Chromium | iPad (gen 7), táctil |
| `webkit-iphone` | WebKit | iPhone 13, táctil |

Cubren: mapa 3D y marcadores, plazas y fichas, búsqueda y filtros, favoritos, enlaces profundos y botón
atrás, teclado (salto al buscador, Escape), 404 propio, región viva única, táctil (toques
y arrastre de la hoja), responsive en 9 tamaños, seguridad (CSP, enlaces externos, 404), el catálogo
de interactuables y degradación (sin WebGL2, sin datos, sin chunk del mapa, sin cartografía base,
sin conexión, registro inválido).

**Cuidado con `test.skip` condicional.** `abierto-ahora.spec.ts` buscaba el filtro con
`getByRole('button')` y se saltaba sola cuando no encontraba nada, con el pretexto razonable de que
a ciertas horas no hay ningún local abierto. El filtro había pasado a `role="switch"` tiempo atrás,
así que encontraba cero siempre: la prueba no fallaba nunca porque no se ejecutaba nunca. Un
`test.skip` que depende de encontrar el objetivo no distingue "no aplica" de "ya no existe". Si una
prueba puede saltarse, la condición tiene que mirar el dato (hay o no hay abiertos), no el DOM.

`catalogo.spec.ts` es distinto del resto y conviene saber por qué: no comprueba una función, sino el
sistema de diseño ([docs/CATALOGO.md](CATALOGO.md)). Son ocho casos: las cinco formas de lo que se
pulsa, los altos, la letra por papel, el contraste entre los dos estados del interruptor, el alto
del avatar contra su barra, que lo que tiene dirección propia sea un enlace, la concentricidad de
las superficies anidadas y que nada de lo que flota sobre el mapa sea transparente. Mira lo que el navegador **calcula**, no lo que
el CSS dice, que es la única forma de atrapar una regla compartida ganándole a la del módulo por el
orden en que el empaquetador junta los archivos. Encontró tres cosas que no se veían leyendo el CSS:
un `select` nativo colando su esquina de 6,5 px, cuatro píxeles de desnivel entre el avatar y la
tarjeta de búsqueda, y la vía del interruptor a 1,66:1 contra su perilla cuando WCAG pide 3:1.

Los enlaces profundos se abren con el ayudante `openApp(page, { path })`, que navega a la ruta real
(`lugar/tomassa`) en vez de a un hash. Es el mismo camino que recorre quien pega el enlace en la barra
de direcciones: se pide una página distinta al servidor, no un fragmento de la portada.

El 404 se comprueba contra `vite preview`, que por omisión responde un 404 vacío; un plugin de
`vite.config.ts` le hace servir el `404.html` del build para que la prueba mire la misma página que
el hosting.

**Accesibilidad.** axe-core en inicio, plaza y ficha (sin violaciones graves o críticas), recorrido de
teclado y foco. Ver [ACCESIBILIDAD.md](ACCESIBILIDAD.md).

**Banco de auditoría (fuera del repositorio).** Sondas con Playwright como librería para medir lo que no
es una aserción binaria: carga por viewport, solapes y desbordamientos, colocación de marcadores,
recorridos A–R en escritorio y móvil, fidelidad cartográfica contra el plano, rendimiento y estrés con
300–500 locales sintéticos. Sus resultados se citan en el informe de auditoría.

## Datos de prueba

`src/test/fixtures.ts` contiene datos **ficticios** con la estructura real (nunca negocios reales
inventados). Las pruebas que dependen del dataset publicado leen los archivos reales: los conteos salen
de `data/commercial/*.json` con los ayudantes `placesInPlaza`, `placesInCategory` y `placeById`, no
escritos a mano. Así una alta, una baja o una ubicación verificada no rompen la suite; solo la rompe un
fallo de verdad.

El idioma se fija en las pruebas (español). Desde el enrutado por idioma la guía ya no mira el idioma
del navegador (ver [ARQUITECTURA.md](ARQUITECTURA.md) § Idioma), así que el español es lo que
responde la raíz de forma determinista; el inglés se prueba pidiendo su árbol.

## Estabilidad

- La colocación de marcadores depende del tamaño de pantalla: los E2E usan el ayudante `plazaMarker`, que
  acerca la cámara con el selector de plazas si hace falta, en vez de suponer que siempre tiene marcador
  propio. La garantía que se comprueba es `plazasMissingInBand`: si el punto de una plaza cae en la franja
  libre entre la barra y el panel, esa plaza tiene marcador (con nombre, con la cifra o como punto).
- Tras mover la cámara se espera al reposo antes de medir posiciones.
- Suites completas ejecutadas varias veces sin fallos intermitentes tras corregir dos carreras reales
  (sincronización inicial de la URL y arrastre + click en la hoja).

## Qué NO se prueba

- **Safari real en un iPhone/iPad**: solo el motor WebKit emulado en escritorio. No cubre la GPU de iOS,
  las barras dinámicas ni el comportamiento real de `100dvh` en iOS.
- **Arrastre táctil en WebKit**: Playwright solo inyecta gestos de arrastre táctil en Chromium; en WebKit
  se prueban toques.
- **Publicación real** en Cloudflare (ver [DESPLIEGUE.md](DESPLIEGUE.md)). Esto no es una nota
  menor: en la v4.7.0 el mapa estuvo caído en producción con la suite entera en verde, porque
  `vite preview` sí servía peticiones `Range` y el hosting real no. Toda la suite corre contra un
  servidor que no es el de verdad, así que **una publicación se comprueba abriendo el sitio**. En particular, que un
  archivo plano se sirva sin redirigir a la versión con barra final se verificó en `vite preview` y
  en la documentación de Cloudflare, no contra el sitio publicado.
- **Lectores de pantalla distintos de NVDA** (VoiceOver, JAWS, TalkBack).
- Navegadores antiguos sin WebGL2: se detecta y se ofrece la guía en modo lista, pero no se prueba en un
  navegador antiguo real.
