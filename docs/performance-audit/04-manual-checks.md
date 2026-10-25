# 04 · Verificaciones manuales

## 1. PageSpeed Insights de producción

Medir en `https://visitzibata.com/lugar/al-grano` y en `/`:

- FCP, LCP, TBT, CLS, INP.
- “Minimize main-thread work”.
- “Reduce unused JavaScript”.
- “Reduce unused CSS”.
- “Avoid an excessive DOM size”.

El informe adjunto no corresponde al build actual; hay que volver a medir producción cuando se
publique esta rama.

## 2. Traza del hilo principal

El informe atribuye 9.42 s al grupo “Other”. No se puede repartir sin una traza.

Captura necesaria en Chrome DevTools → Performance:

- Móvil emulado, CPU 4× o 6×.
- Carga en frío de `/lugar/al-grano`.
- Grabar desde la navegación hasta 3 s después de la carga.
- Exportar el perfil y revisar:
  - tareas largas;
  - inicialización de MapLibre/WebGL;
  - creación de marcadores;
  - listeners y observers;
  - recalculaciones de layout;
  - trabajo de la hoja inferior.

Sin esa traza no se debe atribuir “Other” a JavaScript ni recortar bundles por intuición.

## 3. Source maps

El build actual no publica source maps. Habilitarlos públicamente no es una decisión que deba
tomarse para mejorar una puntuación de Lighthouse: expone código y no cambia la experiencia.

Decisión recomendada:

- Mantener los source maps fuera del build público.
- Si se necesita depuración de producción, generarlos como artefacto privado de release o subirlos a
  un servicio de errores.
- Documentar la excepción mientras no exista ese almacenamiento privado.

## 4. CSS no usado de MapLibre

El informe estima ~11.5 KB sin usar en `MapView.css`. Ya se evaluó como mejora marginal (BK-13).

Antes de tocarlo:

- Confirmar qué reglas de MapLibre usa realmente la app.
- No romper controles, atribución, popups ni marcadores.
- Medir el ahorro real en gzip.
- Si el ahorro sigue siendo marginal, dejarlo documentado como excepción.

## 5. MapView en fichas

`/lugar/al-grano` monta el mapa detrás del panel porque la experiencia es mapa + hoja. Separar la
ficha del mapa es un cambio de arquitectura, no un ajuste de bundle.

Antes de plantearlo:

- Medir cuánto tarda el mapa en aparecer y cuánto bloquea el hilo principal.
- Comprobar que la navegación de vuelta al mapa sigue funcionando.
- Evitar flashes, dobles inicializaciones y estados de carga vacíos.
- Validar en móvil y escritorio.

## 6. CLS de la hoja inferior

Corregido en local: el CLS de `/lugar/al-grano` bajó de 0.447 a 0.015.

La hoja ahora arranca expandida desde el primer render cuando la URL es de una ficha, y el primer
frame no anima el alto.

Comprobar en producción:

- PSI móvil de `/lugar/al-grano`: CLS por debajo de 0.1.
- Repetir en `/zona/...` y en la portada.
- Confirmar que abrir y cerrar la hoja a mano sigue animando con normalidad.
- Confirmar que un enlace directo a una ficha abre la hoja ya expandida, sin salto.

## 7. Cómo volver a medir

1. `npm run build`.
2. `npx vite preview --port 4173`.
3. Lighthouse móvil en `/lugar/al-grano`, `/` y `/zona/xentric-anahuac`.
4. Comparar con `01-baseline.md`.
5. Repetir `npm run test:seo` y `npx playwright test tests/e2e/map.spec.ts --project=desktop`.
