# 03 · Validación

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm test` | 68 archivos, 596 pruebas ✅ |
| `npm run test:seo` | 52 pruebas ✅ |
| `npx playwright test tests/e2e/map.spec.ts --project=desktop` | 9 passed, 1 skipped ✅ |
| `npm run build` | ✅ |
| `npm run perf:budget` | ✅ |

## Accesibilidad

Los nombres accesibles observados tras el cambio:

| Control | Nombre |
|---|---|
| Marcador | `Xentric Anáhuac, 25 lugares` |
| Filtro “Todo” | `Todo 101` |
| Filtro “Desayunos y Café” | `Desayunos y Café 26` |
| Botón de visita | `Registrar visita a Al Grano Maíz & Snacks` |

Las pruebas existentes de `FilterBar`, `PlazaPanel`, `VisitButton` y `map.spec.ts` se actualizaron al
nuevo contrato y pasan.

## Rendimiento

Lighthouse local en `/lugar/al-grano`:

| Métrica | Antes | Después |
|---|---:|---:|
| Performance | 35 | **53** |
| FCP | 2.6 s | 2.6 s |
| LCP | 5.3 s | **4.7 s** |
| TBT | 980 ms | 1,640 ms |
| CLS | 0.447 | **0.015** |

El TBT es ruidoso en local y varía entre corridas; no se usa como comparación definitiva. El CLS
bajó de 0.447 a 0.015 y los shifts restantes son de ~0.002, atribuidos a los marcadores del mapa.

`npm run perf:budget` confirma que el build actual sigue dentro de los límites del proyecto.

## Limitaciones

- La medición de Lighthouse es local, no de producción.
- No se ejecutó `npm run check` completo porque duplicaría build y pruebas ya ejecutadas; sus partes
  se corrieron por separado.
- No se modificó el rendimiento de bundles en este paso.
- Falta la traza de Chrome DevTools para repartir el grupo “Other”.
