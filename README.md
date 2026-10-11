# Visit Zibatá

La guía de zibateños para zibateños. Una guía interactiva en 3D de **Zibatá, Querétaro**, publicada en
<https://visitzibata.com>. El mapa es el producto: se explora Zibatá, se elige una zona y se descubren
sus lugares, con búsqueda, filtros, ficha de cada establecimiento y enlace a Google Maps para llegar.
En la interfaz y en las URLs esas agrupaciones se llaman **zona**; en los datos y el código, `plaza`.

- Sitio **100 % estático**: sin backend, cuentas, API keys ni servicios de pago. Cualquier hosting de
  archivos lo sirve. Hoy lo sirve un Worker de Cloudflare con assets estáticos
  (ver [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)).
- Mapa propio con **MapLibre GL JS** y teselas propias: edificios 3D, calles, áreas verdes y agua a
  partir de OpenStreetMap y Overture Maps. El 96 % de las vialidades dibujadas cae sobre el plano del
  cliente (a 11 m) y el plano queda cubierto al 89 % (ver [docs/MAPA.md](docs/MAPA.md)).
- **101 locales verificados en 11 zonas activas**, revisados uno por uno con el propietario el
  2026-09-22: todos con descripción propia del negocio, 90 con horario, 88 con ubicación exacta y 77
  con teléfono ([research/](research/audit-report.md) guarda fuentes y confianza por registro). 18
  categorías con sus giros, y un local puede tener dos giros reales (El Hornero es parrilla argentina y
  pizzería).
- **Una página real por ruta**, en los dos idiomas: 234 archivos HTML con su título, su descripción, su
  canonical, sus `hreflang` y sus datos estructurados, más una imagen de vista previa por local. Es lo
  que hace que cada ficha se indexe y se comparta por separado.
- Escritorio (panel lateral) y móvil (hoja inferior), en **español e inglés** (se cambia de un toque en
  la barra superior, y cada idioma tiene su propio árbol de URLs) y preparado para más idiomas.
  Diseñado para WCAG 2.1 AA: sin violaciones graves o críticas de axe, navegable con teclado y probado
  con NVDA (alcance y límites en [docs/ACCESIBILIDAD.md](docs/ACCESIBILIDAD.md)).

![Visit Zibatá](public/og-image.png)

## Requisitos

- Node.js **22.18+** (recomendado 24, el de CI) y npm.
- Para los tests E2E: `npx playwright install chromium webkit`.

## Desarrollo local

```bash
npm install
npm run dev            # http://localhost:5173
```

- Modo depuración del mapa: `http://localhost:5173/?debug` (coordenadas, cámara, IDs de edificios y
  plazas, límites de teselas y superposición del plano del cliente). No existe en producción.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Valida datos, comprueba tipos y genera `dist/` (incluye las 234 páginas, el sitemap y las teselas del mapa) |
| `npm run preview` | Sirve `dist/` localmente |
| `npm run check` | Lint + tipos + tests + build |
| `npm run lint` / `lint:fix` | Biome (lint y formato) |
| `npm test` | Tests unitarios y de componentes (Vitest) |
| `npm run test:e2e` | Tests E2E en escritorio, móvil, tableta y WebKit (Playwright, requiere `npm run build`) |
| `npm run perf:budget` | Comprueba el presupuesto de peso del build |
| `npm run data:validate` | Valida `data/commercial` (`-- --fix` recalcula campos derivados) |
| `npm run data:import -- <csv>` | Importa locales desde CSV |
| `npm run images:optimize` | Optimiza fotos (AVIF/WebP + miniaturas) y las registra |
| `npm run images:og` | Regenera la imagen general para redes sociales (con `npm run preview` activo) |
| `npm run images:og-places` | Compone la imagen de vista previa de cada local, **después** del build |
| `npm run images:icons` | Regenera los iconos "maskable" del manifiesto |
| `npm run data:apply-review -- <carpeta>` | Aplica las respuestas del formulario de verificación del propietario |
| `npm run map:fetch` | Descarga OSM + edificios y cobertura arbórea de Overture (≈15 min) |
| `npm run map:build` | Genera `zibata.pmtiles` (el archivo fuente del mapa), edificios de plazas, extensión y manifiesto |
| `npm run map:georef` | Georreferencia el plano del cliente |
| `npm run map:suggest-plaza -- --lat=… --lng=…` | Sugiere la geometría de una plaza |

## Estructura

```
data/
  commercial/   categories.json · plazas.json · places.json · imports/ (CSV) · schemas/
  geographic/   config.json · extent.json · manifest.json · reference/ (plano) · raw/ (no versionado)
docs/           Arquitectura, datos, mapa, pipeline GIS, pruebas, seguridad, accesibilidad,
                despliegue, contribuir, licencias y release/
public/         map/ (archivo de teselas + GeoJSON) · icons/ · images/ · favicon, OG, manifest
scripts/        build/ (prerenderizado, teselas, datos estructurados) · data/ · map/ · images/ · perf/
src/            app/ · components/ · config/ · data/ · features/ · hooks/ · i18n/ · lib/ · styles/ · types/
tests/e2e/      Playwright
```

Detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Gestionar el contenido

Guía completa: [docs/DATOS.md](docs/DATOS.md).

- **Agregar un local:** añádelo al CSV y ejecuta `npm run data:import -- data/commercial/imports/<archivo>.csv`,
  o edítalo en `places.json` y ejecuta `npm run data:validate -- --fix`.
