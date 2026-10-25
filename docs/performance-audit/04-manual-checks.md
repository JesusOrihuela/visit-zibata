# 04 · Verificaciones manuales

Las cifras de `01` y `03` son locales. Producción es la que manda: allí hay GPU real, compresión de
Cloudflare y latencia de red. Estas son las comprobaciones que no se pueden hacer desde el repo.

## 1. PageSpeed Insights de producción

Medir en `https://visitzibata.com/`, `/lugar/al-grano` y `/zona/xentric-zibata`, en móvil y
escritorio:

- FCP, LCP, TBT, CLS, INP.
- “Minimize main-thread work”.
- “Reduce unused JavaScript”.
- “Reduce unused CSS”.
- “Avoid an excessive DOM size”.

Qué se espera, según lo medido en local:

| Métrica | Local (móvil) | Qué buscar en producción |
|---|---:|---|
| CLS portada | 0 | 0 o casi |
| CLS ficha | 0.015 | por debajo de 0.1 |
| CLS zona | 0.097 | por debajo de 0.1; si sube, es la hoja |
| TBT | 1,200–1,450 ms | menor que en local, por la GPU |
| Accesibilidad | 100 | 100 |

Si el CLS de zona pasa de 0.1 en producción, el culpable está identificado: el alto inicial de la
hoja inferior en rutas de zona, no los marcadores.

## 2. CLS de la hoja inferior

La ficha ya arranca expandida desde el primer render. Comprobar en producción:

- PSI móvil de `/lugar/al-grano`: CLS por debajo de 0.1.
- PSI móvil de `/zona/xentric-zibata` y de otra zona: CLS por debajo de 0.1.
- Abrir y cerrar la hoja a mano sigue animando con normalidad.
- Un enlace directo a una ficha abre la hoja ya expandida, sin salto.

## 3. Animaciones no compuestas

La auditoría sigue mostrando **un** elemento: el tallo del marcador (`span._stem`), con `height` como
propiedad señalada. Es el residuo documentado de BK-11.

Antes de intentar eliminarlo:

- Confirmar en PSI que no genera jank perceptible.
- No volver a `scale` sin probar que la etiqueta no se separa de su línea (pasó en v4.21).
- Medir antes/después en las tres rutas, no solo en una.

## 4. Source maps

El build no publica source maps. Habilitarlos públicamente no mejora ninguna métrica y expone código.

Decisión recomendada:

- Mantenerlos fuera del build público.
- Si se necesita depuración de producción, generarlos como artefacto privado de release o subirlos a
  un servicio de errores.
- Documentar la excepción mientras no exista ese almacenamiento privado.

## 5. CSS no usado de MapLibre

Lighthouse estima ~12 KB sin usar en `MapView.css` (BK-13, prioridad P3). Antes de tocarlo:

- Confirmar qué reglas de MapLibre usa realmente la app.
- No romper controles, atribución, popups ni marcadores.
- Medir el ahorro real en gzip.
- Si el ahorro sigue siendo marginal, dejarlo documentado como excepción.

## 6. MapView en fichas

`/lugar/al-grano` monta el mapa detrás del panel porque la experiencia es mapa + hoja. Separar la
ficha del mapa es un cambio de arquitectura, no un ajuste de bundle.

Antes de plantearlo:

- Medir cuánto tarda el mapa en aparecer y cuánto bloquea el hilo principal.
- Comprobar que la navegación de vuelta al mapa sigue funcionando.
- Evitar flashes, dobles inicializaciones y estados de carga vacíos.
- Validar en móvil y escritorio.

## 7. Cómo volver a medir

```powershell
npm run build
npm run preview -- --port 4173 --strictPort

$env:CHROME_PATH = (node -e "console.log(require('@playwright/test').chromium.executablePath())")

npx --no-install lighthouse "http://localhost:4173/" `
  --only-categories=performance,accessibility `
  --output=json --output-path=./lh-portada.json `
  --chrome-flags="--headless=new --no-sandbox --enable-unsafe-swiftshader" --quiet
```

Repetir con `/lugar/al-grano` y `/zona/xentric-zibata`. Comparar con las tablas de `01-baseline.md`.

Notas:

- `CHROME_PATH` apunta al Chromium de Playwright: en esta máquina no hay Chrome del sistema.
- Sin `--enable-unsafe-swiftshader` el mapa no arranca en modo headless.
- El servidor de preview sirve con gzip, así que el peso transferido se parece al de producción; los
  tiles del mapa son la mayor parte de los bytes.
- Cerrar el preview antes de volver a medir si se reconstruyó (`dist/` cambia bajo los pies del
  servidor y los hashes dejan de coincidir).

Después de medir, repetir las compuertas:

```powershell
npm run lint; npm run typecheck; npm test; npm run test:seo; npm run perf:budget
```
