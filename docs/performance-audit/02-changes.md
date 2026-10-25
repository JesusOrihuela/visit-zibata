# 02 · Cambios

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

### Pruebas actualizadas

- `src/features/filters/FilterBar.test.tsx`
- `src/features/plazas/PlazaPanel.test.tsx`
- `src/features/visits/VisitButton.test.tsx`
- `tests/e2e/map.spec.ts`
- `tests/e2e/helpers.ts`

Se actualizaron las expectativas al nuevo contrato de nombre accesible. No se relajó ninguna
comprobación: las pruebas siguen exigiendo el nombre completo.

## CLS de la hoja inferior

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

CLS de `/lugar/al-grano` en Lighthouse local:

- Antes: **0.447**.
- Después: **0.015**.

Los shifts restantes son de ~0.002 y corresponden a los marcadores del mapa mientras la cámara se
asienta, no a la hoja.

## Rendimiento de bundles

No se modificó ningún bundle, ningún import dinámico ni la carga del mapa en este paso. El informe
corresponde a otra versión y las optimizaciones propuestas necesitan una medición de la versión
actual antes de aplicarse.

Pendiente de evidencia:

- Reparto de `MapView` en la ficha.
- CSS no usado de MapLibre.
- Source maps.
- Traza de Chrome DevTools para el grupo “Other” del hilo principal.
