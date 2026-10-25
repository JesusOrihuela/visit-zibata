# 05 · Traza del hilo principal

**Estado:** capturada sobre un build anterior al PR #48 (tipografía Archivo, arreglo de CLS y
accesibilidad). **No se volvió a capturar**: las cifras de las secciones siguientes describen ese
build. La revisión del 25 de octubre de 2026 confirmó la misma conclusión con Lighthouse, y está al
final del documento.

## Cómo se capturó

- Playwright + Chrome DevTools Protocol (`Tracing`).
- Ruta: `/lugar/al-grano`.
- Viewport móvil: 412 × 823, `isMobile`, `hasTouch`.
- CPU: 4×.
- `prefers-reduced-motion: reduce` para no mezclar animaciones de interfaz.
- Ventana: desde el primer evento del hilo principal hasta 8 s después.
- Hilo: `CrRendererMain`.

No se usó `Lighthouse` para esta traza: es una captura directa para separar los eventos que
Lighthouse agrupa como “Other”.

## Reparto por self time

| Categoría | Tiempo |
|---|---:|
| Other | 1,492.6 ms |
| Script Evaluation | 1,176.4 ms |
| Style & Layout | 387.5 ms |
| Rendering | 82.7 ms |
| Garbage Collection | 37.1 ms |
| Parse HTML & CSS | 12.6 ms |

### Qué compone “Other”

| Evento | Self time |
|---|---:|
| `Commit` | 1,145.1 ms |
| `RunTask` (overhead) | 307.7 ms |
| `Paint` | 37.0 ms |
| `PrePaint` | 21.2 ms |
| `Layerize` | 19.5 ms |
| `EventDispatch` | 4.2 ms |
| `FireAnimationFrame` | 2.2 ms |

“Other” **no es JavaScript sobrante**: es sobre todo `Commit`, el commit de composición que sigue
a los frames del mapa y a los cambios de layout/paint del DOM.

### Qué compone Script Evaluation

| Evento | Self time |
|---|---:|
| `FunctionCall` | 912.4 ms |
| `v8.callFunction` | 159.0 ms |
| `v8.evaluateModule` | 95.0 ms |

La mayor parte es MapView: el `bootup-time` de Lighthouse local le atribuye ~4.57 s de evaluación y
los long tasks más grandes son de `MapView-*.js` (897 ms, 664 ms, 167 ms, 115 ms).

### Style & Layout

| Evento | Self time |
|---|---:|
| `Layout` | 284.1 ms |
| `UpdateLayoutTree` | 97.7 ms |
| `ParseAuthorStyleSheet` | 5.7 ms |

## Tareas largas más relevantes

| Tarea | Contenido principal |
|---:|---|
| 301 ms | `FireAnimationFrame` 95 ms + `FunctionCall` 94 ms + `Commit` 206 ms (layer tree del mapa) |
| 211 ms | `FunctionCall` 208 ms + `UpdateLayoutTree` 350 elementos + `Layout` 421 objetos sucios |
| 174 ms | `FireAnimationFrame` 52 ms + `Commit` 117 ms |
| 146 ms | `Layout` 125 ms sobre 101 objetos sucios + `Paint` 14 ms |

Las tareas de `Commit` van acompañadas de `FireAnimationFrame`: son frames del mapa. La tarea de
211 ms mezcla un `FunctionCall` largo con un layout de 350 elementos, compatible con la creación y
colocación de marcadores. La tarea de 146 ms es layout de DOM, probablemente la hoja y su contenido.

## Comparación con Lighthouse local

`mainthread-work-breakdown` del mismo build:

| Grupo | Tiempo |
|---|---:|
| Script Evaluation | 4,660.6 ms |
| Other | 766.1 ms |
| Style & Layout | 452.4 ms |
| Rendering | 125.8 ms |
| Garbage Collection | 56.9 ms |
| Parse HTML & CSS | 12.5 ms |

Las cifras no coinciden exactamente porque Lighthouse agrupa tareas completas y la traza reparte
self time entre eventos anidados. Lo que coincide es la conclusión: **el coste principal es el mapa**
(script + frames + commit), no la hoja.

## Qué se puede intentar

Por orden de evidencia:

1. **Reducir frames/commits iniciales del mapa.** La tarea de 301 ms y la de 174 ms son frames con
   `Commit`. Revisar si la cámara inicial anima varios frames y si los marcadores se recolocan
   durante esa animación.
2. **Reducir el layout de marcadores.** La tarea de 211 ms hace `UpdateLayoutTree` de 350 elementos
   y `Layout` de 421 objetos. Ver si la creación de marcadores provoca varias pasadas y si se puede
   hacer en un solo lote o con `contain: layout paint`.
3. **Evaluar el mapa en fichas.** La ficha cubre la mayor parte de la pantalla en móvil. Separar su
   carga del mapa ahorraría script y frames, pero es un cambio de arquitectura y de UX; no se debe
   hacer sin una prueba comparativa y sin conservar la vuelta al mapa.
4. **Contención de layout.** `contain: layout paint` en el contenedor del mapa y en la hoja puede
   aislar recálculos, pero solo si las medidas confirman que el layout se propaga entre ambos.

## Limitaciones

- Una sola captura local, no producción.
- Los nombres de funciones están minificados y no hay source maps.
- El grupo “Other” del informe original (9.42 s) no se reproduce en esta máquina; la traza local
  muestra ~1.5 s. La diferencia es de entorno y de metodología.
- No se ha implementado ninguna optimización a partir de esta traza.

## Revisión del 25 de octubre de 2026

No se repitió la traza. En su lugar se corrió Lighthouse 13.5.0 (móvil, local) sobre el build actual,
que reparte el hilo principal así:

| Ruta | Script Evaluation | Other | Style & Layout | Rendering |
|---|---:|---:|---:|---:|
| `/lugar/al-grano` | 4,761 ms | 750 ms | 478 ms | 134 ms |
| `/` | 2,895 ms | 388 ms | 194 ms | 55 ms |

`bootup-time` del mismo build:

| Script | `/lugar/al-grano` | `/` |
|---|---:|---:|
| `MapView-*.js` | 4,405 ms (3,818 de scripting) | 2,718 ms (2,480) |
| `index-*.js` | 1,153 ms (867) | 448 ms (326) |

Tareas largas más grandes: 626 ms, 336 ms y 224 ms, todas de `MapView-*.js`; la más grande de
`index-*.js` es de 249 ms.

La conclusión no cambia y ahora está medida sobre el build publicado: **el coste es el mapa**. Las
cuatro líneas de “Qué se puede intentar” siguen vigentes, y ninguna se aplicó porque las variantes
probadas no mejoraban el TBT lo suficiente para justificar retrasar el mapa (BK-10).
