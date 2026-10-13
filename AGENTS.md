# AGENTS.md

Guía para agentes y colaboradores. Contexto del producto y comandos en [README.md](README.md).

## Reglas del proyecto

- Sitio estático: nada de API keys ni dependencias de servicios externos en runtime, y la CSP lo
  fija (`connect-src 'self'`, sin un solo destino fuera). Lo único que corre en el servidor es
  `worker/`, que sirve los archivos, cuenta visitas y comparticiones por página y día (sin cookies,
  sin IP, sin nada por persona), guarda lo que marca cada quien bajo una cuenta anónima sin correo ni
  nombre, y recibe las sugerencias de "Sugiere un cambio" (lo que la persona escribió, sin colgar de
  ninguna cuenta). Si se cae, el sitio sigue: nada de eso puede romper la página, y hay pruebas que
  fijan lo que NO se guarda.
- El mapa es MapLibre con datos propios (`public/map`). Google Maps solo como enlace externo; nunca Google
  Places, scraping ni descarga de fotos de terceros.
- No inventar datos de negocios reales (horarios, teléfonos, descripciones, fotos). Sin publicidad,
  reservas ni rastreo, nunca.
- Sin reseñas ni notas públicas, y **la guía nunca publica una media**. Lo único de la comunidad
  que se ve es el conteo de corazones, y solo a partir de cinco. Las estrellas alimentan el orden,
  pero el servidor manda un empuje ya calculado y la media no llega al navegador: no es que la
  interfaz decida no enseñarla, es que no la recibe (ver [docs/CUENTAS.md](docs/CUENTAS.md)).
- Datos en `data/`, validados con los esquemas de `src/data/schemas.ts`. Textos de UI en `src/i18n/es.ts`.
- Procesamiento GIS solo en `scripts/map` (Node), nunca en el navegador.
- Imports relativos con extensión `.ts`/`.tsx` (los scripts corren con Node sin transpilar).

## Cómo se escribe aquí

- Nada de guion largo (—) ni de comillas angulares (" "): delatan texto generado. Con coma, punto,
  paréntesis o comillas dobles rectas alcanza.
- Vale para todo: textos de interfaz, comentarios del código, documentación, datos y mensajes de
  commit.

## Autoría

- **Nunca firmar nada a nombre de una herramienta.** Ni `Co-Authored-By` de un asistente, ni líneas
  de "generado con", ni en mensajes de commit, ni en descripciones de pull request, ni en issues. El
  proyecto lo firma una persona. Si tu configuración añade esa línea por omisión, quítala antes de
  commitear.

## Diseño

El sistema vive en [DESIGN.md](DESIGN.md): los tokens con su porqué, las reglas con nombre y lo que
el build carga como defecto sin que sea regla. La fuente de verdad de los valores sigue siendo
`src/styles/tokens.css`.

Cuatro herramientas y un hueco cada una, para que no se pisen:

| Capa | Herramienta | Cuándo |
|---|---|---|
| Conformidad, automática | `impeccable` (hook en cada edición, y `detect <url>`) | sola |
| Estructura y tipografía | `/hallmark audit` | antes de un cambio grande de UI |
| Movimiento | `review-animations` | si tocas una transición |
| Datos del peor caso | `break-ui` | al cerrar un componente |
| Catálogo de tells | `antislop-ui` | mientras se diseña, para consultar |

El hook solo salta con Edit y Write: si editas por script, corre el detector a mano. Las reglas
apagadas y su evidencia están en DESIGN.md; no se apaga una regla para que el contador baje.

## Antes de terminar un cambio

```bash
npm run check          # lint + tipos + tests + build
npm run test:e2e       # si tocaste UI o mapa
```

## Toolset

- delegation: on
- lean-code: on
- verify-loop: on
- rtk: on
- codegraph: off
- worktrees: off
- spec-kit / bmad / superpowers: off
- precommit-hooks: off
- lint-format: on (Biome)
- security-scan: on (Gitleaks en CI)
- ci-cd: on (GitHub Actions → Cloudflare Workers)
- a11y-perf: on (axe en E2E)
- dep-updates: on (Dependabot)
