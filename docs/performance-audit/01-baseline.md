# 01 · Línea base

## Versión del informe

El informe de Lighthouse analizó estos assets:

| Asset | Tamaño reportado |
|---|---:|
| `MapView-CjFY1_hb.js` | 291.356 KB |
| `index-pobgycSc.js` | 118.421 KB |
| `MapView-Ci-l7e0G.css` | 12.562 KB |
| `index-BH-J6JjE.css` | 11.786 KB |

Esos hashes **no coinciden** con el build actual. El informe corresponde a una versión anterior a
los cambios de tipografía y espaciado de esta rama. Por tanto, sus cifras no se usan como
comparación directa antes/después.

## Build actual

Medido sobre `dist/` con gzip:

| Asset | Raw | Gzip |
|---|---:|---:|
| `MapView-cPq_dXJw.js` | 1030.3 KB | 277.4 KB |
| `maplibre-gl-worker-CD0Mhlp9.js` | 495.9 KB | 141.3 KB |
| `index-BtaxCfep.js` | 330.1 KB | 105.5 KB |
| `places-D3LU3oSy.js` | 109.2 KB | 23.7 KB |
| `MapView-Cei6RhT4.css` | 98.6 KB | 13.5 KB |
| `index-DISbqTxT.css` | 45.2 KB | 9.2 KB |

`npm run perf:budget`:

- `initialJs` 118.2 KB (límite 122)
- `initialCss` 9.2 KB (límite 11)
- `mapJs` 277.4 KB (límite 320)
- `mapCss` 13.5 KB (límite 15)
- `dataJs` 32.3 KB (límite 34)
- `tiles` 2306.4 KB (límite 2450)
- `largestTile` 93.2 KB (límite 140)

## Lighthouse local actual

Ruta: `/lugar/al-grano`, emulación móvil por defecto de Lighthouse.

| Métrica | Valor |
|---|---:|
| Performance | 35 |
| FCP | 2.6 s |
| LCP | 5.3 s |
| TBT | 980 ms |
| CLS | **0.447** |
| Speed Index | 2.9 s |

### CLS

El `layout-shifts` de Lighthouse atribuye la mayor parte del CLS a la hoja inferior de móvil
(`section[data-panel]`, “Información de lugares”), cuyo alto crecía de ~158 px a ~676 px en una
transición de altura después del primer pintado.

Causa: el catálogo se carga de forma asíncrona. La ruta se aplicaba en `useUrlSync` cuando el
catálogo ya estaba listo, así que la hoja ya estaba montada colapsada y el cambio a expandida
animaba el alto con `transition: height`.

### Después de la corrección del CLS

| Métrica | Antes | Después |
|---|---:|---:|
| Performance | 35 | **53** |
| FCP | 2.6 s | 2.6 s |
| LCP | 5.3 s | **4.7 s** |
| TBT | 980 ms | 1,640 ms |
| CLS | 0.447 | **0.015** |

El TBT varía entre corridas locales; no se usa como comparación definitiva.

## Accesibilidad observada en el build actual

| Control | Texto visible | Nombre accesible actual |
|---|---|---|
| Marcador de plaza | `25 Xentric Anáhuac` | `Ver Xentric Anáhuac, 25 lugares` |
| Filtro “Todo” | `Todo` | `Todo, 101 lugares` |
| Filtro “Desayunos y Café” | `Desayunos y Café` | `Desayunos y Café, 26 lugares` |
| Botón de visita | `Registrar visita` | `Registrar una visita a Al Grano Maíz & Snacks` |

Los tres primeros nombres no empiezan por el texto visible. El cuarto tampoco reproduce
“Registrar visita” al inicio.

## Hallazgos del informe que no se reproducen igual

- El informe habla de “Todo 24” visible; en el build actual la cifra no se pinta en la cápsula, solo
  va en el nombre accesible.
- El informe habla de “Paseo Zibatá 24”; el orden del DOM actual es cifra y luego nombre.
- El informe estima 186 KiB de JS no usado. Es una estimación de Lighthouse, no una cifra de ahorro
  garantizado. El build actual ya es más pequeño que el reportado.
