# 03 · Validación

**Última actualización:** 25 de octubre de 2026.

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ 309 archivos |
| `npm test` | ✅ 68 archivos, 597 pruebas |
| `npm run test:seo` | ✅ 52 pruebas |
| `npm run build` | ✅ |
| `npm run perf:budget` | ✅ 7 medidas dentro de límite |
| `npm run data:validate` | ✅ 103 locales, 0 errores |

E2E relacionadas con este trabajo: búsqueda, categorías, lugares, ranking y responsive, en escritorio
y móvil. Una ejecución de `responsive.spec.ts` (1920×1080) falló por tiempo bajo carga y pasó al
repetirla sola; es un test lento y frágil, no un fallo del producto.

## Accesibilidad

Puntuación de Lighthouse: **100** en `/`, `/lugar/al-grano` y `/zona/xentric-zibata`, sin auditorías
de peso fallando.

Los nombres accesibles observados:

| Control | Nombre |
|---|---|
| Marcador | `Xentric Anáhuac, 25 lugares` |
| Filtro “Todo” | `Todo 103` |
| Filtro “Desayunos y Café” | `Desayunos y Café 26` |
| Botón de visita | `Registrar visita a Al Grano Maíz & Snacks` |

Las pruebas de `FilterBar`, `PlazaPanel`, `VisitButton` y `map.spec.ts` fijan ese contrato.

## Rendimiento

Lighthouse 13.5.0, móvil por defecto, contra `vite preview` local:

| Ruta | Performance | FCP | LCP | TBT | CLS | Speed Index |
|---|---:|---:|---:|---:|---:|---:|
| `/` | 53 | 2.6 s | 5.1 s | 1,250 ms | 0 | 2.8 s |
| `/lugar/al-grano` | 52 | 2.6 s | 4.9 s | 1,430 ms | 0.015 | 2.9 s |
| `/zona/xentric-zibata` | 51 | 2.6 s | 4.9 s | 1,310 ms | 0.097 | 2.9 s |

Comparación con la línea base de la primera pasada (misma ruta, `/lugar/al-grano`):

| Métrica | Primera medida | Ahora |
|---|---:|---:|
| Performance | 35 | **52** |
| FCP | 2.6 s | 2.6 s |
| LCP | 5.3 s | **4.9 s** |
| CLS | 0.447 | **0.015** |
| TBT | 980 ms | 1,430 ms |

El TBT es ruidoso en local y varía entre corridas (la misma ruta de zona dio 1,310 y 1,210 ms en dos
pasadas); se usa para orden de magnitud, no como comparación fina. El CLS sí es estable: 0.097 y
0.098 en las dos corridas de zona.

`npm run perf:budget` confirma el build dentro de límites:

```
initialJs     118.2 KB  (límite 122 KB)
initialCss      9.1 KB  (límite 11 KB)
mapJs         277.4 KB  (límite 320 KB)
mapCss         13.5 KB  (límite 15 KB)
dataJs         32.9 KB  (límite 34 KB)
tiles        2306.4 KB  (límite 2450 KB)
largestTile    93.2 KB  (límite 140 KB)
```

## Limitaciones

- Medición local, no de producción, y con WebGL por software: los tiempos absolutos son peores que
  los de un móvil real con GPU.
- El preview sirve con gzip, pero no replica la red, el CDN ni la caché de Cloudflare.
- No hay datos de campo (CrUX) en esta máquina.
- INP no se mide en laboratorio con Lighthouse 13; TBT se usa como aproximación.
- La traza del hilo principal es de un build anterior (ver `05-trace.md`); no se volvió a capturar.
