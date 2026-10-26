# 02 · Cambios

**Última actualización:** 25 de octubre de 2026.

Los cambios se agrupan por lo que arreglan. Las tres primeras secciones ya están en `main`. Las dos
últimas documentan lo que se probó y **no** se cambió, con la evidencia que sostiene la decisión.

## Accesibilidad: nombre accesible y texto visible

Se corrigió la generación compartida de etiquetas para que el nombre accesible empiece por el texto
visible y conserve el contexto dinámico.

### Marcador de plaza

- Antes: `Ver {name}, {places}`.
- Ahora: `{name}, {places}`.

Archivos:

- `src/i18n/es.ts`
- `src/i18n/en.ts`

El verbo “Ver” no era texto visible y hacía que el nombre no empezara por la etiqueta.

### Filtros de categoría

- Antes: `{label}, {count} lugares`.
- Ahora: `{label} {count}`.

Archivos:

- `src/features/plazas/CategoryChips.tsx`

El nombre accesible empieza por la etiqueta visible y mantiene la cuenta. No se añade texto que no
esté en pantalla.

### Botón de registrar visita

- Antes: `Registrar una visita a {name}`.
- Ahora: `Registrar visita a {name}`.

Archivo:

- `src/i18n/es.ts`

El inglés ya empezaba por “Log a visit”, así que no necesitó cambio.

### Estado

Las tres rutas medidas dan **accesibilidad 100**. Las pruebas actualizadas (`FilterBar`,
`PlazaPanel`, `VisitButton`, `map.spec.ts`) siguen exigiendo el nombre completo; no se relajó nada.

## CLS de la hoja inferior (ruta de ficha)

### Causa

El catálogo se carga de forma asíncrona. La ruta se aplicaba en `useUrlSync` cuando el catálogo ya
estaba listo, así que la hoja inferior ya estaba montada colapsada. Al abrir la ficha, el estado
pasaba a `sheetExpanded: true` y el CSS animaba `height` de ~158 px a ~676 px después del primer
pintado. Lighthouse lo contaba como layout shift.

### Corrección

1. `src/app/App.tsx`: el estado inicial de la hoja se calcula desde la URL antes del primer render.
   Si la ruta es de una ficha, `sheetExpanded` arranca en `true` y la hoja nace ya expandida.
2. `src/components/panel/BottomSheet.tsx` y `BottomSheet.module.css`: el primer render no anima el
   alto (`data-initial="true"` desactiva la transición durante el primer frame). Es una red de
   seguridad para cualquier otro cambio de estado inicial.

### Resultado

| Ruta | Antes | Ahora |
|---|---:|---:|
| `/lugar/al-grano` | 0.447 | **0.015** |
| `/` | — | **0** |
| `/zona/xentric-zibata` | sin medir | **0.097** |

Los shifts que quedan en la ficha son de ~0.002 y corresponden a los marcadores del mapa mientras la
cámara se asienta, no a la hoja.

### Lo que sigue abierto

La ruta de zona conserva un shift de **0.085** en `section[data-panel]`: la hoja nace colapsada con
un alto y lo ajusta después del primer pintado. Está por debajo de 0.1 y no se tocó en esta pasada.
Cualquier arreglo debe medirse en las tres rutas, porque el mismo componente sirve a la ficha y a la
zona.

## Tipografía y fuentes críticas

La familia cambió a **Archivo** para toda la interfaz (`docs/TIPOGRAFIA.md`). La precarga crítica se
actualizó con ella:

- Antes: Instrument Sans 400/600 y Fraunces 600 (seis archivos).
- Ahora: Archivo 400/600/700 en `latin` y `latin-ext` (seis archivos).

`vite.config.ts` → `CRITICAL_FONT_PATTERNS` y `preloadCriticalFonts()`. Se comprobó en el HTML
publicado: `/lugar/al-grano` lleva los seis `<link rel="preload" as="font" type="font/woff2">` antes
del CSS. Kode Mono queda fuera porque solo sirve a la firma de autoría.

`dist/assets` contiene además variantes que nadie descarga en la ruta crítica: `.woff` de respaldo,
subconjunto `vietnamese` y la itálica 400. No afectan al arranque; son peso de despliegue.

## Rendimiento de bundles: lo que se probó y no se aplicó

Ya existía un informe de Lighthouse que atribuía tareas largas a `MapView-*.js`. Se probaron cinco
variantes de carga del mapa midiendo TBT con Lighthouse móvil en `/zona/xentric-zibata` (3 corridas
cada una) y se decidió **no cambiar** (BK-10):

| Variante | Performance | TBT | Efecto en el usuario |
|---|---:|---:|---|
| Baseline (actual) | 49 | ~1,250 ms | Ninguno |
| Sin precarga | 48 | ~1,617 ms | Peor |
| Diferir 1 frame | 47 | ~1,350 ms | Peor |
| `requestIdleCallback` 2 s | 51 | ~1,207 ms | El mapa puede tardar 2 s |
| `requestIdleCallback` 500 ms | 49 | ~1,400 ms | Peor |
| `requestIdleCallback` 1 s | 50 | ~1,303 ms | Intermedio |
| Precarga + render diferido | 49 | ~1,204 ms | Ganancia marginal |

El criterio de aceptación (TBT < 3,000 ms) ya se cumple con el baseline, así que las variantes que
mejoran milímetros de TBT no compensan retrasar el mapa ni añadir código.

Tampoco se tocó:

- **CSS sin usar de MapLibre** (~12 KB en `MapView.css`, BK-13). Ahorro marginal y riesgo de romper
  controles o atribución.
- **Separar el mapa de la ficha.** La ficha cubre la pantalla en móvil, pero el mapa sigue detrás por
  arquitectura (mapa + hoja). Es un cambio de producto, no un ajuste de bundle.
- **Source maps.** No se publican. Exponerlos no mejora ninguna métrica.

## Animaciones no compuestas

BK-11 cambió el tallo del marcador a `scale` y dejó documentada una excepción. Lighthouse sigue
señalando **un** elemento: el tallo (`span._stem`) con `height` como propiedad no soportada. Es el
residuo que dejó ese cambio, el elemento es `aria-hidden` y su transición solo ocurre cuando el
solucionador de etiquetas reparte los marcadores. No se vuelve a intentar sin una prueba comparativa:
en v4.21 el `scale` mal aplicado separó la etiqueta de su línea.