- **Agregar una plaza:** obtén su geometría con `npm run map:suggest-plaza`, añádela a `plazas.json`,
  ejecuta `npm run data:validate -- --fix` y `npm run map:build`.
- **Modificar una categoría:** edita `categories.json` (etiqueta, icono, orden, sinónimos). Sin tocar código.
- **Actualizar horarios:** campo `hours` (`"mon": ["08:00-22:00"]`, `[]` = cerrado) o columna `hours` del CSV
  (`lun-vie 08:00-22:00; dom cerrado`).
- **Añadir imágenes:** originales en `data/commercial/photos-src/<id-del-lugar>/` y `npm run images:optimize`.
  Solo fotos propias o con licencia: nunca de Google ni de redes sociales.
- **Google Maps:** "Cómo llegar" usa `googleMapsUri`, o las coordenadas del local/plaza (+ `googlePlaceId`
  si existe). Funciona sin ningún dato de Google.
- **Desactivar sin borrar:** `"active": false` en el local o la plaza.

## Modificar el mapa

Guía completa: [docs/PIPELINE-GIS.md](docs/PIPELINE-GIS.md).

```bash
npm run map:fetch && npm run map:build
```

- Área y contorno de Zibatá: `data/geographic/config.json` (`area.bbox`, `zibataSeedPolygon`).
- Alturas y volúmenes de plazas: `buildings` en `config.json`.
- Colores y capas: `src/features/map/style/` (`theme.ts` y `layers/`).
- Cámara inicial y límites: `src/config/map.ts`.
- Un plano de mayor resolución: reemplaza `data/geographic/reference/plano-zibata.png` y ejecuta
  `npm run map:georef`.

## Documentación

| Documento | Contenido |
| --- | --- |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Estructura, estado, decisiones de diseño técnico |
| [docs/DATOS.md](docs/DATOS.md) | Modelo de datos y cómo editarlo |
| [docs/MAPA.md](docs/MAPA.md) | Decisiones cartográficas (alturas, volúmenes, teselas, cámara) |
| [docs/PIPELINE-GIS.md](docs/PIPELINE-GIS.md) | Cómo se generan las teselas y el manifiesto |
| [docs/PRUEBAS.md](docs/PRUEBAS.md) | Qué se prueba, con qué y qué queda fuera |
| [docs/SEGURIDAD.md](docs/SEGURIDAD.md) | CSP, privacidad, dependencias |
| [docs/MARCA.md](docs/MARCA.md) | Propuesta de identidad "Visit Zibatá" (nombre, logo, paleta, SEO) |
| [docs/ESCALABILIDAD.md](docs/ESCALABILIDAD.md) | Evaluación: escalar más allá de comer y beber |
| [docs/CUENTAS.md](docs/CUENTAS.md) | Evaluación: pasar a una arquitectura con usuarios |
| [docs/ACCESIBILIDAD.md](docs/ACCESIBILIDAD.md) | Teclado, lector de pantalla, límites conocidos |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Publicación y requisitos del hosting |
| [docs/CONTRIBUIR.md](docs/CONTRIBUIR.md) | Flujo de trabajo y convenciones |
| [docs/LICENCIAS.md](docs/LICENCIAS.md) | Licencias de datos, software, fuentes e iconos |
| [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) | Cómo contribuir y cómo reportar una vulnerabilidad |
| [CHANGELOG.md](CHANGELOG.md) | Cambios por versión |

## Publicación

El sitio vive en <https://visitzibata.com>, servido por un **Worker de Cloudflare con assets
estáticos**. Cada push a `main` ejecuta `.github/workflows/deploy.yml`: instalación → Gitleaks →
validación de datos → lint, tipos y tests → build → imágenes de vista previa → presupuesto de peso →
humo E2E → `wrangler deploy`. Si cualquier paso falla, no se publica nada.

Se compila y se publica desde GitHub Actions y **no** con la integración de Git de Cloudflare, a
propósito: esa integración compila por su cuenta y no corre las pruebas. El detalle, los secretos que
hacen falta y cómo verificar una publicación, en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).

Las pull requests ejecutan `.github/workflows/ci.yml`, que corre la suite E2E completa en las dos bases
(raíz y subdirectorio) y busca secretos con Gitleaks. Dependabot propone actualizaciones semanales.

### Otro hosting

`npm run build` genera `dist/`, que se puede publicar en cualquier servidor de archivos estáticos. Si
se sirve desde un subdirectorio: `BASE_PATH=/subdirectorio/ npm run build`.

No hay requisitos especiales: ni reescrituras, ni peticiones `Range`, ni cabeceras propias. Lo único
que conviene es que el servidor devuelva **404** para una ruta inexistente (el build genera
`404.html`) y que no añada una barra final a los archivos.

## Fuentes cartográficas y licencias

Datos © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL) y
[Overture Maps Foundation](https://docs.overturemaps.org/attribution/). Detalle de fuentes, fechas y
licencias de datos, software, fuentes tipográficas e iconos en [docs/LICENCIAS.md](docs/LICENCIAS.md) y
`data/geographic/manifest.json`. Decisiones y hallazgos iniciales en
[docs/PROPUESTA-TECNICA.md](docs/PROPUESTA-TECNICA.md).

## Licencia

Código bajo [MIT](LICENSE). Datos comerciales e investigación bajo
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es), citando "Visit Zibatá
(visitzibata.com)". Las capas del mapa derivan de OpenStreetMap y van bajo ODbL 1.0. El detalle, en
[docs/LICENCIAS.md](docs/LICENCIAS.md).
