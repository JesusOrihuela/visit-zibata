# 01 · Línea base

**Última actualización:** 25 de octubre de 2026, sobre `datos/plaza-luna` (después del PR #48).

Este documento fija el estado medido del build actual. Todo lo que aparece aquí se ejecutó en esta
máquina; lo que no se pudo medir está marcado como pendiente.

## Informe original de Lighthouse (no comparable)

El informe que originó la tarea analizó estos assets:

| Asset | Tamaño reportado |
|---|---:|
| `MapView-CjFY1_hb.js` | 291.356 KB |
| `index-pobgycSc.js` | 118.421 KB |
| `MapView-Ci-l7e0G.css` | 12.562 KB |
| `index-BH-J6JjE.css` | 11.786 KB |

Esos hashes **no existen en el build actual**: corresponden a una versión anterior a la tipografía
Archivo, al arreglo del CLS y a las correcciones de accesibilidad. Sus cifras sirven como historia,
no como comparación directa.

## Build actual

Medido sobre `dist/` (raw y gzip real, no estimación):

| Asset | Raw | Gzip |
|---|---:|---:|
| `MapView-CJ65O7Pv.js` | 1030.3 KB | 277.4 KB |
| `maplibre-gl-worker-CD0Mhlp9.js` | 495.9 KB | 141.3 KB |
| `index-BDwupRTW.js` | 330.3 KB | 105.6 KB |
| `places-3Qklao8c.js` | 111.2 KB | 24.2 KB |
| `MapView-Cei6RhT4.css` | 98.6 KB | 13.5 KB |
| `index-qPVn5I6R.css` | 45.0 KB | 9.1 KB |
| `i18n-HP1X7vbV.js` | 28.4 KB | 10.7 KB |
| `PlaceDetail-CJ1yji9I.js` | 19.8 KB | 7.8 KB |

`npm run perf:budget`:

| Medida | Valor | Límite |
|---|---:|---:|
| `initialJs` | 118.2 KB | 122 KB |
| `initialCss` | 9.1 KB | 11 KB |
| `mapJs` | 277.4 KB | 320 KB |
| `mapCss` | 13.5 KB | 15 KB |
| `dataJs` | 32.9 KB | 34 KB |
| `tiles` | 2306.4 KB | 2450 KB |
| `largestTile` | 93.2 KB | 140 KB |

Datos: 103 locales, 18 categorías y 15 plazas.

## Lighthouse local actual

Lighthouse 13.5.0, perfil móvil por defecto, contra `vite preview` en `http://localhost:4173` con
Chromium de Playwright y WebGL por software (SwiftShader). El preview sirve con gzip, así que el
peso transferido se parece al del hosting real.

| Ruta | Performance | Accesibilidad | FCP | LCP | TBT | CLS | Speed Index |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 53 | 100 | 2.6 s | 5.1 s | 1,250 ms | 0 | 2.8 s |
| `/lugar/al-grano` | 52 | 100 | 2.6 s | 4.9 s | 1,430 ms | 0.015 | 2.9 s |
| `/zona/xentric-zibata` | 51 | 100 | 2.6 s | 4.9 s | 1,310 ms | 0.097 | 2.9 s |

Repeticiones: `/zona/xentric-zibata` se corrió dos veces (TBT 1,310 / 1,210 ms; CLS 0.097 / 0.098).
El CLS de esa ruta es estable; el TBT no, y por eso no se usa como comparación entre versiones.

### De dónde viene el tiempo

Reparto del hilo principal en `/lugar/al-grano`:

| Grupo | Tiempo |
|---|---:|
| Script Evaluation | 4,761 ms |
| Other | 750 ms |
| Style & Layout | 478 ms |
| Rendering | 134 ms |
| Garbage Collection | 46 ms |
| Parse HTML & CSS | 13 ms |

`bootup-time`:

| Script | Total | Scripting |
|---|---:|---:|
| `MapView-CJ65O7Pv.js` | 4,405 ms | 3,818 ms |
| `index-BDwupRTW.js` | 1,153 ms | 867 ms |

En la portada el mapa sigue siendo el mayor, con menos peso total: 2,718 ms de `MapView` y 448 ms
del `index`. La conclusión de la traza anterior sigue en pie: **el coste es el mapa**, no la lista ni
la hoja.

### CLS

| Ruta | CLS | Causa principal |
|---|---:|---|
| `/` | 0 | — |
| `/lugar/al-grano` | 0.015 | Marcadores del mapa (~0.002 cada uno) |
| `/zona/xentric-zibata` | 0.097 | Hoja inferior de móvil: un shift de 0.085 |

El arreglo del CLS de la hoja cubre el caso de la ficha (la hoja nace expandida cuando la URL es de
un lugar). En la ruta de una zona la hoja arranca colapsada y su alto se ajusta después del primer
pintado, así que queda un shift de 0.085 sobre `section[data-panel]`. Está por debajo del umbral de
0.1, pero es el shift más grande que queda y el único que conviene vigilar.

## Accesibilidad observada en el build actual

Puntuación 100 en las tres rutas, sin auditorías de peso fallando.

| Control | Texto visible | Nombre accesible |
|---|---|---|
| Marcador de plaza | `25` + `Xentric Anáhuac` | `Xentric Anáhuac, 25 lugares` |
| Filtro “Todo” | `Todo` | `Todo 103` |
| Filtro “Desayunos y Café” | `Desayunos y Café` | `Desayunos y Café 26` |
| Botón de visita | `Registrar visita` | `Registrar visita a Al Grano Maíz & Snacks` |

Los cuatro nombres empiezan por el texto visible. Las pruebas de `FilterBar`, `PlazaPanel`,
`VisitButton` y `map.spec.ts` fijan ese contrato.

## Diferencias con la versión anterior de este informe

- **Tipografía:** la interfaz usa Archivo en toda la escala (ver `docs/TIPOGRAFIA.md`). La precarga
  crítica ya no es Instrument Sans + Fraunces: son Archivo 400, 600 y 700 en `latin` y `latin-ext`
  (seis archivos), inyectados por `preloadCriticalFonts()`.
- **Datos:** el catálogo pasó de 101 a 103 locales, así que las cuentas de los nombres accesibles
  cambiaron (`Todo 103`).
- **CLS de la ficha:** consolidado en 0.015. La portada queda en 0.
- **CLS de zona:** aparece como hallazgo nuevo (0.097). En el informe anterior no se había medido la
  ruta de zona con Lighthouse.
- **Accesibilidad:** pasó de controles con el nombre accesible desalineado a 100 en las tres rutas.

## Lo que este documento no cubre

- Producción: todas las cifras son locales y con WebGL por software.
- CrUX: no hay datos de campo en esta máquina.
- INP: Lighthouse 13 no lo mide en laboratorio; se sigue TBT como aproximación.
